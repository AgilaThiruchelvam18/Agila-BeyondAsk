import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApiKeys from "./api-keys";
import ApiWebhookKeys from "./api-webhook-keys";

const ApiKeysManagement = () => {
  const [activeTab, setActiveTab] = useState("llm-providers");
  
  return (
    <DashboardLayout>
      <div className="container mx-auto py-4 px-4 max-w-7xl">
        <PageHeader
          title="API Keys Management"
          description="Manage your API keys for LLM providers and external integrations"
        />
        
        <Tabs
          defaultValue="llm-providers"
          value={activeTab}
          onValueChange={setActiveTab}
          className="mt-6"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="llm-providers">LLM Provider Keys</TabsTrigger>
            <TabsTrigger value="webhook-keys">Webhook API Keys</TabsTrigger>
          </TabsList>
          
          <TabsContent value="llm-providers" className="mt-6">
            <ApiKeys embeddedView={true} />
          </TabsContent>
          
          <TabsContent value="webhook-keys" className="mt-6">
            <ApiWebhookKeys embeddedView={true} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ApiKeysManagement;