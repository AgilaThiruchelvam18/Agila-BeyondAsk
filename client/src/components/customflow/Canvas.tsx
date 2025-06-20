import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Node, Edge, Position } from './types';
import { Plus, Database, MessageSquare, Link2, Loader2, Save, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import KnowledgeBaseNode from './KnowledgeBaseNode';
import ChatWidgetNode from './ChatWidgetNode';
import CreateKnowledgeBaseDialog from './CreateKnowledgeBaseDialog';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

interface CanvasProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  readOnly?: boolean;
  boardName?: string;
  onBoardNameChange?: (name: string) => void;
  onSave?: () => void;
  onBack?: () => void;
  isSaving?: boolean;
  boardId?: number;
}

const Canvas: React.FC<CanvasProps> = ({
  initialNodes = [],
  initialEdges = [],
  onNodesChange,
  onEdgesChange,
  readOnly = false,
  boardName = '',
  onBoardNameChange = () => {},
  onSave = () => {},
  onBack = () => {},
  isSaving = false,
  boardId
}) => {
  const { toast } = useToast();
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [draggingEdge, setDraggingEdge] = useState<{
    source: string;
    sourceHandle?: string;
  } | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [resizingNode, setResizingNode] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<Position>({ x: 0, y: 0 });
  const [nextNodeId, setNextNodeId] = useState<number>(
    Math.max(
      1,
      ...initialNodes.map(node => {
        const idNum = parseInt(node.id.split('-')[1] || '0', 10);
        return isNaN(idNum) ? 0 : idNum;
      })
    ) + 1
  );
  
  // Knowledge base dialog states
  const [showKnowledgeBaseImportDialog, setShowKnowledgeBaseImportDialog] = useState(false);
  const [showCreateKnowledgeBaseDialog, setShowCreateKnowledgeBaseDialog] = useState(false);
  const [availableKnowledgeBases, setAvailableKnowledgeBases] = useState<any[]>([]);
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<string>('');
  const [isImportLoading, setIsImportLoading] = useState(false);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Create a ref to track the current mouse position for edge dragging
  const currentMousePosition = useRef<{x: number, y: number}>({x: 0, y: 0});
  
  // Define the getConnectedKnowledgeBases function early to avoid reference issues
  const getConnectedKnowledgeBases = useCallback((chatNodeId: string) => {
    return edges
      .filter(edge => edge.target === chatNodeId)
      .map(edge => nodes.find(n => n.id === edge.source))
      .filter((node): node is Node => node !== undefined && node.type === 'knowledgebase');
  }, [edges, nodes]);
  
  // Fetch available knowledge bases for import
  const fetchAvailableKnowledgeBases = useCallback(async () => {
    try {
      setIsImportLoading(true);
      const response = await fetch('/api/knowledge-bases', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      
      if (response.ok) {
        const knowledgeBases = await response.json();
        setAvailableKnowledgeBases(knowledgeBases);
      } else {
        console.error('Failed to fetch knowledge bases');
        toast({
          title: 'Error',
          description: 'Failed to fetch knowledge bases',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching knowledge bases:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch knowledge bases',
        variant: 'destructive',
      });
    } finally {
      setIsImportLoading(false);
    }
  }, [toast]);

  // Import a knowledge base as a node
  const importKnowledgeBase = useCallback(() => {
    if (!selectedKnowledgeBaseId) return;
    
    const selectedKB = availableKnowledgeBases.find(kb => kb.id.toString() === selectedKnowledgeBaseId);
    if (!selectedKB) return;
      
    // Create a new node for the imported knowledge base
    const id = `knowledgebase-${nextNodeId}`;
    
    // Get canvas center position with offset
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const centerX = (canvasRect?.width || 800) / 2 - 100;
    const centerY = (canvasRect?.height || 600) / 2 - 100;
    
    const newNode: Node = {
      id,
      type: 'knowledgebase',
      position: { x: centerX, y: centerY },
      size: { width: 250, height: 200 },
      data: {
        id: selectedKB.id,
        name: selectedKB.name,
        description: selectedKB.description || '',
        documents: selectedKB.documents || [],
        width: 250,
        height: 200
      }
    };
    
    setNodes([...nodes, newNode]);
    setNextNodeId(nextNodeId + 1);
    setSelectedKnowledgeBaseId('');
    setShowKnowledgeBaseImportDialog(false);
    
    toast({
      title: "Knowledge base imported",
      description: `Imported "${selectedKB.name}" knowledge base`
    });
  }, [availableKnowledgeBases, nextNodeId, nodes, selectedKnowledgeBaseId, toast]);
  
  // Update canvas position on scroll or resize
  useEffect(() => {
    const updateCanvasPosition = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        canvasPosition.current = { x: rect.left, y: rect.top };
      }
    };
    
    updateCanvasPosition();
    
    window.addEventListener('scroll', updateCanvasPosition);
    window.addEventListener('resize', updateCanvasPosition);
    
    return () => {
      window.removeEventListener('scroll', updateCanvasPosition);
      window.removeEventListener('resize', updateCanvasPosition);
    };
  }, []);
  
  // Update parent components when nodes or edges change
  useEffect(() => {
    if (onNodesChange) {
      onNodesChange(nodes);
    }
  }, [nodes, onNodesChange]);
  
  useEffect(() => {
    if (onEdgesChange) {
      onEdgesChange(edges);
    }
  }, [edges, onEdgesChange]);
  
  // Handle node dragging
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (readOnly) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    
    setDraggedNode(nodeId);
    setDragOffset({
      x: e.clientX - node.position.x,
      y: e.clientY - node.position.y
    });
  }, [nodes, readOnly]);
  
  // Handle mouse movement for dragging and edge creation
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (readOnly) return;
    
    // Update mouse position tracking for edge drawing
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      currentMousePosition.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
    
    // Handle node dragging
    if (draggedNode) {
      const updatedNodes = nodes.map(node => {
        if (node.id === draggedNode) {
          return {
            ...node,
            position: {
              x: e.clientX - dragOffset.x,
              y: e.clientY - dragOffset.y
            }
          };
        }
        return node;
      });
      
      setNodes(updatedNodes);
    }
    
    // Handle node resizing
    if (resizingNode) {
      const node = nodes.find(n => n.id === resizingNode);
      if (!node) return;
      
      // Calculate new size with minimum constraints
      const newWidth = Math.max(200, node.size.width + (e.clientX - resizeStart.x));
      const newHeight = Math.max(150, node.size.height + (e.clientY - resizeStart.y));
      
      const updatedNodes = nodes.map(n => {
        if (n.id === resizingNode) {
          return {
            ...n,
            size: { width: newWidth, height: newHeight },
            data: {
              ...n.data,
              width: newWidth,
              height: newHeight
            }
          };
        }
        return n;
      });
      
      setNodes(updatedNodes);
      setResizeStart({ x: e.clientX, y: e.clientY });
    }
  }, [draggedNode, dragOffset, nodes, readOnly, resizingNode, resizeStart]);
  
  // Handle mouse up for all interactions
  const handleMouseUp = useCallback(() => {
    if (readOnly) return;
    
    // Restore text selection
    document.body.style.userSelect = '';
    
    // Create edge if we were dragging one and hovering over a valid target
    if (draggingEdge && hoveredNode) {
      const { source } = draggingEdge;
      const target = hoveredNode;
      
      // Prevent self-connections
      if (source !== target) {
        const sourceNode = nodes.find(n => n.id === source);
        const targetNode = nodes.find(n => n.id === target);
        
        if (sourceNode && targetNode) {
          // Check for valid connections
          const isValidConnection = (
            // Either KB -> Chat
            (sourceNode.type === 'knowledgebase' && targetNode.type === 'chat') ||
            // Or Chat -> KB
            (sourceNode.type === 'chat' && targetNode.type === 'knowledgebase')
          );
          
          // Prevent duplicate connections
          const isDuplicate = edges.some(
            edge => edge.source === source && edge.target === target
          );
          
          if (isValidConnection && !isDuplicate) {
            const newEdge: Edge = {
              id: `${source}-${target}`,
              source,
              target
            };
            
            setEdges([...edges, newEdge]);
            
            toast({
              title: "Connection created",
              description: `Successfully connected ${sourceNode.type} to ${targetNode.type}`,
            });
          } else if (isDuplicate) {
            toast({
              title: "Connection already exists",
              description: "These nodes are already connected.",
              variant: "destructive"
            });
          } else {
            toast({
              title: "Invalid connection",
              description: "This connection type is not supported.",
              variant: "destructive"
            });
          }
        }
      }
    }
    
    // Reset all interaction states
    setDraggedNode(null);
    setDraggingEdge(null);
    setHoveredNode(null);
    setResizingNode(null);
  }, [draggingEdge, edges, hoveredNode, nodes, readOnly, toast]);
  
  // Start resizing a node
  const handleResizeStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (readOnly) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    document.body.style.userSelect = 'none';
    
    setResizingNode(nodeId);
    setResizeStart({ x: e.clientX, y: e.clientY });
  }, [readOnly]);
  
  // Start creating an edge from a node port
  const handlePortMouseDown = useCallback((e: React.MouseEvent, nodeId: string, handle?: string) => {
    if (readOnly) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    document.body.style.userSelect = 'none';
    
    setDraggingEdge({
      source: nodeId,
      sourceHandle: handle
    });
  }, [readOnly]);
  
  // Track when mouse enters a node (for edge targeting)
  const handleNodeMouseEnter = useCallback((nodeId: string) => {
    setHoveredNode(nodeId);
  }, []);
  
  // Track when mouse leaves a node
  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);
  
  // Add a new node to the canvas
  const addNode = useCallback((type: 'knowledgebase' | 'chat') => {
    const id = `${type}-${nextNodeId}`;
    
    // Get canvas center position with offset
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const centerX = (canvasRect?.width || 800) / 2 - 100;
    const centerY = (canvasRect?.height || 600) / 2 - 100;
    
    const newNode: Node = {
      id,
      type,
      position: { x: centerX, y: centerY },
      size: type === 'knowledgebase' 
        ? { width: 250, height: 200 } 
        : { width: 350, height: 300 },
      data: type === 'knowledgebase' 
        ? {
            name: `Knowledge Base ${nextNodeId}`,
            description: 'New knowledge base',
            documents: [],
            width: 250,
            height: 200
          }
        : {
            name: `Chat Window ${nextNodeId}`,
            linkedKnowledgeBase: null,
            linkedKnowledgeBaseName: null,
            config: {
              welcomeMessage: 'How can I help you today?',
              widgetTitle: `Chat Window ${nextNodeId}`
            },
            messages: [],
            width: 350,
            height: 300
          }
    };
    
    setNodes([...nodes, newNode]);
    setNextNodeId(nextNodeId + 1);
    
    toast({
      title: "Node created",
      description: `Created new ${type} node`
    });
  }, [nextNodeId, nodes, toast]);
  
  // Delete a node and its connected edges
  const deleteNode = useCallback((nodeId: string) => {
    if (readOnly) return;
    
    // Remove the node
    const updatedNodes = nodes.filter(node => node.id !== nodeId);
    
    // Remove all connected edges
    const updatedEdges = edges.filter(
      edge => edge.source !== nodeId && edge.target !== nodeId
    );
    
    setNodes(updatedNodes);
    setEdges(updatedEdges);
    
    toast({
      title: "Node deleted", 
      description: "Node and all its connections were removed"
    });
  }, [edges, nodes, readOnly, toast]);
  
  // Delete an edge
  const deleteEdge = useCallback((edgeId: string) => {
    if (readOnly) return;
    
    setEdges(edges.filter(edge => edge.id !== edgeId));
    
    toast({
      title: "Connection removed",
      description: "The connection between nodes was removed"
    });
  }, [edges, readOnly, toast]);
  
  // Render the nodes - directly render components based on type
  const renderNodes = useCallback(() => {
    return nodes.map(node => {
      if (node.type === 'knowledgebase') {
        return (
          <KnowledgeBaseNode
            key={node.id}
            node={node}
            selected={draggedNode === node.id}
            onMouseDown={handleNodeMouseDown}
            onMouseEnter={() => handleNodeMouseEnter(node.id)}
            onMouseLeave={handleNodeMouseLeave}
            onPortMouseDown={handlePortMouseDown}
            onResizeStart={handleResizeStart}
            onDelete={() => deleteNode(node.id)}
            isReadOnly={readOnly}
          />
        );
      } else if (node.type === 'chat') {
        return (
          <ChatWidgetNode
            key={node.id}
            node={node}
            selected={draggedNode === node.id}
            onMouseDown={handleNodeMouseDown}
            onMouseEnter={() => handleNodeMouseEnter(node.id)}
            onMouseLeave={handleNodeMouseLeave}
            onPortMouseDown={handlePortMouseDown}
            onResizeStart={handleResizeStart}
            onDelete={() => deleteNode(node.id)}
            isReadOnly={readOnly}
            connectedKnowledgeBases={getConnectedKnowledgeBases(node.id)}
            boardId={boardId as number}
          />
        );
      }
      return null;
    });
  }, [nodes, draggedNode, readOnly, handleNodeMouseDown, handleNodeMouseEnter, 
      handleNodeMouseLeave, handlePortMouseDown, handleResizeStart, deleteNode,
      getConnectedKnowledgeBases]);
  
  // Render edges between nodes
  const renderEdges = () => {
    return edges.map(edge => {
      const source = nodes.find(n => n.id === edge.source);
      const target = nodes.find(n => n.id === edge.target);
      
      if (!source || !target) return null;
      
      // Calculate connection points based on node positions and types
      let sourcePos: Position, targetPos: Position;
      
      if (source.type === 'knowledgebase' && target.type === 'chat') {
        // KB -> Chat: connect from right of KB to left of Chat
        sourcePos = {
          x: source.position.x + source.size.width,
          y: source.position.y + source.size.height / 2
        };
        
        targetPos = {
          x: target.position.x,
          y: target.position.y + target.size.height / 2
        };
      } else if (source.type === 'chat' && target.type === 'knowledgebase') {
        // Chat -> KB: connect from left of Chat to right of KB
        sourcePos = {
          x: source.position.x,
          y: source.position.y + source.size.height / 2
        };
        
        targetPos = {
          x: target.position.x + target.size.width,
          y: target.position.y + target.size.height / 2
        };
      } else {
        // Fallback case
        sourcePos = {
          x: source.position.x + source.size.width / 2,
          y: source.position.y + source.size.height / 2
        };
        
        targetPos = {
          x: target.position.x + target.size.width / 2,
          y: target.position.y + target.size.height / 2
        };
      }
      
      // Calculate distance for curve control
      const dx = targetPos.x - sourcePos.x;
      const dy = targetPos.y - sourcePos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Control points for the cubic Bezier curve - standard curvature
      const cp1x = sourcePos.x + dx * 0.3;
      // Use a more subtle, standard curve similar to other applications
      const curveIntensity = Math.min(40, distance * 0.15);
      const cp1y = sourcePos.y - curveIntensity;
      const cp2x = targetPos.x - dx * 0.3;
      const cp2y = targetPos.y - curveIntensity;
      
      // Create path for the curve
      const path = `M ${sourcePos.x} ${sourcePos.y} 
                    C ${cp1x} ${cp1y},
                      ${cp2x} ${cp2y},
                      ${targetPos.x} ${targetPos.y}`;
      
      // Calculate midpoint for the delete button
      const t = 0.5; // parameter value for midpoint
      const mt = 1 - t;
      const midPoint = {
        x: mt*mt*mt*sourcePos.x + 3*mt*mt*t*cp1x + 3*mt*t*t*cp2x + t*t*t*targetPos.x,
        y: mt*mt*mt*sourcePos.y + 3*mt*mt*t*cp1y + 3*mt*t*t*cp2y + t*t*t*targetPos.y
      };
      
      return (
        <g key={edge.id} className="edge">
          {/* Edge path */}
          <path
            d={path}
            fill="none"
            stroke="#6366f1" 
            strokeWidth="2"
            strokeDasharray={draggingEdge ? "5,5" : "none"}
            className="edge-path"
          />
          
          {/* Edge delete button */}
          {!readOnly && (
            <g
              className="edge-button"
              transform={`translate(${midPoint.x - 8}, ${midPoint.y - 8})`}
              style={{ cursor: 'pointer', pointerEvents: 'all' }}
            >
              <circle 
                r="10" 
                fill="#6366f1" 
                onClick={(e) => {
                  e.stopPropagation();
                  deleteEdge(edge.id);
                }}
              />
              <path
                d="M -5,-5 L 5,5 M -5,5 L 5,-5"
                stroke="white"
                strokeWidth="2"
                pointerEvents="none"
              />
            </g>
          )}
        </g>
      );
    });
  };
  
  // Render a dragging edge during edge creation
  const renderDraggingEdge = () => {
    if (!draggingEdge) return null;
    
    const sourceNode = nodes.find(n => n.id === draggingEdge.source);
    if (!sourceNode) return null;
    
    // Get mouse position relative to canvas from our tracked position
    const mouseX = currentMousePosition.current.x;
    const mouseY = currentMousePosition.current.y;
    
    // Source position based on node type and handle
    let sourceX, sourceY;
    
    if (sourceNode.type === 'knowledgebase') {
      // For knowledge base nodes, connection comes from right side
      sourceX = sourceNode.position.x + sourceNode.size.width;
      sourceY = sourceNode.position.y + sourceNode.size.height / 2;
    } else {
      // For Chat Window nodes, connection comes from left side
      sourceX = sourceNode.position.x;
      sourceY = sourceNode.position.y + sourceNode.size.height / 2;
    }
    
    // Use bezier curve for smoother edge
    const dx = mouseX - sourceX;
    const dy = mouseY - sourceY;
    
    // Control points for the curve
    const cp1x = sourceX + dx * 0.25;
    const cp1y = sourceY + dy * 0.25;
    const cp2x = mouseX - dx * 0.25;
    const cp2y = mouseY - dy * 0.25;
    
    // Create curved path
    const path = `M ${sourceX} ${sourceY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${mouseX} ${mouseY}`;
    
    return (
      <path
        d={path}
        fill="none"
        stroke="#6366f1"
        strokeWidth="2"
        strokeDasharray="5,5"
        className="dragging-edge"
      />
    );
  };
  
  // Open the knowledge base import dialog with prefetched data
  const openKnowledgeBaseImportDialog = useCallback(() => {
    fetchAvailableKnowledgeBases();
    setShowKnowledgeBaseImportDialog(true);
  }, [fetchAvailableKnowledgeBases]);
  
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap gap-2 p-3 border-b bg-slate-50">
          <div className="flex items-center gap-2 mr-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onBack}
              className="flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <Input
              value={boardName}
              onChange={(e) => onBoardNameChange(e.target.value)}
              className="w-48 sm:w-64 font-bold flex-shrink-0"
              placeholder="Board Name"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={() => addNode('chat')} variant="outline" size="sm" className="flex items-center">
              <MessageSquare className="h-4 w-4 mr-2" />
              Add Chat Window
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={openKnowledgeBaseImportDialog} variant="default" size="sm" className="flex items-center">
              <Database className="h-4 w-4 mr-2" />
              Import Knowledge Base
            </Button>
            
            <Button 
              onClick={() => setShowCreateKnowledgeBaseDialog(true)} 
              variant="outline" 
              size="sm" 
              className="flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Knowledge Base
            </Button>
          </div>
          
          <div className="ml-auto flex items-center gap-2">        
            <Button 
              onClick={onSave} 
              disabled={isSaving}
              size="sm"
              className="ml-4"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Board
            </Button>
          </div>
        </div>
      )}
      
      {/* Knowledge Base Creation Dialog */}
      <CreateKnowledgeBaseDialog 
        isOpen={showCreateKnowledgeBaseDialog} 
        onOpenChange={setShowCreateKnowledgeBaseDialog} 
        onSuccess={(newKnowledgeBase) => {
          // Refresh available knowledge bases list
          fetchAvailableKnowledgeBases();
          
          // Create a new knowledge base node with the newly created knowledge base
          const newNodeId = `kb-${nextNodeId}`;
          const newNode: Node = {
            id: newNodeId,
            type: 'knowledgebase',
            position: { x: 100, y: 100 },
            size: { width: 300, height: 150 },
            data: {
              name: newKnowledgeBase.name,
              id: newKnowledgeBase.id,
              documents: []  // Adding required documents array property
            }
          };
          
          // Add the new node to the graph
          const updatedNodes = [...nodes, newNode];
          setNodes(updatedNodes);
          onNodesChange?.(updatedNodes);
          
          // Increment the node ID counter
          setNextNodeId(nextNodeId + 1);
          
          toast({
            title: "Knowledge Base Added",
            description: `Added ${newKnowledgeBase.name} to the flow.`,
          });
        }}
      />
      
      {/* Knowledge Base Import Dialog */}
      <Dialog open={showKnowledgeBaseImportDialog} onOpenChange={setShowKnowledgeBaseImportDialog} >
        <DialogContent >
          <DialogHeader>
            <DialogTitle>Import Existing Knowledge Base</DialogTitle>
            <DialogDescription>
              Select from your existing knowledge bases to use in this flow
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {isImportLoading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              </div>
            ) : (
              <>
                {availableKnowledgeBases.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <Database className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p>No knowledge bases found</p>
                    <p className="text-xs mt-1">Create knowledge bases in the main app first</p>
                  </div>
                ) : (
                  <div className="space-y-4 relative z-10">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select Knowledge Base</label>
                      <Select 
                        value={selectedKnowledgeBaseId} 
                        onValueChange={setSelectedKnowledgeBaseId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a knowledge base" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableKnowledgeBases.map(kb => (
                            <SelectItem key={kb.id} value={kb.id.toString()}>
                              {kb.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {selectedKnowledgeBaseId && (
                      <div className="bg-gray-50 p-3 rounded-md border">
                        <h4 className="text-sm font-medium mb-1">
                          {availableKnowledgeBases.find(kb => kb.id.toString() === selectedKnowledgeBaseId)?.name}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {availableKnowledgeBases.find(kb => kb.id.toString() === selectedKnowledgeBaseId)?.description || 
                            'No description available'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKnowledgeBaseImportDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={importKnowledgeBase} 
              disabled={!selectedKnowledgeBaseId || isImportLoading}
            >
              Import Knowledge Base
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative flex-grow bg-slate-50 border overflow-auto"
        style={{ minHeight: '600px', height: 'calc(100vh - 200px)' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grid pattern (optional) */}
        <svg width="100%" height="100%" className="absolute top-0 left-0 pointer-events-none">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#eee" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        
        {/* SVG layer for edges */}
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
          {renderEdges()}
          {renderDraggingEdge()}
        </svg>
        
        {/* Nodes */}
        <div className="nodes-container">
          {renderNodes()}
        </div>
        
        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            <Plus size={48} strokeWidth={1} />
            <p className="mt-2 text-sm">Add nodes to create your knowledge flow</p>
            {!readOnly && (
              <div className="flex gap-2 mt-4">
                <Button onClick={() => addNode('knowledgebase')} variant="outline" size="sm">
                  <Database className="h-4 w-4 mr-2" />
                  Add Knowledge Base
                </Button>
                <Button onClick={() => addNode('chat')} variant="outline" size="sm">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Add Chat Window
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Canvas;