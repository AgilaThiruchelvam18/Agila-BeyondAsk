import { useState, useRef } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, ChevronUp, BookOpen, X, Copy, Edit, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FollowUpQuestions, FollowUpQuestion } from './follow-up-questions';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export interface Citation {
  id: string;
  score: number;
  content: string;
  source: string;
  document_id: string;
  chunk_index: number;
}

export interface MessageWithCitationsProps {
  id: number;
  content: string;
  role: 'user' | 'assistant' | 'system';
  createdAt: Date;
  citations?: Citation[];
  followUpQuestions?: FollowUpQuestion[];
  senderName: string;
  senderInitial: string;
  avatarUrl?: string;
  isChatDisabled?: boolean;
  onFollowUpQuestionClick?: (question: string) => void;
  onMessageEdit?: (id: number, content: string) => void;
}

export function MessageWithCitations({
  id,
  content,
  role,
  createdAt,
  citations = [],
  followUpQuestions = [],
  senderName,
  senderInitial,
  avatarUrl,
  isChatDisabled = false,
  onFollowUpQuestionClick,
  onMessageEdit
}: MessageWithCitationsProps) {
  const [isCitationsOpen, setIsCitationsOpen] = useState(false);
  const [isContentCollapsed, setIsContentCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  
  const hasCitations = citations && citations.length > 0;
  const isUser = role === 'user';
  const hasLongContent = content.length > 500;
  
  const handleCitationClick = (citation: Citation) => {
    setSelectedCitation(citation);
  };
  
  const handleCloseCitation = () => {
    setSelectedCitation(null);
  };

  const handleCopyClick = () => {
    navigator.clipboard.writeText(content)
      .then(() => {
        setIsCopied(true);
        toast({
          title: "Copied to clipboard",
          description: "Message content has been copied to clipboard",
          duration: 2000
        });
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(() => {
        toast({
          title: "Failed to copy",
          description: "Could not copy message to clipboard",
          variant: "destructive"
        });
      });
  };

  const handleEditClick = () => {
    if (!isUser) return; // Only allow editing user messages
    setIsEditing(true);
    setEditedContent(content);
    // Focus and set cursor at the end of textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.value.length;
        textareaRef.current.selectionEnd = textareaRef.current.value.length;
      }
    }, 0);
  };

  const handleSaveEdit = () => {
    if (editedContent.trim() === "") return;
    if (onMessageEdit && editedContent !== content) {
      onMessageEdit(id, editedContent);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent(content);
  };

  const messageTimeFormatted = format(new Date(createdAt), 'MMM d, h:mm a');
  
  return (
    <Card className={`${isUser ? 'ml-12 bg-primary/10' : 'mr-12'} overflow-hidden group`}>
      <CardHeader className="p-3 pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Avatar className={`h-8 w-8 mr-2 ${isUser ? 'bg-primary/80' : 'bg-indigo-500'}`}>
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={senderName} />
              ) : null}
              <AvatarFallback className="text-white">
                {senderInitial}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-medium">{senderName}</div>
              <div className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200">{messageTimeFormatted}</div>
            </div>
          </div>
          
          {!isChatDisabled && (
            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleCopyClick}
                title="Copy message"
              >
                {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              
              {isUser && onMessageEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hidden"
                  onClick={handleEditClick}
                  title="Edit message"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              
              {hasLongContent && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsContentCollapsed(!isContentCollapsed)}
                  title={isContentCollapsed ? "Expand message" : "Collapse message"}
                >
                  {isContentCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-3 pt-0">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              ref={textareaRef}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[100px]"
              placeholder="Edit your message..."
            />
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCancelEdit}
              >
                Cancel
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleSaveEdit}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <Collapsible
            open={!isContentCollapsed}
            className="w-full overflow-hidden"
          >
            <CollapsibleContent className="w-full">
              <div className="whitespace-pre-wrap">{content}</div>
            </CollapsibleContent>
            
            {isContentCollapsed && (
              <div className="text-sm text-muted-foreground mt-1">
                {content.substring(0, 150)}...
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-6 px-2 text-xs"
                  onClick={() => setIsContentCollapsed(false)}
                >
                  Show more
                </Button>
              </div>
            )}
          </Collapsible>
        )}
        
        {!isUser && followUpQuestions && followUpQuestions.length > 0 && onFollowUpQuestionClick && (
          <FollowUpQuestions
            questions={followUpQuestions}
            onQuestionClick={onFollowUpQuestionClick}
            disabled={isChatDisabled}
          />
        )}
      </CardContent>
      
      {!isUser && hasCitations && (
        <>
          <Separator />
          <CardFooter className="p-0">
            <Collapsible
              open={isCitationsOpen}
              onOpenChange={setIsCitationsOpen}
              className="w-full"
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center justify-between w-full rounded-none h-8 px-3 text-xs text-muted-foreground group-hover:bg-muted/50 transition-colors duration-200"
                  disabled={isChatDisabled}
                >
                  <div className="flex items-center">
                    <BookOpen className="mr-1 h-3 w-3" />
                    <span>{citations.length} {citations.length === 1 ? 'Source' : 'Sources'}</span>
                  </div>
                  {isCitationsOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="p-3 bg-muted/50">
                  {selectedCitation ? (
                    <div className="rounded border bg-card p-2 mb-2 relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={handleCloseCitation}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <h4 className="text-xs font-medium mb-1">{selectedCitation.source}</h4>
                      <ScrollArea className="h-32">
                        <p className="text-xs">{selectedCitation.content}</p>
                      </ScrollArea>
                    </div>
                  ) : null}
                  
                  <div className="grid grid-cols-1 gap-2">
                    {citations.map((citation) => (
                      <Button
                        key={citation.id}
                        variant="outline"
                        className="h-auto py-1 px-2 justify-start text-left"
                        onClick={() => handleCitationClick(citation)}
                      >
                        <div className="w-full overflow-hidden">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium truncate">{citation.source}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {Math.round(citation.score * 100)}% match
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {citation.content.substring(0, 100)}...
                          </p>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardFooter>
        </>
      )}
    </Card>
  );
}