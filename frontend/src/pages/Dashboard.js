import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import api from '../lib/api';
import { formatCurrency } from '../utils/currency';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, TrendingUp, AlertCircle, Clock, Plus, FileText } from 'lucide-react';
import { toast } from 'sonner';
import Sidebar from '../components/Sidebar';

const StatsCard = ({ title, value, icon: Icon, trend, testId }) => {
  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-mono" data-testid={`${testId}-value`}>{value}</div>
        {trend && <p className="text-xs text-muted-foreground mt-1">{trend}</p>}
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, invoicesRes] = await Promise.all([
        api.get('/analytics/dashboard'),
        api.get('/invoices'),
      ]);

      setStats(statsRes.data);
      setInvoices(invoicesRes.data.slice(0, 5)); // Latest 5 invoices
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="dashboard-page">
      <Sidebar />
      <div className="md:pl-64">
        <div className="p-8 space-y-8">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-heading font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground mt-2">Welcome back, {user?.full_name}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/projects')} data-testid="new-project-btn">
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
              <Button onClick={() => navigate('/invoices')} data-testid="new-invoice-btn">
                <FileText className="h-4 w-4 mr-2" />
                New Invoice
              </Button>
            </div>
          </div>

          {/* Subscription Banner */}
          {user?.subscription_plan === 'free' && (
            <Card className="border-primary bg-primary/5">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">Upgrade to Pro</h3>
                    <p className="text-sm text-muted-foreground">
                      Unlock unlimited invoices, AI reminders, and Pay-to-Unlock features
                    </p>
                  </div>
                  <Button onClick={() => navigate('/settings')} data-testid="upgrade-btn">
                    Upgrade Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Total Outstanding"
              value={formatCurrency(stats?.total_outstanding || 0, user?.base_currency)}
              icon={DollarSign}
              testId="stat-outstanding"
            />
            <StatsCard
              title="Paid This Month"
              value={formatCurrency(stats?.paid_this_month || 0, user?.base_currency)}
              icon={TrendingUp}
              trend={`${stats?.paid_invoices || 0} invoices paid`}
              testId="stat-paid-month"
            />
            <StatsCard
              title="Overdue Amount"
              value={formatCurrency(stats?.overdue_amount || 0, user?.base_currency)}
              icon={AlertCircle}
              trend={`${stats?.overdue_invoices || 0} invoices overdue`}
              testId="stat-overdue"
            />
            <StatsCard
              title="Avg Payment Time"
              value={`${stats?.average_payment_time?.toFixed(0) || 0} days`}
              icon={Clock}
              testId="stat-avg-payment"
            />
          </div>

          {/* Recent Invoices */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Invoices</CardTitle>
                  <CardDescription>Your latest invoices and their status</CardDescription>
                </div>
                <Button variant="outline" onClick={() => navigate('/invoices')} data-testid="view-all-invoices-btn">
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No invoices yet</p>
                  <Button className="mt-4" onClick={() => navigate('/invoices')} data-testid="create-first-invoice-btn">
                    Create Your First Invoice
                  </Button>
                </div>
              ) : (
                <div className="space-y-4" data-testid="invoices-list">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/invoices/${invoice.id}`)}
                      data-testid={`invoice-item-${invoice.id}`}
                    >
                      <div>
                        <p className="font-medium font-mono">{invoice.invoice_number}</p>
                        <p className="text-sm text-muted-foreground">
                          Due: {new Date(invoice.due_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-mono font-bold">
                          {formatCurrency(invoice.total_amount, invoice.currency)}
                        </p>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            invoice.status === 'paid'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                              : invoice.status === 'overdue'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
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
    </div>
  );
};

export default Dashboard;
