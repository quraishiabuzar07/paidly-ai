from fastapi import APIRouter, HTTPException, Depends
from models import ReminderGenerate, Reminder
from database import reminders_collection, invoices_collection, clients_collection, users_collection
from utils.auth import get_current_user
from emergentintegrations.llm.chat import LlmChat, UserMessage
import uuid
from datetime import datetime, timezone
import os
import asyncio
import resend
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

EMERGENT_LLM_KEY = os.getenv("EMERGENT_LLM_KEY")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "noreply@clientnudge.ai")

resend.api_key = RESEND_API_KEY

async def generate_ai_reminder(invoice_data: dict, client_data: dict, reminder_type: str, user_plan: str) -> str:
    """Generate AI-powered reminder message"""
    
    # Check if user has Pro/Agency plan
    if user_plan == "free":
        # Return template-based reminder for free users
        templates = {
            "polite": f"Hi {client_data['name']},\\n\\nThis is a friendly reminder that invoice {invoice_data['invoice_number']} for ${invoice_data['total_amount']} {invoice_data['currency']} is due on {invoice_data['due_date']}.\\n\\nPlease let me know if you have any questions.\\n\\nBest regards",
            "firm": f"Dear {client_data['name']},\\n\\nInvoice {invoice_data['invoice_number']} for ${invoice_data['total_amount']} {invoice_data['currency']} is now overdue. Please arrange payment at your earliest convenience.\\n\\nThank you",
            "final": f"URGENT: Dear {client_data['name']},\\n\\nThis is a final notice for invoice {invoice_data['invoice_number']} (${invoice_data['total_amount']} {invoice_data['currency']}), which is now significantly overdue. Please settle this immediately to avoid further action.\\n\\nRegards",
            "late_fee_warning": f"Dear {client_data['name']},\\n\\nPlease note that invoice {invoice_data['invoice_number']} is overdue. As per our terms, a late fee of {invoice_data.get('late_fee_percentage', 5)}% will be applied if payment is not received promptly.\\n\\nCurrent amount due: ${invoice_data['total_amount']} {invoice_data['currency']}\\n\\nThank you"
        }
        return templates.get(reminder_type, templates["polite"])
    
    # AI-powered reminder for Pro/Agency users
    prompt_context = f"""Generate a professional payment reminder email for:
    
Client: {client_data['name']} ({client_data['company'] or 'Individual'})
Invoice Number: {invoice_data['invoice_number']}
Amount: ${invoice_data['total_amount']} {invoice_data['currency']}
Due Date: {invoice_data['due_date']}
Status: {invoice_data['status']}
Reminder Type: {reminder_type}

Guidelines:
- Be professional and {reminder_type}
- Keep it concise (3-4 sentences)
- Don't use subject line
- Don't sign off with a name
- Focus on the payment request
"""
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"reminder-{invoice_data['id']}-{datetime.now().timestamp()}\",
            system_message=\"You are a professional payment reminder assistant. Generate concise, professional reminder messages.\"
        ).with_model(\"openai\", \"gpt-5.2\")
        
        user_message = UserMessage(text=prompt_context)
        response = await chat.send_message(user_message)
        
        return response
    except Exception as e:
        # Fallback to template if AI fails
        return f\"Reminder: Invoice {invoice_data['invoice_number']} for ${invoice_data['total_amount']} {invoice_data['currency']} requires your attention. Due date: {invoice_data['due_date']}.\"

@router.post(\"/generate\")
async def generate_reminder(reminder_data: ReminderGenerate, current_user: dict = Depends(get_current_user)):
    # Get invoice
    invoice = await invoices_collection.find_one({\"id\": reminder_data.invoice_id, \"user_id\": current_user[\"user_id\"]}, {\"_id\": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail=\"Invoice not found\")
    
    # Get client
    client = await clients_collection.find_one({\"id\": invoice[\"client_id\"]}, {\"_id\": 0})
    if not client:
        raise HTTPException(status_code=404, detail=\"Client not found\")
    
    # Get user plan
    user = await users_collection.find_one({\"id\": current_user[\"user_id\"]}, {\"_id\": 0})
    
    # Generate AI message
    message = await generate_ai_reminder(invoice, client, reminder_data.reminder_type, user[\"subscription_plan\"])
    
    # Create reminder record
    reminder_id = str(uuid.uuid4())
    reminder_doc = {
        \"id\": reminder_id,
        \"invoice_id\": reminder_data.invoice_id,
        \"reminder_type\": reminder_data.reminder_type,
        \"message\": message,
        \"sent_at\": None,
        \"channel\": \"email\",
        \"created_at\": datetime.now(timezone.utc).isoformat()
    }
    
    await reminders_collection.insert_one(reminder_doc)
    
    return Reminder(**reminder_doc)

@router.post(\"/send/{reminder_id}\")
async def send_reminder(reminder_id: str, current_user: dict = Depends(get_current_user)):
    # Get reminder
    reminder = await reminders_collection.find_one({\"id\": reminder_id}, {\"_id\": 0})
    if not reminder:
        raise HTTPException(status_code=404, detail=\"Reminder not found\")
    
    # Get invoice
    invoice = await invoices_collection.find_one({\"id\": reminder[\"invoice_id\"], \"user_id\": current_user[\"user_id\"]}, {\"_id\": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail=\"Invoice not found\")
    
    # Get client
    client = await clients_collection.find_one({\"id\": invoice[\"client_id\"]}, {\"_id\": 0})
    if not client:
        raise HTTPException(status_code=404, detail=\"Client not found\")
    
    # Get user info
    user = await users_collection.find_one({\"id\": current_user[\"user_id\"]}, {\"_id\": 0})
    
    # Send email via Resend
    html_content = f\"\"\"
    <div style=\"font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;\">
        <h2 style=\"color: #4361EE;\">Payment Reminder</h2>
        <div style=\"white-space: pre-wrap; line-height: 1.6;\">
            {reminder['message']}
        </div>
        <hr style=\"margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;\">
        <p style=\"font-size: 14px; color: #6b7280;\">
            <strong>Invoice Details:</strong><br>
            Invoice #: {invoice['invoice_number']}<br>
            Amount: ${invoice['total_amount']} {invoice['currency']}<br>
            Due Date: {invoice['due_date']}
        </p>
        <a href=\"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/invoice/{invoice['id']}\" 
           style=\"display: inline-block; background: #4361EE; color: white; padding: 12px 24px; 
                  text-decoration: none; border-radius: 6px; margin-top: 20px;\">
            View & Pay Invoice
        </a>
        <p style=\"margin-top: 30px; font-size: 12px; color: #9ca3af;\">
            Sent from {user['full_name']} via ClientNudge AI
        </p>
    </div>
    \"\"\"
    
    params = {
        \"from\": SENDER_EMAIL,
        \"to\": [client[\"email\"]],
        \"subject\": f\"Payment Reminder: Invoice {invoice['invoice_number']}\",
        \"html\": html_content
    }
    
    try:
        email = await asyncio.to_thread(resend.Emails.send, params)
        
        # Update reminder as sent
        await reminders_collection.update_one(
            {\"id\": reminder_id},
            {\"$set\": {\"sent_at\": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {\"message\": \"Reminder sent successfully\", \"email_id\": email.get(\"id\")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f\"Failed to send reminder: {str(e)}\")

@router.get(\"/invoice/{invoice_id}\")
async def get_invoice_reminders(invoice_id: str, current_user: dict = Depends(get_current_user)):
    # Verify invoice belongs to user
    invoice = await invoices_collection.find_one({\"id\": invoice_id, \"user_id\": current_user[\"user_id\"]}, {\"_id\": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail=\"Invoice not found\")
    
    reminders = await reminders_collection.find({\"invoice_id\": invoice_id}, {\"_id\": 0}).to_list(1000)
    return [Reminder(**reminder) for reminder in reminders]
