import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle, XCircle, Shield, Key, PlusCircle, Calendar, AlertCircle, Copy } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimit: number | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revoked: boolean;
  teamId: number | null;
}

interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  rateLimit: number | null;
  expiresAt: string | null;
  teamId?: number | null;
}

interface ApiWebhookKeysPageProps {
  embeddedView?: boolean;
}

const ApiWebhookKeysPage = ({ embeddedView = false }: ApiWebhookKeysPageProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newKeyDialogOpen, setNewKeyDialogOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState<Partial<CreateApiKeyRequest>>({
    name: '',
    scopes: ['agent:read', 'agent:chat'],
    rateLimit: 100,
    expiresAt: null
  });
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [showKeyDialog, setShowKeyDialog] = useState(false);

  // Fetch API keys
  const { data: apiKeys = [], isLoading: isLoadingKeys } = useQuery<ApiKey[]>({
    queryKey: ['/api/keys'],
    queryFn: () => apiRequest('/api/keys'),
    staleTime: 1000 * 60 // 1 minute
  });
  
  // Create API key mutation
  const createKeyMutation = useMutation({
    mutationFn: (data: CreateApiKeyRequest) => {
      return apiRequest('/api/keys', {
        method: 'POST',
        data,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/keys'] });
      setNewlyCreatedKey(response.fullKey);
      setShowKeyDialog(true);
      setNewKeyDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error Creating API Key",
        description: error.message || "Failed to create API key. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Revoke API key mutation
  const revokeKeyMutation = useMutation({
    mutationFn: (keyId: number) => {
      return apiRequest(`/api/keys/${keyId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/keys'] });
      toast({
        title: "API Key Revoked",
        description: "Your API key has been permanently revoked.",
        variant: "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Revoking API Key",
        description: error.message || "Failed to revoke API key. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleCreateKey = () => {
    if (!createFormData.name) {
      toast({
        title: "Missing Information",
        description: "Please provide a name for your API key.",
        variant: "destructive",
      });
      return;
    }

    createKeyMutation.mutate(createFormData as CreateApiKeyRequest);
  };

  const handleRevokeKey = (keyId: number) => {
    if (confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      revokeKeyMutation.mutate(keyId);
    }
  };

  const resetForm = () => {
    setCreateFormData({
      name: '',
      scopes: ['agent:read', 'agent:chat'],
      rateLimit: 100,
      expiresAt: null
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
      variant: "default",
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const handleScopeChange = (scope: string, isChecked: boolean) => {
    setCreateFormData(prev => {
      const currentScopes = prev.scopes || [];
      if (isChecked) {
        return { ...prev, scopes: [...currentScopes, scope] };
      } else {
        return { ...prev, scopes: currentScopes.filter(s => s !== scope) };
      }
    });
  };

  // Create API Key Dialog
  const createKeyDialog = (
    <Dialog open={newKeyDialogOpen} onOpenChange={setNewKeyDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New API Key</DialogTitle>
          <DialogDescription>
            Create a new API key for programmatic access to your agents.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">API Key Name</Label>
            <Input
              id="name"
              placeholder="E.g., Production, Testing, Website Integration"
              value={createFormData.name}
              onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="scopes">API Key Permissions</Label>
            <div className="space-y-2 border rounded-md p-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="agent-read"
                  checked={createFormData.scopes?.includes('agent:read')}
                  onCheckedChange={(checked) => 
                    handleScopeChange('agent:read', checked === true)
                  }
                />
                <Label htmlFor="agent-read">agent:read - Read agents and their settings</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="agent-chat"
                  checked={createFormData.scopes?.includes('agent:chat')}
                  onCheckedChange={(checked) => 
                    handleScopeChange('agent:chat', checked === true)
                  }
                />
                <Label htmlFor="agent-chat">agent:chat - Chat with agents</Label>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="rateLimit">Rate Limit (requests per minute)</Label>
            <Input
              id="rateLimit"
              type="number"
              min="1"
              max="1000"
              value={createFormData.rateLimit || ''}
              onChange={(e) => setCreateFormData({ 
                ...createFormData, 
                rateLimit: e.target.value ? parseInt(e.target.value) : null 
              })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="expiration">Expiration (Optional)</Label>
            <Input
              id="expiration"
              type="datetime-local"
              value={createFormData.expiresAt || ''}
              onChange={(e) => setCreateFormData({ 
                ...createFormData, 
                expiresAt: e.target.value || null 
              })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setNewKeyDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateKey} disabled={createKeyMutation.isPending}>
            {createKeyMutation.isPending ? 'Creating...' : 'Create API Key'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // API Key Created Dialog
  const createdKeyDialog = (
    <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
      <DialogContent className="">
        <DialogHeader>
          <DialogTitle>API Key Created</DialogTitle>
          <DialogDescription>
            <div className="flex items-center text-amber-600 mt-2 mb-4">
              <AlertCircle className="h-5 w-5 mr-2" />
              Your API key is shown only once. Please copy it now.
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="apiKey">Your API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                value={newlyCreatedKey || ''}
                readOnly
                className="pr-10 font-mono"
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-0 top-0 h-full" 
                onClick={() => copyToClipboard(newlyCreatedKey || '')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Tabs defaultValue="curl">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
            </TabsList>

            <TabsContent value="curl">
              <ScrollArea className="h-60 w-full rounded-md border p-4">
                <pre className="text-sm font-mono whitespace-pre-wrap">
{`# Example API request
curl -X POST \\
  https://yourapp.com/api/webhook/chat \\
  -H "Authorization: Bearer ${newlyCreatedKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": 123,
    "message": "What can you tell me about this product?"
  }'`}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="javascript">
              <ScrollArea className="h-60 w-full rounded-md border p-4">
                <pre className="text-sm font-mono whitespace-pre-wrap">
{`// Example API request with JavaScript
const apiKey = "${newlyCreatedKey}";

async function chatWithAgent(agentId, message) {
  const response = await fetch('https://yourapp.com/api/webhook/chat', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${apiKey}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agentId,
      message,
    }),
  });
  
  return response.json();
}

// Usage
chatWithAgent(123, "What can you tell me about this product?")
  .then(result => console.log(result))
  .catch(error => console.error(error));`}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="python">
              <ScrollArea className="h-60 w-full rounded-md border p-4">
                <pre className="text-sm font-mono whitespace-pre-wrap">
{`# Example API request with Python
import requests

api_key = "${newlyCreatedKey}"

def chat_with_agent(agent_id, message):
    url = "https://yourapp.com/api/webhook/chat"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "agentId": agent_id,
        "message": message
    }
    
    response = requests.post(url, json=payload, headers=headers)
    return response.json()

# Usage
response = chat_with_agent(123, "What can you tell me about this product?")
print(response)`}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
        <DialogFooter>
          <Button onClick={() => setShowKeyDialog(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Main content
  const content = (
    <>
      {!embeddedView && (
        <PageHeader 
          title="API Webhook Keys"
          description="Create and manage API keys for programmatic access to your agents"
        />
      )}

      <div className={embeddedView ? "mb-4 flex justify-end" : "mb-6 flex justify-end"}>
        <Button onClick={() => setNewKeyDialogOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Create New API Key
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>
            These keys allow external systems to interact with your agents via API webhooks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingKeys ? (
            <div className="text-center py-4">Loading API keys...</div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No API keys yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first API key to enable external access to your agents.
              </p>
              <Button onClick={() => setNewKeyDialogOpen(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Create API Key
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>{key.keyPrefix}...</TableCell>
                    <TableCell>{formatDate(key.createdAt)}</TableCell>
                    <TableCell>{formatDate(key.lastUsedAt)}</TableCell>
                    <TableCell>
                      {key.expiresAt ? (
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(key.expiresAt) < new Date() 
                            ? <span className="text-red-500">Expired</span> 
                            : formatDate(key.expiresAt)
                          }
                        </div>
                      ) : (
                        'Never'
                      )}
                    </TableCell>
                    <TableCell>
                      {key.revoked ? (
                        <Badge variant="destructive" className="flex items-center">
                          <XCircle className="h-3 w-3 mr-1" />
                          Revoked
                        </Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-500 flex items-center">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!key.revoked && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevokeKey(key.id)}
                          disabled={revokeKeyMutation.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="bg-muted/50 border-t px-6 py-3">
          <div className="flex items-center text-sm text-muted-foreground">
            <Shield className="h-4 w-4 mr-2" />
            Your API keys are encrypted and stored securely
          </div>
        </CardFooter>
      </Card>

      {/* Documentation card - we'll show this only if not in embedded view */}
      {!embeddedView && (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>API Documentation</CardTitle>
              <CardDescription>Learn how to use the API with your API keys</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>Authentication</AccordionTrigger>
                  <AccordionContent>
                    <p className="mb-4">
                      All API requests require authentication using your API key. 
                      Pass your API key in the Authorization header using the Bearer scheme.
                    </p>
                    <pre className="bg-muted p-2 rounded text-sm">
                      Authorization: Bearer your_api_key
                    </pre>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2">
                  <AccordionTrigger>Rate Limiting</AccordionTrigger>
                  <AccordionContent>
                    <p>API requests are rate limited based on the settings for your API key.</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      <li>The default rate limit is 100 requests per minute.</li>
                      <li>When exceeded, requests will receive a 429 Too Many Requests response.</li>
                      <li>The response will include headers indicating the rate limit and when it resets.</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3">
                  <AccordionTrigger>API Endpoints</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium">GET /api/webhook/agents</h4>
                        <p className="text-sm text-muted-foreground mt-1">List all available agents</p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium">GET /api/webhook/agents/:id</h4>
                        <p className="text-sm text-muted-foreground mt-1">Get details for a specific agent</p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium">POST /api/webhook/chat</h4>
                        <p className="text-sm text-muted-foreground mt-1">Send a message to an agent</p>
                        <pre className="bg-muted p-2 rounded text-sm mt-2">
{`{
  "agentId": 123,
  "message": "What can you tell me about this product?",
  "conversationId": "optional-conversation-id"
}`}
                        </pre>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
            <CardFooter className="bg-muted/50 border-t px-6 py-3">
              <p className="text-sm text-muted-foreground">
                For detailed API documentation, visit our <a href="/api-docs" className="text-primary hover:underline">API Docs page</a>.
              </p>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Dialogs */}
      {createKeyDialog}
      {createdKeyDialog}
    </>
  );
  
  // Return the content wrapped in the appropriate layout
  return embeddedView ? (
    <div className={embeddedView ? "px-4 py-4" : ""}>
      {content}
    </div>
  ) : (
    <DashboardLayout>
      <div className="container px-4 py-4 mx-auto max-w-7xl">
        {content}
      </div>
    </DashboardLayout>
  );
};

export default ApiWebhookKeysPage;