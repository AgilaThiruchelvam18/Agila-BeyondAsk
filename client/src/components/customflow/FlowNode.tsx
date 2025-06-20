// This is a wrapper component that renders the appropriate node component based on the node type
import React, { memo } from 'react';
import { Node } from './types';
import KnowledgeBaseNode from './KnowledgeBaseNode';
import ChatWidgetNode from './ChatWidgetNode';

interface FlowNodeProps {
  node: Node;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onPortMouseDown: (e: React.MouseEvent, nodeId: string, handle?: string) => void;
  onResizeStart: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: () => void;
  isReadOnly?: boolean;
  connectedKnowledgeBases?: Node[];
  boardId?: number;
}

// This component dynamically renders either a KnowledgeBaseNode or ChatWidgetNode
// based on the node's type
const FlowNode: React.FC<FlowNodeProps> = ({ 
  node, 
  selected, 
  onMouseDown, 
  onMouseEnter, 
  onMouseLeave, 
  onPortMouseDown, 
  onResizeStart, 
  onDelete, 
  isReadOnly = false,
  connectedKnowledgeBases = [],
  boardId
}) => {
  if (node.type === 'knowledgebase') {
    return (
      <KnowledgeBaseNode
        node={node}
        selected={selected}
        onMouseDown={onMouseDown}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onPortMouseDown={onPortMouseDown}
        onResizeStart={onResizeStart}
        onDelete={onDelete}
        isReadOnly={isReadOnly}
      />
    );
  } 
  
  if (node.type === 'chat') {
    return (
      <ChatWidgetNode
        node={node}
        selected={selected}
        onMouseDown={onMouseDown}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onPortMouseDown={onPortMouseDown}
        onResizeStart={onResizeStart}
        onDelete={onDelete}
        isReadOnly={isReadOnly}
        connectedKnowledgeBases={connectedKnowledgeBases}
        boardId={boardId || 0}
      />
    );
  }
  
  // Fallback for unknown node types
  return null;
};

export default memo(FlowNode);