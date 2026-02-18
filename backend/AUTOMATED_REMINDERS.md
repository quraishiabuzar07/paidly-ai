# Automated Reminder System Documentation

## Overview
ClientNudge AI includes an intelligent automated reminder system that monitors all unpaid invoices and sends timely payment reminders to clients without manual intervention.

## How It Works

### Daily Schedule
The system runs automatically every day at **9:00 AM UTC** to check all invoices with `auto_reminders` enabled.

### Reminder Timeline

#### 1. **3 Days Before Due Date** - Polite Reminder
- **Trigger**: Exactly 3 days before the invoice due date
- **Condition**: No previous reminder has been sent
- **Tone**: Friendly and polite
- **Example**: "Hi [Client], friendly reminder that invoice [#] for $[amount] is due soon on [date]."

#### 2. **On Due Date** - Due Today Reminder
- **Trigger**: On the exact due date
- **Condition**: At least 1 day since last reminder
- **Tone**: Professional reminder
- **Example**: "Hi [Client], just a reminder that invoice [#] for $[amount] is due today."

#### 3. **1 Day Overdue** - Firm Reminder
- **Trigger**: 1 day after the due date
- **Condition**: At least 1 day since last reminder
- **Action**: Invoice status automatically updated to "overdue"
- **Tone**: Firm and professional
- **Example**: "Dear [Client], invoice [#] for $[amount] is now overdue. Please arrange payment as soon as possible."

#### 4. **7 Days Overdue** - Final Notice with Late Fee
- **Trigger**: 7 days after the due date
- **Condition**: At least 3 days since last reminder
- **Actions**:
  - Applies late fee (if enabled on invoice)
  - Updates total amount with late fee
  - Sends final urgent notice
- **Tone**: Urgent and final
- **Example**: "URGENT: This is a final notice for invoice [#] which is significantly overdue."

### AI-Powered Messages (Pro/Agency Plans)
For Pro and Agency subscribers, reminders are generated using **OpenAI GPT-5.2** to create:
- Contextually appropriate messages
- Professional tone matching reminder type
- Personalized content based on client and invoice details

For Free plan users, pre-written professional templates are used.

### Email Delivery
All reminders are sent via **Resend** email service with:
- Professional HTML formatting
- Invoice details embedded
- Direct link to client payment portal
- One-click payment button

### Duplicate Prevention
The system intelligently prevents spam by:
- Checking reminder history before sending
- Enforcing minimum time gaps between reminders
- Tracking sent dates for each invoice
- Only sending one reminder per trigger condition

### Manual Override
Users can also generate and send reminders manually through the invoice detail page, bypassing the automated schedule.

## Configuration

### Enable/Disable Automation
When creating an invoice, users can toggle the "Auto Reminders" option:
- **Enabled** (default): Invoice participates in automated reminder schedule
- **Disabled**: No automated reminders sent (manual only)

### Late Fee Settings
Configure per invoice:
- **Enable Late Fee**: Toggle on/off
- **Percentage**: Default 5% (customizable)
- **Grace Period**: Default 7 days after due date
- **Application**: Automatically applied when final reminder is triggered

## Benefits

1. **Time Savings**: Eliminates manual follow-up tasks
2. **Consistency**: Never miss a payment reminder
3. **Professionalism**: Maintains professional communication
4. **Cash Flow**: Faster payments through timely reminders
5. **Scalability**: Handles unlimited invoices automatically

## Monitoring

### Reminder History
View all sent reminders in the invoice detail page:
- Reminder type
- Date sent
- Message content
- Delivery status

### Dashboard Integration
Track reminder effectiveness through:
- Average payment time metrics
- Overdue invoice count
- Payment collection rates

## Technical Details

- **Scheduler**: APScheduler (Background job runner)
- **Trigger**: CronTrigger (daily at 9 AM UTC)
- **Email Service**: Resend API
- **AI Model**: OpenAI GPT-5.2 (Pro/Agency only)
- **Database**: MongoDB (reminder history tracking)

## Manual Testing

Administrators can manually trigger the reminder check via:
```
POST /api/admin/trigger-reminders
```

This is useful for testing the system or running an immediate check outside the scheduled time.

## Best Practices

1. **Set Realistic Due Dates**: Allow reasonable time for client payment
2. **Enable Late Fees**: Encourages timely payment
3. **Keep Auto-Reminders ON**: Unless special client circumstances
4. **Monitor Dashboard**: Track which clients need attention
5. **Follow Up Personally**: For high-value or sensitive invoices

## Future Enhancements

Potential additions:
- WhatsApp reminders (SMS alternative)
- Custom reminder schedules per client
- Reminder templates customization
- Multi-language support
- Slack/Discord notifications for freelancer
