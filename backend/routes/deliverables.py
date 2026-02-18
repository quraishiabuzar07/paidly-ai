from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import FileResponse
from models import Deliverable
from database import deliverables_collection, invoices_collection
from utils.auth import get_current_user
import uuid
import os
from datetime import datetime, timezone
from pathlib import Path
import shutil

router = APIRouter()

UPLOADS_DIR = Path("/app/backend/uploads")
DELIVERABLES_DIR = UPLOADS_DIR / "deliverables"
PREVIEWS_DIR = UPLOADS_DIR / "previews"

# Ensure directories exist
DELIVERABLES_DIR.mkdir(parents=True, exist_ok=True)
PREVIEWS_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/upload")
async def upload_deliverable(
    invoice_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    # Verify invoice
    invoice = await invoices_collection.find_one({"id": invoice_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Check file size (200MB max)
    file_size = 0
    content = await file.read()
    file_size = len(content)
    
    if file_size > 200 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 200MB limit")
    
    # Check file type
    allowed_types = ["image/jpeg", "image/png", "application/pdf", "video/mp4", "application/zip"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="File type not allowed")
    
    # Save file
    deliverable_id = str(uuid.uuid4())
    file_extension = file.filename.split(".")[-1]
    file_name = f"{deliverable_id}.{file_extension}"
    file_path = DELIVERABLES_DIR / file_name
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Create deliverable record
    deliverable_doc = {
        "id": deliverable_id,
        "invoice_id": invoice_id,
        "file_name": file.filename,
        "file_path": str(file_path),
        "file_type": file.content_type,
        "file_size": file_size,
        "is_locked": True,
        "preview_path": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await deliverables_collection.insert_one(deliverable_doc)
    
    return Deliverable(**deliverable_doc)

@router.get("/invoice/{invoice_id}")
async def get_invoice_deliverables(invoice_id: str, current_user: dict = Depends(get_current_user)):
    # Verify invoice
    invoice = await invoices_collection.find_one({"id": invoice_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    deliverables = await deliverables_collection.find({"invoice_id": invoice_id}, {"_id": 0}).to_list(1000)
    return [Deliverable(**d) for d in deliverables]

@router.get("/download/{deliverable_id}")
async def download_deliverable(deliverable_id: str):
    # Get deliverable
    deliverable = await deliverables_collection.find_one({"id": deliverable_id}, {"_id": 0})
    if not deliverable:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    
    # Check if locked
    if deliverable["is_locked"]:
        raise HTTPException(status_code=403, detail="Deliverable is locked. Payment required to unlock.")
    
    # Return file
    file_path = Path(deliverable["file_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=file_path,
        filename=deliverable["file_name"],
        media_type=deliverable["file_type"]
    )

@router.delete("/{deliverable_id}")
async def delete_deliverable(deliverable_id: str, current_user: dict = Depends(get_current_user)):
    # Get deliverable
    deliverable = await deliverables_collection.find_one({"id": deliverable_id}, {"_id": 0})
    if not deliverable:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    
    # Verify user owns the invoice
    invoice = await invoices_collection.find_one({"id": deliverable["invoice_id"], "user_id": current_user["user_id"]}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Delete file
    file_path = Path(deliverable["file_path"])
    if file_path.exists():
        file_path.unlink()
    
    # Delete record
    await deliverables_collection.delete_one({"id": deliverable_id})
    
    return {"message": "Deliverable deleted successfully"}
