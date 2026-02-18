from fastapi import APIRouter, HTTPException, Depends
from models import DashboardStats
from database import invoices_collection, payments_collection, clients_collection
from utils.auth import get_current_user
from datetime import datetime, timezone, timedelta

router = APIRouter()

@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    # Get all invoices for user
    invoices = await invoices_collection.find({"user_id": current_user["user_id"]}, {"_id": 0}).to_list(10000)
    
    total_outstanding = 0.0
    paid_this_month = 0.0
    overdue_amount = 0.0
    late_fee_collected = 0.0
    payment_days = []
    
    total_invoices = len(invoices)
    paid_invoices = 0
    pending_invoices = 0
    overdue_invoices = 0
    
    now = datetime.now(timezone.utc)
    first_day_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    for invoice in invoices:
        status = invoice["status"]
        amount = invoice["total_amount"]
        
        if status == "paid":
            paid_invoices += 1
            late_fee_collected += invoice.get("late_fee_amount", 0.0)
            
            # Check if paid this month
            if invoice.get("paid_at"):
                paid_at = datetime.fromisoformat(invoice["paid_at"].replace('Z', '+00:00'))
                if paid_at >= first_day_of_month:
                    paid_this_month += amount
                
                # Calculate payment days
                created_at = datetime.fromisoformat(invoice["created_at"].replace('Z', '+00:00'))
                days_to_pay = (paid_at - created_at).days
                payment_days.append(days_to_pay)
        
        elif status in ["sent", "viewed"]:
            pending_invoices += 1
            total_outstanding += amount
            
            # Check if overdue
            due_date = datetime.fromisoformat(invoice["due_date"].replace('Z', '+00:00'))
            if now > due_date:
                overdue_invoices += 1
                overdue_amount += amount
        
        elif status == "overdue":
            overdue_invoices += 1
            overdue_amount += amount
            total_outstanding += amount
    
    # Calculate average payment time
    average_payment_time = sum(payment_days) / len(payment_days) if payment_days else 0.0
    
    return DashboardStats(
        total_outstanding=round(total_outstanding, 2),
        paid_this_month=round(paid_this_month, 2),
        overdue_amount=round(overdue_amount, 2),
        average_payment_time=round(average_payment_time, 1),
        late_fee_collected=round(late_fee_collected, 2),
        total_invoices=total_invoices,
        paid_invoices=paid_invoices,
        pending_invoices=pending_invoices,
        overdue_invoices=overdue_invoices
    )

@router.get("/revenue-trend")
async def get_revenue_trend(current_user: dict = Depends(get_current_user)):
    # Get paid invoices from last 6 months
    six_months_ago = datetime.now(timezone.utc) - timedelta(days=180)
    
    invoices = await invoices_collection.find({
        "user_id": current_user["user_id"],
        "status": "paid",
        "paid_at": {"$exists": True}
    }, {"_id": 0}).to_list(10000)
    
    # Group by month
    monthly_revenue = {}
    
    for invoice in invoices:
        paid_at = datetime.fromisoformat(invoice["paid_at"].replace('Z', '+00:00'))
        if paid_at >= six_months_ago:
            month_key = paid_at.strftime("%Y-%m")
            if month_key not in monthly_revenue:
                monthly_revenue[month_key] = 0.0
            monthly_revenue[month_key] += invoice["total_amount"]
    
    # Format for chart
    trend_data = []
    for month, revenue in sorted(monthly_revenue.items()):
        trend_data.append({
            "month": month,
            "revenue": round(revenue, 2)
        })
    
    return trend_data

@router.get("/client-scores")
async def get_client_scores(current_user: dict = Depends(get_current_user)):
    clients = await clients_collection.find({"user_id": current_user["user_id"]}, {"_id": 0}).to_list(1000)
    
    scored_clients = []
    for client in clients:
        scored_clients.append({
            "id": client["id"],
            "name": client["name"],
            "payment_score": client.get("payment_score", "medium"),
            "avg_payment_days": client.get("avg_payment_days", 0),
            "total_paid": client.get("total_paid", 0),
            "total_pending": client.get("total_pending", 0)
        })
    
    return scored_clients
