import React from 'react';
import { Button } from "@/components/ui/button";
import { HelpCircle } from 'lucide-react';

export interface FollowUpQuestion {
  id: string;
  text: string;
}

interface FollowUpQuestionsProps {
  questions: FollowUpQuestion[];
  onQuestionClick: (question: string) => void;
  disabled?: boolean;
}

export function FollowUpQuestions({ 
  questions, 
  onQuestionClick, 
  disabled = false 
}: FollowUpQuestionsProps) {
  if (!questions || questions.length === 0) {
    return null;
  }

  const handleQuestionClick = (question: FollowUpQuestion) => {
    if (!disabled) {
      onQuestionClick(question.text);
    }
  };

  return (
    <div className="mt-4">
      <div className="flex items-center mb-2 text-xs text-muted-foreground">
        <HelpCircle className="h-3 w-3 mr-1" />
        <span>Suggested questions</span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {questions.map((question) => (
          <Button
            key={question.id}
            variant="outline"
            size="sm"
            className="justify-start h-auto py-2 px-3 text-left text-xs"
            onClick={() => handleQuestionClick(question)}
            disabled={disabled}
          >
            {question.text}
          </Button>
        ))}
      </div>
    </div>
  );
}