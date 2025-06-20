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
import { Loader2, Upload, FileText, FilesIcon } from "lucide-react";
import { MAX_FILE_SIZE, MAX_FILE_SIZE_FORMATTED, MAX_FILES_PER_UPLOAD } from "@/lib/utils";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import axios from "axios";

// Multiple PDF upload schema
const multiplePdfUploadSchema = z.object({
  baseTitle: z.string().min(1, "Base title is required"),
  description: z.string().optional(),
  files: z.any(), // This will be validated separately
});

type MultiplePdfUploadFormValues = z.infer<typeof multiplePdfUploadSchema>;

interface MultiplePdfUploadDialogProps {
  knowledgeBaseId: number;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function MultiplePdfUploadDialog({ knowledgeBaseId, trigger, onSuccess }: MultiplePdfUploadDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  // No need for typedCheckedValue state as we handle the types directly in handlers
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch knowledge base details to get custom fields
  const { data: knowledgeBase, isLoading: isLoadingKnowledgeBase } = useQuery({
    queryKey: [`/api/knowledge-bases/${knowledgeBaseId}`],
    enabled: isOpen, // Only fetch when dialog is open
    queryFn: () => apiRequest(`/api/knowledge-bases/${knowledgeBaseId}`),
  });

  const form = useForm<MultiplePdfUploadFormValues>({
    resolver: zodResolver(multiplePdfUploadSchema),
    defaultValues: {
      baseTitle: "",
      description: "",
    },
  });

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedFiles([]);
      setUploadProgress(0);
      setUploadStatus('idle');
      setStatusMessages([]);
      form.reset();
    }
  }, [isOpen, form]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    // Convert FileList to array and filter for PDF files
    let filesArray = Array.from(fileList).filter(file => file.type === 'application/pdf');

    // Check file sizes
    const oversizedFiles = filesArray.filter(file => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      toast({
        title: "Files too large",
        description: `${oversizedFiles.length} file(s) exceed the ${MAX_FILE_SIZE_FORMATTED} limit and were removed`,
        variant: "destructive"
      });
      filesArray = filesArray.filter(file => file.size <= MAX_FILE_SIZE);
    }

    // Limit the number of files
    if (filesArray.length > MAX_FILES_PER_UPLOAD) {
      toast({
        title: "Too many files",
        description: `Maximum ${MAX_FILES_PER_UPLOAD} files allowed per upload. Only the first ${MAX_FILES_PER_UPLOAD} were kept.`,
        variant: "destructive"
      });
      filesArray = filesArray.slice(0, MAX_FILES_PER_UPLOAD);
    }

    setSelectedFiles(filesArray);
  };

  // Handle files drop
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (e.dataTransfer.files) {
      // Convert FileList to array and filter for PDF files
      let filesArray = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf');

      // Check file sizes - same validation as in handleFileChange
      const oversizedFiles = filesArray.filter(file => file.size > MAX_FILE_SIZE);
      if (oversizedFiles.length > 0) {
        toast({
          title: "Files too large",
          description: `${oversizedFiles.length} file(s) exceed the ${MAX_FILE_SIZE_FORMATTED} limit and were removed`,
          variant: "destructive"
        });
        filesArray = filesArray.filter(file => file.size <= MAX_FILE_SIZE);
      }

      // Limit the number of files
      if (filesArray.length > MAX_FILES_PER_UPLOAD) {
        toast({
          title: "Too many files",
          description: `Maximum ${MAX_FILES_PER_UPLOAD} files allowed per upload. Only the first ${MAX_FILES_PER_UPLOAD} were kept.`,
          variant: "destructive"
        });
        filesArray = filesArray.slice(0, MAX_FILES_PER_UPLOAD);
      }

      setSelectedFiles(filesArray);
    }
  };

  // Remove a file from selection
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Create document mutation
  const uploadDocuments = useMutation({
    mutationFn: async (values: MultiplePdfUploadFormValues) => {
      if (selectedFiles.length === 0) {
        throw new Error("Please select at least one PDF file");
      }

      setUploadStatus('uploading');
      setStatusMessages(prev => [...prev, 'Starting upload...']);

      // Create FormData object
      const formData = new FormData();
      formData.append('baseTitle', values.baseTitle);
      formData.append('description', values.description || '');
      formData.append('sourceType', 'pdf');

      // Add custom fields as metadata if any
      if (Object.keys(customFieldValues).length > 0) {
        formData.append('metadata', JSON.stringify({
          customFields: customFieldValues
        }));
      }

      // Append all files
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      // Log for debugging
      console.log('Uploading files:', selectedFiles.map(f => f.name));

      // Set up custom headers for FormData
      const headers = {
        // Don't set Content-Type, it will be set automatically with the boundary
      };

      try {
        setStatusMessages(prev => [...prev, `Uploading ${selectedFiles.length} files...`]);

        // Upload files
        const response = await axios.post(
          `/api/knowledge-bases/${knowledgeBaseId}/documents/upload-multiple`, 
          formData,
          { 
            headers: {
              ...headers,
              Authorization: `Bearer ${localStorage.getItem('auth_token')}`
            }
          }
        ).then((res: any) => res.data);

        setUploadStatus('success');
        setStatusMessages(prev => [...prev, 'Upload successful! Processing files...']);

        return response;
      } catch (error) {
        setUploadStatus('error');
        setStatusMessages(prev => [...prev, `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Show success message
      toast({
        title: "Files uploaded",
        description: `Successfully uploaded ${data.documents.length} PDF files. They will be processed in the background.`,
      });

      // Invalidate queries to refresh the document list
      queryClient.invalidateQueries({ queryKey: [`/api/knowledge-bases/${knowledgeBaseId}/documents`] });
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-bases'] });

      // Reset form and close dialog
      form.reset();
      setSelectedFiles([]);
      setIsOpen(false);

      // Call onSuccess callback if provided
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An error occurred while uploading the files",
        variant: "destructive",
      });
    },
  });

  // We don't need to watch source type for this component

  return (
    <div>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" className="p-2" onClick={() => setIsOpen(true)}>
                    <FilesIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Upload Multiple PDFs</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Upload Multiple PDF Documents</DialogTitle>
            <DialogDescription>
              Upload multiple PDF files at once to add them to your knowledge base.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(data => uploadDocuments.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="baseTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Title</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Base name for all documents" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      This will be used as the base title for all uploaded files. Each file will get "{field.value} - filename" as its title.
                    </FormDescription>
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
                      <Textarea 
                        placeholder="Enter a description for these documents" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="files"
                render={({ field: { onChange, ...rest } }) => (
                  <FormItem>
                    <FormLabel>PDF Files</FormLabel>
                    <FormControl>
                      <div 
                        className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleFileDrop}
                        onClick={() => document.getElementById('multiple-file-upload')?.click()}
                      >
                        <Input
                          id="multiple-file-upload"
                          type="file"
                          accept=".pdf"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            handleFileChange(e);
                            // Don't try to set input value, just pass the FileList to form state
                            if (e.target.files) {
                              onChange(e.target.files);
                            }
                          }}
                        />
                        <FileText className="h-10 w-10 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Drag & drop PDF files here or <span className="text-primary">browse</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Supports up to {MAX_FILES_PER_UPLOAD} PDF files, max {MAX_FILE_SIZE_FORMATTED} each
                        </p>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedFiles.length > 0 && (
                <div className="border rounded-md overflow-hidden">
                  <ScrollArea className="max-h-[200px]">
                    <Table>
                      <TableCaption>
                        Selected files: {selectedFiles.length} ({(selectedFiles.reduce((acc, file) => acc + file.size, 0) / (1024 * 1024)).toFixed(2)} MB total)
                      </TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File Name</TableHead>
                          <TableHead className="w-[100px]">Size</TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedFiles.map((file, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium truncate" title={file.name}>
                              {file.name}
                            </TableCell>
                            <TableCell>
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFile(index);
                                }}
                                disabled={uploadDocuments.isPending}
                              >
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}

              {/* Custom fields from knowledge base */}
              {knowledgeBase?.metadata?.customFields && knowledgeBase.metadata.customFields.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Custom Fields</h3>
                  <div className="space-y-3">
                    {knowledgeBase.metadata.customFields.map((field: { name: string, type: string, options?: string[] }) => (
                      <div key={field.name} className="grid grid-cols-2 gap-2">
                        <Label htmlFor={`custom-${field.name}`} className="self-center">
                          {field.name}
                        </Label>

                        {/* Render appropriate input based on field type */}
                        {field.type === 'text' && (
                          <Input
                            id={`custom-${field.name}`}
                            type="text"
                            value={customFieldValues[field.name] || ''}
                            onChange={(e) => setCustomFieldValues({
                              ...customFieldValues,
                              [field.name]: e.target.value
                            })}
                          />
                        )}

                        {field.type === 'boolean' && (
                          <Checkbox
                            id={`custom-${field.name}`}
                            checked={!!customFieldValues[field.name]}
                            onCheckedChange={(checked: boolean | "indeterminate") => {
                              if (typeof checked === "boolean") {
                                setCustomFieldValues({
                                  ...customFieldValues,
                                  [field.name]: checked === true
                                });
                              }
                            }}
                          />
                        )}

                        {field.type === 'select' && field.options && (
                          <Select
                            value={customFieldValues[field.name] || ''}
                            onValueChange={(value: string) => setCustomFieldValues({
                              ...customFieldValues,
                              [field.name]: value
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select option" />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options.map((option) => (
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
                </div>
              )}

              {uploadStatus !== 'idle' && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <ScrollArea className="h-[100px] border rounded-md p-2">
                    {statusMessages.map((message, index) => (
                      <div key={index} className="text-xs py-1">{message}</div>
                    ))}
                  </ScrollArea>
                </div>
              )}

              {uploadStatus === 'error' && (
                <Alert variant="destructive">
                  <AlertDescription>
                    There was an error uploading your files. Please try again.
                  </AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    form.reset();
                    setSelectedFiles([]);
                    setIsOpen(false);
                  }}
                  disabled={uploadDocuments.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={uploadDocuments.isPending || selectedFiles.length === 0}
                >
                  {uploadDocuments.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Upload {selectedFiles.length} Files
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}