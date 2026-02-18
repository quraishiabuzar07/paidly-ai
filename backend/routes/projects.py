from fastapi import APIRouter, HTTPException, Depends
from models import ProjectCreate, Project, ProjectLogCreate, ProjectLog
from database import projects_collection, project_logs_collection, clients_collection
from utils.auth import get_current_user
import uuid
from datetime import datetime, timezone
from typing import List

router = APIRouter()

@router.post("/", response_model=Project)
async def create_project(project_data: ProjectCreate, current_user: dict = Depends(get_current_user)):
    # Verify client exists
    client = await clients_collection.find_one({"id": project_data.client_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    project_id = str(uuid.uuid4())
    project_doc = {
        "id": project_id,
        "user_id": current_user["user_id"],
        "client_id": project_data.client_id,
        "name": project_data.name,
        "total_value": project_data.total_value,
        "currency": project_data.currency,
        "completion_percentage": 0.0,
        "earned_amount": 0.0,
        "remaining_balance": project_data.total_value,
        "deadline": project_data.deadline,
        "linked_invoice_id": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await projects_collection.insert_one(project_doc)
    return Project(**project_doc)

@router.get("/", response_model=List[Project])
async def get_projects(current_user: dict = Depends(get_current_user)):
    projects = await projects_collection.find({"user_id": current_user["user_id"]}, {"_id": 0}).to_list(1000)
    return [Project(**project) for project in projects]

@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await projects_collection.find_one({"id": project_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return Project(**project)

@router.post("/{project_id}/logs", response_model=ProjectLog)
async def add_project_log(project_id: str, log_data: ProjectLogCreate, current_user: dict = Depends(get_current_user)):
    # Verify project exists
    project = await projects_collection.find_one({"id": project_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    log_id = str(uuid.uuid4())
    log_doc = {
        "id": log_id,
        "project_id": project_id,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "description": log_data.description,
        "hours": log_data.hours,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await project_logs_collection.insert_one(log_doc)
    return ProjectLog(**log_doc)

@router.get("/{project_id}/logs", response_model=List[ProjectLog])
async def get_project_logs(project_id: str, current_user: dict = Depends(get_current_user)):
    # Verify project exists
    project = await projects_collection.find_one({"id": project_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    logs = await project_logs_collection.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    return [ProjectLog(**log) for log in logs]

@router.put("/{project_id}/completion")
async def update_project_completion(project_id: str, completion_percentage: float, current_user: dict = Depends(get_current_user)):
    if completion_percentage < 0 or completion_percentage > 100:
        raise HTTPException(status_code=400, detail="Completion percentage must be between 0 and 100")
    
    project = await projects_collection.find_one({"id": project_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    earned_amount = project["total_value"] * (completion_percentage / 100)
    remaining_balance = project["total_value"] - earned_amount
    
    await projects_collection.update_one(
        {"id": project_id},
        {"$set": {
            "completion_percentage": completion_percentage,
            "earned_amount": round(earned_amount, 2),
            "remaining_balance": round(remaining_balance, 2)
        }}
    )
    
    updated_project = await projects_collection.find_one({"id": project_id}, {"_id": 0})
    return Project(**updated_project)
