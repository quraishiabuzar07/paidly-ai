from fastapi import APIRouter, HTTPException, Depends
from database import users_collection, subscriptions_collection
from utils.auth import get_current_user
from datetime import datetime, timezone
import uuid

router = APIRouter()

@router.post("/upgrade")
async def upgrade_subscription(plan: str, current_user: dict = Depends(get_current_user)):
    if plan not in ["pro", "agency"]:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    # Update user subscription
    await users_collection.update_one(
        {"id": current_user["user_id"]},
        {"$set": {
            "subscription_plan": plan,
            "subscription_status": "active"
        }}
    )
    
    # Create subscription record
    subscription_id = str(uuid.uuid4())
    subscription_doc = {
        "id": subscription_id,
        "user_id": current_user["user_id"],
        "stripe_subscription_id": None,
        "plan": plan,
        "status": "active",
        "current_period_end": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await subscriptions_collection.insert_one(subscription_doc)
    
    return {"message": f"Successfully upgraded to {plan} plan"}

@router.get("/subscription")
async def get_subscription(current_user: dict = Depends(get_current_user)):
    user = await users_collection.find_one({"id": current_user["user_id"]}, {"_id": 0, "password_hash": 0})
    subscription = await subscriptions_collection.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    
    return {
        "plan": user.get("subscription_plan", "free"),
        "status": user.get("subscription_status", "active"),
        "invoice_count": user.get("invoice_count", 0),
        "subscription_details": subscription
    }


@router.post("/trigger-reminders")
async def trigger_reminders_manually(current_user: dict = Depends(get_current_user)):
    """Manually trigger automated reminder check (for testing/admin)"""
    from utils.scheduler import check_and_send_reminders
    
    try:
        await check_and_send_reminders()
        return {"message": "Reminder check completed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to run reminder check: {str(e)}")
