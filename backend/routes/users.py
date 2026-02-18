from fastapi import APIRouter, HTTPException, Depends
from models import UserUpdate
from database import users_collection
from utils.auth import get_current_user

router = APIRouter()

@router.get("/")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    user = await users_collection.find_one({"id": current_user["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/")
async def update_user_profile(user_update: UserUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in user_update.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await users_collection.update_one(
        {"id": current_user["user_id"]},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = await users_collection.find_one({"id": current_user["user_id"]}, {"_id": 0, "password_hash": 0})
    return user
