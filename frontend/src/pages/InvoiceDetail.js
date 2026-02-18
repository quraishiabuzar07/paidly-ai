import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import api from '../lib/api';
import { formatCurrency } from '../utils/currency';
import { Copy, Upload, Mail, FileText, Lock, Unlock, Download, Send, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import Sidebar from '../components/Sidebar';

const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
  const [client, setClient] = useState(null);
  const [deliverables, setDeliverables] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingReminder, setGeneratingReminder] = useState(false);
  const [reminderType, setReminderType] = useState('polite');
  const [generatedReminder, setGeneratedReminder] = useState(null);

  useEffect(() => {
    fetchInvoiceDetails();
  }, [id]);

  const fetchInvoiceDetails = async () => {
    try {
      const [invoiceRes, itemsRes, deliverablesRes, remindersRes] = await Promise.all([
        api.get(`/invoices/${id}`),
        api.get(`/invoices/${id}/items`),
        api.get(`/deliverables/invoice/${id}`),
        api.get(`/reminders/invoice/${id}`),
      ]);

      setInvoice(invoiceRes.data);
      setItems(itemsRes.data);
      setDeliverables(deliverablesRes.data);
      setReminders(remindersRes.data);

      // Fetch client
      const clientRes = await api.get(`/clients/${invoiceRes.data.client_id}`);
      setClient(clientRes.data);
    } catch (error) {
      toast.error('Failed to load invoice details');
      navigate('/invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 200 * 1024 * 1024) {
      toast.error('File size must be less than 200MB');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post(`/deliverables/upload?invoice_id=${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDeliverables([...deliverables, response.data]);
      toast.success('Deliverable uploaded successfully');
      setUploadDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateReminder = async () => {
    setGeneratingReminder(true);
    try {
      const response = await api.post('/reminders/generate', {
        invoice_id: id,
        reminder_type: reminderType,
      });
      setGeneratedReminder(response.data);
      toast.success('Reminder generated successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate reminder');
    } finally {
      setGeneratingReminder(false);
    }
  };

  const handleSendReminder = async () => {
    if (!generatedReminder) return;

    try {
      await api.post(`/reminders/send/${generatedReminder.id}`);
      setReminders([...reminders, generatedReminder]);
      toast.success('Reminder sent successfully');
      setReminderDialogOpen(false);
      setGeneratedReminder(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send reminder');
    }
  };

  const handleSendInvoice = async () => {
    try {
      await api.put(`/invoices/${id}/send`);
      setInvoice({ ...invoice, status: 'sent' });
      toast.success('Invoice sent to client');
    } catch (error) {
      toast.error('Failed to send invoice');
    }
  };

  const copyPortalLink = () => {
    const link = `${window.location.origin}/portal/${id}`;
    navigator.clipboard.writeText(link);
    toast.success('Portal link copied to clipboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="md:pl-64">
        <div className="p-8 space-y-8">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-heading font-bold tracking-tight font-mono">{invoice.invoice_number}</h1>
              <p className="text-muted-foreground mt-2">
                {client?.name} • {client?.email}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={copyPortalLink} data-testid="copy-portal-link">
                <Copy className="h-4 w-4 mr-2" />
                Copy Portal Link
              </Button>
              {invoice.status === 'draft' && (
                <Button onClick={handleSendInvoice} data-testid="send-invoice-btn">
                  <Send className="h-4 w-4 mr-2" />
                  Send Invoice
                </Button>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <div>
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                invoice.status === 'paid'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900'
                  : invoice.status === 'overdue'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900'
                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900'
              }`}
            >
              {invoice.status.toUpperCase()}
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Invoice Details */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Items */}
                <div>
                  <h3 className="font-semibold mb-4">Items</h3>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="flex justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{item.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.quantity} × {formatCurrency(item.rate, invoice.currency)}
                          </p>
                        </div>
                        <p className="font-mono font-bold">{formatCurrency(item.amount, invoice.currency)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="space-y-2 pt-4 border-t">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                  </div>
                  {invoice.discount_amount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount ({invoice.discount_type === 'percentage' ? `${invoice.discount_value}%` : 'Fixed'})</span>
                      <span className="font-mono">-{formatCurrency(invoice.discount_amount, invoice.currency)}</span>
                    </div>
                  )}
                  {invoice.tax_amount > 0 && (
                    <div className="flex justify-between">
                      <span>Tax ({invoice.tax_percentage}%)</span>
                      <span className="font-mono">{formatCurrency(invoice.tax_amount, invoice.currency)}</span>
                    </div>
                  )}
                  {invoice.late_fee_amount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Late Fee</span>
                      <span className="font-mono">{formatCurrency(invoice.late_fee_amount, invoice.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-bold pt-2 border-t">
                    <span>Total</span>
                    <span className="font-mono">{formatCurrency(invoice.total_amount, invoice.currency)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t text-sm">
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium">{new Date(invoice.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Due Date</p>
                    <p className="font-medium">{new Date(invoice.due_date).toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="space-y-6">
              {/* Deliverables */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Deliverables</CardTitle>
                    <Button size="sm" onClick={() => setUploadDialogOpen(true)} data-testid="upload-deliverable-btn">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {deliverables.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No deliverables uploaded</p>
                  ) : (
                    <div className="space-y-2">
                      {deliverables.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-2 rounded border">
                          <div className="flex items-center gap-2">
                            {file.is_locked ? (
                              <Lock className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Unlock className="h-4 w-4 text-green-600" />
                            )}
                            <div>
                              <p className="text-sm font-medium truncate max-w-[150px]">{file.file_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(file.file_size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          {!file.is_locked && (
                            <Button size="sm" variant="ghost">
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Reminders */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Reminders</CardTitle>
                    <Button size="sm" onClick={() => setReminderDialogOpen(true)} data-testid="generate-reminder-btn">
                      <Mail className="h-4 w-4 mr-2" />
                      New
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {reminders.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No reminders sent</p>
                  ) : (
                    <div className="space-y-2">
                      {reminders.map((reminder) => (
                        <div key={reminder.id} className="p-2 rounded border">
                          <p className="text-sm font-medium capitalize">{reminder.reminder_type}</p>
                          <p className="text-xs text-muted-foreground">
                            {reminder.sent_at ? new Date(reminder.sent_at).toLocaleDateString() : 'Draft'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Deliverable</DialogTitle>
            <DialogDescription>Upload files that will be locked until payment is received</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="file-upload">Select File (Max 200MB)</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,.mp4,.zip"
                onChange={handleFileUpload}
                disabled={uploading}
                data-testid="file-upload-input"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Supported: JPG, PNG, PDF, MP4, ZIP
              </p>
            </div>
            {uploading && (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="text-sm">Uploading...</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reminder Dialog */}
      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate Payment Reminder</DialogTitle>
            <DialogDescription>AI will generate a professional reminder based on the type you select</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reminder Type</Label>
              <Select value={reminderType} onValueChange={setReminderType}>
                <SelectTrigger data-testid="reminder-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="polite">Polite (Friendly reminder)</SelectItem>
                  <SelectItem value="firm">Firm (Professional follow-up)</SelectItem>
                  <SelectItem value="final">Final (Urgent notice)</SelectItem>
                  <SelectItem value="late_fee_warning">Late Fee Warning</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!generatedReminder ? (
              <Button
                onClick={handleGenerateReminder}
                disabled={generatingReminder}
                className="w-full"
                data-testid="generate-btn"
              >
                {generatingReminder ? 'Generating...' : 'Generate Reminder'}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Generated Message</Label>
                  <Textarea
                    value={generatedReminder.message}
                    readOnly
                    rows={8}
                    className="font-sans"
                    data-testid="generated-message"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setGeneratedReminder(null)} variant="outline" className="flex-1">
                    Regenerate
                  </Button>
                  <Button onClick={handleSendReminder} className="flex-1" data-testid="send-reminder-btn">
                    Send to Client
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoiceDetail;
