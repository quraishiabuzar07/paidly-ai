# Razorpay Integration Documentation

## Overview
ClientNudge AI now supports Razorpay as a payment gateway for invoice payments and subscription management. This integration provides a complete payment solution for Indian and international customers.

## Features Implemented

### 1. Invoice Payment Integration
- **Standard Checkout**: Uses Razorpay's hosted checkout for secure payments
- **Order Creation**: Backend creates Razorpay orders with invoice details
- **Payment Verification**: Server-side signature verification using HMAC-SHA256
- **Auto-unlock**: Deliverables automatically unlock upon successful payment
- **Multi-currency**: Supports all Razorpay-supported currencies

### 2. Subscription Management
- **Monthly Plans**: 
  - Pro Plan: ₹1,900/month
  - Agency Plan: ₹3,900/month
- **30-Day Duration**: Subscriptions valid for 30 days from activation
- **Auto-cancellation**: Expires after 30 days if not renewed
- **Instant Activation**: Subscription activated immediately upon payment

### 3. Pay-to-Unlock System
When payment is successful:
1. Invoice status changed to "paid"
2. All deliverables unlocked (is_locked = False)
3. High-resolution downloads enabled
4. Client payment stats updated

### 4. Webhook Integration
Endpoint: `POST /api/razorpay/webhook`

Supported Events:
- `payment.captured` - Payment successful
- `payment.failed` - Payment failed
- `subscription.charged` - Subscription renewed

## API Endpoints

### Invoice Payment

#### Create Order
```
POST /api/razorpay/create-order?invoice_id={id}
Authorization: Bearer <token>

Response:
{
  "order_id": "order_MN...",
  "amount": 550000,  // in paise
  "currency": "INR",
  "key_id": "rzp_test_...",
  "invoice_number": "INV-20260218001"
}
```

#### Verify Payment
```
POST /api/razorpay/verify-payment
Authorization: Bearer <token>

Body:
{
  "razorpay_order_id": "order_MN...",
  "razorpay_payment_id": "pay_MN...",
  "razorpay_signature": "abc123..."
}

Response:
{
  "status": "success",
  "message": "Payment verified successfully"
}
```

### Subscription Payment

#### Create Subscription Order
```
POST /api/razorpay/create-subscription-order?plan=pro
Authorization: Bearer <token>

Response:
{
  "order_id": "order_MN...",
  "amount": 190000,  // in paise
  "currency": "INR",
  "key_id": "rzp_test_...",
  "plan": "pro"
}
```

#### Verify Subscription Payment
```
POST /api/razorpay/verify-subscription-payment
Authorization: Bearer <token>

Body:
{
  "razorpay_order_id": "order_MN...",
  "razorpay_payment_id": "pay_MN...",
  "razorpay_signature": "abc123...",
  "plan": "pro"
}

Response:
{
  "status": "success",
  "message": "Subscription activated successfully",
  "plan": "pro",
  "expires_at": "2026-03-20T10:54:33+00:00"
}
```

### Webhook
```
POST /api/razorpay/webhook
X-Razorpay-Signature: <signature>

Body: (JSON payload from Razorpay)

Response:
{
  "status": "processed"
}
```

### Payment Status
```
GET /api/razorpay/payment-status/{order_id}
Authorization: Bearer <token>

Response:
{
  "status": "completed",
  "payment_id": "pay_MN...",
  "amount": 5500.00,
  "currency": "INR"
}
```

## Configuration

### Environment Variables
```bash
RAZORPAY_KEY_ID=rzp_test_SIN88A2SWYICLu
RAZORPAY_KEY_SECRET=Asytjb8lppwZlJUI9m1rbK0T
RAZORPAY_WEBHOOK_SECRET=webhook_secret_1234567890
```

### Test Mode
Use Razorpay test credentials for development:
- Test Key ID: Starts with `rzp_test_`
- Test Secret: Provided in Razorpay dashboard
- Test Cards: Available in Razorpay documentation

## Frontend Integration

### Invoice Payment (Client Portal)
```javascript
import { useRazorpay } from '../hooks/useRazorpay';

const { initiateInvoicePayment } = useRazorpay();

const handlePayment = async () => {
  await initiateInvoicePayment(invoiceId, invoiceNumber, {
    name: client.name,
    email: client.email,
    phone: client.phone,
  });
};
```

### Subscription Payment (Settings Page)
```javascript
import { useRazorpay } from '../hooks/useRazorpay';

const { initiateSubscriptionPayment } = useRazorpay();

const handleUpgrade = async (plan) => {
  await initiateSubscriptionPayment(plan, {
    name: user.full_name,
    email: user.email,
  });
};
```

## Payment Flow

