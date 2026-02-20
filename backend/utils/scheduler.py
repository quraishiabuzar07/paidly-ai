from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timezone, timedelta
from database import invoices_collection, clients_collection, users_collection, reminders_collection
import asyncio
import logging
import os
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
import resend

load_dotenv()
logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.getenv("EMERGENT_LLM_KEY")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "noreply@clientnudge.ai")

resend.api_key = RESEND_API_KEY

scheduler = BackgroundScheduler()

async def generate_ai_reminder(invoice_data, client_data, reminder_type, user_plan):
    """Generate AI reminder message"""
    if user_plan == "free":
        templates = {
            "polite": f"Hi {client_data['name']},\n\nFriendly reminder that invoice {invoice_data['invoice_number']} for ${invoice_data['total_amount']} {invoice_data['currency']} is due soon on {invoice_data['due_date']}.\n\nThank you!",
            "due_today": f"Hi {client_data['name']},\n\nJust a reminder that invoice {invoice_data['invoice_number']} for ${invoice_data['total_amount']} {invoice_data['currency']} is due today.\n\nPlease arrange payment at your earliest convenience.",
            "firm": f"Dear {client_data['name']},\n\nInvoice {invoice_data['invoice_number']} for ${invoice_data['total_amount']} {invoice_data['currency']} is now overdue. Please arrange payment as soon as possible.\n\nThank you",
            "final": f"URGENT: Dear {client_data['name']},\n\nThis is a final notice for invoice {invoice_data['invoice_number']} (${invoice_data['total_amount']} {invoice_data['currency']}), which is significantly overdue.\n\nPlease settle immediately."
        }
        return templates.get(reminder_type, templates["polite"])
    
    # AI-powered reminder for Pro/Agency users
    prompt = f"""Generate a professional payment reminder for:
    
Client: {client_data['name']}
Invoice: {invoice_data['invoice_number']}
Amount: ${invoice_data['total_amount']} {invoice_data['currency']}
Due Date: {invoice_data['due_date']}
Type: {reminder_type}

Be professional and {reminder_type}. Keep it 3-4 sentences."""
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"auto-reminder-{invoice_data['id']}",
            system_message="You are a professional payment reminder assistant."
        ).with_model("openai", "gpt-5.2")
        
        response = await chat.send_message(UserMessage(text=prompt))
        return response
    except Exception as e:
        logger.error(f"AI reminder generation failed: {e}")
        return f"Reminder: Invoice {invoice_data['invoice_number']} requires attention. Due: {invoice_data['due_date']}."

async def send_reminder_email(invoice, client, user, reminder_type, message):
    """Send reminder email to client"""
    try:
        html_content = f"""
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4361EE;">Payment Reminder</h2>
            <div style="white-space: pre-wrap; line-height: 1.6;">
                {message}
            </div>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 14px; color: #6b7280;">
                <strong>Invoice Details:</strong><br>
                Invoice #: {invoice['invoice_number']}<br>
                Amount: ${invoice['total_amount']} {invoice['currency']}<br>
                Due Date: {invoice['due_date']}
            </p>
            <a href="{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/portal/{invoice['id']}" 
               style="display: inline-block; background: #4361EE; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; margin-top: 20px;">
                View & Pay Invoice
            </a>
            <p style="margin-top: 30px; font-size: 12px; color: #9ca3af;">
                Automated reminder from {user['full_name']} via ClientNudge AI
            </p>
        </div>
        """
        
        params = {
            "from": SENDER_EMAIL,
            "to": [client["email"]],
            "subject": f"Payment Reminder: Invoice {invoice['invoice_number']}",
            "html": html_content
        }
        
        # Send email synchronously (called from async context)
        email = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Reminder sent for invoice {invoice['invoice_number']} to {client['email']}")
        return True
    except Exception as e:
        logger.error(f"Failed to send reminder email: {e}")
        return False

