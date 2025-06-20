import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Code, CopyIcon, CheckIcon, ExternalLink, Palette, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WidgetThemeCustomizer } from "./widget-theme-customizer";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

interface AgentWidgetCodeProps {
  agentId: number;
  agentName: string;
}

export function AgentWidgetCode({ agentId, agentName }: AgentWidgetCodeProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  
  // Query for existing widget for this agent
  const { data: widget, isLoading: isWidgetLoading } = useQuery({
    queryKey: [`/api/agents/${agentId}/widget`],
    queryFn: async () => {
      // Check if a widget already exists for this agent
      const authToken = localStorage.getItem('auth_token');
      const response = await fetch(`/api/agents/${agentId}/widget`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Widget data loaded:', data);
        return data;
      } else if (response.status === 404) {
        // If widget doesn't exist, return null (we'll show Create Widget button)
        console.log('No widget found for this agent');
        return null;
      }
      throw new Error('Failed to fetch widget');
    },
    // Add refetchOnMount to make sure we always have the latest data
    refetchOnMount: true,
    // Add retry to handle transient failures
    retry: 2
  });
  
  // Function to create a new widget
  const createWidget = async () => {
    try {
      console.log(`Creating widget for agent ${agentId} (${agentName})`);
      const authToken = localStorage.getItem('auth_token');
      const createResponse = await fetch(`/api/agents/${agentId}/widget`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: `${agentName} Widget`,
          config: {
            theme: {
              primaryColor: '#0078d4',
              textColor: '#ffffff',
              backgroundColor: '#ffffff',
              secondaryTextColor: '#333333'
            },
            position: 'bottom-right',
            size: 'medium',
            welcomeMessage: 'Hello! How can I help you today?',
            widgetTitle: agentName,
            collectName: true,
            collectEmail: true,
            collectPhone: false,
            requireOtpVerification: true
          }
        })
      });
      
      if (createResponse.ok) {
        const widget = await createResponse.json();
        console.log('Widget created successfully:', widget);
        
        // Refresh the query to get the new widget
        await queryClient.invalidateQueries({ queryKey: [`/api/agents/${agentId}/widget`] });
        
        // Force refetch to ensure we have the latest data
        await queryClient.fetchQuery({ queryKey: [`/api/agents/${agentId}/widget`] });
        
        toast({
          title: "Widget created successfully",
          description: "You can now embed this widget on your website.",
        });
      } else {
        throw new Error('Failed to create widget');
      }
    } catch (error) {
      toast({
        title: "Failed to create widget",
        description: "Please try again later.",
        variant: "destructive",
      });
    }
  };
  
  // Use the widget's public key for the embed code
  const widgetPublicKey = widget?.publicKey || '';
  
  const embedCode = `<!-- BeyondAsk Widget Code -->
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
    position: 'bottom-right',        // Options: 'bottom-right', 'bottom-left', 'top-right', 'top-left', or 'embedded'
    size: 'medium',                  // Options: 'small', 'medium', 'large'
    welcomeMessage: 'Hello! How can I help you today?',
    widgetTitle: '${agentName}',
    brandName: 'Support',            // Shown beneath widget title
    
    // Theme customization options
    theme: 'light',                  // Options: 'light' or 'dark'
    primaryColor: '#0078d4',         // Main color for widget bubble and accents
    avatarUrl: null,                 // Custom avatar image URL, leave null to use initial
    
    // Advanced theme customization
    themeConfig: {                   // Custom theme settings (overrides basic theme)
      primaryColor: '#0078d4',       // Bubble and user messages color
      textColor: '#333333',          // Primary text color
      backgroundColor: '#ffffff',    // Background of chat window
      bubbleIcon: null,              // Custom SVG icon for bubble (optional)
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }
  });
</script>

<!-- Add this div where you want the widget to appear -->
<div id="beyond-container"></div>`;

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

  // Show loading state while checking for widget
  if (isWidgetLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Loading Widget Information...</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </CardContent>
      </Card>
    );
  }

  // If no widget exists yet, show the create button
  if (!widget) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Create Widget for {agentName}</CardTitle>
          <CardDescription>
            Create a chat widget to embed this agent on your website
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="rounded-full bg-primary/10 p-6 mb-2">
              <Code className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">No Widget Created Yet</h3>
            <p className="text-muted-foreground max-w-md">
              Create a widget to allow your users to interact with this agent through a chat interface on your website.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button onClick={createWidget} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Create Widget
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // If widget exists, show the widget code and customizer
  return (
    <Tabs defaultValue="customizer" className="w-full">
      <TabsList className="grid w-full grid-cols-2"> {/* Two tabs: customizer and embed code */}
        <TabsTrigger value="customizer" className="flex items-center">
          <Palette className="mr-2 h-4 w-4" />
          Widget Customizer
        </TabsTrigger>
        <TabsTrigger value="embed" className="flex items-center">
          <Code className="mr-2 h-4 w-4" />
          Embed Code
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="customizer">
        <WidgetThemeCustomizer agentId={agentId} agentName={agentName} />
      </TabsContent>
      
      <TabsContent value="embed">
        <Card>
          <CardHeader>
            <CardTitle>Widget Embed Code</CardTitle>
            <CardDescription>
              Copy this code and paste it into your website to add the chat widget.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              className="font-mono text-xs h-96 overflow-auto whitespace-pre"
              readOnly
              value={embedCode}
            />
            <Alert className="mt-4">
              <AlertDescription className="flex items-center text-sm">
                <ExternalLink className="h-4 w-4 mr-2 inline flex-shrink-0" />
                This widget will connect to your agent using the public key: <span className="font-mono ml-1">{widgetPublicKey}</span>
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={copyToClipboard} 
              className="w-full sm:w-auto"
              variant="default"
            >
              {copied ? 
                <><CheckIcon className="mr-2 h-4 w-4" /> Copied</> : 
                <><CopyIcon className="mr-2 h-4 w-4" /> Copy Code</>
              }
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>
    </Tabs>
  );
}