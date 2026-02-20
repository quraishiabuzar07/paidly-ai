import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { Crown, Zap } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { toast } from 'sonner';
import { useRazorpay } from '../hooks/useRazorpay';

const Settings = () => {
  const { user, updateUser } = useAuth();

  const handleUpgrade = async (plan) => {
    try {
      await api.post('/admin/upgrade', null, { params: { plan } });
      const updatedUser = { ...user, subscription_plan: plan };
      updateUser(updatedUser);
      toast.success(`Successfully upgraded to ${plan} plan!`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upgrade');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="md:pl-64">
        <div className="p-8 space-y-8">
          <div>
            <h1 className="text-4xl font-heading font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground mt-2">Manage your account and subscription</p>
          </div>

          {/* Profile */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{user?.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Base Currency</p>
                <p className="font-medium">{user?.base_currency}</p>
              </div>
            </CardContent>
          </Card>

          {/* Subscription */}
          <Card>
            <CardHeader>
              <CardTitle>Subscription Plan</CardTitle>
              <CardDescription>Current plan: <strong className="text-primary capitalize">{user?.subscription_plan}</strong></CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {user?.subscription_plan === 'free' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Upgrade to unlock unlimited invoices, AI reminders, and Pay-to-Unlock features
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card className="border-primary">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Zap className="h-5 w-5 text-primary" />
                          <CardTitle className="text-xl">Pro</CardTitle>
                        </div>
                        <p className="text-3xl font-bold font-heading">$19<span className="text-sm font-normal text-muted-foreground">/month</span></p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <ul className="space-y-2 text-sm">
                          <li>✓ Unlimited invoices</li>
                          <li>✓ AI reminders</li>
                          <li>✓ Pay-to-Unlock</li>
                          <li>✓ Late fee automation</li>
                          <li>✓ Multi-currency</li>
                        </ul>
                        <Button onClick={() => handleUpgrade('pro')} className="w-full" data-testid="upgrade-pro-btn">
                          Upgrade to Pro
                        </Button>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Crown className="h-5 w-5 text-primary" />
                          <CardTitle className="text-xl">Agency</CardTitle>
                        </div>
                        <p className="text-3xl font-bold font-heading">$39<span className="text-sm font-normal text-muted-foreground">/month</span></p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <ul className="space-y-2 text-sm">
                          <li>✓ Everything in Pro</li>
                          <li>✓ Advanced analytics</li>
                          <li>✓ Client behavior scoring</li>
                          <li>✓ Priority support</li>
                        </ul>
                        <Button onClick={() => handleUpgrade('agency')} className="w-full" data-testid="upgrade-agency-btn">
                          Upgrade to Agency
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
              {user?.subscription_plan !== 'free' && (
                <div className="flex items-center gap-4 p-4 rounded-lg bg-primary/10">
                  <Crown className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-semibold">You're on the {user?.subscription_plan} plan</p>
                    <p className="text-sm text-muted-foreground">Enjoy all premium features!</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Automated Reminders Info */}
          <Card>
            <CardHeader>
              <CardTitle>Automated Payment Reminders</CardTitle>
              <CardDescription>Intelligent reminder system running 24/7</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                ClientNudge AI automatically monitors all your unpaid invoices and sends professional payment reminders at optimal times:
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">3d</div>
                  <div>
                    <p className="font-medium">Polite Reminder</p>
                    <p className="text-muted-foreground text-xs">3 days before due date</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">0d</div>
                  <div>
                    <p className="font-medium">Due Today Reminder</p>
                    <p className="text-muted-foreground text-xs">On the due date</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-600 font-semibold">+1d</div>
                  <div>
                    <p className="font-medium">Firm Reminder</p>
                    <p className="text-muted-foreground text-xs">1 day overdue</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-600 font-semibold">+7d</div>
                  <div>
                    <p className="font-medium">Final Notice + Late Fee</p>
                    <p className="text-muted-foreground text-xs">7 days overdue (applies late fee if enabled)</p>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  <strong>Schedule:</strong> Runs daily at 9:00 AM UTC • 
                  <strong> AI-Powered:</strong> {user?.subscription_plan !== 'free' ? 'Enabled ✓' : 'Upgrade to Pro for AI reminders'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
