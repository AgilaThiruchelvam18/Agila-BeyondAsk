import React from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentWidgetCode } from "@/components/agents/agent-widget-code";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams, Link } from "wouter";
import { ChevronLeft, Loader2, BrainCircuit, Settings, Code, Save, Database, Plus } from "lucide-react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AgentDetail() {
  const params = useParams();
  const id = params?.id ? parseInt(params.id) : null;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [availableModels, setAvailableModels] = useState<{ value: string, label: string }[]>([]);

  // Define LLM providers and models
  const llmProviders = [
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic" },
    { value: "azure", label: "Azure OpenAI" }
  ];

  const llmModels = {
    openai: [
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" }
    ],
    anthropic: [
      { value: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet" },
      { value: "claude-3-opus-20240229", label: "Claude 3 Opus" },
      { value: "claude-3-sonnet-20240229", label: "Claude 3 Sonnet" },
      { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" }
    ],
    azure: [
      { value: "gpt-4", label: "GPT-4" },
      { value: "gpt-4-32k", label: "GPT-4 32K" },
      { value: "gpt-35-turbo", label: "GPT-3.5 Turbo" }
    ]
  };

  // Define the type for agent data
  interface AgentDetails {
    id: number;
    name: string;
    description: string | null;
    userId: number;
    createdAt: string;
    isActive: boolean;
    configuration: {
      model: string;
      provider?: string; // Added provider field
      temperature: number;
      max_tokens: number;
      top_p: number;
      frequency_penalty: number;
      presence_penalty: number;
      system_message: string;
    };
    knowledgeBaseIds: number[];
    promptTemplate: string | null;
    rules: string[];
    confidenceThreshold: string;
    fallbackMessage: string;
    allowContinuousGeneration: boolean;
    enableConversationMemory: boolean;
  }

  // Define the type for knowledge base data
  interface KnowledgeBase {
    id: number;
    name: string;
    description: string | null;
    userId: number;
    createdAt: string;
  }

  // Form for the prompt template and settings
  type FormValues = {
    name: string;
    promptTemplate: string;
    allowContinuousGeneration: boolean;
    enableConversationMemory: boolean;
    maxTokens: number;
    temperature: number;
    llmProvider: string;
    llmModel: string;
    knowledgeBaseIds: number[];
    rules: string[];
    confidenceThreshold: string;
    fallbackMessage: string;
  };

  const form = useForm<FormValues>({
    defaultValues: {
      name: "",
      promptTemplate: "",
      allowContinuousGeneration: true,
      enableConversationMemory: true,
      maxTokens: 1024,
      temperature: 0.7,
      llmProvider: "openai",
      llmModel: "gpt-4o",
      knowledgeBaseIds: [],
      rules: [],
      confidenceThreshold: "0.75",
      fallbackMessage: "I don't have enough information to answer that question confidently. Could you please rephrase or provide more details?",
    },
  });

  // Query to fetch available knowledge bases
  const { data: knowledgeBases = [] } = useQuery<KnowledgeBase[]>({
    queryKey: ["/api/knowledge-bases"],
    queryFn: async () => {
      const response = await fetch("/api/knowledge-bases", {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch knowledge bases');
      return response.json();
    }
  });

  // Query to fetch agent details
  const { data: agent, isLoading, error } = useQuery<AgentDetails>({
    queryKey: [`/api/agents/${id}`],
    enabled: !!id,
    retry: 3,
    queryFn: () => fetch(`/api/agents/${id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    }).then(res => {
      if (!res.ok) throw new Error('Failed to fetch agent details');
      return res.json();
    })
  });

  const hasSetForm = React.useRef(false);

  React.useEffect(() => {
    if (agent && !hasSetForm.current) {
      const provider = agent.configuration?.provider || "openai";

      form.reset({
        name: agent.name || "",
        promptTemplate: agent.promptTemplate || "The following information from knowledge bases may be helpful for answering the user's question.",
        allowContinuousGeneration: agent.allowContinuousGeneration ?? true,
        enableConversationMemory: agent.enableConversationMemory ?? true,
        maxTokens: agent.configuration?.max_tokens || 1024,
        temperature: agent.configuration?.temperature || 0.7,
        llmProvider: provider,
        llmModel: agent.configuration?.model || "gpt-4o",
        knowledgeBaseIds: agent.knowledgeBaseIds || [],
        rules: agent.rules || [],
        confidenceThreshold: agent.confidenceThreshold || "0.75",
        fallbackMessage: agent.fallbackMessage || "I don't have enough information to answer that question confidently."
      });

      setAvailableModels(llmModels[provider as keyof typeof llmModels] || llmModels.openai);
      hasSetForm.current = true; // Prevent future resets
    }
  }, [agent, form, llmModels]);

  // Update available models when provider changes
  React.useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'llmProvider') {
        const provider = value.llmProvider as string;
        setAvailableModels(llmModels[provider as keyof typeof llmModels] || llmModels.openai);

        // Also update the model when provider changes
        const defaultModel = llmModels[provider as keyof typeof llmModels]?.[0]?.value || "";
        form.setValue('llmModel', defaultModel);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, llmModels]);

  // Mutation to update the agent
  const { mutate: updateAgent, isPending } = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!id) throw new Error("Agent ID is required");

      // Use apiRequest from queryClient which properly handles auth
      const response = await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          name: values.name,
          promptTemplate: values.promptTemplate,
          allowContinuousGeneration: values.allowContinuousGeneration,
          enableConversationMemory: values.enableConversationMemory,
          knowledgeBaseIds: values.knowledgeBaseIds,
          rules: values.rules,
          // Ensure confidenceThreshold is a string or number depending on API expectations
          confidenceThreshold: values.confidenceThreshold.toString(),
          fallbackMessage: values.fallbackMessage,
          configuration: {
            max_tokens: values.maxTokens,
            // Ensure temperature is a number between 0 and 1
            temperature: parseFloat(values.temperature.toString()),
            provider: values.llmProvider,
            model: values.llmModel
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update agent');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate the query to refetch the agent data
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${id}`] });
      toast({
        title: "Success",
        description: "Agent settings updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update agent",
        variant: "destructive",
      });
    }
  });

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
          <Button variant="ghost" onClick={() => navigate("/agents")}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Agents
          </Button>

          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {!id ? "Invalid agent ID" : "Failed to load agent details"}
              <div className="mt-2">
                <Button variant="outline" onClick={() => navigate("/agents")}>
                  Return to Agents
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
              <Link href="/agents">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{agent?.name || "Agent"}</h1>
              <p className="text-gray-500">{agent?.description || "No description"}</p>
            </div>
          </div>

        </div>

        <Separator />

        <Tabs defaultValue="configuration">
          <TabsList>
            <TabsTrigger value="configuration">
              <BrainCircuit className="mr-2 h-4 w-4" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="widget">
              <Code className="mr-2 h-4 w-4" />
              Widget
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="configuration" className="py-4">
            <Card>
              <CardHeader>
                <CardTitle>Agent Configuration</CardTitle>
                <CardDescription>Manage settings for {agent?.name || "this agent"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium mb-2">Model</h3>
                    <p className="text-gray-600">{agent?.configuration?.model || "Not specified"}</p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Temperature</h3>
                    <p className="text-gray-600">{agent?.configuration?.temperature || "0"}</p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Max Tokens</h3>
                    <p className="text-gray-600">{agent?.configuration?.max_tokens || "1024"}</p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Status</h3>
                    <p className="text-gray-600">{agent?.isActive ? "Active" : "Inactive"}</p>
                  </div>
                  <div className="col-span-2 mb-2">
                    <h3 className="font-medium mb-2">Knowledge Bases</h3>
                    <div className="flex flex-wrap gap-2">
                      {agent?.knowledgeBaseIds && agent.knowledgeBaseIds.length > 0 ? (
                        knowledgeBases
                          .filter(kb => agent.knowledgeBaseIds.includes(kb.id))
                          .map(kb => (
                            <div key={kb.id} className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                              {kb.name}
                            </div>
                          ))
                      ) : (
                        <p className="text-gray-600">No knowledge bases connected</p>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <h3 className="font-medium mb-2">System Message</h3>
                    <p className="text-gray-600 p-3 bg-gray-50 rounded-md">
                      {agent?.configuration?.system_message || "No system message provided."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="widget" className="py-4">
            {agent && (
              <AgentWidgetCode agentId={agent.id} agentName={agent.name} />
            )}
          </TabsContent>

          <TabsContent value="settings" className="py-4">
            <Card>
              <CardHeader>
                <CardTitle>Agent Settings</CardTitle>
                <CardDescription>Customize agent behavior and response generation</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((values) => updateAgent(values))} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agent Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter agent name"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            A descriptive name for your agent.
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="promptTemplate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prompt Template</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter a custom prompt template..."
                              className="min-h-[200px] font-mono text-sm"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            This template is used when the agent retrieves information from knowledge bases.
                            It affects how the agent interprets and integrates this knowledge into its responses.
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="llmProvider"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>LLM Provider</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a provider" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {llmProviders.map((provider) => (
                                  <SelectItem key={provider.value} value={provider.value}>
                                    {provider.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              The AI service provider for your agent.
                            </FormDescription>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="llmModel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>LLM Model</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a model" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {availableModels.map((model) => (
                                  <SelectItem key={model.value} value={model.value}>
                                    {model.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              The specific AI model to use with the selected provider.
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="maxTokens"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Tokens</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={100}
                                max={8192}
                                step={1}
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Maximum number of tokens to generate per response. Higher values allow for longer responses,
                              but may increase latency and cost. Typical values range from 256 to 4096.
                            </FormDescription>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="temperature"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Temperature</FormLabel>
                            <FormControl>
                              <div className="pt-2">
                                <Slider
                                  value={[field.value]}
                                  min={0}
                                  max={1}
                                  step={0.01}
                                  onValueChange={(values) => field.onChange(values[0])}
                                />
                                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                                  <span>Precise ({field.value.toFixed(2)})</span>
                                  <span>Creative</span>
                                </div>
                              </div>
                            </FormControl>
                            <FormDescription>
                              Controls randomness of responses. Lower values are more deterministic, while higher values increase creativity.
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="allowContinuousGeneration"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Continuous Content Generation</FormLabel>
                            <FormDescription>
                              Allow this agent to generate long-form content like sales pages in multiple sections (up to 8,000+ words).
                              Enable for marketing content, blog posts, and detailed reports. Disable for customer support, Q&A,
                              or any application where short, precise responses are preferred.
                            </FormDescription>
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

                    <FormField
                      control={form.control}
                      name="enableConversationMemory"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Conversation Memory</FormLabel>
                            <FormDescription>
                              Enable conversation memory to allow the agent to remember and reference previous messages in the conversation.
                              This helps maintain context and provide more coherent responses for follow-up questions. 
                              Disable if you want each question to be handled independently.
                            </FormDescription>
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

                    <div className="border p-4 rounded-lg space-y-6 mt-6">
                      <h3 className="font-semibold text-lg border-b pb-2">AI Behavior Controls</h3>

                      {/* Rules for this Agent */}
                      <FormField
                        control={form.control}
                        name="rules"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rules for this Agent</FormLabel>
                            <div className="space-y-4">
                              <FormDescription>
                                Add specific operational rules that this agent should follow when responding. These rules will be injected into the AI prompt system for this agent.
                              </FormDescription>

                              {/* Show existing rules */}
                              <div className="space-y-2">
                                {field.value.map((rule, index) => (
                                  <div key={index} className="flex items-center gap-2">
                                    <Input 
                                      value={rule}
                                      onChange={(e) => {
                                        const newRules = [...field.value];
                                        newRules[index] = e.target.value;
                                        field.onChange(newRules);
                                      }}
                                      className="flex-1"
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      onClick={() => {
                                        const newRules = [...field.value];
                                        newRules.splice(index, 1);
                                        field.onChange(newRules);
                                      }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                    </Button>
                                  </div>
                                ))}
                              </div>

                              {/* Add new rule button */}
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  field.onChange([...field.value, ""]);
                                }}
                                disabled={field.value.length >= 10}
                                className="w-full"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Add Rule
                              </Button>

                              {field.value.length >= 10 && (
                                <p className="text-xs text-amber-500">Maximum of 10 rules reached</p>
                              )}

                              <FormMessage />
                            </div>
                          </FormItem>
                        )}
                      />

                      {/* Confidence Threshold */}
                      <FormField
                        control={form.control}
                        name="confidenceThreshold"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confidence Threshold</FormLabel>
                            <FormDescription>
                              If the AI's confidence falls below this threshold, the fallback message will be shown instead. Higher values ensure more accurate responses but may increase fallback frequency.
                            </FormDescription>
                            <div className="flex gap-4 items-center">
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  max="1"
                                  step="0.01"
                                  {...field}
                                  className="w-24"
                                />
                              </FormControl>
                              <div className="w-full">
                                <div className="flex h-5 items-center">
                                  <span className="text-xs text-muted-foreground">Lower threshold</span>
                                  <div className="flex-1"></div>
                                  <span className="text-xs text-muted-foreground">Higher threshold</span>
                                </div>
                                <Input
                                  type="range" 
                                  min="0"
                                  max="1"
                                  step="0.01"
                                  value={field.value}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                  className="accent-primary"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>More responses</span>
                                  <span>More accurate</span>
                                </div>
                              </div>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Default Fallback Message */}
                      <FormField
                        control={form.control}
                        name="fallbackMessage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Default Fallback Message</FormLabel>
                            <FormDescription>
                              This message will be shown to users when the AI isn't confident enough to provide a reliable answer or encounters issues with the request.
                            </FormDescription>
                            <FormControl>
                              <Textarea
                                placeholder="I'm not confident enough to answer that. Could you please rephrase your question?"
                                className="min-h-[100px]"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Save Settings
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}