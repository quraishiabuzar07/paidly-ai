import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import api from '../lib/api';
import { CURRENCIES } from '../utils/currency';
import { Plus, FolderKanban } from 'lucide-react';
import { toast } from 'sonner';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';

const Projects = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createClientDialogOpen, setCreateClientDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    client_id: '',
    name: '',
    total_value: '',
    currency: user?.base_currency || 'USD',
    deadline: '',
  });
  const [clientFormData, setClientFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [projectsRes, clientsRes] = await Promise.all([
        api.get('/projects'),
        api.get('/clients'),
      ]);
      setProjects(projectsRes.data);
      setClients(clientsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/clients', clientFormData);
      setClients([...clients, response.data]);
      toast.success('Client created successfully');
      setCreateClientDialogOpen(false);
      setClientFormData({ name: '', email: '', phone: '', company: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create client');
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/projects', {
        ...formData,
        total_value: parseFloat(formData.total_value),
      });
      setProjects([...projects, response.data]);
      toast.success('Project created successfully');
      setCreateDialogOpen(false);
      setFormData({
        client_id: '',
        name: '',
        total_value: '',
        currency: user?.base_currency || 'USD',
        deadline: '',
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create project');
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
              <h1 className="text-4xl font-heading font-bold tracking-tight">Projects</h1>
              <p className="text-muted-foreground mt-2">Manage your projects and track progress</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCreateClientDialogOpen(true)} data-testid="add-client-btn">
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </Button>
              <Button onClick={() => setCreateDialogOpen(true)} data-testid="create-project-btn">
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <FolderKanban className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No projects yet</p>
                  <Button onClick={() => setCreateDialogOpen(true)} data-testid="create-first-project-btn">
                    Create Your First Project
                  </Button>
                </CardContent>
              </Card>
            ) : (
              projects.map((project) => (
                <Card key={project.id} className="hover:shadow-md transition-shadow" data-testid={`project-${project.id}`}>
                  <CardHeader>
                    <CardTitle className="text-xl font-heading">{project.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {clients.find((c) => c.id === project.client_id)?.name || 'Unknown Client'}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Value</p>
                      <p className="text-2xl font-mono font-bold">
                        {CURRENCIES.find((c) => c.code === project.currency)?.symbol}
                        {project.total_value.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Progress</span>
                        <span className="font-medium">{project.completion_percentage.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${project.completion_percentage}%` }}
                        ></div>
                      </div>
                    </div>
                    {project.deadline && (
                      <p className="text-sm text-muted-foreground">
                        Deadline: {new Date(project.deadline).toLocaleDateString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create Client Dialog */}
      <Dialog open={createClientDialogOpen} onOpenChange={setCreateClientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>Add a client to associate with your projects and invoices</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateClient}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-name">Client Name *</Label>
                <Input
                  id="client-name"
                  value={clientFormData.name}
                  onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })}
                  required
                  data-testid="client-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-email">Email *</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={clientFormData.email}
                  onChange={(e) => setClientFormData({ ...clientFormData, email: e.target.value })}
                  required
                  data-testid="client-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-phone">Phone</Label>
                <Input
                  id="client-phone"
                  value={clientFormData.phone}
                  onChange={(e) => setClientFormData({ ...clientFormData, phone: e.target.value })}
                  data-testid="client-phone-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-company">Company</Label>
                <Input
                  id="client-company"
                  value={clientFormData.company}
                  onChange={(e) => setClientFormData({ ...clientFormData, company: e.target.value })}
                  data-testid="client-company-input"
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="submit" data-testid="submit-client-btn">Create Client</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Project Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>Start tracking a new project for your client</DialogDescription>
          </DialogHeader>
          {clients.length === 0 ? (
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-4">You need to add a client first before creating a project.</p>
              <Button onClick={() => {
                setCreateDialogOpen(false);
                setCreateClientDialogOpen(true);
              }} data-testid="add-client-first-btn">
                Add Client First
              </Button>
            </div>
          ) : (
            <form onSubmit={handleCreateProject}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project-client">Client *</Label>
                  <Select value={formData.client_id} onValueChange={(value) => setFormData({ ...formData, client_id: value })} required>
                    <SelectTrigger data-testid="project-client-select">
                      <SelectValue placeholder="Select client" />
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
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name *</Label>
                  <Input
                    id="project-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="project-name-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="project-value">Total Value *</Label>
                    <Input
                      id="project-value"
                      type="number"
                      step="0.01"
                      value={formData.total_value}
                      onChange={(e) => setFormData({ ...formData, total_value: e.target.value })}
                      required
                      data-testid="project-value-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project-currency">Currency</Label>
                    <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                      <SelectTrigger data-testid="project-currency-select">
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
                <div className="space-y-2">
                  <Label htmlFor="project-deadline">Deadline</Label>
                  <Input
                    id="project-deadline"
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    data-testid="project-deadline-input"
                  />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="submit" data-testid="submit-project-btn">Create Project</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Projects;
