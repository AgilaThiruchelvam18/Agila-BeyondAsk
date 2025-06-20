import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Edit, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/ui/tag-input";

interface EditDocumentDialogProps {
  document: {
    id: number;
    title: string;
    description?: string;
    metadata?: any;
    tags?: string[];
    knowledgeBaseId: number;
  };
  trigger?: React.ReactNode;
}

// Define the schema for editing a document
const editDocumentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.string()).optional()
});

type EditDocumentFormValues = z.infer<typeof editDocumentSchema>;

export function EditDocumentDialog({ document, trigger }: EditDocumentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [customFieldKeys, setCustomFieldKeys] = useState<string[]>([]);
  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Set up the form
  const form = useForm<EditDocumentFormValues>({
    resolver: zodResolver(editDocumentSchema),
    defaultValues: {
      title: document.title || "",
      description: document.description || "",
      tags: document.tags || [],
      customFields: {}
    }
  });

  // Extract custom fields from document metadata on component mount
  useEffect(() => {
    if (document.metadata?.customFields && typeof document.metadata.customFields === "object") {
      setCustomFields(document.metadata.customFields);
      setCustomFieldKeys(Object.keys(document.metadata.customFields));
    }
  }, [document.metadata]);

  // Update form when custom fields change
  useEffect(() => {
    form.setValue("customFields", customFields);
  }, [customFields, form]);

  // Add a new custom field
  const addCustomField = () => {
    if (!newFieldKey.trim()) {
      toast({
        title: "Field key required",
        description: "Please enter a key for the custom field.",
        variant: "destructive"
      });
      return;
    }

    // Add the new field
    const updatedFields = {
      ...customFields,
      [newFieldKey]: newFieldValue
    };

    setCustomFields(updatedFields);
    setCustomFieldKeys([...customFieldKeys, newFieldKey]);
    
    // Reset inputs
    setNewFieldKey("");
    setNewFieldValue("");
  };

  // Remove a custom field
  const removeCustomField = (key: string) => {
    const updatedFields = { ...customFields };
    delete updatedFields[key];
    
    setCustomFields(updatedFields);
    setCustomFieldKeys(customFieldKeys.filter(k => k !== key));
  };

  // Update an existing custom field value
  const updateCustomField = (key: string, value: string) => {
    setCustomFields({
      ...customFields,
      [key]: value
    });
  };

  // Submit handler
  const updateDocument = useMutation({
    mutationFn: async (data: EditDocumentFormValues) => {
      // Prepare the payload
      const payload = {
        title: data.title,
        description: data.description,
        tags: data.tags,
        metadata: {
          ...document.metadata,
          customFields: data.customFields
        }
      };

      return apiRequest(`/api/knowledge-bases/${document.knowledgeBaseId}/documents/${document.id}`, {
        method: "PUT",
        data: payload
      });
    },
    onSuccess: () => {
      toast({
        title: "Document updated",
        description: "The document has been successfully updated."
      });
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/knowledge-bases/${document.knowledgeBaseId}/documents`] });
    },
    onError: (error) => {
      console.error("Error updating document:", error);
      toast({
        title: "Error updating document",
        description: "There was a problem updating the document. Please try again.",
        variant: "destructive"
      });
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            Edit Document
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Document</DialogTitle>
          <DialogDescription>
            Update document title, description, tags, and custom fields.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(data => updateDocument.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Document title" {...field} />
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
                    <Textarea
                      placeholder="Enter a description"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormDescription>
                    Add tags to categorize and filter your document
                  </FormDescription>
                  <FormControl>
                    <TagInput
                      tags={field.value || []}
                      onTagsChange={field.onChange}
                      placeholder="Enter tags..."
                      maxTags={20}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="space-y-4">
              <div>
                <FormLabel>Custom Fields</FormLabel>
                <FormDescription>
                  Add custom metadata fields to this document for better organization and filtering.
                </FormDescription>
              </div>

              {/* Display existing custom fields */}
              {customFieldKeys.length > 0 && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    {customFieldKeys.map(key => (
                      <div key={key} className="flex items-center gap-3">
                        <div className="flex-1">
                          <Label>{key}</Label>
                          <Input 
                            value={customFields[key] || ""}
                            onChange={(e) => updateCustomField(key, e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => removeCustomField(key)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Add new custom field */}
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label>Key</Label>
                  <Input 
                    value={newFieldKey}
                    onChange={(e) => setNewFieldKey(e.target.value)}
                    placeholder="Field name"
                    className="mt-1"
                  />
                </div>
                <div className="flex-1">
                  <Label>Value</Label>
                  <Input 
                    value={newFieldValue}
                    onChange={(e) => setNewFieldValue(e.target.value)}
                    placeholder="Field value"
                    className="mt-1"
                  />
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={addCustomField}
                >
                  Add Field
                </Button>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset();
                  setIsOpen(false);
                }}
                disabled={updateDocument.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateDocument.isPending}>
                {updateDocument.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}