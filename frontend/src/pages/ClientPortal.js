import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import api from '../lib/api';
import { formatCurrency } from '../utils/currency';
import { Lock, Unlock, Download, CreditCard, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRazorpay } from '../hooks/useRazorpay';

const ClientPortal = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [pollingPayment, setPollingPayment] = useState(false);
  const { initiateInvoicePayment } = useRazorpay();

  useEffect(() => {
    fetchInvoiceData();
    markAsViewed();
    
    // Check for session_id in URL (return from Stripe)
    const urlParams = new URLSearchParams(window.location.search);
    const sid = urlParams.get('session_id');
    if (sid) {
      setSessionId(sid);
      pollPaymentStatus(sid);
    }
  }, [id]);

  const fetchInvoiceData = async () => {
    try {
      const response = await api.get(`/invoices/public/${id}`);
      setData(response.data);
    } catch (error) {
      toast.error('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const markAsViewed = async () => {
    try {
      await api.put(`/invoices/${id}/mark-viewed`);
    } catch (error) {
      console.error('Failed to mark as viewed');
    }
  };

  const pollPaymentStatus = async (sid, attempts = 0) => {
    if (attempts >= 5) {
      setPollingPayment(false);
      toast.error('Payment status check timed out. Please refresh the page.');
      return;
    }

    setPollingPayment(true);

    try {
      const response = await api.get(`/payments/checkout-status/${sid}`);
      
      if (response.data.status === 'completed') {
        toast.success('Payment successful! Your deliverables are now unlocked.');
        setPollingPayment(false);
        // Refresh invoice data to show unlocked deliverables
        await fetchInvoiceData();
        return;
      }

      // Continue polling
      setTimeout(() => pollPaymentStatus(sid, attempts + 1), 2000);
    } catch (error) {
      console.error('Error checking payment status:', error);
      setPollingPayment(false);
    }
  };

  const handlePayment = async () => {
    setPaying(true);
    try {
      // Use Razorpay for payment
      await initiateInvoicePayment(id, invoice.invoice_number, {
        name: client.name,
        email: client.email,
        phone: client.phone,
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to initiate payment');
    } finally {
      setPaying(false);
    }
  };

  const handleDownload = async (deliverableId, fileName) => {
    try {
      const response = await api.get(`/deliverables/download/${deliverableId}`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      // Use public endpoint for client portal (no auth required)
      const response = await api.get(`/invoices/public/${id}/pdf`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice_${invoice.invoice_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('PDF downloaded successfully');
    } catch (error) {
      toast.error('Failed to download PDF');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Invoice not found</p>
      </div>
    );
  }

  const { invoice, items, client, company } = data;
  const isPaid = invoice.status === 'paid';
  const hasDeliverables = items.some((item) => item.deliverables?.length > 0);

  return (
    <div className="min-h-screen bg-background" data-testid="client-portal">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-heading font-bold text-primary">ClientNudge AI</h1>
              <p className="text-sm text-muted-foreground mt-1">Secure Payment Portal</p>
            </div>
            <div className="flex items-center gap-3">
              {isPaid && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Paid</span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
                data-testid="download-pdf-btn"
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {pollingPayment && (
          <Card className="mb-6 border-primary bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                <p className="font-medium">Verifying your payment...</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-8">
          {/* Invoice Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">From</p>
                  <p className="text-lg font-semibold">{company.name}</p>
                  <p className="text-sm text-muted-foreground">{company.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Invoice</p>
                  <p className="text-2xl font-heading font-bold font-mono">{invoice.invoice_number}</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-2 ${
                      isPaid
                        ? 'bg-green-100 text-green-700 dark:bg-green-900'
                        : invoice.status === 'overdue'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900'
                    }`}
                  >
                    {invoice.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Bill To</p>
                  <p className="font-medium">{client.name}</p>
                  <p className="text-muted-foreground">{client.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="font-medium">{new Date(invoice.due_date).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between items-start p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.quantity} × {formatCurrency(item.rate, invoice.currency)}
                      </p>
                    </div>
                    <p className="font-mono font-bold">{formatCurrency(item.amount, invoice.currency)}</p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-2 mt-6 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                </div>
                {invoice.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span className="font-mono">-{formatCurrency(invoice.discount_amount, invoice.currency)}</span>
                  </div>
                )}
                {invoice.tax_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Tax ({invoice.tax_percentage}%)</span>
                    <span className="font-mono">{formatCurrency(invoice.tax_amount, invoice.currency)}</span>
                  </div>
                )}
                {invoice.late_fee_amount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Late Fee</span>
                    <span className="font-mono">{formatCurrency(invoice.late_fee_amount, invoice.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-2xl font-bold pt-3 border-t">
                  <span>Total Due</span>
                  <span className="font-mono">{formatCurrency(invoice.total_amount, invoice.currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deliverables */}
          {data.deliverables && data.deliverables.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Your Deliverables</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.deliverables.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        {file.is_locked ? (
                          <Lock className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <Unlock className="h-5 w-5 text-green-600" />
                        )}
                        <div>
                          <p className="font-medium">{file.file_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(file.file_size / 1024 / 1024).toFixed(2)} MB
                            {file.is_locked && ' • Locked until payment'}
                          </p>
                        </div>
                      </div>
                      {!file.is_locked ? (
                        <Button
                          size="sm"
                          onClick={() => handleDownload(file.id, file.file_name)}
                          data-testid="download-deliverable-btn"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">Pay to unlock</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Button */}
          {!isPaid && (
            <Card className="border-primary shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Ready to Pay?</h3>
                    <p className="text-sm text-muted-foreground">
                      Secure payment powered by Stripe
                      {data.deliverables?.length > 0 && ' • Deliverables will unlock instantly'}
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={handlePayment}
                    disabled={paying}
                    className="px-8"
                    data-testid="pay-invoice-btn"
                  >
                    {paying ? (
                      'Redirecting...'
                    ) : (
                      <>
                        <CreditCard className="h-5 w-5 mr-2" />
                        Pay {formatCurrency(invoice.total_amount, invoice.currency)}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isPaid && (
            <Card className="border-green-600 bg-green-50 dark:bg-green-950">
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-1">Payment Received!</h3>
                <p className="text-sm text-muted-foreground">
                  Thank you for your payment. Your deliverables are now available for download.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-6 max-w-4xl text-center text-sm text-muted-foreground">
          <p>Powered by ClientNudge AI • Secure Payment Processing</p>
        </div>
      </footer>
    </div>
  );
};

export default ClientPortal;
