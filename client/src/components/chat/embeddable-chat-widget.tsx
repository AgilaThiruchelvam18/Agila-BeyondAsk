import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { MessageWithCitations, Citation } from './message-with-citations';
import { Send, X, MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';

interface EmbeddableChatProps {
  widgetId: string;
  publicKey: string;
  token?: string;
  config: {
    theme: {
      primaryColor: string;
      textColor: string;
      backgroundColor: string;
    };
    position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    size: 'small' | 'medium' | 'large';
    welcomeMessage: string;
    widgetTitle: string;
  };
  onLogin: () => void;
  isAuthenticated: boolean;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  citations?: Citation[];
}

export function EmbeddableChatWidget({
  widgetId,
  publicKey,
  token,
  config,
  onLogin,
  isAuthenticated
}: EmbeddableChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userMessage, setUserMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [agentName, setAgentName] = useState('Assistant');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Set widget size
  const getWidgetSize = () => {
    switch (config.size) {
      case 'small': return 'w-80 h-96';
      case 'large': return 'w-96 h-[600px]';
      case 'medium':
      default: return 'w-[350px] h-[500px]';
    }
  };
  
  // Set widget position
  const getWidgetPosition = () => {
    switch (config.position) {
      case 'top-left': return 'top-4 left-4';
      case 'top-right': return 'top-4 right-4';
      case 'bottom-left': return 'bottom-4 left-4';
      case 'bottom-right':
      default: return 'bottom-4 right-4';
    }
  };
  
  // Apply theme colors as CSS variables
  useEffect(() => {
    document.documentElement.style.setProperty('--chat-primary-color', config.theme.primaryColor);
    document.documentElement.style.setProperty('--chat-text-color', config.theme.textColor);
    document.documentElement.style.setProperty('--chat-background-color', config.theme.backgroundColor);
  }, [config.theme]);
  
  // Fetch agent info on load
  useEffect(() => {
    if (isAuthenticated) {
      fetchAgentInfo();
    }
  }, [isAuthenticated, publicKey]);
  
  // Add welcome message when conversation starts
  useEffect(() => {
    if (isOpen && messages.length === 0 && config.welcomeMessage) {
      setMessages([
        {
          id: 0,
          role: 'assistant',
          content: config.welcomeMessage,
          createdAt: new Date()
        }
      ]);
    }
  }, [isOpen, messages.length, config.welcomeMessage]);
  
  // Scroll to bottom when messages update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  const fetchAgentInfo = async () => {
    try {
      const response = await apiRequest(`/api/widgets/${publicKey}/agent`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      
      if (response && response.name) {
        setAgentName(response.name);
      }
    } catch (error) {
      console.error('Error fetching agent info:', error);
    }
  };
  
  const fetchOrCreateConversation = async () => {
    if (conversationId) return conversationId;
    
    try {
      const response = await apiRequest(`/api/widgets/${publicKey}/conversations`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        data: {
          title: `Chat with ${agentName}`
        }
      });
      
      if (response && response.id) {
        setConversationId(response.id);
        return response.id;
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
    
    return null;
  };
  
  const sendMessage = async () => {
    if (!userMessage.trim() || !isAuthenticated) return;
    
    // Add user message to chat
    const tempId = Date.now();
    const userMsg: ChatMessage = {
      id: tempId,
      role: 'user',
      content: userMessage,
      createdAt: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setUserMessage('');
    setIsLoading(true);
    
    try {
      // Get or create conversation
      const convId = await fetchOrCreateConversation();
      if (!convId) {
        throw new Error('Failed to create conversation');
      }
      
      // Send message to API
      const response = await apiRequest(`/api/widgets/${publicKey}/conversations/${convId}/messages`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        data: {
          content: userMsg.content,
          role: 'user'
        }
      });
      
      // Get the assistant response
      if (response && response.messages) {
        // Find the assistant message in the response
        const assistantMessage = response.messages.find((msg: any) => 
          msg.role === 'assistant' && msg.conversationId === convId
        );
        
        if (assistantMessage) {
          setMessages(prev => [
            ...prev,
            {
              id: assistantMessage.id,
              role: assistantMessage.role,
              content: assistantMessage.content,
              createdAt: new Date(assistantMessage.createdAt),
              citations: assistantMessage.citations || []
            }
          ]);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message
      setMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          role: 'assistant',
          content: 'I\'m sorry, I encountered an error while processing your request. Please try again later.',
          createdAt: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  return (
    <>
      {/* Chat toggle button */}
      <button
        className={`fixed z-50 rounded-full p-3 shadow-lg focus:outline-none ${getWidgetPosition()}`}
        style={{ backgroundColor: config.theme.primaryColor }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <X className="h-6 w-6" style={{ color: config.theme.textColor }} />
        ) : (
          <MessageSquare className="h-6 w-6" style={{ color: config.theme.textColor }} />
        )}
      </button>
      
      {/* Chat window */}
      {isOpen && (
        <div 
          className={`fixed z-40 shadow-lg rounded-lg flex flex-col overflow-hidden ${getWidgetSize()} ${getWidgetPosition()}`}
          style={{ backgroundColor: config.theme.backgroundColor }}
        >
          {/* Header */}
          <div 
            className="p-3 flex justify-between items-center"
            style={{ 
              backgroundColor: config.theme.primaryColor,
              color: config.theme.textColor
            }}
          >
            <h3 className="font-semibold">{config.widgetTitle || agentName}</h3>
            <Button 
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsOpen(false)}
              style={{ color: config.theme.textColor }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Chat area */}
          {!isAuthenticated ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <Card className="w-full">
                <CardHeader>
                  <CardTitle className="text-base">Login Required</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Please login to start chatting</p>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full"
                    onClick={onLogin}
                    style={{ 
                      backgroundColor: config.theme.primaryColor,
                      color: config.theme.textColor
                    }}
                  >
                    Login
                  </Button>
                </CardFooter>
              </Card>
            </div>
          ) : (
            <>
              {/* Messages */}
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <MessageWithCitations
                      key={message.id}
                      id={message.id}
                      content={message.content}
                      role={message.role}
                      createdAt={message.createdAt}
                      citations={message.citations}
                      senderName={message.role === 'user' ? 'You' : agentName}
                      senderInitial={message.role === 'user' ? 'Y' : agentName.charAt(0)}
                      isChatDisabled={isLoading}
                    />
                  ))}
                  
                  {isLoading && (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              
              {/* Input area */}
              <div className="p-3 border-t">
                <div className="flex">
                  <Input
                    placeholder="Type your message..."
                    value={userMessage}
                    onChange={(e) => setUserMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    className="mr-2"
                  />
                  <Button
                    size="icon"
                    onClick={sendMessage}
                    disabled={!userMessage.trim() || isLoading}
                    style={{ backgroundColor: config.theme.primaryColor }}
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" style={{ color: config.theme.textColor }} />
                    ) : (
                      <Send className="h-5 w-5" style={{ color: config.theme.textColor }} />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}