// Shared types for ReactFlow components
export interface KnowledgeNodeData {
  name: string;
  id?: number;
  description?: string;
  documents: Array<{
    id: string;
    name: string;
    content?: string;
  }>;
  width?: number;
  height?: number;
}

export interface ChatWidgetNodeData {
  name?: string;
  linkedKnowledgeBase: string | null;
  linkedKnowledgeBaseName?: string | null;
  config?: {
    welcomeMessage?: string;
    widgetTitle?: string;
  };
  width?: number;
  height?: number;
}