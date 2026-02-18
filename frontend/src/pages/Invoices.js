import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import api from '../lib/api';
import { formatCurrency } from '../utils/currency';
import { Plus, FileText } from 'lucide-react';
import { toast } from 'sonner';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import InvoiceCreateForm from '../components/InvoiceCreateForm';

const Invoices = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invoicesRes, clientsRes] = await Promise.all([
        api.get('/invoices'),
        api.get('/clients'),
      ]);
      setInvoices(invoicesRes.data);
      setClients(clientsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
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
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-heading font-bold tracking-tight">Invoices</h1>
              <p className="text-muted-foreground mt-2">Manage and track all your invoices</p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="create-invoice-btn">
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </div>

          {user?.subscription_plan === 'free' && (
            <Card className="border-primary bg-primary/5">
              <CardContent className="p-4">
                <p className="text-sm">
                  <strong>Free Plan:</strong> {user?.invoice_count || 0}/3 invoices used this month.
                  <Button variant="link" className="px-2" onClick={() => navigate('/settings')}>
                    Upgrade for unlimited
                  </Button>
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>All Invoices</CardTitle>
              <CardDescription>{invoices.length} total invoices</CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No invoices yet</p>
                  <Button onClick={() => setCreateDialogOpen(true)} data-testid="create-first-invoice-btn">
                    Create Your First Invoice
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/invoices/${invoice.id}`)}
                      data-testid={`invoice-${invoice.id}`}
                    >
                      <div>
                        <p className="font-medium font-mono">{invoice.invoice_number}</p>
                        <p className="text-sm text-muted-foreground">
                          Created: {new Date(invoice.created_at).toLocaleDateString()} | Due: {new Date(invoice.due_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-mono font-bold">{formatCurrency(invoice.total_amount, invoice.currency)}</p>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            invoice.status === 'paid'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900'
                              : invoice.status === 'overdue'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900'
                          }`}
                        >
                          {invoice.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>This feature requires a client. Please create a client first from Projects.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To create a professional invoice with all features, start by creating a project and client.
            </p>
            <Button onClick={() => navigate('/projects')} className="w-full" data-testid="go-to-projects-btn">
              Go to Projects
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Invoices;
