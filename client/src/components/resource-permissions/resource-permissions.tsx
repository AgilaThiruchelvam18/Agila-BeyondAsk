import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentResourcePermissions } from "./agent-permissions";
import { KnowledgeBaseResourcePermissions } from "./knowledgebase-permissions";

export type ResourceType = "agent" | "knowledgeBase";

interface ResourcePermissionsProps {
  teamId: number;
}

export default function ResourcePermissions({ teamId }: ResourcePermissionsProps) {
  const [activeTab, setActiveTab] = useState<string>("agents");

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-1.5">
        <h3 className="text-2xl font-semibold leading-none tracking-tight">Resource Permissions</h3>
        <p className="text-sm text-muted-foreground">
          Manage which AI agents and knowledge bases this team has access to
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="agents">AI Agents</TabsTrigger>
          <TabsTrigger value="knowledgeBases">Knowledge Bases</TabsTrigger>
        </TabsList>
        
        <TabsContent value="agents" className="mt-4">
          <AgentResourcePermissions teamId={teamId} />
        </TabsContent>
        
        <TabsContent value="knowledgeBases" className="mt-4">
          <KnowledgeBaseResourcePermissions teamId={teamId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Types for resource permissions
export interface ResourcePermission {
  id: number;
  teamId: number;
  resourceType: ResourceType;
  resourceId: number;
  createdAt: Date;
  createdBy: number;
}

// Generic resource type
export interface Resource {
  id: number;
  name: string;
  description?: string | null;
  createdAt: Date;
}