async def check_and_send_reminders():
    """Check all invoices and send automated reminders based on due dates"""
    try:
        logger.info("Running automated reminder check...")
        now = datetime.now(timezone.utc)
        
        # Get all unpaid invoices with auto_reminders enabled
        invoices = await invoices_collection.find({
            "status": {"$in": ["sent", "viewed", "overdue"]},
            "auto_reminders": True
        }, {"_id": 0}).to_list(10000)
        
        for invoice in invoices:
            due_date = datetime.fromisoformat(invoice['due_date'].replace('Z', '+00:00'))
            days_until_due = (due_date - now).days
            
            # Get last reminder sent
            last_reminder = await reminders_collection.find_one(
                {"invoice_id": invoice['id'], "sent_at": {"$ne": None}},
                {"_id": 0},
                sort=[("sent_at", -1)]
            )
            
            last_sent_date = None
            if last_reminder and last_reminder.get('sent_at'):
                last_sent_date = datetime.fromisoformat(last_reminder['sent_at'].replace('Z', '+00:00'))
            
            # Determine if we should send a reminder
            should_send = False
            reminder_type = None
            
            # 3 days before due (only if no reminder sent yet)
            if days_until_due == 3 and not last_sent_date:
                should_send = True
                reminder_type = "polite"
            
            # On due date
            elif days_until_due == 0 and (not last_sent_date or (now - last_sent_date).days >= 1):
                should_send = True
                reminder_type = "due_today"
            
            # 1 day overdue
            elif days_until_due == -1 and (not last_sent_date or (now - last_sent_date).days >= 1):
                should_send = True
                reminder_type = "firm"
                # Update invoice status to overdue
                await invoices_collection.update_one(
                    {"id": invoice['id']},
                    {"$set": {"status": "overdue"}}
                )
            
            # 7 days overdue - final reminder with late fee
            elif days_until_due <= -7 and (not last_sent_date or (now - last_sent_date).days >= 3):
                should_send = True
                reminder_type = "final"
                
                # Apply late fee if enabled and not already applied
                if invoice['late_fee_enabled'] and invoice['late_fee_amount'] == 0:
                    late_fee = invoice['total_amount'] * (invoice['late_fee_percentage'] / 100)
                    new_total = invoice['total_amount'] + late_fee
                    await invoices_collection.update_one(
                        {"id": invoice['id']},
                        {"$set": {
                            "late_fee_amount": round(late_fee, 2),
                            "total_amount": round(new_total, 2)
                        }}
                    )
                    invoice['late_fee_amount'] = late_fee
                    invoice['total_amount'] = new_total
            
            if should_send:
                # Get client and user info
                client = await clients_collection.find_one({"id": invoice['client_id']}, {"_id": 0})
                user = await users_collection.find_one({"id": invoice['user_id']}, {"_id": 0})
                
                if client and user:
                    # Generate reminder message
                    message = await generate_ai_reminder(invoice, client, reminder_type, user['subscription_plan'])
                    
                    # Send email
                    sent = await send_reminder_email(invoice, client, user, reminder_type, message)
                    
                    if sent:
                        # Save reminder record
                        import uuid
                        reminder_doc = {
                            "id": str(uuid.uuid4()),
                            "invoice_id": invoice['id'],
                            "reminder_type": reminder_type,
                            "message": message,
                            "sent_at": now.isoformat(),
                            "channel": "email",
                            "created_at": now.isoformat()
                        }
                        await reminders_collection.insert_one(reminder_doc)
                        logger.info(f"Automated reminder sent: {invoice['invoice_number']} ({reminder_type})")
        
        logger.info(f"Automated reminder check completed. Checked {len(invoices)} invoices.")
    except Exception as e:
        logger.error(f"Error in automated reminder check: {e}")

def run_reminder_check():
    """Wrapper to run async function in sync scheduler"""
    asyncio.run(check_and_send_reminders())

def start_scheduler():
    """Start the background scheduler for automated reminders and subscription checks"""
    # Run daily at 9 AM UTC for reminders
    scheduler.add_job(
        run_reminder_check,
        CronTrigger(hour=9, minute=0),
        id='automated_reminders',
        replace_existing=True
    )
    
    # Run daily at 10 AM UTC for subscription expiry check
    scheduler.add_job(
        run_subscription_check,
        CronTrigger(hour=10, minute=0),
        id='subscription_check',
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Automated scheduler started (reminders at 9 AM, subscriptions at 10 AM UTC)")

def stop_scheduler():
    """Stop the scheduler"""
    scheduler.shutdown()
    logger.info("Scheduler stopped")


async def check_and_cancel_expired_subscriptions():
    """Check and cancel expired subscriptions (30 days unpaid)"""
    try:
        logger.info("Checking for expired subscriptions...")
        now = datetime.now(timezone.utc)
        
        from database import subscriptions_collection, users_collection
        
        # Get all active subscriptions
        subscriptions = await subscriptions_collection.find({"status": "active"}, {"_id": 0}).to_list(10000)
        
        for subscription in subscriptions:
            if not subscription.get("end_date"):
                continue
            
            end_date = datetime.fromisoformat(subscription["end_date"].replace('Z', '+00:00'))
            
            # Check if subscription has expired
            if now > end_date:
                # Cancel subscription
                await subscriptions_collection.update_one(
                    {"id": subscription["id"]},
                    {"$set": {
                        "status": "cancelled",
                        "cancelled_at": now.isoformat(),
                        "cancellation_reason": "expired_unpaid"
                    }}
                )
                
                # Downgrade user to free plan
                await users_collection.update_one(
                    {"id": subscription["user_id"]},
                    {"$set": {
                        "subscription_plan": "free",
                        "subscription_status": "inactive"
                    }}
                )
                
                logger.info(f"Subscription {subscription['id']} cancelled due to expiry")
        
        logger.info(f"Checked {len(subscriptions)} subscriptions")
    except Exception as e:
        logger.error(f"Error checking expired subscriptions: {e}")

def run_subscription_check():
    """Wrapper to run async subscription check"""
    asyncio.run(check_and_cancel_expired_subscriptions())
