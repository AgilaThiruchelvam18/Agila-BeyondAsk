import React, { useState, useEffect } from 'react';
import { Link, useRoute } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, X, CheckCircle, AlertCircle, Clock, ExternalLink, BookOpen } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, defaultFetcher } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from "@/components/layout/dashboard-layout";

// Define the type for the unanswered question from backend
interface UnansweredQuestion {
  id: number;
  question: string;
  context: string | null;
  confidenceScore: number;
  status: 'pending' | 'addressed' | 'ignored';
  resolution: string | null;
  userId: number;
  agentId: number;
  knowledgeBaseId: number | null;
  conversationId: number | null;
  messageId: number | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  newDocumentId: number | null;
  metadata: any;
}

// Define the type for an agent
interface Agent {
  id: number;
  name: string;
  userId: number;
  description?: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
  knowledgeBaseIds?: number[];
}

// Type for Document
interface Document {
  id: number;
  title: string;
  description?: string;
  status: string;
  sourceType: string;
  knowledgeBaseId: number;
  createdAt: string;
}

// Form schemas
const addressQuestionSchema = z.object({
  resolution: z.string().min(1, 'Resolution is required'),
  documentAction: z.enum(['none', 'select', 'create']),
  documentId: z.number().optional(),
  documentTitle: z.string().optional(),
  documentContent: z.string().optional(),
});

const ignoreQuestionSchema = z.object({
  reason: z.string().optional(),
});

const UnansweredQuestionsPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedQuestion, setSelectedQuestion] = useState<UnansweredQuestion | null>(null);
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);
  const [isIgnoreDialogOpen, setIsIgnoreDialogOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);

  // Form setup for addressing a question
  const addressForm = useForm<z.infer<typeof addressQuestionSchema>>({
    resolver: zodResolver(addressQuestionSchema),
    defaultValues: {
      resolution: '',
      documentAction: 'none',
      documentId: undefined,
      documentTitle: '',
      documentContent: '',
    },
  });
  
  // Reset form when dialog opens
  useEffect(() => {
    if (isAddressDialogOpen) {
      addressForm.reset({
        resolution: '',
        documentAction: 'none',
        documentId: undefined,
        documentTitle: '',
        documentContent: '',
      });
    }
  }, [isAddressDialogOpen, addressForm]);

  // Form setup for ignoring a question
  const ignoreForm = useForm<z.infer<typeof ignoreQuestionSchema>>({
    resolver: zodResolver(ignoreQuestionSchema),
    defaultValues: {
      reason: '',
    },
  });

  // Get all unanswered questions - OPTIMIZED to reduce calls
  const { data: questions, isLoading, error } = useQuery({
    queryKey: ['/api/unanswered-questions'],
    queryFn: () => defaultFetcher('/api/unanswered-questions'),
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    gcTime: 1000 * 60 * 10, // 10 minutes cache retention
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  });

  // Get agents for filtering - OPTIMIZED to reduce calls
  const { data: agents } = useQuery({
    queryKey: ['/api/agents'],
    queryFn: () => defaultFetcher('/api/agents'),
    retry: 1,
    staleTime: 1000 * 60 * 10, // 10 minutes cache
    gcTime: 1000 * 60 * 15, // 15 minutes cache retention
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  });

  // Mutation for creating a new document
  const createDocumentMutation = useMutation({
    mutationFn: (data: { title: string, content: string, knowledgeBaseId: number }) => {
      return apiRequest(`/api/knowledge-bases/${data.knowledgeBaseId}/documents`, {
        method: 'POST',
        data: {
          title: data.title,
          content: data.content,
          sourceType: 'text',
        },
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Document created',
        description: 'New document has been created successfully'
      });
      
      // Extract the newly created document's ID and update the form
      if (data && data.id) {
        addressForm.setValue('documentId', data.id);
        
        // Now submit the address question form with the new document ID
        const formData = addressForm.getValues();
        submitAddressQuestion({
          ...formData,
          documentId: data.id,
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create document: ${error}`,
        variant: 'destructive',
      });
    }
  });
  
  // Mutation for addressing a question
  const addressMutation = useMutation({
    mutationFn: (data: any) => {
      if (!selectedQuestion) return Promise.reject('No question selected');
      
      // Transform the form data to match what the backend expects
      const payload = {
        resolution: data.resolution,
        // Only include documentId if it's defined
        ...(data.documentId ? { newDocumentId: data.documentId } : {})
      };
      
      return apiRequest(`/api/unanswered-questions/${selectedQuestion.id}/address`, {
        method: 'POST',
        data: payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/unanswered-questions'] });
      toast({
        title: 'Question addressed',
        description: 'The question has been marked as addressed',
      });
      setIsAddressDialogOpen(false);
      addressForm.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to address question: ${error}`,
        variant: 'destructive',
      });
    },
  });

  // Mutation for ignoring a question
  const ignoreMutation = useMutation({
    mutationFn: (data: z.infer<typeof ignoreQuestionSchema>) => {
      if (!selectedQuestion) return Promise.reject('No question selected');
      return apiRequest(`/api/unanswered-questions/${selectedQuestion.id}/ignore`, {
        method: 'POST',
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/unanswered-questions'] });
      toast({
        title: 'Question ignored',
        description: 'The question has been marked as ignored',
      });
      setIsIgnoreDialogOpen(false);
      ignoreForm.reset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to ignore question: ${error}`,
        variant: 'destructive',
      });
    },
  });
  
  // Helper function to submit the address question form with document id
  const submitAddressQuestion = (formData: z.infer<typeof addressQuestionSchema>) => {
    addressMutation.mutate(formData);
  };

  // Function to handle addressing a question
  const handleAddressQuestion = (data: z.infer<typeof addressQuestionSchema>) => {
    if (!selectedQuestion) return;
    
    switch (data.documentAction) {
      case 'none':
        // Just address the question without creating or selecting a document
        submitAddressQuestion({
          ...data,
          documentId: undefined,
        });
        break;
        
      case 'select':
        // Use the selected existing document
        if (!data.documentId) {
          toast({
            title: 'Document required',
            description: 'Please select a document',
            variant: 'destructive',
          });
          return;
        }
        submitAddressQuestion(data);
        break;
        
      case 'create':
        // Create a new document first, then address the question
        if (!data.documentTitle || !data.documentContent) {
          toast({
            title: 'Document details required',
            description: 'Please provide a title and content for the new document',
            variant: 'destructive',
          });
          return;
        }
        
        // Find a knowledge base to add the document to
        let knowledgeBaseId = selectedQuestion.knowledgeBaseId;
        
        // If question doesn't have a knowledge base directly associated,
        // try to get one from the agent
        if (!knowledgeBaseId && selectedQuestion.agentId) {
          const agent = agents?.find((a: Agent) => a.id === selectedQuestion.agentId);
          if (agent?.knowledgeBaseIds?.length) {
            knowledgeBaseId = agent.knowledgeBaseIds[0];
          }
        }
        
        if (!knowledgeBaseId) {
          toast({
            title: 'Knowledge base required',
            description: 'No knowledge base found for this question',
            variant: 'destructive',
          });
          return;
        }
        
        // Create the document
        createDocumentMutation.mutate({
          title: data.documentTitle,
          content: data.documentContent,
          knowledgeBaseId: knowledgeBaseId,
        });
        break;
    }
  };

  // Function to handle ignoring a question
  const handleIgnoreQuestion = (data: z.infer<typeof ignoreQuestionSchema>) => {
    ignoreMutation.mutate(data);
  };

  // Function to open the address dialog
  const openAddressDialog = (question: UnansweredQuestion) => {
    setSelectedQuestion(question);
    setIsAddressDialogOpen(true);
  };

  // Function to open the ignore dialog
  const openIgnoreDialog = (question: UnansweredQuestion) => {
    setSelectedQuestion(question);
    setIsIgnoreDialogOpen(true);
  };

  // Filter questions based on active tab and selected agent
  const filteredQuestions = questions && Array.isArray(questions) 
    ? questions.filter((q: UnansweredQuestion) => {
        const statusMatch = activeTab === 'all' || q.status === activeTab;
        const agentMatch = !selectedAgentId || q.agentId === selectedAgentId;
        return statusMatch && agentMatch;
      }) 
    : [];

  // Find agent name by ID
  const getAgentName = (agentId: number) => {
    if (!agents || !Array.isArray(agents)) return 'Unknown Agent';
    const agent = agents.find((a: Agent) => a.id === agentId);
    return agent ? agent.name : 'Unknown Agent';
  };

  // Render status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" /> Pending</Badge>;
      case 'addressed':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="mr-1 h-3 w-3" /> Addressed</Badge>;
      case 'ignored':
        return <Badge variant="outline"><X className="mr-1 h-3 w-3" /> Ignored</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <DashboardLayout>
        <div className="bg-destructive/20 border border-destructive p-4 rounded-md">
          <h2 className="text-lg font-bold text-destructive mb-2">Error loading questions</h2>
          <p>{String(error)}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Unanswered Questions</h1>
        <p className="text-muted-foreground">
          Review and manage questions that your knowledge agent couldn't answer confidently
        </p>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <Select value={selectedAgentId?.toString() || 'all'} onValueChange={(value) => setSelectedAgentId(value === 'all' ? null : parseInt(value))}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents && Array.isArray(agents) && agents.map((agent: Agent) => (
                <SelectItem key={agent.id} value={agent.id.toString()}>{agent.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="all">All Questions</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="addressed">Addressed</TabsTrigger>
          <TabsTrigger value="ignored">Ignored</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredQuestions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold">No questions found</h3>
                <p className="text-muted-foreground text-center mt-2">
                  {activeTab === 'all' 
                    ? "No unanswered questions have been detected yet. They'll appear here when your agent encounters questions it can't answer confidently."
                    : `No questions with status "${activeTab}" found.`}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredQuestions.map((question: UnansweredQuestion) => (
              <Card key={question.id} className={
                question.status === 'addressed' ? 'border-green-200' :
                question.status === 'ignored' ? 'border-gray-200' :
                'border-amber-200'
              }>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{question.question}</CardTitle>
                      <CardDescription>
                        From {getAgentName(question.agentId)} • {formatDate(question.createdAt)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      {renderStatusBadge(question.status)}
                      <Badge variant="outline">
                        Confidence: {question.confidenceScore}%
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Show detection reasons */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold mb-1">Detection Reason:</h4>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {question.metadata?.detection_reason?.low_confidence && (
                        <Badge variant="outline" className="bg-amber-100">Low Confidence Score</Badge>
                      )}
                      {question.metadata?.detection_reason?.contains_uncertainty && (
                        <Badge variant="outline" className="bg-amber-100">Contains Uncertainty</Badge>
                      )}
                      {question.metadata?.detection_reason?.too_short && (
                        <Badge variant="outline" className="bg-amber-100">Response Too Short</Badge>
                      )}
                      {question.metadata?.detection_reason?.irrelevant && (
                        <Badge variant="outline" className="bg-amber-100">Irrelevant Question</Badge>
                      )}
                      {!question.metadata?.detection_reason && (
                        <Badge variant="outline">Unspecified Reason</Badge>
                      )}
                    </div>
                    
                    {/* Display evaluation reason from LLM if available */}
                    {question.metadata?.metadata?.reason && (
                      <div className="text-sm text-muted-foreground bg-muted p-2 rounded-md">
                        <span className="font-medium">AI Evaluation: </span> 
                        {question.metadata.metadata.reason}
                      </div>
                    )}
                  </div>
                  
                  {question.context && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold mb-1">Context provided:</h4>
                      <div className="bg-muted p-3 rounded-md text-sm max-h-[200px] overflow-y-auto">
                        {question.context}
                      </div>
                    </div>
                  )}
                  
                  {question.resolution && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-1">Resolution:</h4>
                      <div className="bg-muted p-3 rounded-md text-sm">
                        {question.resolution}
                      </div>
                    </div>
                  )}
                  
                  {question.newDocumentId && (
                    <div className="mt-4">
                      <Button variant="link" size="sm" asChild>
                        <Link to={`/knowledge-bases/documents/${question.newDocumentId}`}>
                          <BookOpen className="mr-1 h-4 w-4" /> View related document
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
                
                {question.status === 'pending' && (
                  <CardFooter className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => openIgnoreDialog(question)}>
                      Ignore
                    </Button>
                    <Button onClick={() => openAddressDialog(question)}>
                      Address
                    </Button>
                  </CardFooter>
                )}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog for addressing a question */}
      <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Address Unanswered Question</DialogTitle>
            <DialogDescription>
              Provide a resolution for this question or link it to a new document that addresses it.
            </DialogDescription>
          </DialogHeader>
          
          {selectedQuestion && (
            <>
              <div className="mb-4">
                <h4 className="text-sm font-semibold mb-1">Question:</h4>
                <div className="bg-muted p-3 rounded-md">{selectedQuestion.question}</div>
              </div>
              
              <Form {...addressForm}>
                <form onSubmit={addressForm.handleSubmit(handleAddressQuestion)} className="space-y-4">
                  <FormField
                    control={addressForm.control}
                    name="resolution"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Resolution</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Provide details on how this question was addressed..."
                            {...field}
                            rows={5}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={addressForm.control}
                    name="documentAction"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Document Action</FormLabel>
                        <FormControl>
                          <RadioGroup 
                            onValueChange={field.onChange} 
                            value={field.value}
                            className="flex flex-col space-y-1"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="none" id="doc-none" />
                              <Label htmlFor="doc-none">No document needed</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="select" id="doc-select" />
                              <Label htmlFor="doc-select">Select existing document</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="create" id="doc-create" />
                              <Label htmlFor="doc-create">Create new document</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {addressForm.watch('documentAction') === 'select' && (
                    <DocumentSelection 
                      selectedQuestion={selectedQuestion}
                      onSelect={(docId) => addressForm.setValue('documentId', docId)}
                    />
                  )}
                  
                  {addressForm.watch('documentAction') === 'create' && (
                    <>
                      <FormField
                        control={addressForm.control}
                        name="documentTitle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Document Title</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter document title" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={addressForm.control}
                        name="documentContent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Document Content</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Enter document content..."
                                {...field}
                                rows={5}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                  
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddressDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addressMutation.isPending}>
                      {addressMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Resolution
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog for ignoring a question */}
      <Dialog open={isIgnoreDialogOpen} onOpenChange={setIsIgnoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ignore Unanswered Question</DialogTitle>
            <DialogDescription>
              Provide a reason for ignoring this question (optional).
            </DialogDescription>
          </DialogHeader>
          
          {selectedQuestion && (
            <>
              <div className="mb-4">
                <h4 className="text-sm font-semibold mb-1">Question:</h4>
                <div className="bg-muted p-3 rounded-md">{selectedQuestion.question}</div>
              </div>
              
              <Form {...ignoreForm}>
                <form onSubmit={ignoreForm.handleSubmit(handleIgnoreQuestion)} className="space-y-4">
                  <FormField
                    control={ignoreForm.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Explain why this question is being ignored..."
                            {...field}
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsIgnoreDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={ignoreMutation.isPending}
                      variant="secondary"
                    >
                      {ignoreMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Ignore Question
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

// DocumentSelection component for selecting existing documents
interface DocumentSelectionProps {
  selectedQuestion: UnansweredQuestion | null;
  onSelect: (documentId: number) => void;
}

const DocumentSelection: React.FC<DocumentSelectionProps> = ({ selectedQuestion, onSelect }) => {
  // Get the knowledge base ID from the question if available, or fetch from the agent
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<number | null>(
    selectedQuestion?.knowledgeBaseId || null
  );
  
  // If the question doesn't have a direct knowledge base, fetch the agent's knowledge bases
  useEffect(() => {
    if (!selectedQuestion?.knowledgeBaseId && selectedQuestion?.agentId) {
      // Fetch agent details to get its knowledge bases
      fetch(`/api/agents/${selectedQuestion.agentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })
        .then(res => res.json())
        .then(agent => {
          // If agent has knowledge bases, use the first one
          if (agent.knowledgeBaseIds && agent.knowledgeBaseIds.length > 0) {
            setKnowledgeBaseId(agent.knowledgeBaseIds[0]);
          }
        })
        .catch(err => console.error('Error fetching agent details:', err));
    }
  }, [selectedQuestion]);

  // Fetch documents for the selected knowledge base
  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: [`/api/knowledge-bases/${knowledgeBaseId}/documents`],
    enabled: !!knowledgeBaseId,
    queryFn: () => fetch(`/api/knowledge-bases/${knowledgeBaseId}/documents`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    }).then(res => {
      if (!res.ok) throw new Error('Failed to fetch documents');
      return res.json();
    })
  });

  if (!knowledgeBaseId) {
    return <div className="text-sm text-muted-foreground">No knowledge base available for this question.</div>;
  }

  if (isLoading) {
    return <div className="flex items-center"><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading documents...</div>;
  }

  if (documents.length === 0) {
    return <div className="text-sm text-muted-foreground">No documents found in this knowledge base.</div>;
  }

  return (
    <div className="space-y-2">
      <FormLabel>Select Document</FormLabel>
      <Select onValueChange={(value) => onSelect(parseInt(value))}>
        <SelectTrigger>
          <SelectValue placeholder="Select a document" />
        </SelectTrigger>
        <SelectContent>
          {documents
            .filter(doc => doc.status === 'processed') // Only show processed documents
            .map(doc => (
              <SelectItem key={doc.id} value={doc.id.toString()}>
                {doc.title}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      <div className="text-xs text-muted-foreground">
        Select an existing document that addresses this question
      </div>
    </div>
  );
};

export default UnansweredQuestionsPage;