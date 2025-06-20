import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, RefreshCw, Info as InfoIcon, Maximize2, Minimize2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from '@codemirror/view';

interface DocumentContentDialogProps {
  document: {
    id: number;
    title: string;
    knowledgeBaseId: number;
    sourceType: string;
    content?: string;
    sourceUrl?: string;
  };
  trigger?: React.ReactNode;
}

// Define the schema for editing document content
const editContentSchema = z.object({
  content: z.string().min(1, "Content is required")
});

type EditContentFormValues = z.infer<typeof editContentSchema>;

export function DocumentContentDialog({ document, trigger }: DocumentContentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editorContent, setEditorContent] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query to get the document content
  const { data: documentContent, isLoading, error } = useQuery({
    queryKey: [`/api/knowledge-bases/${document.knowledgeBaseId}/documents/${document.id}/content`],
    enabled: isOpen,
    queryFn: () => apiRequest(`/api/knowledge-bases/${document.knowledgeBaseId}/documents/${document.id}/content`),
    refetchOnWindowFocus: false
  });

  // Set up the form
  const form = useForm<EditContentFormValues>({
    resolver: zodResolver(editContentSchema),
    defaultValues: {
      content: document.content || ""
    }
  });

  // Update form when document content changes
  useEffect(() => {
    if (documentContent && documentContent.content) {
      form.reset({ content: documentContent.content });
      setEditorContent(documentContent.content);
    }
  }, [documentContent, form]);
  
  // Update form when entering edit mode
  useEffect(() => {
    if (isEditMode && documentContent && documentContent.content) {
      form.reset({ content: documentContent.content });
      setEditorContent(documentContent.content);
    }
  }, [isEditMode, documentContent, form]);
  
  // Handle editor content change
  const handleEditorChange = (value: string) => {
    setEditorContent(value);
    form.setValue("content", value);
  };

  // Submit handler for updating content
  const updateContent = useMutation({
    mutationFn: async (data: EditContentFormValues) => {
      return apiRequest(`/api/knowledge-bases/${document.knowledgeBaseId}/documents/${document.id}/content`, {
        method: "PUT",
        data: {
          content: data.content
        }
      });
    },
    onSuccess: () => {
      toast({
        title: "Content updated",
        description: "The document content has been updated and will be reprocessed."
      });
      setIsEditMode(false);
      // Invalidate both the content and the document list queries
      queryClient.invalidateQueries({ queryKey: [`/api/knowledge-bases/${document.knowledgeBaseId}/documents/${document.id}/content`] });
      queryClient.invalidateQueries({ queryKey: [`/api/knowledge-bases/${document.knowledgeBaseId}/documents`] });
    },
    onError: (error) => {
      console.error("Error updating document content:", error);
      toast({
        title: "Error updating content",
        description: "There was a problem updating the document content. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Handler for processing a document to extract content
  const processDocument = useMutation({
    mutationFn: async (documentId: number) => {
      return apiRequest(`/api/knowledge-bases/${document.knowledgeBaseId}/documents/${documentId}/process`, {
        method: "POST"
      });
    },
    onSuccess: () => {
      toast({
        title: "Processing started",
        description: "The document is being processed to extract content. This may take a few moments."
      });
      // Set a timer to refresh the content after a delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/knowledge-bases/${document.knowledgeBaseId}/documents/${document.id}/content`] });
        queryClient.invalidateQueries({ queryKey: [`/api/knowledge-bases/${document.knowledgeBaseId}/documents`] });
      }, 3000);
    },
    onError: (error) => {
      console.error("Error processing document:", error);
      toast({
        title: "Error processing document",
        description: "There was a problem processing the document. Please try again.",
        variant: "destructive"
      });
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <FileText className="mr-2 h-4 w-4" />
            View Content
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={isExpanded ? "sm:max-w-[90vw] max-h-[90vh]" : "sm:max-w-[800px] max-h-[80vh]"}>
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Document Content" : "Document Content"}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Edit the document content. This will reprocess the document and update its embeddings."
              : `Viewing content for document: ${document.title}`}
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : error ? (
          // Check the error response to see if it's a document that needs processing
          ((error as any)?.response?.status === 202 || 
           (error as any)?.message?.includes('Document needs processing')) ? (
            <div className="space-y-4">
              <Alert>
                <InfoIcon className="h-4 w-4 mr-2" />
                <AlertTitle>Document Needs Processing</AlertTitle>
                <AlertDescription>
                  This document exists in storage but needs to be processed to extract its content. 
                  Click the button below to process the document.
                </AlertDescription>
              </Alert>
              
              <Button 
                onClick={() => {
                  console.log(`Processing document ${document.id}`);
                  processDocument.mutate(document.id);
                }}
                className="w-full"
              >
                {processDocument.isPending ? 
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                  <RefreshCw className="mr-2 h-4 w-4" />}
                Process Document
              </Button>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertTitle>Error loading content</AlertTitle>
              <AlertDescription>
                Failed to load document content. This may happen for non-text documents that don't have extracted content.
              </AlertDescription>
            </Alert>
          )
        ) : (
          isEditMode ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(data => updateContent.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <div className="flex items-center justify-between">
                        <FormLabel>Content</FormLabel>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsExpanded(!isExpanded)}
                          className="px-2"
                        >
                          {isExpanded ? (
                            <><Minimize2 className="h-4 w-4 mr-1" /> Compact View</>
                          ) : (
                            <><Maximize2 className="h-4 w-4 mr-1" /> Expanded View</>
                          )}
                        </Button>
                      </div>
                      <FormControl>
                        <ScrollArea className={`border rounded-md ${isExpanded ? 'h-[65vh]' : 'h-[400px]'}`}>
                          <CodeMirror
                            value={editorContent}
                            height={isExpanded ? "65vh" : "400px"}
                            extensions={[
                              markdown({ codeLanguages: languages }),
                              EditorView.lineWrapping,
                              EditorView.theme({
                                "&": {
                                  overflow: "auto",
                                  maxWidth: "100%"
                                },
                                ".cm-content": {
                                  whiteSpace: "pre-wrap",
                                  wordWrap: "break-word",
                                  wordBreak: "break-word"
                                },
                                ".cm-line": {
                                  padding: "0 8px",
                                  lineHeight: "1.6"
                                }
                              })
                            ]}
                            theme={oneDark}
                            onChange={handleEditorChange}
                            placeholder="Document content"
                            basicSetup={{
                              lineNumbers: true,
                              highlightActiveLineGutter: true,
                              highlightActiveLine: true,
                              foldGutter: true,
                              autocompletion: true,
                              closeBrackets: true,
                              searchKeymap: true,
                              lintKeymap: true
                            }}
                            className="break-words whitespace-pre-wrap"
                          />
                        </ScrollArea>
                      </FormControl>
                      <FormDescription>
                        Edit the content of this document. This will trigger reprocessing and update all embeddings.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditMode(false)}
                    disabled={updateContent.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateContent.isPending}>
                    {updateContent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save & Reprocess
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          ) : (
            <>
              <div className="flex items-center justify-end mb-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="px-2"
                >
                  {isExpanded ? (
                    <><Minimize2 className="h-4 w-4 mr-1" /> Compact View</>
                  ) : (
                    <><Maximize2 className="h-4 w-4 mr-1" /> Expanded View</>
                  )}
                </Button>
              </div>
              <ScrollArea className={`border rounded-md ${isExpanded ? 'h-[65vh]' : 'h-[400px]'}`}>
                <CodeMirror
                  value={documentContent?.content || document.content || "No content available for this document."}
                  height={isExpanded ? "65vh" : "400px"}
                  extensions={[
                    markdown({ codeLanguages: languages }),
                    EditorView.lineWrapping,
                    EditorView.theme({
                      "&": {
                        overflow: "auto",
                        maxWidth: "100%"
                      },
                      ".cm-content": {
                        whiteSpace: "pre-wrap",
                        wordWrap: "break-word",
                        wordBreak: "break-word"
                      },
                      ".cm-line": {
                        padding: "0 8px",
                        lineHeight: "1.6"
                      }
                    })
                  ]}
                  theme={oneDark}
                  editable={false}
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    highlightActiveLine: false,
                  }}
                  className="break-words whitespace-pre-wrap"
                />
              </ScrollArea>
              
              {/* Show the "View Original Document" button for PDF/Document type documents */}
              {(document.sourceType === 'pdf' || document.sourceType === 'document') && (
                <div className="mt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      // For PDF/document type files, create a secure form submission with auth token
                      console.log(`Creating secure document viewer form for document ${document.id}`);
                      
                      // Get the authentication token
                      const token = localStorage.getItem('auth_token');
                      if (!token) {
                        alert('Authentication token not found. Please log in again.');
                        return;
                      }
                      
                      try {
                        // Create a temporary form that sends auth token as POST
                        // This approach is more secure than query parameters as it doesn't expose tokens in URLs
                        const formElement = window.document.createElement('form');
                        formElement.method = 'POST';
                        formElement.action = `/api/knowledge-bases/${document.knowledgeBaseId}/documents/${document.id}/view-document`;
                        formElement.target = '_blank'; // Open in new tab
                        
                        // Add auth token as hidden input
                        const tokenInput = window.document.createElement('input');
                        tokenInput.type = 'hidden';
                        tokenInput.name = 'token';
                        tokenInput.value = token;
                        formElement.appendChild(tokenInput);
                        
                        // Add timestamp to prevent caching issues
                        const timestampInput = window.document.createElement('input');
                        timestampInput.type = 'hidden';
                        timestampInput.name = 'timestamp';
                        timestampInput.value = Date.now().toString();
                        formElement.appendChild(timestampInput);
                        
                        // Add to body, submit, and remove
                        window.document.body.appendChild(formElement);
                        console.log('Submitting document view form...');
                        formElement.submit();
                        window.document.body.removeChild(formElement);
                      } catch (error) {
                        console.error('Error opening document:', error);
                        alert('Error opening document. Please try again.');
                      }
                    }}
                    className="w-full"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    View Original Document
                  </Button>
                </div>
              )}
              
              
              
              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="mr-auto"
                >
                  Close
                </Button>
                {/* Show the "Open Original URL" button for URL and YouTube documents */}
                {(document.sourceType === 'url' || document.sourceType === 'youtube') && document.sourceUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        window.open(document.sourceUrl, '_blank');
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Open Original URL
                    </Button>
                )}
                <Button 
                  onClick={() => setIsEditMode(true)}
                  disabled={!documentContent?.content && !document.content}
                >
                  Edit Content
                </Button>
              </DialogFooter>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}