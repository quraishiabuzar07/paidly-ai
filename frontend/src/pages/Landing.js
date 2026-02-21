import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Zap, TrendingUp, Shield, DollarSign, Clock, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { CURRENCIES } from '../utils/currency';

const Landing = () => {
  const [showAuth, setShowAuth] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    base_currency: 'USD',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        toast.success('Welcome back!');
      } else {
        await register(formData.email, formData.password, formData.full_name, formData.base_currency);
        toast.success('Account created successfully!');
      }
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Zap,
      title: 'AI-Powered Reminders',
      description: 'Smart, polite reminders that adapt to client behavior',
    },
    {
      icon: Shield,
      title: 'Pay-to-Unlock',
      description: 'Protect deliverables until payment is confirmed',
    },
    {
      icon: DollarSign,
      title: 'Multi-Currency',
      description: 'Work with clients globally in their preferred currency',
    },
    {
      icon: Clock,
      title: 'Late Fee Automation',
      description: 'Automatically apply late fees to overdue invoices',
    },
    {
      icon: TrendingUp,
      title: 'Client Scoring',
      description: 'Track and predict payment behavior patterns',
    },
    {
      icon: Sparkles,
      title: 'Professional Portals',
      description: 'Branded client portals that build trust',
    },
  ];

  const pricingPlans = [
    {
      name: 'Free',
      price: '$0',
      features: ['3 invoices/month', 'Basic templates', 'Email reminders', 'Manual follow-ups'],
    },
    {
      name: 'Pro',
      price: '$12',
      popular: true,
      features: [
        'Unlimited invoices',
        'AI reminders',
        'Pay-to-Unlock',
        'Late fee automation',
        'Multi-currency',
        'Client portal',
      ],
    },
    {
      name: 'Agency',
      price: '$29',
      features: [
        'Everything in Pro',
        'Advanced analytics',
        'Client behavior scoring',
        'Priority support',
        'Team access',
      ],
    },
  ];

  if (showAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background">
        <Card className="w-full max-w-md" data-testid="auth-card">
          <CardHeader>
            <CardTitle className="text-2xl font-heading">
              {isLogin ? 'Welcome Back' : 'Get Started'}
            </CardTitle>
            <CardDescription>
              {isLogin ? 'Sign in to your account' : 'Create your account to start getting paid faster'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    data-testid="full-name-input"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required={!isLogin}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  data-testid="email-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  data-testid="password-input"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="base_currency">Base Currency</Label>
                  <Select
                    value={formData.base_currency}
                    onValueChange={(value) => setFormData({ ...formData, base_currency: value })}
                  >
                    <SelectTrigger data-testid="currency-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.code} - {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                data-testid="auth-submit-button"
              >
                {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline"
                data-testid="toggle-auth-mode"
              >
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="py-24 md:py-32 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background">
        <div className="container mx-auto px-4 md:px-8 max-w-7xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-5xl md:text-7xl font-heading font-bold tracking-tight leading-tight">
                Get Paid Faster.
                <br />
                <span className="text-primary">Without Awkward Follow-Ups.</span>
              </h1>
              <p className="text-base md:text-lg leading-relaxed text-muted-foreground">
                The intelligent invoice and payment management platform built specifically for freelancers and solo agencies.
                Automate reminders, protect your work, and get paid on time.
              </p>
              <Button
                size="lg"
                className="text-lg px-8 py-6"
                onClick={() => setShowAuth(true)}
                data-testid="get-started-btn"
              >
                Start Free Trial
              </Button>
            </div>
            <div className="relative">
              <img
                src="https://images.pexels.com/photos/251225/pexels-photo-251225.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
                alt="Minimalist workspace"
                className="rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 md:py-32" data-testid="features-section">
        <div className="container mx-auto px-4 md:px-8 max-w-7xl">
          <h2 className="text-4xl md:text-5xl font-heading font-semibold tracking-tight text-center mb-16">
            Everything You Need to Get Paid
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="hover:shadow-md hover:border-primary/20 transition-all duration-300">
                  <CardHeader>
                    <Icon className="h-12 w-12 text-primary mb-4" />
                    <CardTitle className="text-2xl font-heading">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 md:py-32 bg-muted/50" data-testid="pricing-section">
        <div className="container mx-auto px-4 md:px-8 max-w-7xl">
          <h2 className="text-4xl md:text-5xl font-heading font-semibold tracking-tight text-center mb-16">
            Simple, Transparent Pricing
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <Card
                key={index}
                className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl font-heading">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-5xl font-heading font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full mt-8"
                    variant={plan.popular ? 'default' : 'outline'}
                    onClick={() => setShowAuth(true)}
                    data-testid={`pricing-${plan.name.toLowerCase()}-btn`}
                  >
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
