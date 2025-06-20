import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export interface DeleteKnowledgeBaseDialogProps {
  knowledgeBaseId: number;
  knowledgeBaseName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

interface KnowledgeBaseDependencies {
  documents: number;
  agents: number;
  unansweredQuestions: number;
}

export function DeleteKnowledgeBaseDialog({
  knowledgeBaseId,
  knowledgeBaseName,
  isOpen,
  onOpenChange,
  onDeleted,
}: DeleteKnowledgeBaseDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [useCascade, setUseCascade] = useState(false);
  const [dependencies, setDependencies] = useState<KnowledgeBaseDependencies | null>(null);

  // Get dependencies when dialog opens
  const getDependencies = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/knowledge-bases/${knowledgeBaseId}/dependencies`, {
        method: "GET"
      });
      return response;
    },
    onSuccess: (data) => {
      setDependencies(data);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to check dependencies",
        description: error.message || "An error occurred while checking knowledge base dependencies.",
        variant: "destructive",
      });
      onOpenChange(false);
    }
  });

  // Delete knowledge base mutation
  const deleteKnowledgeBase = useMutation({
    mutationFn: async () => {
      if (useCascade) {
        await apiRequest(`/api/knowledge-bases/${knowledgeBaseId}/cascade`, {
          method: "DELETE"
        });
      } else {
        await apiRequest(`/api/knowledge-bases/${knowledgeBaseId}`, {
          method: "DELETE"
        });
      }
      return knowledgeBaseId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-bases"] });
      toast({
        title: "Knowledge Base deleted",
        description: useCascade 
          ? `${knowledgeBaseName} and all related data have been deleted successfully.` 
          : `${knowledgeBaseName} has been deleted successfully.`,
      });
      onOpenChange(false);
      onDeleted?.();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete knowledge base",
        description: error.message || "An error occurred while deleting the knowledge base.",
        variant: "destructive",
      });
    },
  });

  // When dialog opens, check dependencies
  useEffect(() => {
    if (isOpen) {
      getDependencies.mutate();
    }
  }, [isOpen]);

  const hasDependencies = Boolean(dependencies && (
    (dependencies.documents ?? 0) > 0 ||
    (dependencies.agents ?? 0) > 0 ||
    (dependencies.unansweredQuestions ?? 0) > 0
  ));

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Knowledge Base</AlertDialogTitle>
          <AlertDialogDescription>
            {getDependencies.isPending ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2">Checking dependencies...</span>
              </div>
            ) : hasDependencies ? (
              <>
                <p className="mb-2">
                  This knowledge base has related data that will prevent deletion:
                </p>
                <ul className="list-disc pl-5 mb-4">
                  {dependencies && (dependencies.documents ?? 0) > 0 && (
                    <li>{dependencies.documents} document{dependencies.documents !== 1 ? 's' : ''}</li>
                  )}
                  {dependencies && (dependencies.agents ?? 0) > 0 && (
                    <li>{dependencies.agents} agent{dependencies.agents !== 1 ? 's' : ''}</li>
                  )}
                  {dependencies && (dependencies.unansweredQuestions ?? 0) > 0 && (
                    <li>{dependencies.unansweredQuestions} unanswered question{dependencies.unansweredQuestions !== 1 ? 's' : ''}</li>
                  )}
                </ul>
                <div className="flex items-start space-x-2 mb-4">
                  <Checkbox
                    id="cascade"
                    checked={useCascade}
                    onCheckedChange={(checked) => setUseCascade(checked === true)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="cascade" className="font-semibold">
                      Delete all related data
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      This will delete the knowledge base and all related documents, agents, and unanswered questions.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p>
                Are you sure you want to delete <strong>{knowledgeBaseName}</strong>? This action cannot be undone.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteKnowledgeBase.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              deleteKnowledgeBase.mutate();
            }}
            disabled={deleteKnowledgeBase.isPending || getDependencies.isPending || (hasDependencies && !useCascade)}
            className={deleteKnowledgeBase.isPending ? "opacity-50 pointer-events-none" : ""}
          >
            {deleteKnowledgeBase.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : hasDependencies && !useCascade ? (
              "Cannot Delete"
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}