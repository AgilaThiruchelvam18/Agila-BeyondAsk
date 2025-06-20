import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ResourcePermission, Resource, ResourceType } from "./resource-permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface KnowledgeBaseResourcePermissionsProps {
  teamId: number;
}

export function KnowledgeBaseResourcePermissions({ teamId }: KnowledgeBaseResourcePermissionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch all knowledge bases
  const { data: knowledgeBases = [], isLoading: isLoadingKbs } = useQuery<Resource[]>({
    queryKey: ["/api/knowledge-bases"],
  });

  // Fetch team permissions
  const { data: permissions = [], isLoading: isLoadingPermissions } = useQuery<ResourcePermission[]>({
    queryKey: [`/api/teams/${teamId}/permissions?resourceType=knowledgeBase`],
  });

  // Grant permission mutation
  const grantPermission = useMutation({
    mutationFn: async (kbId: number) => {
      return apiRequest(`/api/teams/${teamId}/permissions`, {
        method: "POST",
        data: {
          resourceType: "knowledgeBase",
          resourceId: kbId,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/permissions?resourceType=knowledgeBase`] });
      toast({
        title: "Permission granted",
        description: "The team now has access to this knowledge base",
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
    mutationFn: async (kbId: number) => {
      return apiRequest(`/api/teams/${teamId}/permissions/knowledgeBase/${kbId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/permissions?resourceType=knowledgeBase`] });
      toast({
        title: "Permission revoked",
        description: "The team no longer has access to this knowledge base",
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

  // Check if knowledge base has permission
  const hasPermission = (kbId: number): boolean => {
    return permissions.some((permission: ResourcePermission) => permission.resourceId === kbId);
  };

  // Get all knowledge bases (we're not filtering by access here since we want to show all available knowledge bases)
  const filteredKbs = knowledgeBases.length ? knowledgeBases : [];

  if (isLoadingKbs || isLoadingPermissions) {
    return <div>Loading knowledge base permissions...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-xl font-semibold">Knowledge Bases</h4>
        <Badge variant="outline" className="ml-2">
          {permissions.length} of {knowledgeBases.length} granted
        </Badge>
      </div>

      {knowledgeBases.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg">
          <AlertTriangle className="w-10 h-10 text-muted-foreground mb-2" />
          <p className="text-center text-muted-foreground">No knowledge bases found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {knowledgeBases.map((kb: Resource) => {
            const hasAccess = hasPermission(kb.id);
            
            return (
              <Card key={kb.id} className={hasAccess ? "border-green-200" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{kb.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {kb.description || "No description"}
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
                      onClick={() => revokePermission.mutate(kb.id)}
                      disabled={revokePermission.isPending}
                    >
                      Revoke Access
                    </Button>
                  ) : (
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="w-full"
                      onClick={() => grantPermission.mutate(kb.id)}
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