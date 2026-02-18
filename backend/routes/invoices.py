from fastapi import APIRouter, HTTPException, Depends
from models import InvoiceCreate, Invoice, InvoiceItem
from database import invoices_collection, invoice_items_collection, clients_collection, projects_collection, users_collection, deliverables_collection
from utils.auth import get_current_user
from utils.invoice_helpers import calculate_invoice_totals, generate_invoice_number
import uuid
from datetime import datetime, timezone
from typing import List

router = APIRouter()

SUBSCRIPTION_LIMITS = {
    "free": 3,
    "pro": float("inf"),
    "agency": float("inf")
}

@router.post("/", response_model=Invoice)
async def create_invoice(invoice_data: InvoiceCreate, current_user: dict = Depends(get_current_user)):
    # Check subscription limits
    user = await users_collection.find_one({"id": current_user["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    invoice_count = user.get("invoice_count", 0)
    limit = SUBSCRIPTION_LIMITS.get(user["subscription_plan"], 3)
    
    if invoice_count >= limit:
        raise HTTPException(
            status_code=403, 
            detail=f"Invoice limit reached for {user['subscription_plan']} plan. Upgrade to Pro for unlimited invoices."
        )
    
    # Verify client exists
    client = await clients_collection.find_one({"id": invoice_data.client_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Calculate totals
    totals = calculate_invoice_totals(
        invoice_data.items,
        invoice_data.tax_percentage,
        invoice_data.discount_type,
        invoice_data.discount_value,
        invoice_data.late_fee_enabled,
        invoice_data.late_fee_percentage,
        invoice_data.due_date
    )
    
    # Get exchange rate (default to 1 for same currency)
    exchange_rate = 1.0
    
    invoice_id = str(uuid.uuid4())
    invoice_number = generate_invoice_number()
    
    invoice_doc = {
        "id": invoice_id,
        "user_id": current_user["user_id"],
        "client_id": invoice_data.client_id,
        "project_id": invoice_data.project_id,
        "invoice_number": invoice_number,
        "subtotal": totals["subtotal"],
        "tax_amount": totals["tax_amount"],
        "tax_percentage": invoice_data.tax_percentage,
        "discount_amount": totals["discount_amount"],
        "discount_type": invoice_data.discount_type,
        "discount_value": invoice_data.discount_value,
        "late_fee_amount": totals["late_fee_amount"],
        "late_fee_enabled": invoice_data.late_fee_enabled,
        "late_fee_percentage": invoice_data.late_fee_percentage,
        "late_fee_days": invoice_data.late_fee_days,
        "total_amount": totals["total_amount"],
        "currency": invoice_data.currency,
        "exchange_rate": exchange_rate,
        "due_date": invoice_data.due_date,
        "status": "draft",
        "auto_reminders": invoice_data.auto_reminders,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "sent_at": None,
        "paid_at": None
    }
    
    await invoices_collection.insert_one(invoice_doc)
    
    # Create invoice items
    for item_data in invoice_data.items:
        item_id = str(uuid.uuid4())
        item_amount = item_data.quantity * item_data.rate
        item_doc = {
            "id": item_id,
            "invoice_id": invoice_id,
            "description": item_data.description,
            "quantity": item_data.quantity,
            "rate": item_data.rate,
            "amount": round(item_amount, 2)
        }
        await invoice_items_collection.insert_one(item_doc)
    
    # Update invoice count
    await users_collection.update_one(
        {"id": current_user["user_id"]},
        {"$inc": {"invoice_count": 1}}
    )
    
    return Invoice(**invoice_doc)

@router.get("/", response_model=List[Invoice])
async def get_invoices(current_user: dict = Depends(get_current_user)):
    invoices = await invoices_collection.find({"user_id": current_user["user_id"]}, {"_id": 0}).to_list(1000)
    return [Invoice(**invoice) for invoice in invoices]

@router.get("/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str, current_user: dict = Depends(get_current_user)):
    invoice = await invoices_collection.find_one({"id": invoice_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return Invoice(**invoice)

@router.get("/{invoice_id}/items", response_model=List[InvoiceItem])
async def get_invoice_items(invoice_id: str, current_user: dict = Depends(get_current_user)):
    # Verify invoice exists and belongs to user
    invoice = await invoices_collection.find_one({"id": invoice_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    items = await invoice_items_collection.find({"invoice_id": invoice_id}, {"_id": 0}).to_list(1000)
    return [InvoiceItem(**item) for item in items]

@router.put("/{invoice_id}/send")
async def send_invoice(invoice_id: str, current_user: dict = Depends(get_current_user)):
    invoice = await invoices_collection.find_one({"id": invoice_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    await invoices_collection.update_one(
        {"id": invoice_id},
        {"$set": {
            "status": "sent",
            "sent_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Invoice sent successfully"}

@router.put("/{invoice_id}/mark-viewed")
async def mark_invoice_viewed(invoice_id: str):
    # Public endpoint for client portal
    invoice = await invoices_collection.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice["status"] == "sent":
        await invoices_collection.update_one(
            {"id": invoice_id},
            {"$set": {"status": "viewed"}}
        )
    
    return {"message": "Invoice marked as viewed"}

@router.get("/public/{invoice_id}")
async def get_public_invoice(invoice_id: str):
    """Public endpoint for client portal"""
    invoice = await invoices_collection.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Get invoice items
    items = await invoice_items_collection.find({"invoice_id": invoice_id}, {"_id": 0}).to_list(1000)
    
    # Get deliverables
    deliverables = await deliverables_collection.find({"invoice_id": invoice_id}, {"_id": 0}).to_list(1000)
    
    # Get client info
    client = await clients_collection.find_one({"id": invoice["client_id"]}, {"_id": 0})
    
    # Get user/company info
    user = await users_collection.find_one({"id": invoice["user_id"]}, {"_id": 0, "password_hash": 0})
    
    return {
        "invoice": Invoice(**invoice),
        "items": [InvoiceItem(**item) for item in items],
        "deliverables": deliverables,
        "client": client,
        "company": {
            "name": user.get("full_name", ""),
            "email": user.get("email", "")
        }
    }
