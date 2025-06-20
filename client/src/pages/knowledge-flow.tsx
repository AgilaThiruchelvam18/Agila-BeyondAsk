import React, { useState, useEffect } from 'react';
import { Canvas, Node, Edge } from '@/components/customflow';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Play } from 'lucide-react';
import { Link } from 'wouter';

export default function CustomFlowTest() {
  const { toast } = useToast();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Load saved state from localStorage on initial load
  useEffect(() => {
    const savedNodes = localStorage.getItem('customflow-nodes');
    const savedEdges = localStorage.getItem('customflow-edges');
    
    if (savedNodes) {
      try {
        setNodes(JSON.parse(savedNodes));
      } catch (error) {
        console.error('Failed to parse saved nodes:', error);
      }
    }
    
    if (savedEdges) {
      try {
        setEdges(JSON.parse(savedEdges));
      } catch (error) {
        console.error('Failed to parse saved edges:', error);
      }
    }
  }, []);
  
  // Handle nodes changes
  const handleNodesChange = (updatedNodes: Node[]) => {
    setNodes(updatedNodes);
  };
  
  // Handle edges changes
  const handleEdgesChange = (updatedEdges: Edge[]) => {
    setEdges(updatedEdges);
  };
  
  // Save current state to localStorage
  const handleSave = () => {
    setIsSaving(true);
    
    try {
      localStorage.setItem('customflow-nodes', JSON.stringify(nodes));
      localStorage.setItem('customflow-edges', JSON.stringify(edges));
      
      toast({
        title: 'Flow saved',
        description: 'Your flow has been saved successfully.',
      });
    } catch (error) {
      console.error('Failed to save flow:', error);
      toast({
        title: 'Error saving flow',
        description: 'There was a problem saving your flow.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Clear the canvas
  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the canvas? This action cannot be undone.')) {
      setNodes([]);
      setEdges([]);
      localStorage.removeItem('customflow-nodes');
      localStorage.removeItem('customflow-edges');
      
      toast({
        title: 'Canvas cleared',
        description: 'All nodes and connections have been removed.',
      });
    }
  };
  
  return (
    <div className="container mx-auto py-4 h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Link href="/knowledge-flow">
            <Button variant="ghost" size="icon" className="mr-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Custom Flow Builder (Test)</h1>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleClear}
          >
            Clear Canvas
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleSave} 
            disabled={isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Flow
          </Button>
          
          <Button>
            <Play className="h-4 w-4 mr-2" />
            Create Flow
          </Button>
        </div>
      </div>
      
      {/* Canvas Container */}
      <div className="flex-grow border rounded-lg overflow-hidden bg-slate-50">
        <Canvas
          initialNodes={nodes}
          initialEdges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
        />
      </div>
      
      {/* Stats Footer */}
      <div className="mt-4 text-sm text-gray-500">
        <p>Nodes: {nodes.length} | Connections: {edges.length}</p>
      </div>
    </div>
  );
}