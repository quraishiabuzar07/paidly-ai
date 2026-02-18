from fastapi import APIRouter, HTTPException, Depends
from models import ClientCreate, Client
from database import clients_collection
from utils.auth import get_current_user
import uuid
from datetime import datetime, timezone
from typing import List

router = APIRouter()

@router.post("/", response_model=Client)
async def create_client(client_data: ClientCreate, current_user: dict = Depends(get_current_user)):
    client_id = str(uuid.uuid4())
    client_doc = {
        "id": client_id,
        "user_id": current_user["user_id"],
        "name": client_data.name,
        "email": client_data.email,
        "phone": client_data.phone,
        "company": client_data.company,
        "payment_score": "medium",
        "avg_payment_days": 0.0,
        "total_paid": 0.0,
        "total_pending": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await clients_collection.insert_one(client_doc)
    return Client(**client_doc)

@router.get("/", response_model=List[Client])
async def get_clients(current_user: dict = Depends(get_current_user)):
    clients = await clients_collection.find({"user_id": current_user["user_id"]}, {"_id": 0}).to_list(1000)
    return [Client(**client) for client in clients]

@router.get("/{client_id}", response_model=Client)
async def get_client(client_id: str, current_user: dict = Depends(get_current_user)):
    client = await clients_collection.find_one({"id": client_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return Client(**client)

@router.put("/{client_id}", response_model=Client)
async def update_client(client_id: str, client_data: ClientCreate, current_user: dict = Depends(get_current_user)):
    update_data = client_data.model_dump()
    
    result = await clients_collection.update_one(
        {"id": client_id, "user_id": current_user["user_id"]},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    
    client = await clients_collection.find_one({"id": client_id}, {"_id": 0})
    return Client(**client)

@router.delete("/{client_id}")
async def delete_client(client_id: str, current_user: dict = Depends(get_current_user)):
    result = await clients_collection.delete_one({"id": client_id, "user_id": current_user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"message": "Client deleted successfully"}
