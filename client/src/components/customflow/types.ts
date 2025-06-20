/**
 * Type definitions for the custom flow builder
 */

// Basic node type
export interface Node {
  id: string;
  type: 'knowledgebase' | 'chat';
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  data: KnowledgeNodeData | ChatWidgetNodeData;
}

// Knowledge base node data
export interface KnowledgeNodeData {
  name: string;
  id?: number;
  description?: string;
  documents: Array<{
    id: string | number;
    title?: string;
    name?: string;
    content?: string;
    sourceType?: string;
    createdAt?: string | Date;
  }>;
  width?: number;
  height?: number;
}

// Chat widget node data
export interface ChatWidgetNodeData {
  name?: string;
  linkedKnowledgeBase: string | null;
  linkedKnowledgeBaseName?: string | null;
  config?: {
    welcomeMessage?: string;
    widgetTitle?: string;
  };
  messages?: Array<{
    sender: 'user' | 'bot';
    text: string;
    timestamp?: string | Date;
  }>;
  width?: number;
  height?: number;
}

// Edge connecting nodes
export interface Edge {
  id: string;
  source: string;
  target: string;
  // Optional fields for advanced edge features
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

// Position type for coordinates
export interface Position {
  x: number;
  y: number;
}

// Port/handle type for connections
export interface Port {
  id: string;
  type: 'source' | 'target';
  position: 'left' | 'right' | 'top' | 'bottom';
}