import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Link2, ExternalLink, PlusCircle, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth/auth-provider";

// Import third-party integration logos
import { SiZapier, SiWhatsapp, SiSlack, SiGoogle } from "react-icons/si";
import { FaDiagramProject } from "react-icons/fa6";
import { BsMicrosoft } from "react-icons/bs";

export default function Integrations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [connectingIntegration, setConnectingIntegration] = useState<string | null>(null);

  // Simulate the connection process
  const handleConnect = (integrationId: string) => {
    setConnectingIntegration(integrationId);
    
    // Simulate API call with timeout
    setTimeout(() => {
      setConnectingIntegration(null);
      toast({
        title: "Integration Connected",
        description: "Successfully connected to the integration.",
        variant: "default",
      });
    }, 1500);
  };

  // All available integrations
  const integrations = [
    {
      id: "zapier",
      name: "Zapier",
      description: "Connect BeyondAsk to 5,000+ apps using Zapier's automation platform",
      logo: <SiZapier className="h-10 w-10 text-[#FF4A00]" />,
      category: "automation",
      connected: false,
    },
    {
      id: "n8n",
      name: "n8n",
      description: "Open-source workflow automation tool that connects BeyondAsk with other services",
      logo: <FaDiagramProject className="h-10 w-10 text-[#6755C3]" />,
      category: "automation",
      connected: false,
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      description: "Deploy your AI agents directly in WhatsApp conversations",
      logo: <SiWhatsapp className="h-10 w-10 text-[#25D366]" />,
      category: "messaging",
      connected: false,
    },
    {
      id: "slack",
      name: "Slack",
      description: "Add your agents to Slack channels and direct messages",
      logo: <SiSlack className="h-10 w-10 text-[#4A154B]" />,
      category: "messaging",
      connected: true,
    },
    {
      id: "google-drive",
      name: "Google Drive",
      description: "Index and search your Google Drive documents",
      logo: <SiGoogle className="h-10 w-10 text-[#4285F4]" />,
      category: "storage",
      connected: false,
    },
    {
      id: "microsoft-365",
      name: "Microsoft 365",
      description: "Connect with SharePoint, OneDrive and Teams",
      logo: <BsMicrosoft className="h-10 w-10 text-[#00A4EF]" />,
      category: "storage",
      connected: false,
    }
  ];

  // Filter integrations based on active tab
  const filteredIntegrations = activeTab === "all" 
    ? integrations 
    : integrations.filter(integration => integration.category === activeTab);

  return (
    <DashboardLayout>
      <div className="container mx-auto py-4 px-4 max-w-7xl">
        <PageHeader
          title="Integrations"
          description="Connect BeyondAsk with your favorite tools and services"
        />

        {/* Integration tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All Integrations</TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
            <TabsTrigger value="messaging">Messaging</TabsTrigger>
            <TabsTrigger value="storage">Storage & Documents</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredIntegrations.map((integration) => (
                <Card key={integration.id} className="overflow-hidden">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-semibold">{integration.name}</CardTitle>
                      <CardDescription>
                        {integration.connected && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 mb-1">
                            <Check className="mr-1 h-3 w-3" /> Connected
                          </Badge>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center justify-center p-2">
                      {integration.logo}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-6">
                      {integration.description}
                    </p>
                  </CardContent>
                  <CardFooter className="border-t bg-muted/20 pt-4">
                    {integration.connected ? (
                      <div className="flex justify-between w-full">
                        <Button variant="outline" size="sm">
                          Configure
                        </Button>
                        <Button variant="destructive" size="sm">
                          Disconnect
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        className="w-full" 
                        onClick={() => handleConnect(integration.id)}
                        disabled={connectingIntegration === integration.id}
                      >
                        {connectingIntegration === integration.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Link2 className="mr-2 h-4 w-4" />
                            Connect
                          </>
                        )}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* API Keys section */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">API Access</h2>
            <Button variant="outline" size="sm" asChild>
              <a href="/api-keys-management">
                Manage API Keys
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>API & Webhook Integration</CardTitle>
              <CardDescription>
                Integrate BeyondAsk with custom applications and third-party services using our APIs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded bg-amber-50 border border-amber-200 text-amber-800 flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">API Access Required</p>
                  <p className="text-sm mt-1">
                    API access requires an API key. Visit the API Keys Management page to create one.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Card className="bg-muted/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Webhook API</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <p className="text-sm text-muted-foreground">
                      Create webhook endpoints to interact with your agents programmatically.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button size="sm" variant="ghost" asChild>
                      <a href="/api-webhook-keys">
                        Manage Keys
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </a>
                    </Button>
                  </CardFooter>
                </Card>

                <Card className="bg-muted/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">API Documentation</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <p className="text-sm text-muted-foreground">
                      Explore our API documentation to learn how to integrate with BeyondAsk.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button size="sm" variant="ghost" asChild>
                      <a href="/api-docs">
                        View Docs
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </a>
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Custom integration section */}
        <div className="mt-8">
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle>Need a Custom Integration?</CardTitle>
              <CardDescription>
                Don't see the integration you need? Request a custom integration or build your own.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-col sm:flex-row gap-3 pt-0">
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Request Integration
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request an Integration</DialogTitle>
                    <DialogDescription>
                      Tell us about the integration you need, and we'll consider adding it to our roadmap.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Integration Name</Label>
                      <Input id="name" placeholder="e.g., Intercom, Discord, etc." />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description">How would you use this integration?</Label>
                      <textarea 
                        id="description" 
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        placeholder="Describe your use case..."
                      ></textarea>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      toast({
                        title: "Request Submitted",
                        description: "We've received your integration request.",
                      });
                    }}>
                      Submit Request
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <Button variant="outline" asChild>
                <a href="https://docs.beyondask.ai/developer-api" target="_blank" rel="noopener noreferrer">
                  Developer Documentation
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}