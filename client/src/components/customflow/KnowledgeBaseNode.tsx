import React, { useState, useEffect } from 'react';
import { Node, KnowledgeNodeData } from './types';
import { 
  Database, File, FilePlus, Plus, X, ExternalLink, FileText, Loader2, 
  Move, Link2, Globe, Youtube, FileUp, Minimize, Cloud
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { MAX_FILE_SIZE, MAX_FILE_SIZE_FORMATTED } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { TagInput } from '@/components/ui/tag-input';

interface KnowledgeBaseNodeProps {
  node: Node;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onPortMouseDown: (e: React.MouseEvent, nodeId: string, handle?: string) => void;
  onResizeStart: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: () => void;
  isReadOnly?: boolean;
}

const KnowledgeBaseNode: React.FC<KnowledgeBaseNodeProps> = ({
  node,
  selected,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
  onPortMouseDown,
  onResizeStart,
  onDelete,
  isReadOnly = false
}) => {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(true); // Keep node expanded by default
  const [isDocumentsDialogOpen, setIsDocumentsDialogOpen] = useState(false);
  const [isViewDocumentDialogOpen, setIsViewDocumentDialogOpen] = useState(false);
  const [isUploadDocumentDialogOpen, setIsUploadDocumentDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [documentsList, setDocumentsList] = useState<any[]>((node.data as KnowledgeNodeData).documents || []);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [knowledgeBase, setKnowledgeBase] = useState<any>(null);
  const queryClient = useQueryClient();
  
  const nodeData = node.data as KnowledgeNodeData;

  // Document upload schema
  const documentUploadSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    sourceType: z.enum(["text", "document", "url", "youtube"]),
    // For text content
    content: z.string().optional(),
    // For URL or YouTube
    sourceUrl: z.string().url().optional().or(z.string().length(0)),
    // For file upload - we'll validate this separately
    file: z.any().optional(),
  });

  // Conditionally require fields based on source type
  const conditionalDocumentSchema = z.discriminatedUnion("sourceType", [
    // Text document schema
    documentUploadSchema.extend({
      sourceType: z.literal("text"),
      content: z.string().min(1, "Content is required for text documents"),
    }),
    // Document upload schema
    documentUploadSchema.extend({
      sourceType: z.literal("document"),
    }),
    // URL document schema
    documentUploadSchema.extend({
      sourceType: z.literal("url"),
      sourceUrl: z.string().url("Please enter a valid URL"),
    }),
    // YouTube document schema
    documentUploadSchema.extend({
      sourceType: z.literal("youtube"),
      sourceUrl: z.string().url("Please enter a valid YouTube URL"),
    }),
  ]);

  type DocumentUploadFormValues = z.infer<typeof conditionalDocumentSchema>;

  // Define form
  const form = useForm<DocumentUploadFormValues>({
    resolver: zodResolver(conditionalDocumentSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      sourceType: "text",
      content: "",
      sourceUrl: "",
    },
  });

  // Auto-fetch documents when node has a knowledge base ID
  useEffect(() => {
    if (nodeData.id) {
      fetchDocuments();
    }
  }, [nodeData.id]);

  const fetchDocuments = async () => {
    if (!nodeData.id) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(`/api/knowledge-bases/${nodeData.id}/documents`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      
      if (response.ok) {
        const docs = await response.json();
        setDocumentsList(docs);
      } else {
        console.error('Failed to fetch documents');
        toast({
          title: 'Error',
          description: 'Failed to fetch documents',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch documents',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageDocuments = () => {
    if (nodeData.id) {
      fetchDocuments();
    }
    setIsDocumentsDialogOpen(true);
  };

  const handleViewDocument = (doc: any) => {
    setSelectedDocument(doc);
    setIsViewDocumentDialogOpen(true);
  };

  // Document upload functionality
  const handleAddDocument = () => {
    if (!nodeData.id) {
      toast({
        title: "Error",
        description: "Please link a knowledge base first",
        variant: "destructive",
      });
      return;
    }

    // Reset form and states
    form.reset({
      title: "",
      description: "",
      sourceType: "text",
      content: "",
      sourceUrl: "",
    });
    setSelectedFile(null);
    setTags([]);
    setUploadProgress(0);
    setShowProgress(false);
    
    // Fetch knowledge base to get any custom fields
    fetchKnowledgeBaseDetails(nodeData.id);
    
    // Open the upload dialog
    setIsUploadDocumentDialogOpen(true);
  };

  // Create document mutation
  const createDocument = useMutation({
    mutationFn: async (data: DocumentUploadFormValues) => {
      // Reset and show progress bar
      setUploadProgress(0);
      setShowProgress(true);
      
      // Handle different source types
      if (data.sourceType === 'document' && selectedFile) {
        // For document upload, we need to use FormData
        const formData = new FormData();
        formData.append('title', data.title);
        if (data.description) formData.append('description', data.description);
        formData.append('sourceType', data.sourceType);
        formData.append('file', selectedFile);
        
        // Add tags as JSON string
        if (tags.length > 0) {
          formData.append('tags', JSON.stringify(tags));
        }
        
        // Use XMLHttpRequest to track upload progress
        const token = localStorage.getItem('auth_token');
        
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          // Track upload progress
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(progress);
            }
          });
          
          xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              reject(new Error('Upload failed: ' + xhr.statusText));
            }
          };
          
          xhr.onerror = function() {
            reject(new Error('Network error occurred during upload'));
          };
          
          xhr.open('POST', `/api/knowledge-bases/${nodeData.id}/documents`, true);
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.send(formData);
        });
      } else {
        // For text, URL, or YouTube sources
        const documentData = {
          title: data.title,
          description: data.description,
          sourceType: data.sourceType,
          content: data.sourceType === 'text' ? data.content : undefined,
          url: (data.sourceType === 'url' || data.sourceType === 'youtube') ? data.sourceUrl : undefined,
          tags: tags.length > 0 ? tags : undefined
        };
        
        // Use a simulated progress for non-file uploads
        const interval = setInterval(() => {
          setUploadProgress(prev => {
            const newProgress = prev + 10;
            if (newProgress >= 90) {
              clearInterval(interval);
              return 90;
            }
            return newProgress;
          });
        }, 100);
        
        try {
          const response = await fetch(`/api/knowledge-bases/${nodeData.id}/documents`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            },
            body: JSON.stringify(documentData),
          });
          
          if (!response.ok) {
            clearInterval(interval);
            throw new Error(`Failed to create document: ${response.statusText}`);
          }
          
          clearInterval(interval);
          setUploadProgress(100);
          return await response.json();
        } catch (error) {
          clearInterval(interval);
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/knowledge-bases/${nodeData.id}/documents`] });
      fetchDocuments();
      setIsUploadDocumentDialogOpen(false);
      toast({
        title: "Success",
        description: "Document added successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error creating document:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add document",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setShowProgress(false);
      setUploadProgress(0);
    }
  });

  // Fetch knowledge base details (including custom fields)
  const fetchKnowledgeBaseDetails = async (kbId: number) => {
    try {
      const response = await fetch(`/api/knowledge-bases/${kbId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      
      if (response.ok) {
        const kb = await response.json();
        setKnowledgeBase(kb);
      }
    } catch (error) {
      console.error('Error fetching knowledge base details:', error);
    }
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: `Maximum file size is ${MAX_FILE_SIZE_FORMATTED}`,
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
      // Update form title with filename if title is empty
      const currentTitle = form.getValues("title");
      if (!currentTitle) {
        form.setValue("title", file.name.split('.')[0]);
      }
      form.setValue("sourceType", "document");
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    if (!nodeData.id) {
      toast({
        title: 'Error',
        description: 'Node data ID is missing',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsLoading(true);
      const response = await fetch(`/api/knowledge-bases/${nodeData.id}/documents/${docId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      
      if (response.ok) {
        const deletedDoc = await response.json(); // Ensure it returns a valid response
        if (deletedDoc.success) { // Check if deletion was truly successful
          setDocumentsList(prev => prev.filter((doc: any) => doc.id !== docId));
          toast({
            title: 'Success',
            description: 'Document deleted successfully',
          });
        } else {
          toast({
            title: 'Error',
            description: 'Failed to delete document',
            variant: 'destructive',
          });
        }
      } else {
        console.error('Failed to delete document');
        toast({
          title: 'Error',
          description: 'Failed to delete document',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete document',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const nodeStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${node.position.x}px`,
    top: `${node.position.y}px`,
    width: `${node.size.width}px`,
    height: isExpanded ? `${node.size.height}px` : 'auto',
    userSelect: 'none'
  };

  // Simple node view (collapsed state)
  if (!isExpanded) {
    return (
      <div 
        className={`p-4 rounded-md border ${selected ? 'border-indigo-500 shadow-md' : 'border-gray-200'} 
                   bg-white transition-all duration-200 cursor-grab`}
        style={nodeStyle}
        onMouseDown={(e) => onMouseDown(e, node.id)}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={() => !isReadOnly && setIsExpanded(true)}
      >
        {/* Right side handle for connections */}
        <div 
          className="absolute right-0 top-1/2 w-4 h-8 -mr-2 rounded-full bg-indigo-500 cursor-crosshair"
          style={{ transform: 'translateY(-50%)' }}
          onMouseDown={(e) => onPortMouseDown(e, node.id, 'right')}
        />
        
        <div className="flex items-center space-x-2">
          <Database className="h-5 w-5 text-indigo-500" />
          <h3 className="text-sm font-medium">{nodeData.name || 'Knowledge Base'}</h3>
          
          {nodeData.id && (
            <Badge variant="outline" className="text-xs ml-auto">
              ID: {nodeData.id}
            </Badge>
          )}
        </div>
        
        <div className="mt-2 text-xs text-gray-500">
          {documentsList.length > 0 ? (
            <div>
              <p>{documentsList.length} document(s)</p>
              <ul className="mt-1 ml-4 list-disc text-gray-600">
                {documentsList.slice(0, 3).map((doc) => (
                  <li key={doc.id} className="truncate">
                    {doc.title || doc.name}
                  </li>
                ))}
                {documentsList.length > 3 && (
                  <li>+{documentsList.length - 3} more</li>
                )}
              </ul>
            </div>
          ) : (
            <p>No documents. Click to expand and add documents.</p>
          )}
        </div>
      </div>
    );
  }

  // Expanded node view
  return (
    <div 
      className={`p-4 rounded-md border ${selected ? 'border-indigo-500 shadow-md' : 'border-gray-200'} 
                bg-white relative overflow-hidden`}
      style={nodeStyle}
      onMouseDown={(e) => onMouseDown(e, node.id)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Right side handle for connections */}
      <div 
        className="absolute right-0 top-1/2 w-4 h-8 -mr-2 rounded-full bg-indigo-500 cursor-crosshair z-10 connection-handle"
        style={{ transform: 'translateY(-50%)' }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onPortMouseDown(e, node.id, 'right');
        }}
      />
      
      {/* Resize handle */}
      {!isReadOnly && (
        <div 
          className="absolute bottom-1 right-1 cursor-se-resize text-gray-400 z-10"
          onMouseDown={(e) => onResizeStart(e, node.id)}
        >
          <Move size={16} />
        </div>
      )}
      
      {/* Node header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Database className="h-5 w-5 text-indigo-500" />
          <h3 className="text-sm font-medium">{nodeData.name || 'Knowledge Base'}</h3>
        </div>
        
        <div className="flex gap-1">
          
          {nodeData.id && !isReadOnly && (
            <Button 
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleAddDocument();
              }}
              title="Add Document"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6" 
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(false);
            }}
            title="Minimize"
          >
            <Minimize className="h-4 w-4" />
          </Button>
          {!isReadOnly && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 text-gray-400 hover:text-red-500" 
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Remove"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Documents list header */}
      <div className="text-xs text-gray-700 mb-2 flex justify-between items-center">
        <span className="font-medium">Documents</span>
        <span className="text-gray-500">{documentsList.length} total</span>
      </div>
      
      {/* Documents list */}
      <div className="h-[150px] border rounded-md p-2 overflow-y-auto" style={{ userSelect: 'text' }}>
        {documentsList.length > 0 ? (
          <ul className="space-y-1.5">
            {documentsList.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-2 truncate max-w-[180px]">
                  <FileText className="h-3.5 w-3.5 text-gray-500" />
                  <span className="truncate" style={{ userSelect: 'text' }}>
                    {doc.title || doc.name}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {!isReadOnly && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-red-500 hover:text-indigo-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDocument(doc.id);
                      }}
                      title="Delete Document"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-gray-500 hover:text-indigo-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDocument(doc);
                    }}
                    title="View Document"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4">
            <File className="h-8 w-8 mb-2 text-gray-300" />
            <p className="text-center">No documents yet</p>
            <p className="text-center text-xs">Click the + button above to add documents</p>
          </div>
        )}
      </div>
      
      {/* Removed Link Knowledge Base feature to simplify the interface */}

      {/* Documents Management Dialog */}
      <Dialog open={isDocumentsDialogOpen} onOpenChange={setIsDocumentsDialogOpen}>
        <DialogContent 
          className="sm:max-w-[600px] z-50 relative" 
          onPointerDownOutside={(e) => e.preventDefault()} 
          onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Manage Documents</DialogTitle>
            <DialogDescription>
              View and manage documents in this knowledge base
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {isLoading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              </div>
            ) : (
              <div className="space-y-4">
                {documentsList.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    <File className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No documents in this knowledge base</p>
                    <p className="text-xs mt-1">
                      Add documents using the + button in the node
                    </p>
                  </div>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b text-xs text-gray-500">
                        <th className="text-left p-2">Title</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-right p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documentsList.map((doc) => (
                        <tr key={doc.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">
                            <div className="flex items-center">
                              {doc.sourceType === 'youtube' ? (
                                <Youtube className="h-4 w-4 mr-2 text-red-500" />
                              ) : doc.sourceType === 'url' ? (
                                <Globe className="h-4 w-4 mr-2 text-blue-500" />
                              ) : doc.sourceType === 'document' ? (
                                <FileUp className="h-4 w-4 mr-2 text-indigo-500" />
                              ) : (
                                <FileText className="h-4 w-4 mr-2 text-gray-500" />
                              )}
                              <span className="text-sm font-medium">{doc.title || doc.name}</span>
                            </div>
                          </td>
                          <td className="p-2">
                            <span className="text-xs text-gray-500 capitalize">
                              {doc.sourceType}
                            </span>
                          </td>
                          <td className="p-2 text-right">
                            <div className="flex justify-end space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => handleViewDocument(doc)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              {!isReadOnly && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-red-500"
                                  onClick={() => handleDeleteDocument(doc.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button onClick={() => setIsDocumentsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={isUploadDocumentDialogOpen} onOpenChange={setIsUploadDocumentDialogOpen}>
        <DialogContent 
          className="sm:max-w-[600px]" // CRITICAL FIX: ensure pointer events work
          style={{ pointerEvents: 'auto' }}
          // Stop propagation to prevent canvas events from stealing focus
          onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Add Document to Knowledge Base</DialogTitle>
            <DialogDescription>
              Add a new document to your knowledge base. You can upload a file, enter text directly, or provide a URL.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form 
              onSubmit={form.handleSubmit((data) => createDocument.mutate(data))} 
              className="space-y-6"
              onClick={(e) => e.stopPropagation()}>
              {/* Title & Description */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="title">Title</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          onClick={(e) => {
                            e.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div style={{ display: 'none' }}>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          onClick={(e) => {
                            e.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              </div>
              
              {/* Document Type */}
              <FormField
                control={form.control}
                name="sourceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <div className="flex items-center space-x-3 space-y-0">
                          <RadioGroupItem value="text" id="r1" />
                          <Label htmlFor="r1" className="flex items-center">
                            <FileText className="mr-2 h-5 w-5 text-gray-600" />
                            Text
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 space-y-0">
                          <RadioGroupItem value="document" id="r2" />
                          <Label htmlFor="r2" className="flex items-center">
                            <FileUp className="mr-2 h-5 w-5 text-gray-600" />
                            File Upload
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 space-y-0">
                          <RadioGroupItem value="url" id="r3" />
                          <Label htmlFor="r3" className="flex items-center">
                            <Globe className="mr-2 h-5 w-5 text-gray-600" />
                            URL / Web Page
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 space-y-0">
                          <RadioGroupItem value="youtube" id="r4" />
                          <Label htmlFor="r4" className="flex items-center">
                            <Youtube className="mr-2 h-5 w-5 text-red-600" />
                            YouTube Video
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Content based on source type */}
              {form.watch("sourceType") === "text" && (
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Text Content</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={6}
                          placeholder="Enter the text content for your document"
                          {...field}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              {form.watch("sourceType") === "document" && (
                <div className="space-y-4">
                  <div className="border rounded-md p-4 bg-gray-50">
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-white hover:bg-gray-50">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <FileUp className="w-8 h-8 mb-2 text-gray-500" />
                          <p className="mb-1 text-sm text-gray-500">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">
                            PDF, TXT, DOCX (max. {MAX_FILE_SIZE_FORMATTED})
                          </p>
                          {selectedFile && (
                            <div className="flex items-center mt-2 text-sm text-indigo-600">
                              <FileText className="w-4 h-4 mr-1" />
                              {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                            </div>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.txt,.doc,.docx,.csv"
                          onChange={handleFileChange}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}
              
              {(form.watch("sourceType") === "url" || form.watch("sourceType") === "youtube") && (
                <FormField
                  control={form.control}
                  name="sourceUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {form.watch("sourceType") === "url" ? "URL" : "YouTube URL"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={
                            form.watch("sourceType") === "url"
                              ? "https://example.com/page"
                              : "https://www.youtube.com/watch?v=..."
                          }
                          {...field}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              {/* Tags Section */}
              
              <div className="space-y-2" style={{ display: 'none' }}>
                <FormLabel>Tags (Optional)</FormLabel>
                <TagInput 
                  tags={tags} 
                  onTagsChange={setTags} 
                  placeholder="Add tags..."
                  onClick={(e) => {
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                  }}
                />
                <FormDescription>
                  Add tags to help organize and filter your documents
                </FormDescription>
              </div>
              
              {/* Upload Progress */}
              {showProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-1" />
                </div>
              )}
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsUploadDocumentDialogOpen(false)}
                  disabled={createDocument.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createDocument.isPending}
                >
                  {createDocument.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <FileUp className="mr-2 h-4 w-4" />
                      Add Document
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Document Dialog */}
      <Dialog open={isViewDocumentDialogOpen} onOpenChange={setIsViewDocumentDialogOpen}>
        <DialogContent 
          className="sm:max-w-[600px] z-50 relative" 
          onPointerDownOutside={(e) => e.preventDefault()} 
          onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>
              {selectedDocument?.title || selectedDocument?.name || 'Document'}
            </DialogTitle>
            <DialogDescription>
              {selectedDocument?.description || ''}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="border rounded-md p-4 max-h-[400px] overflow-y-auto bg-gray-50">
              {selectedDocument?.format === 'youtube' || selectedDocument?.type === 'youtube' ? (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-2">
                    <Youtube className="h-8 w-8 text-red-600" />
                    <h3 className="text-sm font-medium">YouTube Video</h3>
                  </div>
                  
                  <p className="text-sm text-center">
                    <a href={selectedDocument.url} target="_blank" rel="noopener noreferrer" 
                      className="text-indigo-600 hover:underline break-all">
                      {selectedDocument.url}
                    </a>
                  </p>
                  
                  <div className="text-xs text-center text-gray-500 mt-2">
                    <p>This YouTube video has been added to your knowledge base.</p>
                    <p>The system will process the transcript content automatically.</p>
                  </div>
                </div>
              ) : selectedDocument?.content ? (
                <div className="whitespace-pre-wrap text-sm">
                  {selectedDocument.content}
                </div>
              ) : selectedDocument?.url ? (
                <div className="space-y-4">
                  <p className="text-sm">
                    Source URL: <a href={selectedDocument.url} target="_blank" rel="noopener noreferrer" 
                      className="text-indigo-600 hover:underline break-all">{selectedDocument.url}</a>
                  </p>
                  
                  {selectedDocument.summary && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Summary:</p>
                      <p className="text-sm whitespace-pre-wrap">{selectedDocument.summary}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  No content available for this document
                </p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setIsViewDocumentDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KnowledgeBaseNode;