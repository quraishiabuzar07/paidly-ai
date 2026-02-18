from datetime import datetime, timezone
from typing import List
from models import InvoiceItemCreate

def calculate_invoice_totals(
    items: List[InvoiceItemCreate],
    tax_percentage: float,
    discount_type: str,
    discount_value: float,
    late_fee_enabled: bool,
    late_fee_percentage: float,
    due_date: str
) -> dict:
    # Calculate subtotal
    subtotal = sum(item.quantity * item.rate for item in items)
    
    # Calculate discount
    discount_amount = 0.0
    if discount_type == "percentage":
        discount_amount = subtotal * (discount_value / 100)
    elif discount_type == "fixed":
        discount_amount = discount_value
    
    # Calculate tax on discounted amount
    taxable_amount = subtotal - discount_amount
    tax_amount = taxable_amount * (tax_percentage / 100)
    
    # Calculate late fee if applicable
    late_fee_amount = 0.0
    if late_fee_enabled:
        due_date_obj = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        if now > due_date_obj:
            late_fee_amount = (subtotal - discount_amount) * (late_fee_percentage / 100)
    
    # Calculate total
    total_amount = subtotal - discount_amount + tax_amount + late_fee_amount
    
    return {
        "subtotal": round(subtotal, 2),
        "discount_amount": round(discount_amount, 2),
        "tax_amount": round(tax_amount, 2),
        "late_fee_amount": round(late_fee_amount, 2),
        "total_amount": round(total_amount, 2)
    }

def generate_invoice_number() -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"INV-{timestamp}"
