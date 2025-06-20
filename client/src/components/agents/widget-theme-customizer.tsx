import * as React from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Code, CopyIcon, CheckIcon, ExternalLink, Share2, RefreshCw, Save } from "lucide-react";
import { WidgetPreview } from "./widget-preview";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Widget configuration interface
interface WidgetConfig {
  theme: {
    primaryColor: string;
    textColor: string;
    backgroundColor: string;
  };
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  size: 'small' | 'medium' | 'large';
  welcomeMessage: string;
  widgetTitle: string;
  brandName: string;
  collectName: boolean;
  collectEmail: boolean;
  collectPhone: boolean;
  requireOtpVerification: boolean;
}

// Default configuration settings
const defaultConfig: WidgetConfig = {
  theme: {
    primaryColor: '#0078d4',
    textColor: '#ffffff',
    backgroundColor: '#ffffff',
  },
  position: 'bottom-right',
  size: 'medium',
  welcomeMessage: 'Hello! How can I help you today?',
  widgetTitle: 'AI Assistant',
  brandName: 'Support',
  collectName: true,
  collectEmail: true,
  collectPhone: false,
  requireOtpVerification: false
};

interface WidgetThemeCustomizerProps {
  agentId: number;
  agentName: string;
}

export function WidgetThemeCustomizer({ agentId, agentName }: WidgetThemeCustomizerProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState<WidgetConfig>({
    ...defaultConfig,
    widgetTitle: agentName || defaultConfig.widgetTitle
  });
  
  // Query for existing widget or use the widget created in the parent component
  const { data: widget, isLoading: isWidgetLoading } = useQuery({
    queryKey: [`/api/agents/${agentId}/widget`],
    queryFn: async () => {
      const response = await fetch(`/api/agents/${agentId}/widget`);
      if (response.ok) {
        return response.json();
      }
      throw new Error('Failed to fetch widget');
    }
  });
  
  // Initialize query client for mutations
  const queryClient = useQueryClient();
  
  // Use the widget's public key for the embed code
  const widgetPublicKey = widget?.publicKey || '';
  
  // Load widget config from server if available
  useEffect(() => {
    if (widget && widget.config) {
      setConfig({
        ...config,
        ...widget.config,
        widgetTitle: widget.config.widgetTitle || agentName || defaultConfig.widgetTitle
      });
    }
  }, [widget, agentName]);
  
  // Generate embed code based on current configuration
  const generateEmbedCode = () => {
    // Fields for user collection
    const userFields = [];
    if (config.collectName) userFields.push('name');
    if (config.collectEmail) userFields.push('email');
    if (config.collectPhone) userFields.push('phone');
    
    return `<!-- BeyondAsk Widget Code -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['BeyondAskWidget']=o;w[o]=w[o]||function(){
      (w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','beyondWidget',window.location.origin + '/widget.js'));
  
  beyondWidget('init', {
    publicKey: '${widgetPublicKey}', // Your unique widget key
    container: '#beyond-container',   // ID of container element (for embedded mode)
    
    // Basic configuration
    position: '${config.position}',
    size: '${config.size}',
    welcomeMessage: '${config.welcomeMessage}',
    widgetTitle: '${config.widgetTitle}',
    brandName: '${config.brandName}',
    
    // User information collection
    collectUserInfo: ${userFields.length > 0},
    userFields: ${JSON.stringify(userFields)},
    requireOtpVerification: ${config.requireOtpVerification},
    
    // Theme customization
    themeConfig: {
      primaryColor: '${config.theme.primaryColor}',
      textColor: '${config.theme.textColor}',
      backgroundColor: '${config.theme.backgroundColor}'
    }
  });
</script>

<!-- Add this div where you want the widget to appear -->
<div id="beyond-container"></div>`;
  };
  
  const [embedCode, setEmbedCode] = useState(generateEmbedCode());
  
  // Update embed code whenever configuration changes
  useEffect(() => {
    setEmbedCode(generateEmbedCode());
  }, [config]);
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode)
      .then(() => {
        setCopied(true);
        toast({
          title: "Code copied to clipboard",
          description: "You can now paste the widget code into your website.",
        });
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        toast({
          title: "Failed to copy code",
          description: "Please try selecting and copying the code manually.",
          variant: "destructive",
        });
      });
  };
  
  const generateShareableLink = () => {
    // Convert config to base64 string to create a sharable link
    const configBase64 = btoa(JSON.stringify(config));
    const shareUrl = `${window.location.origin}/widget-share?config=${encodeURIComponent(configBase64)}&agentId=${agentId}`;
    
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        toast({
          title: "Share link copied",
          description: "The configuration link has been copied to your clipboard.",
        });
      })
      .catch(err => {
        toast({
          title: "Failed to copy share link",
          description: "Please try again.",
          variant: "destructive",
        });
      });
  };
  
  // Add mutation to save widget configuration
  const [isSaving, setIsSaving] = useState(false);
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      if (!widget) {
        throw new Error('Widget not found');
      }
      
      // Use the widget's public key which is more reliable across the ID change
      return apiRequest(`/api/agents/${agentId}/widget`, {
        method: 'PUT',
        data: {
          publicKey: widget.publicKey,
          config: config
        }
      });
    },
    onSuccess: () => {
      // Invalidate and refetch the widget data
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}/widget`] });
      toast({
        title: "Changes saved",
        description: "Widget configuration has been updated successfully.",
      });
      setIsSaving(false);
    },
    onError: (error) => {
      console.error('Error saving widget config:', error);
      toast({
        title: "Failed to save changes",
        description: "An error occurred while saving widget configuration.",
        variant: "destructive",
      });
      setIsSaving(false);
    }
  });
  
  const saveChanges = () => {
    setIsSaving(true);
    saveConfigMutation.mutate();
  };
  
  const resetToDefaults = () => {
    setConfig({
      ...defaultConfig,
      widgetTitle: agentName || defaultConfig.widgetTitle
    });
    
    toast({
      title: "Settings reset",
      description: "All customization options have been reset to their default values.",
    });
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel - Customizer Controls */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Code className="mr-2 h-5 w-5" />
              Widget Customizer
            </CardTitle>
            <CardDescription>
              Customize your chat widget appearance and behavior
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="appearance" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="appearance">Appearance</TabsTrigger>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="behavior">Behavior</TabsTrigger>
              </TabsList>
              
              {/* Appearance Tab */}
              <TabsContent value="appearance" className="space-y-6 py-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Colors</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primaryColor">Primary Color</Label>
                      <div className="flex space-x-2">
                        <Input
                          id="primaryColor"
                          type="text"
                          value={config.theme.primaryColor}
                          onChange={(e) => setConfig({
                            ...config,
                            theme: { ...config.theme, primaryColor: e.target.value }
                          })}
                        />
                        <Input
                          type="color"
                          value={config.theme.primaryColor}
                          onChange={(e) => setConfig({
                            ...config,
                            theme: { ...config.theme, primaryColor: e.target.value }
                          })}
                          className="w-12 p-1 h-10"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Main color for buttons and accents
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="textColor">Text Color</Label>
                      <div className="flex space-x-2">
                        <Input
                          id="textColor"
                          type="text"
                          value={config.theme.textColor}
                          onChange={(e) => setConfig({
                            ...config,
                            theme: { ...config.theme, textColor: e.target.value }
                          })}
                        />
                        <Input
                          type="color"
                          value={config.theme.textColor}
                          onChange={(e) => setConfig({
                            ...config,
                            theme: { ...config.theme, textColor: e.target.value }
                          })}
                          className="w-12 p-1 h-10"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Text color for headers and buttons
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="backgroundColor">Background Color</Label>
                      <div className="flex space-x-2">
                        <Input
                          id="backgroundColor"
                          type="text"
                          value={config.theme.backgroundColor}
                          onChange={(e) => setConfig({
                            ...config,
                            theme: { ...config.theme, backgroundColor: e.target.value }
                          })}
                        />
                        <Input
                          type="color"
                          value={config.theme.backgroundColor}
                          onChange={(e) => setConfig({
                            ...config,
                            theme: { ...config.theme, backgroundColor: e.target.value }
                          })}
                          className="w-12 p-1 h-10"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Background color for the chat window
                      </p>
                    </div>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Size & Position</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="size">Widget Size</Label>
                        <Select 
                          value={config.size} 
                          onValueChange={(value: 'small' | 'medium' | 'large') => setConfig({
                            ...config,
                            size: value
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small">Small</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="large">Large</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="position">Widget Position</Label>
                        <Select 
                          value={config.position} 
                          onValueChange={(value: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left') => setConfig({
                            ...config,
                            position: value
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select position" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bottom-right">Bottom Right</SelectItem>
                            <SelectItem value="bottom-left">Bottom Left</SelectItem>
                            <SelectItem value="top-right">Top Right</SelectItem>
                            <SelectItem value="top-left">Top Left</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              {/* Content Tab */}
              <TabsContent value="content" className="space-y-6 py-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Text Content</h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="widgetTitle">Widget Title</Label>
                      <Input
                        id="widgetTitle"
                        value={config.widgetTitle}
                        onChange={(e) => setConfig({
                          ...config,
                          widgetTitle: e.target.value
                        })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Title displayed in the widget header
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="brandName">Brand Name</Label>
                      <Input
                        id="brandName"
                        value={config.brandName}
                        onChange={(e) => setConfig({
                          ...config,
                          brandName: e.target.value
                        })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Your brand name displayed beneath the widget title
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="welcomeMessage">Welcome Message</Label>
                      <Textarea
                        id="welcomeMessage"
                        value={config.welcomeMessage}
                        onChange={(e) => setConfig({
                          ...config,
                          welcomeMessage: e.target.value
                        })}
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground">
                        First message displayed when the chat is opened
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              {/* Behavior Tab */}
              <TabsContent value="behavior" className="space-y-6 py-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">User Information</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="collectName">Collect Name</Label>
                        <p className="text-xs text-muted-foreground">
                          Ask users for their name
                        </p>
                      </div>
                      <Switch
                        id="collectName"
                        checked={config.collectName}
                        onCheckedChange={(checked) => setConfig({
                          ...config,
                          collectName: checked
                        })}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="collectEmail">Collect Email</Label>
                        <p className="text-xs text-muted-foreground">
                          Ask users for their email address
                        </p>
                      </div>
                      <Switch
                        id="collectEmail"
                        checked={config.collectEmail}
                        onCheckedChange={(checked) => setConfig({
                          ...config,
                          collectEmail: checked
                        })}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="collectPhone">Collect Phone Number</Label>
                        <p className="text-xs text-muted-foreground">
                          Ask users for their phone number
                        </p>
                      </div>
                      <Switch
                        id="collectPhone"
                        checked={config.collectPhone}
                        onCheckedChange={(checked) => setConfig({
                          ...config,
                          collectPhone: checked
                        })}
                      />
                    </div>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <h3 className="text-lg font-medium">Authentication</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="requireOtpVerification">Email OTP Verification</Label>
                        <p className="text-xs text-muted-foreground">
                          Require email verification with a one-time password
                        </p>
                      </div>
                      <Switch
                        id="requireOtpVerification"
                        checked={config.requireOtpVerification}
                        onCheckedChange={(checked) => setConfig({
                          ...config,
                          requireOtpVerification: checked
                        })}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <div className="w-full flex flex-col md:flex-row gap-2 justify-start items-stretch">
              <Button 
                variant="default" 
                onClick={saveChanges} 
                className="flex-1"
                disabled={isSaving || isWidgetLoading}
              >
                {isSaving ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={copyToClipboard} 
                className="flex-1"
                disabled={isSaving}
              >
                {copied ? (
                  <>
                    <CheckIcon className="mr-2 h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <CopyIcon className="mr-2 h-4 w-4" />
                    Copy Embed Code
                  </>
                )}
              </Button>
              
              <Button 
                variant="ghost" 
                onClick={resetToDefaults}
                className="md:flex-initial"
                disabled={isSaving}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset to Default
              </Button>
            </div>
            
            <div className="mt-2 w-full">
              <Button 
                variant="outline" 
                onClick={generateShareableLink}
                className="mb-2 w-full"
                disabled={isSaving}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share Configuration
              </Button>
              
              <Textarea
                className="font-mono text-xs h-24"
                readOnly
                value={embedCode}
              />
            </div>
          </CardFooter>
        </Card>
      </div>
      
      {/* Right Panel - Live Preview */}
      <div className="lg:col-span-1">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-base">Live Preview</CardTitle>
            <CardDescription>
              See how your widget will appear
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center items-center h-96 bg-gray-50 dark:bg-gray-900 rounded-md overflow-hidden">
            <WidgetPreview config={config} agentName={agentName} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}