### Invoice Payment Flow
1. Client opens invoice in portal
2. Clicks "Pay Invoice" button
3. Frontend calls `/api/razorpay/create-order`
4. Razorpay checkout modal opens
5. Client enters payment details
6. Payment processed by Razorpay
7. Success handler calls `/api/razorpay/verify-payment`
8. Backend verifies signature
9. Invoice marked as paid
10. Deliverables unlocked
11. Client stats updated
12. Success message shown, page reloads

### Subscription Payment Flow
1. User clicks upgrade button in Settings
2. Frontend calls `/api/razorpay/create-subscription-order`
3. Razorpay checkout modal opens
4. User enters payment details
5. Payment processed by Razorpay
6. Success handler calls `/api/razorpay/verify-subscription-payment`
7. Backend verifies signature
8. Subscription record created (30-day duration)
9. User plan updated to Pro/Agency
10. Success message shown, page reloads

## Security

### Signature Verification
All payments are verified using HMAC-SHA256 signature:

```python
import hmac
import hashlib

message = f"{order_id}|{payment_id}"
expected_signature = hmac.new(
    RAZORPAY_KEY_SECRET.encode(),
    message.encode(),
    hashlib.sha256
).hexdigest()

if expected_signature != razorpay_signature:
    raise Exception("Invalid signature")
```

### Webhook Security
Webhooks are verified using webhook secret:

```python
expected_signature = hmac.new(
    RAZORPAY_WEBHOOK_SECRET.encode(),
    webhook_payload,
    hashlib.sha256
).hexdigest()
```

## Database Schema

### Payment Record
```javascript
{
  id: uuid,
  invoice_id: string,
  razorpay_order_id: string,
  razorpay_payment_id: string,
  amount: float,
  currency: string,
  status: "pending" | "completed" | "failed",
  payment_method: "razorpay",
  webhook_event: string,
  error_reason: string,
  verified_at: ISO timestamp,
  created_at: ISO timestamp,
  updated_at: ISO timestamp
}
```

### Subscription Record
```javascript
{
  id: uuid,
  user_id: string,
  razorpay_order_id: string,
  razorpay_payment_id: string,
  plan: "pro" | "agency",
  status: "active" | "cancelled",
  start_date: ISO timestamp,
  end_date: ISO timestamp,
  auto_renew: boolean,
  cancelled_at: ISO timestamp,
  cancellation_reason: string,
  created_at: ISO timestamp
}
```

## Automated Subscription Management

### Expiry Check (Daily at 10 AM UTC)
The scheduler automatically:
1. Checks all active subscriptions
2. Compares end_date with current date
3. If expired:
   - Updates subscription status to "cancelled"
   - Downgrades user to "free" plan
   - Sets cancellation_reason to "expired_unpaid"
4. Logs all actions

### Manual Cancellation
```
POST /api/admin/cancel-subscription
Authorization: Bearer <token>

Body:
{
  "user_id": "uuid",
  "reason": "user_request"
}
```

## Testing

### Test Payment Flow
1. Use Razorpay test credentials
2. Test cards available at: https://razorpay.com/docs/payments/payments/test-card-details/
3. Success card: 4111 1111 1111 1111
4. Failed card: 4000 0000 0000 0002

### Test Webhook
Use Razorpay dashboard to send test webhooks or use ngrok for local testing:
```bash
ngrok http 8001
# Update webhook URL in Razorpay dashboard
```

## Error Handling

### Common Errors
1. **Invalid Signature**: Payment/Webhook signature verification failed
2. **Order Not Found**: Invalid order_id provided
3. **Payment Failed**: Card declined or insufficient balance
4. **Duplicate Payment**: Order already paid

### Error Responses
```javascript
{
  "detail": "Invalid signature"  // 400
}
{
  "detail": "Payment not found"  // 404
}
{
  "detail": "Razorpay error: ..."  // 400
}
```

## Production Deployment

### Checklist
1. ✅ Replace test credentials with live credentials
2. ✅ Update webhook URL to production endpoint
3. ✅ Enable webhook signature verification
4. ✅ Test live payments with small amounts
5. ✅ Monitor webhook delivery in Razorpay dashboard
6. ✅ Set up error alerts for failed payments
7. ✅ Configure auto-capture settings in Razorpay

### Going Live
1. Generate live API keys from Razorpay dashboard
2. Update `.env` file:
   ```
   RAZORPAY_KEY_ID=rzp_live_...
   RAZORPAY_KEY_SECRET=live_secret_...
   RAZORPAY_WEBHOOK_SECRET=webhook_secret_...
   ```
3. Restart backend: `sudo supervisorctl restart backend`
4. Test with small live payment
5. Monitor logs and webhook delivery

## Support

### Razorpay Documentation
- Standard Checkout: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
- Webhooks: https://razorpay.com/docs/webhooks/
- Test Mode: https://razorpay.com/docs/payments/payments/test-card-details/

### Contact
For integration issues:
- Check logs: `tail -f /var/log/supervisor/backend.*.log`
- Verify webhook delivery in Razorpay dashboard
- Test signature verification manually
