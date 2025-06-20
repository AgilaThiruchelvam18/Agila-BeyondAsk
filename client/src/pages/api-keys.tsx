import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Shield, Key, PlusCircle, Star, Info, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { PageHeader } from '@/components/ui/page-header';

interface Provider {
  id: number;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
}

interface ApiKey {
  id: string;
  providerId: number;
  providerName: string;
  keyName: string;
  maskedKey: string;
  isDefault: boolean;
  createdAt: string;
}

interface ApiKeysPageProps {
  embeddedView?: boolean;
}

const ApiKeysPage: React.FC<ApiKeysPageProps> = ({ embeddedView = false }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [keyName, setKeyName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Fetch providers
  const { data: providers = [], isLoading: isLoadingProviders } = useQuery({
    queryKey: ['/api/llm/providers'],
    queryFn: () => apiRequest('/api/llm/providers'),
    staleTime: 1000 * 60 * 5 // 5 minutes
  });
  
  // Effect to check the direct API access (removed in prod)
  useEffect(() => {
    const checkApiDirectly = async () => {
      try {
        console.log('Attempting direct fetch to /api/llm/providers');
        const response = await fetch('/api/llm/providers');
        if (!response.ok) {
          console.error('API Error:', response.status, response.statusText);
          return;
        }
        const data = await response.json();
        console.log('Direct API fetch result:', data);
      } catch (error) {
        console.error('Direct fetch error:', error);
      }
    };

    checkApiDirectly();
  }, []);

  // Fetch API keys
  const { data: apiKeys = [], isLoading: isLoadingKeys } = useQuery<ApiKey[]>({
    queryKey: ['/api/llm/api-keys'],
    queryFn: () => apiRequest('/api/llm/api-keys'),
    staleTime: 1000 * 60 // 1 minute
  });
  
  // Add API key mutation
  const addKeyMutation = useMutation({
    mutationFn: (newKey: { providerId: number, keyName: string, apiKey: string, isDefault: boolean }) => {
      console.log('Submitting key data:', newKey);
      return apiRequest('/api/llm/api-keys', {
        method: 'POST',
        data: newKey
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/llm/api-keys'] });
      toast({
        title: "API Key Added",
        description: "Your API key has been securely stored.",
        variant: "default",
      });
      setSelectedProvider(null);
      setKeyName('');
      setApiKey('');
      setIsDefault(false);
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error Adding API Key",
        description: error.message || "Failed to add API key. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Delete API key mutation
  const deleteKeyMutation = useMutation({
    mutationFn: (keyId: string) => {
      return apiRequest(`/api/llm/api-keys/${keyId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/llm/api-keys'] });
      toast({
        title: "API Key Deleted",
        description: "Your API key has been removed.",
        variant: "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Deleting API Key",
        description: error.message || "Failed to delete API key. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Set default API key mutation
  const setDefaultKeyMutation = useMutation({
    mutationFn: (keyId: string) => {
      return apiRequest(`/api/llm/api-keys/${keyId}/default`, {
        method: 'PUT'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/llm/api-keys'] });
      toast({
        title: "Default API Key Updated",
        description: "Your default API key has been updated.",
        variant: "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Updating Default Key",
        description: error.message || "Failed to update default API key. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider || !keyName || !apiKey) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      providerId: selectedProvider,
      keyName,
      apiKey,
      isDefault
    };
    
    addKeyMutation.mutate(payload as any);
  };

  const handleDelete = (keyId: string) => {
    if (window.confirm("Are you sure you want to delete this API key?")) {
      deleteKeyMutation.mutate(keyId);
    }
  };

  const handleSetDefault = (keyId: string) => {
    setDefaultKeyMutation.mutate(keyId);
  };

  // Get provider name by ID
  const getProviderName = (providerId: number) => {
    const provider = providers?.find((p: Provider) => p.id === providerId);
    return provider ? provider.name : "Unknown Provider";
  };

  // Loading state
  if (isLoadingProviders || isLoadingKeys) {
    return embeddedView ? (
      <div className="flex justify-center my-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    ) : (
      <DashboardLayout>
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  // Dialog for adding a new API key
  const addKeyDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">
          <PlusCircle className="h-4 w-4 mr-2" />
          Add API Key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add API Key</DialogTitle>
          <DialogDescription>
            Add an API key for an LLM provider. Your key will be encrypted and stored securely.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={selectedProvider || ""}
                onValueChange={setSelectedProvider}
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers?.map((provider: Provider) => (
                    <SelectItem key={provider.id} value={provider.id.toString()}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="keyName">Key Name</Label>
              <Input
                id="keyName"
                placeholder="My OpenAI Key"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter your API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Your API key is encrypted and stored securely.
              </p>
            </div>

            <div className="flex flex-col space-y-2 p-3 bg-muted/30 rounded-md border border-dashed">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isDefault"
                    checked={isDefault}
                    onCheckedChange={setIsDefault}
                  />
                  <Label htmlFor="isDefault" className="text-sm font-medium">
                    Set as default for this provider
                  </Label>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Info className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs max-w-48">Only one default key is allowed per provider. Setting this as default will replace any existing default key.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {selectedProvider && (
                <p className="text-xs text-muted-foreground">
                  This key will be used as the default for all {providers.find((p: any) => p.id.toString() === selectedProvider)?.name || "provider"} operations.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={addKeyMutation.isPending}>
              {addKeyMutation.isPending ? "Adding..." : "Add API Key"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  // Main content
  const content = (
    <>
      {!embeddedView && (
        <PageHeader
          title="API Keys"
          description="Manage your LLM provider API keys"
          actions={addKeyDialog}
        />
      )}

      <div className={embeddedView ? "" : "space-y-6 p-6"}>
        <Card>
          <CardHeader className="flex flex-row justify-between items-start">
            <div>
              <CardTitle>Your API Keys</CardTitle>
              <CardDescription>
                Manage your API keys for different LLM providers
              </CardDescription>
            </div>
            {embeddedView && addKeyDialog}
          </CardHeader>
          <CardContent>
            {apiKeys.length === 0 ? (
              <div className="text-center py-8">
                <Key className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No API Keys Found</h3>
                <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                  You haven't added any API keys yet. Add an API key to start using LLM providers.
                </p>
              </div>
            ) : (
              <>
                {/* Check for duplicate default keys */}
                {(() => {
                  // Check for providers with multiple default keys
                  const providerDefaultKeyCounts = new Map<number, number>();
                  const providersWithMultipleDefaults = new Map<number, string[]>();
                  
                  apiKeys.forEach(key => {
                    if (key.isDefault) {
                      const count = providerDefaultKeyCounts.get(key.providerId) || 0;
                      providerDefaultKeyCounts.set(key.providerId, count + 1);
                      
                      if (count === 1) { // This is the second default key
                        providersWithMultipleDefaults.set(key.providerId, [
                          ...(providersWithMultipleDefaults.get(key.providerId) || []),
                          key.keyName
                        ]);
                      } else if (count > 1) { // This is the third+ default key
                        providersWithMultipleDefaults.set(key.providerId, [
                          ...(providersWithMultipleDefaults.get(key.providerId) || []),
                          key.keyName
                        ]);
                      }
                    }
                  });
                  
                  // If we have any providers with multiple default keys, show a warning
                  if (providersWithMultipleDefaults.size > 0) {
                    return (
                      <div className="mb-6 p-4 border border-amber-300 bg-amber-50 rounded-md">
                        <div className="flex items-start">
                          <div className="flex-shrink-0">
                            <Info className="h-5 w-5 text-amber-500" aria-hidden="true" />
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-amber-800">
                              Multiple default API keys detected
                            </h3>
                            <div className="mt-2 text-sm text-amber-700">
                              <p className="mb-1">
                                The following providers have multiple keys set as default:
                              </p>
                              <ul className="list-disc pl-5 space-y-1">
                                {Array.from(providersWithMultipleDefaults.entries()).map(([providerId, keyNames]) => (
                                  <li key={providerId}>
                                    <strong>{apiKeys.find(k => k.providerId === providerId)?.providerName || `Provider ${providerId}`}:</strong> {keyNames.join(', ')}
                                  </li>
                                ))}
                              </ul>
                              <p className="mt-2">
                                Click "Make Default" on the key you want to use to fix this issue.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  return null;
                })()}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Key Name</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys?.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell>{key.providerName || getProviderName(key.providerId)}</TableCell>
                        <TableCell>{key.keyName}</TableCell>
                        <TableCell>{new Date(key.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {key.isDefault ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Default
                              </Badge>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                      <Info className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs max-w-48">This is your default key for {key.providerName} and will be used for all operations</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleSetDefault(key.id)}
                              disabled={setDefaultKeyMutation.isPending}
                              className="border-dashed"
                            >
                              {setDefaultKeyMutation.isPending ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Setting...
                                </>
                              ) : (
                                <>
                                  <Star className="h-3 w-3 mr-1" />
                                  Make Default
                                </>
                              )}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(key.id)}
                            disabled={deleteKeyMutation.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
          <CardFooter className="bg-muted/50 border-t px-6 py-3">
            <div className="flex items-center text-sm text-muted-foreground">
              <Shield className="h-4 w-4 mr-2" />
              Your API keys are encrypted and stored securely
            </div>
          </CardFooter>
        </Card>
      </div>
    </>
  );

  return embeddedView ? content : <DashboardLayout>{content}</DashboardLayout>;
};

export default ApiKeysPage;