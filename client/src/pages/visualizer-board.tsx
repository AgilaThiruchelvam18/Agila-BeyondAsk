import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Canvas, Node, Edge } from '@/components/customflow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Save, 
  Loader2,
  Network 
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

export default function VisualizerBoard() {
  const { id } = useParams<{ id: string }>();
  const boardId = parseInt(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [boardName, setBoardName] = useState<string>('');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load board data on initial load
  useEffect(() => {
    if (isNaN(boardId)) {
      toast({
        title: 'Invalid Board ID',
        description: 'The board ID is not valid.',
        variant: 'destructive',
      });
      setLocation('/visualizer-boards');
      return;
    }

    fetchBoardData();
  }, [boardId]);

  const fetchBoardData = async () => {
    setIsLoading(true);
    try {
      // Try new endpoint first
      const response = await fetch(`/api/visualizer/${boardId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBoardName(data.name);
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      } else {
        // Fall back to legacy endpoint
        const legacyResponse = await fetch(`/api/knowledgeflow/${boardId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        });

        if (legacyResponse.ok) {
          const data = await legacyResponse.json();
          setBoardName(data.name);
          setNodes(data.nodes || []);
          setEdges(data.edges || []);
        } else {
          throw new Error('Failed to fetch board data');
        }
      }
    } catch (error) {
      console.error('Error loading board data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load visualizer board data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle nodes changes
  const handleNodesChange = (updatedNodes: Node[]) => {
    setNodes(updatedNodes);
  };

  // Handle edges changes
  const handleEdgesChange = (updatedEdges: Edge[]) => {
    setEdges(updatedEdges);
  };

  // Save current state to backend
  const handleSave = async () => {
    if (isNaN(boardId)) return;

    if (!boardName || boardName.trim() === '') {
      toast({
        title: 'Missing board name',
        description: 'Please provide a name for your board before saving.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: boardName,
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        description: ''
      };

      console.log('Saving board with payload:', payload);

      // Try the new endpoint first
      let saveSuccessful = false;
      try {
        const response = await fetch(`/api/visualizer/${boardId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          saveSuccessful = true;
        } else {
          console.log('New endpoint failed, trying legacy endpoint');
        }
      } catch (error) {
        console.log('Error with new endpoint:', error);
      }

      // If the new endpoint failed, try the legacy endpoint
      if (!saveSuccessful) {
        const legacyResponse = await fetch(`/api/knowledgeflow/${boardId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: JSON.stringify(payload),
        });

        if (legacyResponse.ok) {
          saveSuccessful = true;
        } else {
          const errorData = await legacyResponse.json();
          throw new Error(errorData.message || 'Failed to save board');
        }
      }

      if (saveSuccessful) {
        toast({
          title: 'Board saved',
          description: 'Your visualizer board has been saved successfully.',
        });
      }
    } catch (error) {
      console.error('Error saving board:', error);
      toast({
        title: 'Error saving board',
        description: (error instanceof Error ? error.message : 'There was a problem saving your visualizer board.'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-screen w-screen">
      <div className="flex flex-col h-full">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 relative">
            <Canvas
              initialNodes={nodes}
              initialEdges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              boardName={boardName}
              onBoardNameChange={(name) => setBoardName(name)}
              onSave={handleSave}
              onBack={() => setLocation('/visualizer-boards')}
              isSaving={isSaving}
              boardId={boardId}
            />
          </div>
        )}
      </div>
    </div>
  );
}