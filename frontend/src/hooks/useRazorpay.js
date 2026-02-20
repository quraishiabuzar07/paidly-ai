import { useCallback } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';

// Load Razorpay script
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const useRazorpay = () => {
  const initiateInvoicePayment = useCallback(async (invoiceId, invoiceNumber, clientInfo) => {
    try {
      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error('Failed to load payment gateway');
        return;
      }

      // Create Razorpay order
      const response = await api.post(`/razorpay/create-order?invoice_id=${invoiceId}`);
      const { order_id, amount, currency, key_id } = response.data;

      // Razorpay options
      const options = {
        key: key_id,
        amount: amount,
        currency: currency,
        order_id: order_id,
        name: 'ClientNudge AI',
        description: `Payment for Invoice ${invoiceNumber}`,
        image: 'https://via.placeholder.com/150',
        prefill: {
          name: clientInfo.name,
          email: clientInfo.email,
          contact: clientInfo.phone || '',
        },
        notes: {
          invoice_id: invoiceId,
        },
        theme: {
          color: '#4361EE',
        },
        handler: async function (response) {
          try {
            // Verify payment on backend
            await api.post('/razorpay/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            toast.success('Payment successful! Deliverables unlocked.');
            
            // Reload page to show updated status
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          } catch (error) {
            toast.error('Payment verification failed. Please contact support.');
            console.error('Payment verification error:', error);
          }
        },
        modal: {
          ondismiss: function () {
            toast.info('Payment cancelled');
          },
        },
      };

      // Open Razorpay checkout
      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to initiate payment');
      console.error('Payment initiation error:', error);
    }
  }, []);

  const initiateSubscriptionPayment = useCallback(async (plan, userInfo) => {
    try {
      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error('Failed to load payment gateway');
        return;
      }

      // Create Razorpay subscription order
      const response = await api.post(`/razorpay/create-subscription-order?plan=${plan}`);
      const { order_id, amount, currency, key_id } = response.data;

      // Plan names
      const planNames = {
        pro: 'Pro Plan - Monthly',
        agency: 'Agency Plan - Monthly',
      };

      // Razorpay options
      const options = {
        key: key_id,
        amount: amount,
        currency: currency,
        order_id: order_id,
        name: 'ClientNudge AI',
        description: planNames[plan] || 'Subscription',
        image: 'https://via.placeholder.com/150',
        prefill: {
          name: userInfo.name,
          email: userInfo.email,
        },
        notes: {
          plan: plan,
          type: 'subscription',
        },
        theme: {
          color: '#4361EE',
        },
        handler: async function (response) {
          try {
            // Verify subscription payment on backend
            await api.post('/razorpay/verify-subscription-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan: plan,
            });

            toast.success(`${planNames[plan]} activated successfully!`);
            
            // Reload page to show updated subscription
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          } catch (error) {
            toast.error('Payment verification failed. Please contact support.');
            console.error('Subscription verification error:', error);
          }
        },
        modal: {
          ondismiss: function () {
            toast.info('Payment cancelled');
          },
        },
      };

      // Open Razorpay checkout
      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to initiate subscription payment');
      console.error('Subscription payment error:', error);
    }
  }, []);

  return {
    initiateInvoicePayment,
    initiateSubscriptionPayment,
  };
};
