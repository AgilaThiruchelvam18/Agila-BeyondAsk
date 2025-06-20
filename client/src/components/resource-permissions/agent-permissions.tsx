import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ResourcePermission, Resource, ResourceType } from "./resource-permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AgentResourcePermissionsProps {
  teamId: number;
}

export function AgentResourcePermissions({ teamId }: AgentResourcePermissionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch all agents
  const { data: agents = [], isLoading: isLoadingAgents } = useQuery<Resource[]>({
    queryKey: ["/api/agents"],
  });

  // Fetch team permissions
  const { data: permissions = [], isLoading: isLoadingPermissions } = useQuery<ResourcePermission[]>({
    queryKey: [`/api/teams/${teamId}/permissions?resourceType=agent`],
  });

  // Grant permission mutation
  const grantPermission = useMutation({
    mutationFn: async (agentId: number) => {
      return apiRequest(`/api/teams/${teamId}/permissions`, {
        method: "POST",
        data: {
          resourceType: "agent",
          resourceId: agentId,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/permissions?resourceType=agent`] });
      toast({
        title: "Permission granted",
        description: "The team now has access to this agent",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to grant permission",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Revoke permission mutation
  const revokePermission = useMutation({
    mutationFn: async (agentId: number) => {
      return apiRequest(`/api/teams/${teamId}/permissions/agent/${agentId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/permissions?resourceType=agent`] });
      toast({
        title: "Permission revoked",
        description: "The team no longer has access to this agent",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to revoke permission",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check if agent has permission
  const hasPermission = (agentId: number): boolean => {
    return permissions.some((permission: ResourcePermission) => permission.resourceId === agentId);
  };

  // Get all agents (we're not filtering by access here since we want to show all available agents)
  const filteredAgents = agents.length ? agents : [];

  if (isLoadingAgents || isLoadingPermissions) {
    return <div>Loading agent permissions...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-xl font-semibold">AI Agents</h4>
        <Badge variant="outline" className="ml-2">
          {permissions.length} of {agents.length} granted
        </Badge>
      </div>

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg">
          <AlertTriangle className="w-10 h-10 text-muted-foreground mb-2" />
          <p className="text-center text-muted-foreground">No AI agents found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent: Resource) => {
            const hasAccess = hasPermission(agent.id);
            
            return (
              <Card key={agent.id} className={hasAccess ? "border-green-200" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{agent.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {agent.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {hasAccess ? (
                    <Badge className="bg-green-500">
                      <Check className="w-3 h-3 mr-1" /> Access Granted
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <X className="w-3 h-3 mr-1" /> No Access
                    </Badge>
                  )}
                </CardContent>
                <CardFooter>
                  {hasAccess ? (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="w-full"
                      onClick={() => revokePermission.mutate(agent.id)}
                      disabled={revokePermission.isPending}
                    >
                      Revoke Access
                    </Button>
                  ) : (
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="w-full"
                      onClick={() => grantPermission.mutate(agent.id)}
                      disabled={grantPermission.isPending}
                    >
                      Grant Access
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}