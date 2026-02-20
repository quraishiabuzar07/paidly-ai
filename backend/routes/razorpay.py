from fastapi import APIRouter, HTTPException, Request, Depends
from database import invoices_collection, payments_collection, deliverables_collection, clients_collection, users_collection, subscriptions_collection
from utils.auth import get_current_user
import razorpay
import os
import hmac
import hashlib
import uuid
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
import logging

load_dotenv()
logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize Razorpay Client
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET")

razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
razorpay_client.set_app_details({"title": "ClientNudge AI", "version": "1.0"})

@router.post("/create-order")
async def create_razorpay_order(invoice_id: str, current_user: dict = Depends(get_current_user)):
    """Create Razorpay order for invoice payment"""
    try:
        # Get invoice
        invoice = await invoices_collection.find_one({"id": invoice_id, "user_id": current_user["user_id"]}, {"_id": 0})
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        if invoice["status"] == "paid":
            raise HTTPException(status_code=400, detail="Invoice already paid")
        
        # Convert amount to paise (Razorpay uses smallest currency unit)
        amount_in_paise = int(invoice["total_amount"] * 100)
        
        # Create Razorpay order
        razorpay_order = razorpay_client.order.create({
            "amount": amount_in_paise,
            "currency": invoice["currency"],
            "receipt": f"invoice_{invoice['invoice_number']}",
            "payment_capture": 1,  # Auto-capture payment
            "notes": {
                "invoice_id": invoice_id,
                "user_id": current_user["user_id"],
                "client_id": invoice["client_id"]
            }
        })
        
        # Create payment record
        payment_id = str(uuid.uuid4())
        payment_doc = {
            "id": payment_id,
            "invoice_id": invoice_id,
            "razorpay_order_id": razorpay_order["id"],
            "razorpay_payment_id": None,
            "amount": invoice["total_amount"],
            "currency": invoice["currency"],
            "status": "pending",
            "payment_method": "razorpay",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await payments_collection.insert_one(payment_doc)
        
        logger.info(f"Razorpay order created: {razorpay_order['id']} for invoice {invoice_id}")
        
        return {
            "order_id": razorpay_order["id"],
            "amount": amount_in_paise,
            "currency": invoice["currency"],
            "key_id": RAZORPAY_KEY_ID,
            "invoice_number": invoice["invoice_number"],
            "payment_id": payment_id
        }
    
    except razorpay.errors.BadRequestError as e:
        logger.error(f"Razorpay order creation failed: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Razorpay error: {str(e)}")
    except Exception as e:
        logger.error(f"Order creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create-subscription-order")
async def create_subscription_order(plan: str, current_user: dict = Depends(get_current_user)):
    """Create Razorpay order for subscription payment"""
    try:
        # Get user
        user = await users_collection.find_one({"id": current_user["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Plan pricing
        plan_prices = {
            "pro": 1900,  # ₹19 in paise
            "agency": 3900  # ₹39 in paise
        }
        
        if plan not in plan_prices:
            raise HTTPException(status_code=400, detail="Invalid plan")
        
        amount_in_paise = plan_prices[plan] * 100  # Convert to rupees and then paise
        
        # Create Razorpay order
        razorpay_order = razorpay_client.order.create({
            "amount": amount_in_paise,
            "currency": "INR",
            "receipt": f"subscription_{plan}_{user['id'][:8]}",
            "payment_capture": 1,
            "notes": {
                "user_id": user["id"],
                "plan": plan,
                "type": "subscription"
            }
        })
        
        logger.info(f"Razorpay subscription order created: {razorpay_order['id']} for user {user['id']}")
        
        return {
            "order_id": razorpay_order["id"],
            "amount": amount_in_paise,
            "currency": "INR",
            "key_id": RAZORPAY_KEY_ID,
            "plan": plan
        }
    
    except Exception as e:
        logger.error(f"Subscription order creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/verify-payment")
async def verify_payment(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
    current_user: dict = Depends(get_current_user)
):
    """Verify Razorpay payment signature"""
    try:
        # Generate signature
        message = f"{razorpay_order_id}|{razorpay_payment_id}"
        expected_signature = hmac.new(
            RAZORPAY_KEY_SECRET.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        # Verify signature
        if expected_signature != razorpay_signature:
            logger.error(f"Signature verification failed for payment {razorpay_payment_id}")
            raise HTTPException(status_code=400, detail="Invalid signature")
        
        # Find payment record
        payment = await payments_collection.find_one({"razorpay_order_id": razorpay_order_id}, {"_id": 0})
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        # Update payment status
        await payments_collection.update_one(
            {"razorpay_order_id": razorpay_order_id},
            {"$set": {
                "razorpay_payment_id": razorpay_payment_id,
                "status": "completed",
                "verified_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Update invoice status
        await invoices_collection.update_one(
            {"id": payment["invoice_id"]},
            {"$set": {
                "status": "paid",
                "paid_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Unlock deliverables (Pay-to-Unlock feature)
        await deliverables_collection.update_many(
            {"invoice_id": payment["invoice_id"]},
            {"$set": {"is_locked": False}}
        )
        
        # Update client payment stats
        invoice = await invoices_collection.find_one({"id": payment["invoice_id"]}, {"_id": 0})
        if invoice:
            await clients_collection.update_one(
                {"id": invoice["client_id"]},
                {"$inc": {"total_paid": invoice["total_amount"]}}
            )
        
        logger.info(f"Payment verified and invoice {payment['invoice_id']} marked as paid")
        
        return {"status": "success", "message": "Payment verified successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Payment verification failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/verify-subscription-payment")
async def verify_subscription_payment(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
    plan: str,
    current_user: dict = Depends(get_current_user)
):
    """Verify Razorpay subscription payment and activate subscription"""
    try:
        # Generate signature
        message = f"{razorpay_order_id}|{razorpay_payment_id}"
        expected_signature = hmac.new(
            RAZORPAY_KEY_SECRET.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        # Verify signature
        if expected_signature != razorpay_signature:
            raise HTTPException(status_code=400, detail="Invalid signature")
        
        # Calculate subscription end date (30 days from now)
        subscription_end = datetime.now(timezone.utc) + timedelta(days=30)
        
        # Update user subscription
        await users_collection.update_one(
            {"id": current_user["user_id"]},
            {"$set": {
                "subscription_plan": plan,
                "subscription_status": "active"
            }}
        )
        
        # Create/update subscription record
        subscription_id = str(uuid.uuid4())
        subscription_doc = {
            "id": subscription_id,
            "user_id": current_user["user_id"],
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "plan": plan,
            "status": "active",
            "start_date": datetime.now(timezone.utc).isoformat(),
            "end_date": subscription_end.isoformat(),
            "auto_renew": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await subscriptions_collection.insert_one(subscription_doc)
        
        logger.info(f"Subscription {plan} activated for user {current_user['user_id']}")
        
        return {
            "status": "success",
            "message": f"Subscription activated successfully",
            "plan": plan,
            "expires_at": subscription_end.isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Subscription verification failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhook")
async def razorpay_webhook(request: Request):
    """Handle Razorpay webhook events"""
    try:
        # Get webhook payload and signature
        payload = await request.body()
        signature = request.headers.get("X-Razorpay-Signature", "")
        
        # Verify webhook signature
        expected_signature = hmac.new(
            RAZORPAY_WEBHOOK_SECRET.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        if expected_signature != signature:
            logger.error("Webhook signature verification failed")
            raise HTTPException(status_code=400, detail="Invalid signature")
        
        # Parse webhook data
        import json
        webhook_data = json.loads(payload.decode())
        
        event = webhook_data.get("event")
        payment_entity = webhook_data.get("payload", {}).get("payment", {}).get("entity", {})
        
        logger.info(f"Received webhook event: {event}")
        
        # Handle different webhook events
        if event == "payment.captured":
            # Payment successful
            order_id = payment_entity.get("order_id")
            payment_id = payment_entity.get("id")
            
            # Find payment record
            payment = await payments_collection.find_one({"razorpay_order_id": order_id}, {"_id": 0})
            
            if payment:
                # Update payment status
                await payments_collection.update_one(
                    {"razorpay_order_id": order_id},
                    {"$set": {
                        "razorpay_payment_id": payment_id,
                        "status": "completed",
                        "webhook_event": event,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Update invoice status
                await invoices_collection.update_one(
                    {"id": payment["invoice_id"]},
                    {"$set": {
                        "status": "paid",
                        "paid_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                # Unlock deliverables
                await deliverables_collection.update_many(
                    {"invoice_id": payment["invoice_id"]},
                    {"$set": {"is_locked": False}}
                )
                
                logger.info(f"Webhook: Payment captured for order {order_id}")
        
        elif event == "payment.failed":
            # Payment failed
            order_id = payment_entity.get("order_id")
            
            await payments_collection.update_one(
                {"razorpay_order_id": order_id},
                {"$set": {
                    "status": "failed",
                    "webhook_event": event,
                    "error_reason": payment_entity.get("error_description"),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            logger.info(f"Webhook: Payment failed for order {order_id}")
        
        elif event == "subscription.charged":
            # Subscription renewal
            logger.info("Webhook: Subscription charged event received")
            # Handle subscription renewal if needed
        
        return {"status": "processed"}
    
    except Exception as e:
        logger.error(f"Webhook processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/payment-status/{order_id}")
async def get_payment_status(order_id: str, current_user: dict = Depends(get_current_user)):
    """Check payment status"""
    try:
        payment = await payments_collection.find_one({"razorpay_order_id": order_id}, {"_id": 0})
        
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        return {
            "status": payment.get("status"),
            "payment_id": payment.get("razorpay_payment_id"),
            "amount": payment.get("amount"),
            "currency": payment.get("currency")
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get payment status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
