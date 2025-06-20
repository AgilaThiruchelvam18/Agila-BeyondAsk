import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { queryClient, apiRequest } from '@/lib/queryClient';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import { Loader } from 'lucide-react';
import DashboardLayout from '@/components/layouts/dashboard-layout';

interface Namespace {
  name: string;
  vectorCount: number;
}

interface Vector {
  id: string;
  score?: number;
  metadata?: {
    text?: string;
    userId?: number;
    knowledgeBaseId?: number;
    documentId?: string;
    [key: string]: any;
  };
}

const PineconeExplorer = () => {
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editVectorId, setEditVectorId] = useState<string | null>(null);
  const [editVectorText, setEditVectorText] = useState<string>('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Fetch namespaces
  const { data: namespaces, isLoading: namespacesLoading } = useQuery<Namespace[]>({
    queryKey: ['/api/pinecone/namespaces'],
    enabled: true,
  });

  // Fetch vectors based on selected namespace
  const { 
    data: vectors, 
    isLoading: vectorsLoading,
    refetch: refetchVectors,
    isError: vectorsError,
    error: vectorsErrorDetail
  } = useQuery<Vector[]>({
    queryKey: ['/api/pinecone/vectors', selectedNamespace],
    enabled: !!selectedNamespace,
  });

  // Search vectors based on query
  const { 
    data: searchResults,
    isLoading: searchLoading,
    refetch: refetchSearch,
    isError: searchError
  } = useQuery<Vector[]>({
    queryKey: ['/api/pinecone/search', selectedNamespace, searchQuery],
    enabled: !!selectedNamespace && !!searchQuery,
  });

  // Update vector mutation
  const updateVectorMutation = useMutation({
    mutationFn: (variables: { id: string, text: string, namespace: string }) => {
      return apiRequest('/api/pinecone/vectors', {
        method: 'PUT',
        data: variables,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pinecone/vectors', selectedNamespace] });
      queryClient.invalidateQueries({ queryKey: ['/api/pinecone/search', selectedNamespace, searchQuery] });
      toast({
        title: 'Vector updated',
        description: 'The vector has been successfully updated.',
      });
      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Error updating vector',
        description: `Failed to update vector: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    },
  });

  // Delete vector mutation
  const deleteVectorMutation = useMutation({
    mutationFn: (variables: { id: string, namespace: string }) => {
      return apiRequest('/api/pinecone/vectors', {
        method: 'DELETE',
        data: variables,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pinecone/vectors', selectedNamespace] });
      queryClient.invalidateQueries({ queryKey: ['/api/pinecone/search', selectedNamespace, searchQuery] });
      toast({
        title: 'Vector deleted',
        description: 'The vector has been successfully deleted.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error deleting vector',
        description: `Failed to delete vector: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    },
  });

  // Open edit dialog with vector data
  const handleEdit = (vector: Vector) => {
    setEditVectorId(vector.id);
    setEditVectorText(vector.metadata?.text || '');
    setEditDialogOpen(true);
  };

  // Handle update submission
  const handleUpdate = () => {
    if (editVectorId && editVectorText && selectedNamespace) {
      updateVectorMutation.mutate({
        id: editVectorId,
        text: editVectorText,
        namespace: selectedNamespace,
      });
    }
  };

  // Handle delete confirmation
  const handleDelete = (vectorId: string) => {
    if (confirm('Are you sure you want to delete this vector? This action cannot be undone.')) {
      deleteVectorMutation.mutate({
        id: vectorId,
        namespace: selectedNamespace,
      });
    }
  };

  // Determine which vectors to display
  const displayVectors = searchQuery && !searchLoading ? searchResults : vectors;

  // Helper to display a limited preview of text content
  const textPreview = (text?: string, limit: number = 100) => {
    if (!text) return 'No text content';
    return text.length > limit ? `${text.substring(0, limit)}...` : text;
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Pinecone Explorer</h1>
        
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Vector Database Controls</CardTitle>
            <CardDescription>
              Browse and search vectors stored in your Pinecone database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Namespace</label>
                <Select
                  value={selectedNamespace}
                  onValueChange={(value) => {
                    setSelectedNamespace(value);
                    setSearchQuery(''); // Clear search when changing namespace
                  }}
                  disabled={namespacesLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a namespace" />
                  </SelectTrigger>
                  <SelectContent>
                    {namespaces?.map((namespace: Namespace) => (
                      <SelectItem key={namespace.name} value={namespace.name}>
                        {namespace.name} ({namespace.vectorCount} vectors)
                      </SelectItem>
                    )) || <SelectItem value="loading">Loading namespaces...</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Search</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Enter search query"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={!selectedNamespace}
                  />
                  <Button 
                    onClick={() => refetchSearch()} 
                    disabled={!selectedNamespace || !searchQuery || searchLoading}
                  >
                    {searchLoading ? (
                      <>
                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                        Searching
                      </>
                    ) : (
                      'Search'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button 
              variant="outline" 
              onClick={() => refetchVectors()}
              disabled={!selectedNamespace || vectorsLoading}
            >
              Refresh Data
            </Button>
          </CardFooter>
        </Card>

        {/* Vector Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              {searchQuery 
                ? `Search Results (${searchResults?.length || 0})` 
                : `Vectors in "${selectedNamespace}" (${vectors?.length || 0})`}
            </CardTitle>
            <CardDescription>
              {searchQuery 
                ? 'Displaying semantically similar vectors to your query'
                : 'Displaying all vectors in the selected namespace'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {vectorsError && (
              <div className="bg-red-50 text-red-800 p-4 mb-4 rounded-md">
                <h3 className="font-bold">Failed to load vectors</h3>
                <p>{vectorsErrorDetail instanceof Error ? vectorsErrorDetail.message : 'Please try again later.'}</p>
              </div>
            )}
            
            {searchError && (
              <div className="bg-red-50 text-red-800 p-4 mb-4 rounded-md">
                <h3 className="font-bold">Search failed</h3>
                <p>There was an error performing your search. Please try again.</p>
              </div>
            )}
            
            {(vectorsLoading || (searchLoading && searchQuery)) ? (
              <div className="flex items-center justify-center p-8">
                <Loader className="h-8 w-8 animate-spin mr-2" />
                <p>Loading vectors...</p>
              </div>
            ) : !selectedNamespace ? (
              <div className="text-center p-8 text-gray-500">
                Please select a namespace to view vectors
              </div>
            ) : displayVectors?.length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                No vectors found in this namespace
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption>Vector database entries</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Text</TableHead>
                      <TableHead>Metadata</TableHead>
                      {searchQuery && <TableHead>Similarity</TableHead>}
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayVectors?.map((vector: Vector) => (
                      <TableRow key={vector.id}>
                        <TableCell className="font-mono text-sm max-w-[120px] truncate">
                          {vector.id}
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          {textPreview(vector.metadata?.text)}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="text-xs">
                            <p>User ID: {vector.metadata?.userId || 'N/A'}</p>
                            <p>KB ID: {vector.metadata?.knowledgeBaseId || 'N/A'}</p>
                            <p>Doc ID: {vector.metadata?.documentId || 'N/A'}</p>
                          </div>
                        </TableCell>
                        {searchQuery && (
                          <TableCell className="text-right">
                            {(vector.score ? (vector.score * 100).toFixed(2) : 'N/A')}%
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEdit(vector)}
                            >
                              Edit
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleDelete(vector.id)}
                              disabled={deleteVectorMutation.isPending}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Edit Vector Text</DialogTitle>
              <DialogDescription>
                Update the text content of this vector. The embeddings will be regenerated.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                value={editVectorText}
                onChange={(e) => setEditVectorText(e.target.value)}
                placeholder="Enter new text content"
                className="min-h-[200px]"
              />
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpdate}
                disabled={updateVectorMutation.isPending}
              >
                {updateVectorMutation.isPending ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Updating
                  </>
                ) : (
                  'Update Vector'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default PineconeExplorer;