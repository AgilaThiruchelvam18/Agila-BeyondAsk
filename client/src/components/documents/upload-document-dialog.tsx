import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MAX_FILE_SIZE, MAX_FILE_SIZE_FORMATTED } from "@/lib/utils";
import { Loader2, Upload, FileText, Globe, FileUp, Youtube, Cloud } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SharePointDocumentDialog } from "./sharepoint-document-dialog";
import { TagInput } from "@/components/ui/tag-input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

// Document upload schema
const documentUploadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  sourceType: z.enum(["text", "document", "url", "youtube", "sharepoint"]),
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
    sourceUrl: z.string().url("Please enter a valid YouTube URL")
      .refine(
        (val) => {
          // YouTube URL validation
          const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(\S*)?$/;
          return ytRegex.test(val);
        },
        { message: "Please enter a valid YouTube URL" }
      ),
  }),
  // SharePoint document schema
  documentUploadSchema.extend({
    sourceType: z.literal("sharepoint"),
  }),
]);

type DocumentUploadFormValues = z.infer<typeof conditionalDocumentSchema>;

interface UploadDocumentDialogProps {
  knowledgeBaseId: number;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function UploadDocumentDialog({ knowledgeBaseId, trigger, onSuccess }: UploadDocumentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [sharePointDialogOpen, setSharePointDialogOpen] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch knowledge base details to get custom fields
  const { data: knowledgeBase, isLoading: isLoadingKnowledgeBase } = useQuery({
    queryKey: [`/api/knowledge-bases/${knowledgeBaseId}`],
    enabled: isOpen, // Only fetch when dialog is open
    queryFn: () => apiRequest(`/api/knowledge-bases/${knowledgeBaseId}`),
  });

  const form = useForm<DocumentUploadFormValues>({
    resolver: zodResolver(conditionalDocumentSchema),
    defaultValues: {
      title: "",
      description: "",
      sourceType: "text", // This will be updated when a file is selected
      content: "",
      sourceUrl: "",
    },
  });

  const sourceType = form.watch("sourceType");
  
  // Create document mutation
  const createDocument = useMutation({
    mutationFn: async (data: DocumentUploadFormValues) => {
      // Prepare metadata with custom fields if any are defined
      const metadata: Record<string, any> = {
        custom_fields: customFieldValues
      };
      
      console.log("Submitting document with custom fields:", customFieldValues);
      
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
        
        // Add metadata as JSON string
        formData.append('metadata', JSON.stringify(metadata));
        
        // Use XMLHttpRequest to track upload progress
        const token = localStorage.getItem('auth_token');
        
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          // Track upload progress
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(percentComplete);
            }
          });
          
          // Handle response
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              // Hide progress after processing is complete
              setUploadProgress(100);
              
              try {
                const response = JSON.parse(xhr.responseText);
                resolve(response);
              } catch (error) {
                setShowProgress(false);
                reject(new Error('Invalid JSON response from server'));
              }
            } else {
              setShowProgress(false);
              try {
                const errorData = JSON.parse(xhr.responseText);
                reject(new Error(errorData.message || `Failed to upload document: ${xhr.status} ${xhr.statusText}`));
              } catch (e) {
                console.error("Failed to parse error response:", xhr.responseText);
                reject(new Error(`Failed to upload document: ${xhr.status} ${xhr.statusText}`));
              }
            }
          });
          
          // Handle network errors
          xhr.addEventListener('error', () => {
            setShowProgress(false);
            reject(new Error('Network error occurred during upload'));
          });
          
          // Handle aborted uploads
          xhr.addEventListener('abort', () => {
            setShowProgress(false);
            reject(new Error('Upload was aborted'));
          });
          
          // Send the request
          xhr.open('POST', `/api/knowledge-bases/${knowledgeBaseId}/documents/upload`);
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.send(formData);
        });
      } else {
        // For text, URL, and YouTube, we show a simple progress indicator
        // as we can't track actual progress with normal JSON
        setUploadProgress(50);
        
        // For text, URL, and YouTube, we can use normal JSON
        const token = localStorage.getItem('auth_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
        
        try {
          const response = await apiRequest(`/api/knowledge-bases/${knowledgeBaseId}/documents`, {
            method: 'POST',
            headers,
            data: {
              title: data.title,
              description: data.description,
              sourceType: data.sourceType,
              content: data.sourceType === 'text' ? data.content : undefined,
              sourceUrl: (data.sourceType === 'url' || data.sourceType === 'youtube') ? data.sourceUrl : undefined,
              metadata: metadata,
              tags: tags
            }
          });
          
          // Indicate completion
          setUploadProgress(100);
          return response;
        } catch (error) {
          // Hide progress on error
          setShowProgress(false);
          throw error;
        }
      }
    },
    onSuccess: async (document) => {
      // After creating the document, we need to process it
      // The response is already parsed by apiRequest
      try {
        // Request document processing
        const token = localStorage.getItem('auth_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
        
        await apiRequest(`/api/knowledge-bases/${knowledgeBaseId}/documents/${document.id}/process`, {
          method: 'POST',
          headers
        });
        
        // Start polling document status to update progress
        let processingComplete = false;
        let pollCount = 0;
        const maxPolls = 60; // Maximum 2 minutes of polling (2sec intervals)
        
        const pollDocumentStatus = async () => {
          if (processingComplete || pollCount >= maxPolls) return;
          
          try {
            const docStatus = await apiRequest(`/api/knowledge-bases/${knowledgeBaseId}/documents/${document.id}`, {
              method: 'GET',
              headers
            });
            
            pollCount++;
            
            // Update progress based on document status
            if (docStatus.status === 'initial' || docStatus.status === 'created') {
              setUploadProgress(10);
            } else if (docStatus.status === 'processing_content') {
              setUploadProgress(30);
            } else if (docStatus.status === 'creating_embeddings') {
              setUploadProgress(60);
            } else if (docStatus.status === 'storing_embeddings') {
              setUploadProgress(80);
            } else if (docStatus.status === 'completed') {
              setUploadProgress(100);
              processingComplete = true;
              return;
            } else if (docStatus.status === 'failed') {
              processingComplete = true;
              return;
            }
            
            // Continue polling
            setTimeout(pollDocumentStatus, 2000);
          } catch (error) {
            console.error('Error polling document status:', error);
            // On error, just stop polling
            processingComplete = true;
          }
        };
        
        // Start the polling process
        pollDocumentStatus();
        
        // Show success message
        toast({
          title: "Document uploaded",
          description: "Your document has been uploaded and is being processed.",
        });
        
        // Invalidate queries to refresh the document list
        queryClient.invalidateQueries({ queryKey: [`/api/knowledge-bases/${knowledgeBaseId}/documents`] });
        queryClient.invalidateQueries({ queryKey: ['/api/knowledge-bases'] });
        
        // Reset form and state
        form.reset();
        setSelectedFile(null);
        setTags([]);
        setShowProgress(false);
        setUploadProgress(0);
        setIsOpen(false);
        
        // Call onSuccess callback if provided
        if (onSuccess) onSuccess();
      } catch (error) {
        toast({
          title: "Processing failed",
          description: "The document was created but processing failed. You can try processing it again later.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message || "An error occurred while uploading the document.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DocumentUploadFormValues) => {
    // For document upload, validate that a file is selected
    if (data.sourceType === 'document' && !selectedFile) {
      toast({
        title: "Error",
        description: "Please select a document file to upload",
        variant: "destructive",
      });
      return;
    }
    
    // Validate required custom fields if knowledge base has any
    if (knowledgeBase?.customFields && knowledgeBase.customFields.length > 0) {
      const requiredFields = knowledgeBase.customFields.filter((field: any) => field.required);
      
      for (const field of requiredFields) {
        if (
          customFieldValues[field.id] === undefined || 
          customFieldValues[field.id] === null || 
          customFieldValues[field.id] === ''
        ) {
          toast({
            title: "Error",
            description: `The field "${field.name}" is required`,
            variant: "destructive",
          });
          return;
        }
      }
    }
    
    // Submit the form data
    createDocument.mutate(data);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type based on source type
      const allowedTypes = {
        document: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
                   'application/msword', 'text/plain', 'application/rtf', 'application/vnd.oasis.opendocument.text'],
      };
      
      // Check file extension as a fallback for when MIME type is not reliable
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
      const allowedExtensions = {
        document: ['pdf', 'docx', 'doc', 'txt', 'rtf', 'odt'],
      };
      
      // Important: When a file is selected, always set sourceType to "document"
      form.setValue("sourceType", "document");
      
      const isValidType = 
        (allowedTypes.document.some(type => file.type.includes(type)) || 
         allowedExtensions.document.includes(fileExtension));
      
      if (!isValidType) {
        toast({
          title: "Invalid file type",
          description: "Please upload a supported document type (PDF, DOCX, DOC, TXT, RTF, ODT)",
          variant: "destructive",
        });
        e.target.value = '';
        return;
      }
      
      // Check file size against server limit
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: `Please upload a file smaller than ${MAX_FILE_SIZE_FORMATTED}`,
          variant: "destructive",
        });
        e.target.value = '';
        return;
      }
      
      setSelectedFile(file);
      // Set the document title to the file name if title is empty
      if (!form.getValues("title")) {
        form.setValue("title", file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  return (
    <div>
      {/* SharePoint Document Dialog */}
      <SharePointDocumentDialog
        open={sharePointDialogOpen}
        onOpenChange={setSharePointDialogOpen}
        knowledgeBaseId={knowledgeBaseId}
        onDocumentCreated={(document) => {
          // Show success message
          toast({
            title: "Document uploaded",
            description: "Your SharePoint document has been added and is being processed.",
          });
          
          // Invalidate queries to refresh the document list
          queryClient.invalidateQueries({ queryKey: [`/api/knowledge-bases/${knowledgeBaseId}/documents`] });
          queryClient.invalidateQueries({ queryKey: ['/api/knowledge-bases'] });
          
          // Reset form and state
          form.reset();
          setSelectedFile(null);
          setTags([]);
          setShowProgress(false);
          setUploadProgress(0);
          setIsOpen(false);
          
          // Call onSuccess callback if provided
          if (onSuccess) onSuccess();
        }}
      />
      
      {/* Main Upload Document Dialog */}
      <Dialog 
        open={isOpen} 
        onOpenChange={(open) => {
          if (!open) {
            // Reset progress when dialog is closed
            setShowProgress(false);
            setUploadProgress(0);
          }
          setIsOpen(open);
        }}>
        <DialogTrigger asChild>
          {trigger || (
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Add Document to Knowledge Base</DialogTitle>
            <DialogDescription>
              Upload a document or add content to your knowledge base.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[calc(65vh-50px)] pr-4 mb-2 flex-grow overflow-auto">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" onClick={(e) => e.stopPropagation()}>
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter a title for this document" {...field} />
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
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter a brief description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="sourceType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Document Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col gap-4 md:flex-row md:flex-wrap"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="text" id="r-text" />
                          <Label htmlFor="r-text" className="flex items-center">
                            <FileText className="mr-2 h-4 w-4" />
                            Text
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="document" id="r-document" />
                          <Label htmlFor="r-document" className="flex items-center">
                            <FileUp className="mr-2 h-4 w-4" />
                            Document Upload
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="url" id="r-url" />
                          <Label htmlFor="r-url" className="flex items-center">
                            <Globe className="mr-2 h-4 w-4" />
                            Web Page URL
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="youtube" id="r-youtube" />
                          <Label htmlFor="r-youtube" className="flex items-center">
                            <Youtube className="mr-2 h-4 w-4" />
                            YouTube Video
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 hidden">
                          <RadioGroupItem value="sharepoint" id="r-sharepoint" />
                          <Label htmlFor="r-sharepoint" className="flex items-center">
                            <Cloud className="mr-2 h-4 w-4" />
                            SharePoint
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {sourceType === "text" && (
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter the document content"
                          className="min-h-[200px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              {sourceType === "document" && (
                <FormItem>
                  <FormLabel>Document File</FormLabel>
                  <FormControl>
                    <div className="border-2 border-dashed border-gray-300 rounded-md p-6 flex flex-col items-center">
                      <Input
                        type="file"
                        accept=".pdf,.docx,.doc,.txt,.rtf,.odt"
                        className="hidden"
                        id="document-upload"
                        onChange={handleFileChange}
                      />
                      {!selectedFile ? (
                        <div className="text-center">
                          <FileUp className="mx-auto h-12 w-12 text-gray-400" />
                          <div className="mt-4 flex flex-col items-center text-sm">
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => document.getElementById("document-upload")?.click()}
                            >
                              Select Document
                            </Button>
                            <p className="mt-2 text-xs text-gray-500">
                              Supported formats: PDF, DOCX, DOC, TXT, RTF, ODT
                            </p>
                            <p className="text-xs text-gray-500">
                              Files up to {MAX_FILE_SIZE_FORMATTED}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <FileText className="mx-auto h-12 w-12 text-blue-500" />
                          <p className="mt-2 text-sm font-medium">{selectedFile.name}</p>
                          <p className="text-xs text-gray-500">
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            className="mt-2 text-xs"
                            onClick={() => {
                              setSelectedFile(null);
                              const input = document.getElementById("document-upload") as HTMLInputElement;
                              if (input) input.value = "";
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
              
              {sourceType === "url" && (
                <FormField
                  control={form.control}
                  name="sourceUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Web Page URL</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://example.com/page" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Enter the URL of the web page you want to add to your knowledge base
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              {sourceType === "youtube" && (
                <FormField
                  control={form.control}
                  name="sourceUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>YouTube Video URL</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://www.youtube.com/watch?v=VIDEO_ID" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Enter the URL of the YouTube video you want to add to your knowledge base.
                        Supported formats: youtube.com/watch?v=VIDEO_ID or youtu.be/VIDEO_ID
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              {sourceType === "sharepoint" && (
                <FormItem>
                  <FormLabel>SharePoint Document</FormLabel>
                  <FormControl>
                    <div className="border-2 border-dashed border-gray-300 rounded-md p-6 flex flex-col items-center">
                      <Cloud className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-4 flex flex-col items-center text-sm">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setSharePointDialogOpen(true)}
                        >
                          Browse SharePoint Files
                        </Button>
                        <p className="mt-2 text-xs text-gray-500">
                          Connect to SharePoint and select a document
                        </p>
                      </div>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Browse your SharePoint sites and select a document to import into your knowledge base
                  </FormDescription>
                </FormItem>
              )}
              
              {/* Tags Section */}
              <FormItem>
                <FormLabel>Tags (Optional)</FormLabel>
                <FormControl>
                  <TagInput 
                    tags={tags} 
                    onTagsChange={setTags} 
                    placeholder="Add tags..." 
                  />
                </FormControl>
                <FormDescription>
                  Add tags to help organize and filter your documents
                </FormDescription>
              </FormItem>
              
              {/* Custom Fields Section */}
              {knowledgeBase?.customFields && knowledgeBase.customFields.length > 0 && (
                <div className="space-y-4 border p-4 rounded-md">
                  <h3 className="text-sm font-medium">Document Custom Fields</h3>
                  
                  {knowledgeBase.customFields.map((field: any) => (
                    <div key={field.id} className="space-y-2">
                      <div className="flex items-start justify-between">
                        <Label 
                          htmlFor={`custom-field-${field.id}`}
                          className="text-sm font-medium"
                        >
                          {field.name}
                          {field.required && <span className="text-red-500">*</span>}
                        </Label>
                        {field.description && (
                          <p className="text-xs text-gray-500">{field.description}</p>
                        )}
                      </div>
                      
                      {field.type === 'text' && (
                        <Input
                          id={`custom-field-${field.id}`}
                          placeholder={`Enter ${field.name}`}
                          value={customFieldValues[field.id] || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                            setCustomFieldValues({
                              ...customFieldValues,
                              [field.id]: e.target.value
                            })
                          }
                          required={field.required}
                        />
                      )}
                      
                      {field.type === 'number' && (
                        <Input
                          id={`custom-field-${field.id}`}
                          type="number"
                          placeholder={`Enter ${field.name}`}
                          value={customFieldValues[field.id] || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                            setCustomFieldValues({
                              ...customFieldValues,
                              [field.id]: e.target.valueAsNumber
                            })
                          }
                          required={field.required}
                        />
                      )}
                      
                      {field.type === 'date' && (
                        <Input
                          id={`custom-field-${field.id}`}
                          type="date"
                          value={customFieldValues[field.id] || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                            setCustomFieldValues({
                              ...customFieldValues,
                              [field.id]: e.target.value
                            })
                          }
                          required={field.required}
                        />
                      )}
                      
                      {field.type === 'boolean' && (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`custom-field-${field.id}`}
                            checked={!!customFieldValues[field.id]}
                            onCheckedChange={(checked) => 
                              setCustomFieldValues({
                                ...customFieldValues,
                                [field.id]: checked
                              })
                            }
                          />
                          <label
                            htmlFor={`custom-field-${field.id}`}
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Yes
                          </label>
                        </div>
                      )}
                      
                      {field.type === 'select' && field.options && (
                        <Select
                          value={customFieldValues[field.id] || ''}
                          onValueChange={(value) => 
                            setCustomFieldValues({
                              ...customFieldValues,
                              [field.id]: value
                            })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={`Select ${field.name}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map((option: string) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Progress bar */}
              {showProgress && createDocument.isPending && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label>Upload Progress</Label>
                    <span className="text-xs text-muted-foreground">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {uploadProgress < 100 ? 'Uploading your document...' : 'Processing document...'}
                  </p>
                </div>
              )}
              
              </form>
            </Form>
          </ScrollArea>
            
          <DialogFooter className="mt-2 flex justify-end gap-2 sticky bottom-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                form.reset();
                setSelectedFile(null);
                setTags([]);
                setShowProgress(false);
                setUploadProgress(0);
                setIsOpen(false);
              }}
              disabled={createDocument.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={form.handleSubmit(onSubmit)} 
              disabled={createDocument.isPending}
            >
              {createDocument.isPending && !showProgress && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Upload Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}