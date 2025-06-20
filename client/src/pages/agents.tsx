import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, MoreVertical, Trash, Edit, BrainCircuit, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
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
import { insertAgentSchema, Agent, InsertAgent, KnowledgeBase } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DeleteAgentDialog } from "@/components/agents/delete-agent-dialog";

// Define agent configuration type
interface AgentConfiguration {
  model: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  system_message?: string;
}

// Type declaration for agent with typed configuration
interface AgentWithConfig extends Omit<Agent, 'configuration'> {
  configuration: AgentConfiguration;
}

// Extend the insertAgentSchema with validation
const createAgentSchema = insertAgentSchema.extend({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  configuration: z.object({
    model: z.string().min(1, "Model is required"),
    temperature: z.number().min(0).max(1),
    max_tokens: z.number().min(1),
    top_p: z.number().min(0).max(1),
    frequency_penalty: z.number().min(0).max(2),
    presence_penalty: z.number().min(0).max(2),
    system_message: z.string().optional(),
  }),
  isActive: z.boolean().default(true),
  knowledgeBaseIds: z.array(z.number()).default([]),
});

type CreateAgentFormValues = z.infer<typeof createAgentSchema>;

export default function Agents() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<{ id: number; name: string } | null>(null);
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

  const { data: agents, isLoading, error } = useQuery<AgentWithConfig[]>({
    queryKey: ["/api/agents"],
    queryFn: async () => {
      return apiRequest("/api/agents");
    },
  });

  const createAgent = useMutation<Agent, Error, CreateAgentFormValues>({
    mutationFn: async (data: CreateAgentFormValues) => {
      return apiRequest("/api/agents", {
        method: "POST", 
        data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setIsCreateOpen(false);
      toast({
        title: "Agent created",
        description: "Your new AI agent has been created successfully.",
      });
    },
    onError: (error) => {
      console.error("Agent creation error:", error);
      toast({
        title: "Failed to create agent",
        description: error.message || "An error occurred while creating the agent.",
        variant: "destructive",
      });
    },
  });

  const deleteAgent = useMutation<number, Error, number>({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/agents/${id}`, {
        method: "DELETE"
      });
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Agent deleted",
        description: "The agent has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete agent",
        description: error.message || "An error occurred while deleting the agent.",
        variant: "destructive",
      });
    },
  });

  // Get knowledge bases for the selection field
  const { data: knowledgeBases = [] } = useQuery<KnowledgeBase[]>({
    queryKey: ["/api/knowledge-bases"],
  });

  const form = useForm<CreateAgentFormValues>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: {
      name: "",
      description: "",
      configuration: {
        model: "gpt-4",
        temperature: 0.7,
        max_tokens: 1024,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        system_message: "You are a helpful assistant.",
      },
      isActive: true,
      knowledgeBaseIds: [],
    },
  });

  const onSubmit = (data: CreateAgentFormValues) => {
    createAgent.mutate(data);
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

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <p className="text-red-500">Failed to load agents</p>
          <Button variant="outline" className="mt-4" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/agents"] })}>
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
            <h1 className="text-3xl font-bold tracking-tight">AI Agents</h1>
            <p className="text-gray-500">Manage your intelligent agents</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Agent
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Agent</DialogTitle>
                <DialogDescription>
                  Configure your new AI agent to work with your knowledge bases.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="My AI Agent" {...field} />
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
                          <Textarea placeholder="What this agent does" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="configuration.model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input placeholder="gpt-4" {...field} />
                        </FormControl>
                        <FormDescription>The AI model to use (e.g., gpt-4).</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="configuration.temperature"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Temperature (0-1)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" min="0" max="1" {...field} />
                        </FormControl>
                        <FormDescription>Higher values make output more random.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="configuration.system_message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>System Message</FormLabel>
                        <FormControl>
                          <Textarea placeholder="You are a helpful assistant." {...field} />
                        </FormControl>
                        <FormDescription>Initial instructions for the AI.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="knowledgeBaseIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Knowledge Bases</FormLabel>
                        <div className="space-y-2">
                          <FormDescription>
                            Select knowledge bases to connect with this agent
                          </FormDescription>
                          {knowledgeBases.length === 0 ? (
                            <div className="flex items-center justify-center p-4 border border-dashed rounded-md">
                              <div className="text-center">
                                <Database className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                                <p className="text-sm text-gray-500 mb-2">No knowledge bases found</p>
                                <Link href="/knowledge-bases?create=true">
                                  <Button variant="secondary" size="sm">
                                    <Plus className="mr-2 h-3 w-3" />
                                    Create Knowledge Base
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {knowledgeBases.map((kb) => (
                                <div key={kb.id} className="flex items-center space-x-2">
                                  <Checkbox 
                                    id={`kb-${kb.id}`}
                                    checked={field.value.includes(kb.id)}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        field.onChange([...field.value, kb.id]);
                                      } else {
                                        field.onChange(field.value.filter(id => id !== kb.id));
                                      }
                                    }}
                                  />
                                  <label
                                    htmlFor={`kb-${kb.id}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                  >
                                    {kb.name}
                                  </label>
                                </div>
                              ))}
                            </div>
                          )}
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Active</FormLabel>
                          <FormDescription>Whether this agent is active and can be used.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateOpen(false)}
                      disabled={createAgent.isPending}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createAgent.isPending}>
                      {createAgent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Agent
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {agents?.length === 0 ? (
          <Card className="flex flex-col items-center justify-center h-64">
            <BrainCircuit className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 text-center mb-4">No agents found</p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create your first agent
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents?.map((agent: AgentWithConfig) => (
              <Card key={agent.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{agent.name}</CardTitle>
                      <CardDescription>{agent.description || "No description"}</CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-white border-gray-200">
                        <DropdownMenuItem asChild>
                          <Link href={`/agent/${agent.id}`}  className=" hover:bg-gray-200">
                            <Edit className="mr-2 h-4 w-4 " />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setAgentToDelete({ id: agent.id, name: agent.name })}
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
                    <div className="text-gray-500">Model:</div>
                    <div>{agent.configuration.model}</div>
                    <div className="text-gray-500">Temperature:</div>
                    <div>{agent.configuration.temperature}</div>
                    <div className="text-gray-500">Status:</div>
                    <div>{agent.isActive ? "Active" : "Inactive"}</div>
                    
                    {Array.isArray(agent.knowledgeBaseIds) && agent.knowledgeBaseIds.length > 0 && (
                      <>
                        <div className="text-gray-500">Knowledge:</div>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="flex items-center">
                            <Database className="h-3 w-3 mr-1" />
                            {agent.knowledgeBaseIds.length}
                          </Badge>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-2">
                  <Button 
                    variant="default" 
                    className="w-full"
                    asChild
                  >
                    <Link href={`/chat/${agent.id}`}>
                      Chat with Agent
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Agent Dialog */}
      {agentToDelete && (
        <DeleteAgentDialog
          agentId={agentToDelete.id}
          agentName={agentToDelete.name}
          isOpen={!!agentToDelete}
          onOpenChange={(open) => {
            if (!open) setAgentToDelete(null);
          }}
          onDeleted={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
          }}
        />
      )}
    </DashboardLayout>
  );
}
