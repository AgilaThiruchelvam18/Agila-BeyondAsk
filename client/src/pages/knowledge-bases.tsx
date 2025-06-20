import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, MoreVertical, Trash, Edit, FileText, Database, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useKnowledgeBases, useDocumentCounts } from "@/hooks/use-shared-data";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { insertKnowledgeBaseSchema } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { DeleteKnowledgeBaseDialog } from "@/components/knowledge-bases/delete-knowledge-base-dialog";
import { CustomFieldsArray } from "@/components/knowledge-bases/custom-fields";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Extend the insertKnowledgeBaseSchema with validation
const createKnowledgeBaseSchema = insertKnowledgeBaseSchema.extend({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  metadata: z.object({
    source: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
  customFields: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, "Field name is required"),
    description: z.string().optional(),
    type: z.enum(['text', 'number', 'date', 'boolean', 'select']),
    required: z.boolean().default(false),
    options: z.array(z.string()).optional(),
  })).default([]),
});

type CreateKnowledgeBaseFormValues = z.infer<typeof createKnowledgeBaseSchema>;

export default function KnowledgeBases() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteDialogState, setDeleteDialogState] = useState<{
    isOpen: boolean;
    knowledgeBaseId: number;
    knowledgeBaseName: string;
  }>({
    isOpen: false,
    knowledgeBaseId: 0,
    knowledgeBaseName: '',
  });
  const [, params] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if we should open the create dialog from URL params
  useEffect(() => {
    if (params && typeof params === 'string') {
      const searchParams = new URLSearchParams(params);
      const shouldOpenCreate = searchParams.get("create") === "true";
      if (shouldOpenCreate && !isCreateOpen) {
        setIsCreateOpen(true);
        // Remove the create param from URL
        searchParams.delete("create");
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, [params, isCreateOpen]);

  const { data: knowledgeBases = [], isLoading, error } = useKnowledgeBases();
  
  // Use the shared document counts hook
  const { data: documentCounts = {}, isLoading: isLoadingDocumentCounts } = useDocumentCounts(knowledgeBases);

  const createKnowledgeBase = useMutation({
    mutationFn: async (data: CreateKnowledgeBaseFormValues) => {
      return apiRequest("/api/knowledge-bases", {
        method: "POST", 
        data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-bases"]});
      // Also invalidate document counts
      queryClient.invalidateQueries({
        queryKey: ['/api/knowledge-bases', 'documents', 'counts']
      });
      setIsCreateOpen(false);
      toast({
        title: "Knowledge Base created",
        description: "Your new knowledge base has been created successfully.",
      });
    },
    onError: (error) => {
      console.error("Knowledge base creation error:", error);
      toast({
        title: "Failed to create knowledge base",
        description: error.message || "An error occurred while creating the knowledge base.",
        variant: "destructive",
      });
    },
  });

  // Delete functionality is now handled by the DeleteKnowledgeBaseDialog component

  const form = useForm<CreateKnowledgeBaseFormValues>({
    resolver: zodResolver(createKnowledgeBaseSchema),
    defaultValues: {
      name: "",
      description: "",
      metadata: {
        source: "",
        tags: [],
      },
      customFields: [],
    },
  });

  const onSubmit = (data: CreateKnowledgeBaseFormValues) => {
    createKnowledgeBase.mutate(data);
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

  // This block handles errors that occur while fetching knowledge bases.
  if (error) {
    console.error("Error2 fetching knowledge bases:", error);
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <p className="text-red-500">Failed to load knowledge bases</p>
          <Button variant="outline" className="mt-4" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/knowledge-bases"] })}>
            Retry
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Knowledge Bases</h1>
            <p className="text-gray-500">Manage your vectorized knowledge sources</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Knowledge Base
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create Knowledge Base</DialogTitle>
                <DialogDescription>
                  Create a new repository for storing and retrieving your knowledge.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="basic">Basic Info</TabsTrigger>
                      <TabsTrigger value="custom-fields">Custom Fields</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="basic" className="space-y-4 pt-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="My Knowledge Base" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea placeholder="What this knowledge base contains" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      { /* Hidden UI Section for Source Input */ }
                      <div style={{ display: 'none' }}>
                        <FormField
                          control={form.control}
                          name="metadata.source"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Source</FormLabel>
                              <FormControl>
                                <Input placeholder="Where this knowledge comes from" {...field} />
                              </FormControl>
                              <FormDescription>Optional: Source of the knowledge (e.g., website, documents)</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="custom-fields" className="space-y-4 pt-4">
                      <CustomFieldsArray 
                        control={form.control}
                        name="customFields"
                      />
                    </TabsContent>
                  </Tabs>
                  
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateOpen(false)}
                      disabled={createKnowledgeBase.isPending}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createKnowledgeBase.isPending}>
                      {createKnowledgeBase.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Knowledge Base
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {knowledgeBases?.length === 0 ? (
          <Card className="flex flex-col items-center justify-center h-64">
            <Database className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 text-center mb-4">No knowledge bases found</p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create your first knowledge base
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {knowledgeBases?.map((kb: any) => (
              <Card key={kb.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{kb.name}</CardTitle>
                      <CardDescription>{kb.description || "No description"}</CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-white">
                        <DropdownMenuItem asChild>
                          <Link href={`/knowledge-base/${kb.id}`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/knowledge-base/${kb.id}`}>
                            <FileText className="mr-2 h-4 w-4" />
                            View Documents
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeleteDialogState({
                            isOpen: true,
                            knowledgeBaseId: kb.id,
                            knowledgeBaseName: kb.name,
                          })}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-500">Source:</div>
                    <div>{kb.metadata?.source || "Not specified"}</div>
                    <div className="text-gray-500">Documents:</div>
                    <div>
                      {isLoadingDocumentCounts ? (
                        <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                      ) : documentCounts && documentCounts[kb.id] !== undefined ? 
                        documentCounts[kb.id] : 0}
                    </div>
                    {kb.metadata?.tags && kb.metadata.tags.length > 0 && (
                      <>
                        <div className="text-gray-500">Tags:</div>
                        <div className="flex flex-wrap gap-1">
                          {kb.metadata.tags.map((tag: string, i: number) => (
                            <Badge key={i} variant="outline">{tag}</Badge>
                          ))}
                        </div>
                      </>
                    )}
                    {kb.customFields && kb.customFields.length > 0 && (
                      <>
                        <div className="text-gray-500">Custom Fields:</div>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline">{kb.customFields.length} field{kb.customFields.length !== 1 ? 's' : ''}</Badge>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-2">
                  <Button variant="default" className="w-full" asChild>
                    <Link href={`/knowledge-base/${kb.id}`}>
                      View Documents
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Knowledge Base Dialog */}
      <DeleteKnowledgeBaseDialog
        knowledgeBaseId={deleteDialogState.knowledgeBaseId}
        knowledgeBaseName={deleteDialogState.knowledgeBaseName}
        isOpen={deleteDialogState.isOpen}
        onOpenChange={(open) => setDeleteDialogState(prev => ({ ...prev, isOpen: open }))}
        onDeleted={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/knowledge-bases"] });
          // Also invalidate document counts
          queryClient.invalidateQueries({
            queryKey: ['/api/knowledge-bases', 'documents', 'counts']
          });
        }}
      />
    </DashboardLayout>
  );
}
