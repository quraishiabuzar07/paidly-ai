from fastapi import APIRouter, HTTPException, Depends
from models import UserCreate, UserLogin, User
from database import users_collection
from utils.auth import hash_password, verify_password, create_token, get_current_user
import uuid
from datetime import datetime, timezone

router = APIRouter()

@router.post("/register")
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await users_collection.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "full_name": user_data.full_name,
        "base_currency": user_data.base_currency,
        "subscription_plan": "free",
        "subscription_status": "active",
        "invoice_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await users_collection.insert_one(user_doc)
    
    # Create token
    token = create_token(user_id, user_data.email)
    
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": user_data.email,
            "full_name": user_data.full_name,
            "base_currency": user_data.base_currency,
            "subscription_plan": "free"
        }
    }

@router.post("/login")
async def login(credentials: UserLogin):
    # Find user
    user = await users_collection.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create token
    token = create_token(user["id"], user["email"])
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "base_currency": user["base_currency"],
            "subscription_plan": user["subscription_plan"]
        }
    }

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    user = await users_collection.find_one({"id": current_user["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
