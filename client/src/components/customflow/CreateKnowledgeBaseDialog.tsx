import React, { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CustomFieldsArray from '@/components/custom-fields-array';

// Create the schema for knowledge base creation
const createKnowledgeBaseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  metadata: z.object({
    source: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  customFields: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1, 'Field name is required'),
      description: z.string().optional(),
      type: z.enum(['text', 'number', 'date', 'boolean', 'select']),
      required: z.boolean().default(false),
      options: z.array(z.string()).optional(),
    })
  ).optional(),
});

type CreateKnowledgeBaseFormValues = z.infer<typeof createKnowledgeBaseSchema>;

interface CreateKnowledgeBaseDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newKnowledgeBase: any) => void;
}

export function CreateKnowledgeBaseDialog({ 
  isOpen, 
  onOpenChange, 
  onSuccess 
}: CreateKnowledgeBaseDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const createKnowledgeBase = useMutation({
    mutationFn: async (data: CreateKnowledgeBaseFormValues) => {
      const response = await fetch("/api/knowledge-bases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create knowledge base");
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-bases"] });
      // Also invalidate document counts
      queryClient.invalidateQueries({
        queryKey: ['/api/knowledge-bases', 'documents', 'counts']
      });
      
      onOpenChange(false);
      form.reset();
      
      toast({
        title: "Knowledge Base created",
        description: "Your new knowledge base has been created successfully.",
      });
      
      if (onSuccess) {
        onSuccess(data);
      }
    },
    onError: (error: Error) => {
      console.error("Knowledge base creation error:", error);
      toast({
        title: "Failed to create knowledge base",
        description: error.message || "An error occurred while creating the knowledge base.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateKnowledgeBaseFormValues) => {
    createKnowledgeBase.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
                
                <FormField
                  control={form.control}
                  name="metadata.source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <FormControl>
                        <Input placeholder="Where this knowledge comes from" {...field} />
                      </FormControl>
                      <FormDescription>
                        Optional: Source of the knowledge (e.g., website, documents)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                onClick={() => onOpenChange(false)}
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
  );
}

export default CreateKnowledgeBaseDialog;