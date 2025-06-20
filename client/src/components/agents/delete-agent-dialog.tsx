import { useState, useEffect } from "react";
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

export interface DeleteAgentDialogProps {
  agentId: number;
  agentName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteAgentDialog({
  agentId,
  agentName,
  isOpen,
  onOpenChange,
  onDeleted,
}: DeleteAgentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [useCascade, setUseCascade] = useState(false);
  const [dependencies, setDependencies] = useState<{
    conversations: number;
    widgets: number;
    unansweredQuestions: number;
  } | null>(null);
  
  // Get dependencies when dialog opens
  const getDependencies = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/agents/${agentId}/dependencies`, {
        method: "GET"
      });
      return response;
    },
    onSuccess: (data) => {
      setDependencies(data.data || data);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to check dependencies",
        description: error.message || "An error occurred while checking agent dependencies.",
        variant: "destructive",
      });
      onOpenChange(false);
    }
  });

  // Delete agent mutation
  const deleteAgent = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/agents/${agentId}`, {
        method: "DELETE",
        params: useCascade ? { cascade: 'true' } : undefined
      });
      return agentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Agent deleted",
        description: useCascade 
          ? `${agentName} and all related data have been deleted successfully.` 
          : `${agentName} has been deleted successfully.`,
      });
      onOpenChange(false);
      onDeleted?.();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete agent",
        description: error.message || "An error occurred while deleting the agent.",
        variant: "destructive",
      });
    },
  });

  // When dialog opens, check dependencies
  useEffect(() => {
    if (isOpen) {
      setDependencies(null);
      setUseCascade(false);
      getDependencies.mutate();
    }
  }, [isOpen]);

  const hasDependencies = dependencies && (
    dependencies.conversations > 0 ||
    dependencies.widgets > 0 ||
    dependencies.unansweredQuestions > 0
  );

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Agent</AlertDialogTitle>
          <AlertDialogDescription>
            {getDependencies.isPending ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2">Checking dependencies...</span>
              </div>
            ) : hasDependencies ? (
              <>
                <p className="mb-2">
                  This agent has related data that will prevent deletion:
                </p>
                <ul className="list-disc pl-5 mb-4">
                  {dependencies?.conversations > 0 && (
                    <li>{dependencies.conversations} conversation{dependencies.conversations !== 1 ? 's' : ''}</li>
                  )}
                  {dependencies?.widgets > 0 && (
                    <li>{dependencies.widgets} widget{dependencies.widgets !== 1 ? 's' : ''}</li>
                  )}
                  {dependencies?.unansweredQuestions > 0 && (
                    <li>{dependencies.unansweredQuestions} unanswered question{dependencies.unansweredQuestions !== 1 ? 's' : ''}</li>
                  )}
                </ul>
                <div className="flex items-start space-x-2 mb-4">
                  <Checkbox
                    id="cascade"
                    checked={useCascade}
                    onCheckedChange={(checked) => setUseCascade(checked as boolean)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="cascade" className="font-semibold">
                      Delete all related data
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      This will delete the agent and all related conversations, widgets, and unanswered questions.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p>
                Are you sure you want to delete <strong>{agentName}</strong>? This action cannot be undone.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteAgent.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              deleteAgent.mutate();
            }}
            disabled={deleteAgent.isPending || getDependencies.isPending}
            className={deleteAgent.isPending ? "opacity-50 pointer-events-none" : ""}
          >
            {deleteAgent.isPending ? (
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