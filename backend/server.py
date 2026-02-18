from fastapi import FastAPI, APIRouter, HTTPException, Header, Request
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
import asyncio
from datetime import datetime, timezone, timedelta
import uuid
import bcrypt
import jwt
from typing import Optional

# Import routes
from routes import auth, users, clients, projects, invoices, payments, reminders, analytics, deliverables, admin

# Import scheduler
from utils.scheduler import start_scheduler, stop_scheduler

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="ClientNudge AI API")

# Create API router
api_router = APIRouter(prefix="/api")

# Health check
@api_router.get("/")
async def root():
    return {"message": "ClientNudge AI API", "status": "running"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include all route modules
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(invoices.router, prefix="/invoices", tags=["invoices"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(reminders.router, prefix="/reminders", tags=["reminders"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(deliverables.router, prefix="/deliverables", tags=["deliverables"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])

# Include router in app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    stop_scheduler()
    client.close()

@app.on_event("startup")
async def startup_event():
    start_scheduler()
    logger.info("Application started with automated reminder scheduler")
