import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuth } from '../contexts/AuthContext';
import { Crown, Zap } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import api from '../lib/api';
import { toast } from 'sonner';

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
        </div>
      </div>
    </div>
  );
};

export default Settings;
