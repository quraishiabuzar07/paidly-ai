from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Literal
from datetime import datetime

# User Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    base_currency: str = "USD"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    base_currency: str
    subscription_plan: Literal["free", "pro", "agency"] = "free"
    subscription_status: Literal["active", "inactive", "cancelled"] = "active"
    invoice_count: int = 0
    created_at: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    base_currency: Optional[str] = None

# Client Models
class ClientCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None

class Client(BaseModel):
    id: str
    user_id: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    payment_score: Literal["fast", "medium", "slow", "high_risk"] = "medium"
    avg_payment_days: float = 0.0
    total_paid: float = 0.0
    total_pending: float = 0.0
    created_at: str

# Project Models
class ProjectCreate(BaseModel):
    client_id: str
    name: str
    total_value: float
    currency: str = "USD"
    deadline: Optional[str] = None

class ProjectLogCreate(BaseModel):
    description: str
    hours: float

class ProjectLog(BaseModel):
    id: str
    project_id: str
    date: str
    description: str
    hours: float
    created_at: str

class Project(BaseModel):
    id: str
    user_id: str
    client_id: str
    name: str
    total_value: float
    currency: str
    completion_percentage: float = 0.0
    earned_amount: float = 0.0
    remaining_balance: float = 0.0
    deadline: Optional[str] = None
    linked_invoice_id: Optional[str] = None
    created_at: str

# Invoice Models
class InvoiceItemCreate(BaseModel):
    description: str
    quantity: float
    rate: float

class InvoiceItem(BaseModel):
    id: str
    invoice_id: str
    description: str
    quantity: float
    rate: float
    amount: float

class InvoiceCreate(BaseModel):
    client_id: str
    project_id: Optional[str] = None
    currency: str = "USD"
    items: List[InvoiceItemCreate]
    tax_percentage: float = 0.0
    discount_type: Literal["none", "percentage", "fixed"] = "none"
    discount_value: float = 0.0
    late_fee_enabled: bool = False
    late_fee_percentage: float = 5.0
    late_fee_days: int = 7
    auto_reminders: bool = True
    due_date: str

class Invoice(BaseModel):
    id: str
    user_id: str
    client_id: str
    project_id: Optional[str] = None
    invoice_number: str
    subtotal: float
    tax_amount: float
    tax_percentage: float
    discount_amount: float
    discount_type: str
    discount_value: float
    late_fee_amount: float
    late_fee_enabled: bool
    late_fee_percentage: float
    late_fee_days: int
    total_amount: float
    currency: str
    exchange_rate: float
    due_date: str
    status: Literal["draft", "sent", "viewed", "paid", "overdue"] = "draft"
    auto_reminders: bool
    created_at: str
    sent_at: Optional[str] = None
    paid_at: Optional[str] = None

# Payment Models
class PaymentCreate(BaseModel):
    invoice_id: str
    amount: float
    currency: str

class Payment(BaseModel):
    id: str
    invoice_id: str
    stripe_session_id: Optional[str] = None
    stripe_payment_id: Optional[str] = None
    amount: float
    currency: str
    status: Literal["pending", "completed", "failed"] = "pending"
    created_at: str

# Reminder Models
class ReminderGenerate(BaseModel):
    invoice_id: str
    reminder_type: Literal["polite", "firm", "final", "late_fee_warning"]

class Reminder(BaseModel):
    id: str
    invoice_id: str
    reminder_type: str
    message: str
    sent_at: Optional[str] = None
    channel: str = "email"
    created_at: str

# Deliverable Models
class DeliverableCreate(BaseModel):
    invoice_id: str
    file_name: str
    file_type: str

class Deliverable(BaseModel):
    id: str
    invoice_id: str
    file_name: str
    file_path: str
    file_type: str
    file_size: int
    is_locked: bool = True
    preview_path: Optional[str] = None
    created_at: str

# Analytics Models
class DashboardStats(BaseModel):
    total_outstanding: float
    paid_this_month: float
    overdue_amount: float
    average_payment_time: float
    late_fee_collected: float
    total_invoices: int
    paid_invoices: int
    pending_invoices: int
    overdue_invoices: int
