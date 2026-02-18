from fastapi import APIRouter, HTTPException, Depends, Request
from models import Payment
from database import payments_collection, invoices_collection, deliverables_collection, clients_collection
from utils.auth import get_current_user
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse, CheckoutStatusResponse
import uuid
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

STRIPE_API_KEY = os.getenv("STRIPE_API_KEY")

@router.post("/create-checkout-session")
async def create_checkout_session(request: Request, invoice_id: str, origin_url: str):
    # Get invoice
    invoice = await invoices_collection.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice["status"] == "paid":
        raise HTTPException(status_code=400, detail="Invoice already paid")
    
    # Initialize Stripe
    webhook_url = f"{origin_url}/api/payments/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Create checkout session
    success_url = f"{origin_url}/invoice/{invoice_id}/success?session_id={{{{CHECKOUT_SESSION_ID}}}}"
    cancel_url = f"{origin_url}/invoice/{invoice_id}"
    
    checkout_request = CheckoutSessionRequest(
        amount=invoice["total_amount"],
        currency=invoice["currency"].lower(),
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "invoice_id": invoice_id,
            "user_id": invoice["user_id"],
            "client_id": invoice["client_id"]
        }
    )
    
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment record
    payment_id = str(uuid.uuid4())
    payment_doc = {
        "id": payment_id,
        "invoice_id": invoice_id,
        "stripe_session_id": session.session_id,
        "stripe_payment_id": None,
        "amount": invoice["total_amount"],
        "currency": invoice["currency"],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await payments_collection.insert_one(payment_doc)
    
    return {"url": session.url, "session_id": session.session_id}

@router.get("/checkout-status/{session_id}")
async def get_checkout_status(session_id: str):
    # Get payment record
    payment = await payments_collection.find_one({"stripe_session_id": session_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # If already completed, return early
    if payment["status"] == "completed":
        return Payment(**payment)
    
    # Check Stripe status
    webhook_url = "https://placeholder.com/webhook"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    try:
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        if status.payment_status == "paid" and payment["status"] != "completed":
            # Update payment
            await payments_collection.update_one(
                {"stripe_session_id": session_id},
                {"$set": {
                    "status": "completed",
                    "stripe_payment_id": session_id
                }}
            )
            
            # Update invoice
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
            
            # Update client payment stats
            invoice = await invoices_collection.find_one({"id": payment["invoice_id"]}, {"_id": 0})
            if invoice:
                await clients_collection.update_one(
                    {"id": invoice["client_id"]},
                    {"$inc": {"total_paid": invoice["total_amount"]}}
                )
            
            payment["status"] = "completed"
        
        return Payment(**payment)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking payment status: {str(e)}")

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    webhook_url = "https://placeholder.com/webhook"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            session_id = webhook_response.session_id
            
            # Find payment
            payment = await payments_collection.find_one({"stripe_session_id": session_id}, {"_id": 0})
            if payment and payment["status"] != "completed":
                # Update payment
                await payments_collection.update_one(
                    {"stripe_session_id": session_id},
                    {"$set": {
                        "status": "completed",
                        "stripe_payment_id": webhook_response.event_id
                    }}
                )
                
                # Update invoice
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
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
