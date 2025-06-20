import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";

interface UseTemplateButtonProps {
  templateId: number;
  templateName: string;
  className?: string;
}

export function UseTemplateButton({ templateId, templateName, className = "" }: UseTemplateButtonProps) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [, navigate] = useLocation();

  const handleUseTemplate = async () => {
    setIsCreating(true);
    
    try {
      const newAgent = await apiRequest(
        `/api/agents/from-template/${templateId}`, 
        {
          method: "POST",
          data: { name: `${templateName} Copy` }
        }
      );
      
      // Invalidate queries to refresh agent list
      queryClient.invalidateQueries({queryKey: ["/api/agents"]});
      
      toast({
        title: "Agent created successfully",
        description: `Your new agent "${newAgent.name}" is ready to use.`,
      });
      
      // Navigate to the edit page for the newly created agent
      navigate(`/agent/${newAgent.id}`);
    } catch (error) {
      console.error("Error creating agent from template:", error);
      toast({
        title: "Error creating agent",
        description: "There was a problem creating your agent. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Button 
      size="sm" 
      className={className}
      onClick={handleUseTemplate}
      disabled={isCreating}
    >
      {isCreating ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Creating...
        </>
      ) : (
        'Use Template'
      )}
    </Button>
  );
}