from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Collection references
users_collection = db.users
clients_collection = db.clients
projects_collection = db.projects
project_logs_collection = db.project_logs
invoices_collection = db.invoices
invoice_items_collection = db.invoice_items
payments_collection = db.payments
reminders_collection = db.reminders
deliverables_collection = db.deliverables
exchange_rates_collection = db.exchange_rates
subscriptions_collection = db.subscriptions
