import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentImportExport } from "@/components/documents/document-import-export";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams, Link } from "wouter";
import { ChevronLeft, Loader2, Database, Settings, FileText } from "lucide-react";
import { CustomFieldsArray } from "@/components/knowledge-bases/custom-fields";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function KnowledgeBaseDetail() {
  const params = useParams();
  const id = params?.id ? parseInt(params.id) : null;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("documents");

  // Define the type for knowledge base data
  interface KnowledgeBaseDetails {
    id: number;
    name: string;
    description: string | null;
    userId: number;
    createdAt: string;
    metadata: Record<string, any>;
    vectorStoreId: string | null;
    customFields?: Array<{
      id: string;
      name: string;
      description?: string;
      type: 'text' | 'number' | 'date' | 'boolean' | 'select';
      required: boolean;
      options?: string[];
    }>;
  }

  // Form setup for custom fields
  const form = useForm<{ customFields: any[] }>({
    defaultValues: {
      customFields: []
    }
  });

  // Query to fetch knowledge base details
  const { data: knowledgeBase, isLoading, error } = useQuery<KnowledgeBaseDetails>({
    queryKey: [`/api/knowledge-bases/${id}`],
    enabled: !!id,
    retry: 3,
    queryFn: () => fetch(`/api/knowledge-bases/${id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    }).then(res => {
      if (!res.ok) throw new Error('Failed to fetch knowledge base details');
      return res.json();
    })
  });
  
  // Reset form when knowledge base data is loaded
  React.useEffect(() => {
    if (knowledgeBase) {
      // TypeScript quirk - need to use as any to avoid type errors
      form.reset({
        customFields: knowledgeBase.customFields || []
      } as any);
    }
  }, [knowledgeBase, form]);
  
  // Mutation for updating custom fields
  const updateCustomFields = useMutation({
    mutationFn: async (data: { customFields: any[] }) => {
      // We need to send a complete knowledge base update
      // First, build an update object that only updates the customFields
      const updateData = {
        ...knowledgeBase ? {
          name: knowledgeBase.name,
          description: knowledgeBase.description,
          metadata: knowledgeBase.metadata
        } : {},
        customFields: data.customFields
      };
      
      console.log("Updating knowledge base with data:", updateData);
      
      try {
        const response = await apiRequest(`/api/knowledge-bases/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          data: updateData
        });
        
        console.log("Knowledge base update successful:", response);
        return response;
      } catch (error) {
        console.error("Failed to update knowledge base:", error);
        throw new Error('Failed to update custom fields');
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Custom fields updated successfully",
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/knowledge-bases/${id}`]
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update custom fields: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  const onSubmit = (data: any) => {
    updateCustomFields.mutate(data);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !id) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => navigate("/knowledge-bases")}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Knowledge Bases
          </Button>
          
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {!id ? "Invalid knowledge base ID" : "Failed to load knowledge base details"}
              <div className="mt-2">
                <Button variant="outline" onClick={() => navigate("/knowledge-bases")}>
                  Return to Knowledge Bases
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Button variant="ghost" asChild className="mr-4">
              <Link href="/knowledge-bases">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{knowledgeBase?.name || "Knowledge Base"}</h1>
              <p className="text-gray-500">{knowledgeBase?.description || "No description"}</p>
            </div>
          </div>
        </div>
        
        <Separator />
        
        <Tabs defaultValue="documents" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="documents" className={activeTab === "documents" ? "bg-primary/10 font-semibold" : ""}>
              <FileText className="mr-2 h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="settings" className={activeTab === "settings" ? "bg-primary/10 font-semibold" : ""}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="documents" className="py-4">
            {id && <DocumentImportExport knowledgeBaseId={id} />}
            <DocumentList knowledgeBaseId={id} />
          </TabsContent>
          
          <TabsContent value="settings" className="py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Settings</CardTitle>
                  <CardDescription>Manage basic settings for {knowledgeBase?.name || "this knowledge base"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-500">Basic settings will be implemented in a future version.</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Custom Fields</CardTitle>
                  <CardDescription>Define document fields for {knowledgeBase?.name || "this knowledge base"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <CustomFieldsArray 
                        control={form.control} 
                        name="customFields"
                      />
                      
                      <div className="flex justify-end mt-4">
                        <Button 
                          type="submit" 
                          disabled={updateCustomFields.isPending}
                        >
                          {updateCustomFields.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Save Custom Fields
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}