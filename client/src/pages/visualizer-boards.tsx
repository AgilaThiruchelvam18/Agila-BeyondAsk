import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Plus, 
  Edit, 
  Trash, 
  Loader2,
  Network
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  DialogDescription,
  DialogHeader,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { type VisualizerBoard } from '@shared/schema';

export default function VisualizerBoards() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [boards, setBoards] = useState<VisualizerBoard[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [boardToDelete, setBoardToDelete] = useState<number | null>(null);
  const [newBoardName, setNewBoardName] = useState<string>('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  useEffect(() => {
    // Fetch all visualizer boards
    fetchBoards();
  }, []);

  const fetchBoards = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/visualizer/all', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setBoards(data);
      } else {
        // Fall back to legacy endpoint if new endpoint fails
        const legacyResponse = await fetch('/api/knowledgeflow/all', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        });
        
        if (legacyResponse.ok) {
          const data = await legacyResponse.json();
          setBoards(data);
        } else {
          throw new Error('Failed to fetch visualizer boards');
        }
      }
    } catch (error) {
      console.error('Error loading visualizer boards:', error);
      toast({
        title: 'Error',
        description: 'Failed to load visualizer boards.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditBoard = (boardId: number) => {
    setLocation(`/visualizer-board/${boardId}`);
  };

  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) {
      toast({
        title: 'Invalid Input',
        description: 'Please enter a name for your new board.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/visualizer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          name: newBoardName,
          nodes: [],
          edges: []
        }),
      });

      if (response.ok) {
        const newBoard = await response.json();
        setIsCreateDialogOpen(false);
        setNewBoardName('');
        toast({
          title: 'Success',
          description: 'New visualizer board created successfully.',
        });
        // Navigate to the new board for editing
        setLocation(`/visualizer-board/${newBoard.id}`);
      } else {
        throw new Error('Failed to create visualizer board');
      }
    } catch (error) {
      console.error('Error creating visualizer board:', error);
      toast({
        title: 'Error',
        description: 'Failed to create new visualizer board.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteBoard = async () => {
    if (!boardToDelete) return;

    try {
      const response = await fetch(`/api/visualizer/${boardToDelete}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (response.ok) {
        // Remove the deleted board from state
        setBoards(boards.filter(board => board.id !== boardToDelete));
        toast({
          title: 'Success',
          description: 'Visualizer board deleted successfully.',
        });
      } else {
        // Try legacy endpoint if new one fails
        const legacyResponse = await fetch(`/api/knowledgeflow/${boardToDelete}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        });
        
        if (legacyResponse.ok) {
          setBoards(boards.filter(board => board.id !== boardToDelete));
          toast({
            title: 'Success',
            description: 'Visualizer board deleted successfully.',
          });
        } else {
          throw new Error('Failed to delete visualizer board');
        }
      }
    } catch (error) {
      console.error('Error deleting visualizer board:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete visualizer board.',
        variant: 'destructive',
      });
    } finally {
      setBoardToDelete(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        <PageHeader 
          title="Visualizer Boards" 
          description="Create and manage your visualizer boards"
        >
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Board
          </Button>
        </PageHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {isLoading ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : boards.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-12 border rounded-lg bg-slate-50">
              <Network className="h-16 w-16 text-slate-300 mb-4" />
              <h3 className="text-xl font-medium text-slate-700">No Visualizer Boards Yet</h3>
              <p className="text-slate-500 mb-6 max-w-md text-center mt-2">
                Create your first visualizer board to start mapping your knowledge bases to chat widgets.
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Board
              </Button>
            </div>
          ) : (
            boards.map((board) => (
              <Card key={board.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{board.name}</CardTitle>
                  <CardDescription>
                    Created {new Date(board.createdAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="h-24 flex items-center justify-center bg-slate-50 rounded-md">
                    <Network className="h-12 w-12 text-slate-300" />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setBoardToDelete(board.id)}
                  >
                    <Trash className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => handleEditBoard(board.id)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Create Board Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Visualizer Board</DialogTitle>
            <DialogDescription>
              Create a new board to connect your knowledge bases to chat widgets.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                className="col-span-3"
                placeholder="My Knowledge Flow"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={handleCreateBoard}
              disabled={isCreating}
            >
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={boardToDelete !== null} 
        onOpenChange={(open) => !open && setBoardToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this visualizer board and all its connections.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteBoard}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}