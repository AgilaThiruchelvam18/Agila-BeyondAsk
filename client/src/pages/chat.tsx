import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Send, ArrowLeft, Loader2, Waves, X, Edit, Copy, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { MessageWithCitations, Citation } from "@/components/chat/message-with-citations";
import { FollowUpQuestion } from "@/components/chat/follow-up-questions";
import { format } from "date-fns";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";

// Define types for our data
type Agent = {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  knowledgeBaseIds: number[] | null;
  // Other fields...
};

type Conversation = {
  id: number;
  title: string;
  agentId: number;
  lastMessageAt: Date;
  // Other fields...
};

type Message = {
  id: number;
  conversationId: number;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: Date;
  citations?: Array<{
    id: string;
    content: string;
    source: string;
    document_id: string;
    score: number;
    chunk_index: number;
  }>;
  followUpQuestions?: Array<{
    id: string;
    text: string;
  }>;
  // Other fields...
};

type Provider = {
  id: number;
  name: string;
  slug: string;
  description: string;
  logoUrl: string | null;
};

type Model = {
  id: number;
  name: string;
  slug: string;
  providerId: number;
  version: string;
  contextWindow: number;
  isActive: boolean;
};

export default function Chat() {
  const { agentId } = useParams<{ agentId: string }>();
  const [userMessage, setUserMessage] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<{[key: string]: boolean}>({
    today: false,
    yesterday: false,
    week: false,
    month: false,
    older: false
  });
  const [editingMessage, setEditingMessage] = useState<{ id: number, content: string } | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamProgress, setStreamProgress] = useState(0);
  const [streamedText, setStreamedText] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [editingConversation, setEditingConversation] = useState<{ id: number, title: string } | null>(null);
  
  // LLM provider and model selection
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>("1"); // Default provider ID
  const [selectedProviderSlug, setSelectedProviderSlug] = useState<string | null>("openai"); // Default to OpenAI
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch agent data
  const {
    data: agent,
    isLoading: isLoadingAgent,
    error: agentError,
  } = useQuery<Agent>({
    queryKey: ["/api/agents", parseInt(agentId)],
    queryFn: () => apiRequest(`/api/agents/${agentId}`),
    enabled: !!agentId,
  });

  // Fetch conversations for this agent
  const {
    data: conversationsData,
    isLoading: isLoadingConversations,
  } = useQuery<{ conversations: Conversation[] }>({
    queryKey: ["/api/agents", parseInt(agentId), "conversations"],
    queryFn: () => apiRequest(`/api/agents/${agentId}/conversations`),
    enabled: !!agentId,
  });
  
  // Extract conversations array from the response
  const conversations = conversationsData?.conversations || [];

  // Fetch messages for active conversation
  const {
    data: messagesData,
    isLoading: isLoadingMessages,
  } = useQuery<{ messages: Message[] }>({
    queryKey: ["/api/conversations", activeConversationId, "messages"],
    queryFn: () => apiRequest(`/api/conversations/${activeConversationId}/messages`),
    enabled: !!activeConversationId,
  });
  
  // Extract messages array from the response
  const messages = messagesData?.messages || [];
  
  // Fetch LLM providers
  const {
    data: providers = [],
    isLoading: isLoadingProviders,
  } = useQuery<Provider[]>({
    queryKey: ["/api/llm/providers"],
    queryFn: () => apiRequest("/api/llm/providers"),
  });
  
  // Update provider slug when providers list or selected provider changes
  useEffect(() => {
    if (providers.length > 0 && selectedProviderId) {
      const provider = providers.find(p => p.id.toString() === selectedProviderId);
      if (provider && provider.slug) {
        setSelectedProviderSlug(provider.slug);
        console.log(`Updated provider slug to: ${provider.slug} from ID: ${selectedProviderId}`);
      }
    }
  }, [providers, selectedProviderId]);
  
  // Fetch LLM models for the selected provider
  const {
    data: models = [],
    isLoading: isLoadingModels,
  } = useQuery<Model[]>({
    queryKey: ["/api/llm/providers", selectedProviderId, "models"],
    queryFn: () => {
      if (!selectedProviderId) return Promise.resolve([]);
      return apiRequest(`/api/llm/providers/${selectedProviderId}/models`);
    },
    enabled: !!selectedProviderId,
  });
  
  // When provider changes, reset model selection
  useEffect(() => {
    setSelectedModelId(null);
  }, [selectedProviderId]);

  // Create new conversation
  const createConversation = useMutation<Conversation, Error, string>({
    mutationFn: async (title: string) => {
      const response = await apiRequest("/api/conversations", {
        method: "POST",
        data: {
          title,
          agentId: parseInt(agentId),
        },
      });
      return response as Conversation;
    },
    onSuccess: (newConversation: Conversation) => {
      // Set active conversation and ensure it's displayed immediately
      setActiveConversationId(newConversation.id);
      
      // Invalidate the conversations query to update the list
      queryClient.invalidateQueries({ queryKey: ["/api/agents", parseInt(agentId), "conversations"] });
      
      // Manually add the new conversation to the cache to ensure it appears immediately
      const previousData = queryClient.getQueryData<{ conversations: Conversation[] }>(["/api/agents", parseInt(agentId), "conversations"]);
      
      if (previousData) {
        queryClient.setQueryData(["/api/agents", parseInt(agentId), "conversations"], {
          conversations: [newConversation, ...previousData.conversations]
        });
      }
      
      // Scroll to message input
      setTimeout(() => {
        const inputElement = document.querySelector("input[placeholder='Type your message...']") as HTMLInputElement;
        if (inputElement) inputElement.focus();
      }, 100);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create conversation",
        variant: "destructive",
      });
    },
  });

  // Update conversation title
  const updateConversation = useMutation<Conversation, Error, { id: number, title: string }>({
    mutationFn: async ({ id, title }) => {
      const response = await apiRequest(`/api/conversations/${id}`, {
        method: "PUT",
        data: {
          title,
        },
      });
      return response.conversation as Conversation;
    },
    onSuccess: (updatedConversation) => {
      setEditingConversation(null);
      
      // Update the conversation in the cache
      const previousData = queryClient.getQueryData<{ conversations: Conversation[] }>(["/api/agents", parseInt(agentId), "conversations"]);
      
      if (previousData) {
        const updatedConversations = previousData.conversations.map(conv => 
          conv.id === updatedConversation.id ? updatedConversation : conv
        );
        
        queryClient.setQueryData(["/api/agents", parseInt(agentId), "conversations"], {
          conversations: updatedConversations
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update conversation",
        variant: "destructive",
      });
    },
  });

  // Delete conversation
  const deleteConversation = useMutation<void, Error, number>({
    mutationFn: async (conversationId: number) => {
      await apiRequest(`/api/conversations/${conversationId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      if (activeConversationId && conversations.length > 1) {
        // Find the next conversation to make active
        const remainingConversations = conversations.filter(c => c.id !== activeConversationId);
        if (remainingConversations.length > 0) {
          // Sort by most recent
          const sortedConversations = [...remainingConversations].sort(
            (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
          );
          setActiveConversationId(sortedConversations[0].id);
        } else {
          setActiveConversationId(null);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/agents", parseInt(agentId), "conversations"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive",
      });
    },
  });

  // Send message
  const sendMessage = useMutation<Message, Error, string>({
    mutationFn: async (content: string) => {
      setIsStreaming(true);
      setStreamProgress(0);
      setStreamedText(""); // Clear previous streaming text
      
      // Handle model selection, including "auto" mode
      let model;
      const isAutoMode = selectedModelId === "auto";
      
      if (isAutoMode) {
        model = "auto"; // Pass the "auto" flag to the server
      } else if (selectedModelId) {
        model = models.find(m => m.id.toString() === selectedModelId)?.slug;
      }
      
      console.log(`Sending message with providerId: ${selectedProviderId}, providerSlug: ${selectedProviderSlug}, model: ${model}, autoMode: ${isAutoMode}`);
      
      const response = await apiRequest(`/api/conversations/${activeConversationId}/messages`, {
        method: "POST",
        data: {
          content,
          role: "user",
          providerId: selectedProviderSlug, // Send the slug instead of ID
          providerIdNum: selectedProviderId, // Keep ID for backwards compatibility
          model: model,
          autoMode: isAutoMode, // Explicit flag for auto mode
        },
      });
      
      // Simulate streaming progress - in a real implementation, we'd use SSE
      const simulateStreamingProgress = () => {
        // For demo purposes, let's simulate an AI generating text character by character
        // In a real app, you'd connect to a streaming endpoint
        const fullResponse = "Thank you for your message. I'm analyzing your query and gathering information to provide the most accurate response possible. Let me search through my knowledge base for relevant details. Here's what I found...";
        let currentPosition = 0;
        
        const intervalId = setInterval(() => {
          if (currentPosition < fullResponse.length) {
            const charsToAdd = Math.floor(Math.random() * 5) + 1; // Add 1-5 chars at a time
            const nextPos = Math.min(currentPosition + charsToAdd, fullResponse.length);
            const nextChunk = fullResponse.substring(currentPosition, nextPos);
            setStreamedText(prev => prev + nextChunk);
            currentPosition = nextPos;
            
            // Update progress based on how much text has been "streamed"
            const progressPercent = (currentPosition / fullResponse.length) * 100;
            setStreamProgress(progressPercent);
          } else {
            clearInterval(intervalId);
            setStreamProgress(100);
            setIsStreaming(false);
          }
        }, 50);
        
        // Fallback timer to ensure streaming always finishes
        setTimeout(() => {
          clearInterval(intervalId);
          setStreamProgress(100);
          setIsStreaming(false);
        }, 8000);
      };
      
      simulateStreamingProgress();
      return response as Message;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", activeConversationId, "messages"] });
    },
    onError: () => {
      setIsStreaming(false);
      setStreamProgress(0);
      setStreamedText("");
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });
  
  // Update message
  const updateMessage = useMutation<Message, Error, { id: number, content: string }>({
    mutationFn: async ({ id, content }) => {
      const response = await apiRequest(`/api/conversations/${activeConversationId}/messages/${id}`, {
        method: "PUT",
        data: {
          content,
        },
      });
      return response as Message;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", activeConversationId, "messages"] });
      toast({
        title: "Message updated",
        description: "Your message has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update message",
        variant: "destructive",
      });
    },
  });

  // When messages update or streaming status changes, scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming, sendMessage.isPending]);

  // Start a new conversation if there isn't one yet
  useEffect(() => {
    if (
      agent && 
      !isLoadingConversations && 
      conversations && 
      conversations.length === 0 && 
      !activeConversationId && 
      !createConversation.isPending
    ) {
      createConversation.mutate(`Chat with ${agent.name}`);
    } else if (
      !isLoadingConversations && 
      conversations && 
      conversations.length > 0 && 
      !activeConversationId
    ) {
      // Set the most recent conversation as active
      const sortedConversations = [...conversations].sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
      setActiveConversationId(sortedConversations[0].id);
    }
  }, [agent, conversations, isLoadingConversations, activeConversationId, createConversation]);

  const handleSendMessage = () => {
    if (!userMessage.trim() || !activeConversationId) return;
    
    sendMessage.mutate(userMessage);
    setUserMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (agentError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold">Error loading agent</h1>
        <p className="text-muted-foreground">The agent might not exist or you may not have permission to access it.</p>
        <Button asChild className="mt-4">
          <Link href="/agents">Back to Agents</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="p-4 flex items-center">
        <Button variant="ghost" size="icon" asChild className="mr-2">
          <Link href="/agents">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        {isLoadingAgent ? (
          <div className="flex items-center">
            <Skeleton className="h-8 w-8 rounded-full mr-2" />
            <Skeleton className="h-6 w-32" />
          </div>
        ) : (
          <div className="flex items-center">
            <Avatar className="h-8 w-8 mr-2">
              <AvatarFallback>{agent?.name ? agent.name.charAt(0) : 'A'}</AvatarFallback>
            </Avatar>
            <span className="font-semibold">{agent?.name || 'Agent'}</span>
          </div>
        )}
      </header>

      {/* Chat Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Conversations Sidebar */}
        <div className={`${isSidebarCollapsed ? 'w-12' : 'w-80'} hidden md:flex flex-col transition-all duration-300 ease-in-out relative`}>
          <div className="flex items-center justify-between p-4">
            {!isSidebarCollapsed && <div className="font-semibold">Conversations</div>}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={isSidebarCollapsed ? 'mx-auto' : ''}
            >
              {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
          <Separator className="border-gray-200"/>
          <ScrollArea className="flex-1 border-r">
            {isLoadingConversations ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : conversations && conversations.length > 0 ? (
              <div className="p-2">
                {/* Group conversations by date */}
                {(() => {
                  // Group conversations by date
                  const today = new Date();
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  const lastWeek = new Date();
                  lastWeek.setDate(lastWeek.getDate() - 7);
                  const lastMonth = new Date();
                  lastMonth.setDate(lastMonth.getDate() - 30);
                  
                  // Use the state from component level
                  
                  const toggleSection = (section: string) => {
                    setCollapsedSections(prev => ({
                      ...prev,
                      [section]: !prev[section]
                    }));
                  };
                  
                  const groups: { [key: string]: Conversation[] } = {
                    today: [],
                    yesterday: [],
                    week: [],
                    month: [],
                    older: []
                  };
                  
                  // Sort conversations by date
                  const sortedConversations = [...conversations].sort(
                    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
                  );
                  
                  // Group conversations
                  sortedConversations.forEach(conv => {
                    const convDate = new Date(conv.lastMessageAt);
                    if (convDate.toDateString() === today.toDateString()) {
                      groups.today.push(conv);
                    } else if (convDate.toDateString() === yesterday.toDateString()) {
                      groups.yesterday.push(conv);
                    } else if (convDate > lastWeek) {
                      groups.week.push(conv);
                    } else if (convDate > lastMonth) {
                      groups.month.push(conv);
                    } else {
                      groups.older.push(conv);
                    }
                  });
                  
                  // Render groups
                  return Object.entries(groups).map(([key, convs]) => {
                    if (convs.length === 0) return null;
                    
                    let title = "";
                    switch (key) {
                      case "today": title = "Today"; break;
                      case "yesterday": title = "Yesterday"; break;
                      case "week": title = "Past Week"; break;
                      case "month": title = "Past Month"; break;
                      case "older": title = "Older"; break;
                    }
                    
                    return (
                      <div key={key} className="mb-4">
                        {!isSidebarCollapsed && (
                          <div 
                            className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-2 py-1 cursor-pointer hover:bg-muted/50 rounded"
                            onClick={() => toggleSection(key)}
                          >
                            <span>{title}</span>
                            {collapsedSections[key] ? 
                              <ChevronRight className="h-3 w-3" /> : 
                              <ChevronDown className="h-3 w-3" />
                            }
                          </div>
                        )}
                        {!collapsedSections[key] && convs.map((conversation: Conversation) => (
                          <div key={conversation.id} className="flex items-center mb-1 group relative">
                            <Button
                              variant={activeConversationId === conversation.id ? "outline" : "ghost"}
                              className={`${isSidebarCollapsed ? 'justify-center' : 'justify-start text-left pr-14'} flex-1`}
                              onClick={() => setActiveConversationId(conversation.id)}
                            >
                              {isSidebarCollapsed ? (
                                <div className="truncate">{conversation.title.charAt(0)}</div>
                              ) : (
                                <div className="truncate">{conversation.title}</div>
                              )}
                            </Button>
                            {!isSidebarCollapsed && (
                              <div className="absolute right-1 opacity-0 group-hover:opacity-100 transition-opacity flex">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingConversation({
                                      id: conversation.id,
                                      title: conversation.title
                                    });
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteConversation.mutate(conversation.id);
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                {!isSidebarCollapsed && "No conversations yet"}
              </div>
            )}
          </ScrollArea>
          <div className="p-2">
            <Button
              variant="outline"
              className={`w-full ${isSidebarCollapsed ? 'px-0' : ''}`}
              onClick={() => {
                if (agent) {
                  createConversation.mutate(`New chat with ${agent.name}`);
                }
              }}
              disabled={createConversation.isPending || !agent}
            >
              {createConversation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSidebarCollapsed ? (
                <span>+</span>
              ) : (
                <span>New Chat</span>
              )}
            </Button>
          </div>
        </div>
        
        {/* Edit Conversation Dialog */}
        <Dialog open={!!editingConversation} onOpenChange={(open) => !open && setEditingConversation(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Conversation</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Input
                value={editingConversation?.title || ""}
                onChange={(e) => setEditingConversation(prev => prev ? { ...prev, title: e.target.value } : null)}
                placeholder="Enter new conversation title"
              />
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                onClick={() => {
                  if (editingConversation) {
                    updateConversation.mutate({
                      id: editingConversation.id,
                      title: editingConversation.title
                    });
                  }
                }}
                disabled={updateConversation.isPending}
              >
                {updateConversation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Messages */}
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            {isLoadingMessages ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader className="p-3">
                      <div className="flex items-center">
                        <Skeleton className="h-8 w-8 rounded-full mr-2" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <Skeleton className="h-16 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : !activeConversationId ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Start a new conversation</h3>
                  <p className="text-muted-foreground">Send a message to begin chatting with the agent</p>
                </div>
              </div>
            ) : messages && messages.length > 0 ? (
              <div className="space-y-4">
                {messages.map((message: Message) => (
                  <MessageWithCitations
                    key={message.id}
                    id={message.id}
                    content={message.content}
                    role={message.role}
                    createdAt={message.createdAt}
                    citations={message.citations}
                    followUpQuestions={message.followUpQuestions}
                    senderName={message.role === "user" ? "You" : (agent?.name || 'Agent')}
                    senderInitial={message.role === "user" ? "U" : (agent?.name ? agent.name.charAt(0) : 'A')}
                    isChatDisabled={isStreaming}
                    onFollowUpQuestionClick={(question) => {
                      setUserMessage(question);
                      // Auto-submit the follow-up question after a brief delay
                      setTimeout(() => handleSendMessage(), 100);
                    }}
                    onMessageEdit={(id, content) => {
                      updateMessage.mutate({ id, content });
                    }}
                  />
                ))}
                {isStreaming && (
                  <Card className="mr-12">
                    <CardHeader className="p-3 pb-1">
                      <div className="flex items-center">
                        <Avatar className="h-8 w-8 mr-2 bg-indigo-500">
                          <AvatarFallback className="text-white">{agent?.name ? agent.name.charAt(0) : 'A'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium">{agent?.name || 'Agent'}</div>
                          <div className="text-xs text-muted-foreground">Just now</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="space-y-2">
                        <div className="whitespace-pre-wrap">{streamedText}</div>
                        <div className="flex items-center">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          <span className="text-sm text-muted-foreground">Generating response</span>
                        </div>
                        <Progress value={streamProgress} className="h-1 bg-gray-200" />
                      </div>
                    </CardContent>
                  </Card>
                )}
                {sendMessage.isPending && !isStreaming && (
                  <Card className="mr-12">
                    <CardHeader className="p-3 pb-1">
                      <div className="flex items-center">
                        <Avatar className="h-8 w-8 mr-2 bg-indigo-500">
                          <AvatarFallback className="text-white">{agent?.name ? agent.name.charAt(0) : 'A'}</AvatarFallback>
                        </Avatar>
                        <CardTitle className="text-sm font-medium">{agent?.name || 'Agent'}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-sm">Processing your request</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <h3 className="text-lg font-semibold">No messages yet</h3>
                  <p className="text-muted-foreground">Send a message to begin chatting with the agent</p>
                </div>
              </div>
            )}
          </ScrollArea>

          {/* Message Input */}
          <div className="p-4">
            <div className="flex flex-col space-y-2">
              {/* LLM Settings */}
              <div className="flex items-center justify-end mb-1">
                <Popover open={isModelSettingsOpen} onOpenChange={setIsModelSettingsOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1 h-8 text-xs"
                    >
                      <Settings className="h-3 w-3" />
                      {selectedProviderId ? (
                        <span>
                          {providers.find(p => p.id.toString() === selectedProviderId)?.name || 'Provider'} / 
                          {selectedModelId === "auto" ? (
                            <span className="text-green-500 font-medium">Auto</span>
                          ) : selectedModelId ? (
                            models.find(m => m.id.toString() === selectedModelId)?.name || 'Model'
                          ) : (
                            'Select Model'
                          )}
                        </span>
                      ) : (
                        <span>Select LLM Model</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 bg-white" align="end">
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium leading-none">LLM Provider</h4>
                        <p className="text-sm text-muted-foreground">
                          Select which LLM provider to use for this conversation
                        </p>
                        <Select
                          value={selectedProviderId || undefined}
                          onValueChange={setSelectedProviderId}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {providers.map((provider) => (
                              <SelectItem key={provider.id} value={provider.id.toString()}>
                                {provider.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-medium leading-none">Model</h4>
                        <p className="text-sm text-muted-foreground">
                          Select which model to use from this provider
                        </p>
                        <Select
                          value={selectedModelId || undefined}
                          onValueChange={setSelectedModelId}
                          disabled={isLoadingModels || models.length === 0}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={
                              isLoadingModels 
                                ? "Loading models..." 
                                : models.length === 0 
                                  ? "No models available" 
                                  : "Select a model"
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem key="auto" value="auto">
                                Auto (Select best model for your query)
                              </SelectItem>
                              <SelectItem key="divider" value="divider" disabled>
                                ───────────────────
                              </SelectItem>
                            {models.map((model) => (
                              <SelectItem 
                                key={model.id} 
                                value={model.id.toString()}
                              >
                                {model.name} {model.version ? `(${model.version})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Message Input Field */}
              <div className="flex">
                <Input
                  placeholder="Type your message..."
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={!activeConversationId || sendMessage.isPending}
                  className="mr-2"
                />
                <Button
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={!userMessage.trim() || !activeConversationId || sendMessage.isPending}
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}