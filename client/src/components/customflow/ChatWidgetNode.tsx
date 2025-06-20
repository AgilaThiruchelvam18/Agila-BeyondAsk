import React, { useState, useEffect } from 'react';
import { Node, ChatWidgetNodeData } from './types';
import { MessageSquare, User, Bot, Send, X, Move, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface ChatWidgetNodeProps {
  node: Node;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onPortMouseDown: (e: React.MouseEvent, nodeId: string, handle?: string) => void;
  onResizeStart: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: () => void;
  isReadOnly?: boolean;
  connectedKnowledgeBases: Node[];
  boardId: number;
}

const ChatWidgetNode: React.FC<ChatWidgetNodeProps> = ({
  node,
  selected,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
  onPortMouseDown,
  onResizeStart,
  onDelete,
  isReadOnly = false,
  connectedKnowledgeBases,
  boardId
}) => {
  const { toast } = useToast();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState<Array<{
    sender: 'user' | 'bot';
    text: string;
    timestamp?: Date;
  }>>(
    // Convert string timestamps to Date objects if needed
    ((node.data as ChatWidgetNodeData).messages || []).map(msg => ({
      sender: msg.sender as 'user' | 'bot',
      text: msg.text,
      timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined
    }))
  );
  
  const [widgetSettings, setWidgetSettings] = useState({
    title: (node.data as ChatWidgetNodeData).config?.widgetTitle || 'Chat Widget',
    welcomeMessage: (node.data as ChatWidgetNodeData).config?.welcomeMessage || 'How can I help you today?'
  });
  
  const nodeData = node.data as ChatWidgetNodeData;
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Query to fetch saved conversation messages
  const { data: conversationData, isLoading: isLoadingConversation } = useQuery({
    queryKey: [`/api/visualizer/${boardId}/conversations/${node.id}`],
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/visualizer/${boardId}/conversations/${node.id}`, {
          method: 'GET'
        });
        return response;
      } catch (error) {
        console.error('Error fetching conversation:', error);
        return { messages: [] };
      }
    },
    refetchOnWindowFocus: false
  });

  // Mutation to save conversation messages
  const saveConversationMutation = useMutation({
    mutationFn: async (messageData: Array<{
      sender: 'user' | 'bot';
      text: string;
      timestamp?: Date;
    }>) => {
      const response = await apiRequest(`/api/visualizer/${boardId}/conversations/${node.id}`, {
        method: 'POST',
        data: { messages: messageData }
      });
      return response;
    },
    onError: (error) => {
      console.error('Error saving conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to save the conversation. Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Load saved conversation on initial render
  useEffect(() => {
    if (conversationData && conversationData.messages && conversationData.messages.length > 0) {
      const savedMessages = conversationData.messages.map((msg: any) => ({
        sender: msg.sender as 'user' | 'bot',
        text: msg.text,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined
      }));
      
      if (savedMessages.length > 0) {
        setMessages(savedMessages);
      }
    }
  }, [conversationData]);
  
  // Scroll to bottom of messages when new ones are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    
    // Store the input text before clearing it
    const inputText = userInput.trim();
    
    // Clear the input immediately
    setUserInput('');
    
    // Add user message
    const newUserMessage = { 
      sender: 'user' as const, 
      text: inputText,
      timestamp: new Date()
    };
    
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    
    // Add loading message temporarily
    const loadingMessage = {
      sender: 'bot' as const,
      text: "Processing your query...",
      timestamp: new Date(),
      isLoading: true
    };
    
    setMessages([...updatedMessages, loadingMessage]);
    
    try {
      // Extract knowledge base IDs from connected nodes
      const connectedKnowledgeBaseIds = connectedKnowledgeBases
        .map(kb => (kb.data as any).id)
        .filter(id => id !== undefined) as number[];
      
      // Create message context for conversation history
      const messageContext = messages
        .slice(-6) // Include last few messages for context
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        }));
        
      if (connectedKnowledgeBaseIds.length > 0) {
        // Call the API to process the query against the connected knowledge bases
        const response = await fetch(`/api/visualizer/${boardId}/process-query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            query: inputText,
            knowledgeBaseIds: connectedKnowledgeBaseIds,
            messageContext
          })
        });
        
        const result = await response.json();
        
        // Create the response message with sources directly attached as an attribute
        const botMessage = {
          sender: 'bot' as const,
          text: result.answer,
          timestamp: new Date(),
          sources: result.sources || [],
          isSimulation: result.isSimulation || false
        };
        
        // Replace the loading message with the real response
        const finalMessages = updatedMessages.concat(botMessage);
        setMessages(finalMessages);
        
        // Save the conversation to the database
        saveConversationMutation.mutate(finalMessages);
      } else {
        // No knowledge bases connected
        const botMessage = {
          sender: 'bot' as const,
          text: "I don't have any knowledge bases connected. Please connect at least one knowledge base to provide more helpful responses.",
          timestamp: new Date()
        };
        
        const finalMessages = updatedMessages.concat(botMessage);
        setMessages(finalMessages);
        
        // Save the conversation to the database
        saveConversationMutation.mutate(finalMessages);
      }
    } catch (error) {
      console.error('Error processing query:', error);
      
      // Error response
      const errorMessage = {
        sender: 'bot' as const,
        text: "I'm sorry, I encountered an error while processing your request. Please try again later.",
        timestamp: new Date()
      };
      
      // Replace loading message with error message
      const finalMessages = updatedMessages.concat(errorMessage);
      setMessages(finalMessages);
      
      // Save the conversation with the error message
      saveConversationMutation.mutate(finalMessages);
    }
  };

  const handleSettingsSave = () => {
    // Normally we would update the node data in the parent component
    // but for this demo we'll just close the dialog
    setIsSettingsOpen(false);
  };
  
  const nodeStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${node.position.x}px`,
    top: `${node.position.y}px`,
    width: `${node.size.width}px`,
    height: `${node.size.height}px`,
    userSelect: 'none'
  };

  return (
    <div 
      className={`rounded-md border ${selected ? 'border-indigo-500 shadow-md' : 'border-gray-200'} 
                 bg-white flex flex-col`}
      style={nodeStyle}
      onMouseDown={(e) => onMouseDown(e, node.id)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Left side handle for connections */}
      <div 
        className="absolute left-0 top-1/2 w-4 h-8 -ml-2 rounded-full bg-indigo-500 cursor-crosshair z-10 connection-handle"
        style={{ transform: 'translateY(-50%)' }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onPortMouseDown(e, node.id, 'left');
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
      
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between bg-indigo-50 rounded-t-md">
        <div className="flex items-center">
          <MessageSquare className="h-5 w-5 text-indigo-500 mr-2" />
          <h3 className="text-sm font-medium">{widgetSettings.title}</h3>
        </div>
        
        <div className="flex gap-1">
          {!isReadOnly && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-500"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSettingsOpen(true);
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-gray-400 hover:text-red-500" 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* Messages area */}
      <div 
        className="flex-grow p-3 overflow-y-auto" 
        style={{ userSelect: 'text' }} 
        onMouseDown={(e) => e.stopPropagation()}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            <p>{widgetSettings.welcomeMessage}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div 
                  className={`
                    max-w-[80%] rounded-lg p-2.5 
                    ${message.sender === 'user' 
                      ? 'bg-indigo-500 text-white' 
                      : 'bg-gray-100 text-gray-800'}
                    ${(message as any).isLoading ? 'animate-pulse' : ''}
                  `}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {message.sender === 'user' ? (
                      <User className="h-3.5 w-3.5" />
                    ) : (
                      <Bot className="h-3.5 w-3.5" />
                    )}
                    <span className="text-xs font-medium">
                      {message.sender === 'user' ? 'You' : 'Assistant'}
                    </span>
                    {message.timestamp && (
                      <span className="text-xs opacity-70">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {(message as any).isLoading && (
                      <span className="text-xs italic ml-1">typing...</span>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                  
                  {/* Sources display for bot messages with sources */}
                  {message.sender === 'bot' && (message as any).sources && (message as any).sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-500">Sources:</p>
                      <ul className="text-xs text-gray-600 mt-1 list-disc pl-4">
                        {(message as any).sources.slice(0, 3).map((source: any, idx: number) => (
                          <li key={idx} className="truncate">
                            {source.source || source.title || source.metadata?.title || `Document ${source.metadata?.document_id || source.document_id || 'Unknown'}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Input area */}
      <div className="p-3 border-t flex items-center space-x-2" onMouseDown={(e) => e.stopPropagation()}>
        <Input
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Type a message..."
          className="text-sm"
          disabled={isReadOnly}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
        />
        <Button
          size="icon"
          disabled={!userInput.trim() || isReadOnly}
          onClick={handleSendMessage}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chat Widget Settings</DialogTitle>
            <DialogDescription>
              Customize the appearance and behavior of the chat widget
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Widget Title</label>
              <Input 
                value={widgetSettings.title}
                onChange={(e) => setWidgetSettings({...widgetSettings, title: e.target.value})}
                placeholder="Enter widget title"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Welcome Message</label>
              <Input 
                value={widgetSettings.welcomeMessage}
                onChange={(e) => setWidgetSettings({...widgetSettings, welcomeMessage: e.target.value})}
                placeholder="Enter welcome message"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSettingsSave}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatWidgetNode;