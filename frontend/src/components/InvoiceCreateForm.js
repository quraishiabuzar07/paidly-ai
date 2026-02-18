import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import api from '../lib/api';
import { CURRENCIES } from '../utils/currency';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const InvoiceCreateForm = ({ open, onOpenChange, clients, onSuccess }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    client_id: '',
    project_id: null,
    currency: 'USD',
    items: [{ description: '', quantity: 1, rate: 0 }],
    tax_percentage: 0,
    discount_type: 'none',
    discount_value: 0,
    late_fee_enabled: false,
    late_fee_percentage: 5,
    late_fee_days: 7,
    auto_reminders: true,
    due_date: '',
  });

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: 1, rate: 0 }],
    });
  };

  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    let discountAmount = 0;
    if (formData.discount_type === 'percentage') {
      discountAmount = subtotal * (formData.discount_value / 100);
    } else if (formData.discount_type === 'fixed') {
      discountAmount = formData.discount_value;
    }
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * (formData.tax_percentage / 100);
    return subtotal - discountAmount + taxAmount;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.items.length === 0 || !formData.items[0].description) {
      toast.error('Please add at least one item');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/invoices', {
        ...formData,
        tax_percentage: parseFloat(formData.tax_percentage) || 0,
        discount_value: parseFloat(formData.discount_value) || 0,
        late_fee_percentage: parseFloat(formData.late_fee_percentage) || 5,
      });

      toast.success('Invoice created successfully!');
      onOpenChange(false);
      if (onSuccess) onSuccess();
      navigate(`/invoices/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  const subtotal = calculateSubtotal();
  const total = calculateTotal();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className=\"max-w-4xl max-h-[90vh] overflow-y-auto\">
        <DialogHeader>
          <DialogTitle>Create New Invoice</DialogTitle>
          <DialogDescription>Create a professional invoice with all features</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className=\"space-y-6\">
          {/* Client Selection */}
          <div className=\"grid md:grid-cols-2 gap-4\">
            <div className=\"space-y-2\">
              <Label>Client *</Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                required
              >
                <SelectTrigger data-testid=\"client-select\">
                  <SelectValue placeholder=\"Select client\" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name} - {client.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className=\"space-y-2\">
              <Label>Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code} - {currency.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Invoice Items */}
          <div className=\"space-y-3\">
            <div className=\"flex items-center justify-between\">
              <Label>Items *</Label>
              <Button type=\"button\" size=\"sm\" onClick={handleAddItem} data-testid=\"add-item-btn\">
                <Plus className=\"h-4 w-4 mr-1\" />
                Add Item
              </Button>
            </div>

            {formData.items.map((item, index) => (
              <div key={index} className=\"grid grid-cols-12 gap-2 items-end\">
                <div className=\"col-span-5\">
                  <Input
                    placeholder=\"Description\"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    required
                  />
                </div>
                <div className=\"col-span-2\">
                  <Input
                    type=\"number\"
                    placeholder=\"Qty\"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    min=\"1\"
                    required
                  />
                </div>
                <div className=\"col-span-2\">
                  <Input
                    type=\"number\"
                    placeholder=\"Rate\"
                    value={item.rate}
                    onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                    step=\"0.01\"
                    min=\"0\"
                    required
                  />
                </div>
                <div className=\"col-span-2\">
                  <Input
                    value={`${CURRENCIES.find(c => c.code === formData.currency)?.symbol}${(item.quantity * item.rate).toFixed(2)}`}
                    disabled
                  />
                </div>
                <div className=\"col-span-1\">
                  {formData.items.length > 1 && (
                    <Button
                      type=\"button\"
                      variant=\"ghost\"
                      size=\"icon\"
                      onClick={() => handleRemoveItem(index)}
                    >
                      <Trash2 className=\"h-4 w-4\" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Tax and Discount */}
          <div className=\"grid md:grid-cols-3 gap-4\">
            <div className=\"space-y-2\">
              <Label>Tax %</Label>
              <Input
                type=\"number\"
                value={formData.tax_percentage}
                onChange={(e) => setFormData({ ...formData, tax_percentage: e.target.value })}
                step=\"0.01\"
                min=\"0\"
                data-testid=\"tax-input\"
              />
            </div>

            <div className=\"space-y-2\">
              <Label>Discount Type</Label>
              <Select
                value={formData.discount_type}
                onValueChange={(value) => setFormData({ ...formData, discount_type: value })}
              >
                <SelectTrigger data-testid=\"discount-type-select\">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=\"none\">No Discount</SelectItem>
                  <SelectItem value=\"percentage\">Percentage</SelectItem>
                  <SelectItem value=\"fixed\">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.discount_type !== 'none' && (
              <div className=\"space-y-2\">
                <Label>Discount Value</Label>
                <Input
                  type=\"number\"
                  value={formData.discount_value}
                  onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                  step=\"0.01\"
                  min=\"0\"
                  data-testid=\"discount-value-input\"
                />
              </div>
            )}
          </div>

          {/* Due Date */}
          <div className=\"space-y-2\">
            <Label>Due Date *</Label>
            <Input
              type=\"date\"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              required
              data-testid=\"due-date-input\"
            />
          </div>

          {/* Late Fee Settings */}
          <div className=\"space-y-4 p-4 rounded-lg border\">
            <div className=\"flex items-center justify-between\">
              <div>
                <Label>Enable Late Fee</Label>
                <p className=\"text-sm text-muted-foreground\">Automatically apply late fee after due date</p>
              </div>
              <Switch
                checked={formData.late_fee_enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, late_fee_enabled: checked })}
                data-testid=\"late-fee-toggle\"
              />
            </div>

            {formData.late_fee_enabled && (
              <div className=\"grid md:grid-cols-2 gap-4\">
                <div className=\"space-y-2\">
                  <Label>Late Fee %</Label>
                  <Input
                    type=\"number\"
                    value={formData.late_fee_percentage}
                    onChange={(e) => setFormData({ ...formData, late_fee_percentage: e.target.value })}
                    step=\"0.01\"
                    min=\"0\"
                    data-testid=\"late-fee-percentage-input\"
                  />
                </div>
                <div className=\"space-y-2\">
                  <Label>Apply After (days)</Label>
                  <Input
                    type=\"number\"
                    value={formData.late_fee_days}
                    onChange={(e) => setFormData({ ...formData, late_fee_days: e.target.value })}
                    min=\"1\"
                    data-testid=\"late-fee-days-input\"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Auto Reminders */}
          <div className=\"flex items-center justify-between p-4 rounded-lg border\">
            <div>
              <Label>Automatic Reminders</Label>
              <p className=\"text-sm text-muted-foreground\">Send automated payment reminders</p>
            </div>
            <Switch
              checked={formData.auto_reminders}
              onCheckedChange={(checked) => setFormData({ ...formData, auto_reminders: checked })}
              data-testid=\"auto-reminders-toggle\"
            />
          </div>

          {/* Total Summary */}
          <div className=\"space-y-2 p-4 rounded-lg bg-muted/50\">
            <div className=\"flex justify-between text-sm\">
              <span>Subtotal:</span>
              <span className=\"font-mono\">{CURRENCIES.find(c => c.code === formData.currency)?.symbol}{subtotal.toFixed(2)}</span>
            </div>
            <div className=\"flex justify-between text-lg font-bold\">
              <span>Total:</span>
              <span className=\"font-mono\">{CURRENCIES.find(c => c.code === formData.currency)?.symbol}{total.toFixed(2)}</span>
            </div>
          </div>

          <DialogFooter>
            <Button type=\"button\" variant=\"outline\" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type=\"submit\" disabled={loading} data-testid=\"create-invoice-submit\">
              {loading ? 'Creating...' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceCreateForm;
