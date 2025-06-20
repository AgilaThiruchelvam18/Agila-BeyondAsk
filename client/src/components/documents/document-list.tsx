import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// Instead of using Spinner, we'll use a simple loading element
// import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { 
  FileText, FileUp, Edit, Trash, RefreshCw, Globe, Youtube, ExternalLink, 
  Upload, List, LayoutGrid as Grid, Files as FilesIcon, Clock
} from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import { DocumentFilters } from "./document-filters";
import { UploadDocumentDialog } from "./upload-document-dialog";
import { EditDocumentDialog } from "./edit-document-dialog";
import { DocumentContentDialog } from "./document-content-dialog";
import { MultiplePdfUploadDialog } from "./multiple-pdf-upload-dialog";
import { ScheduledUpdateDialog } from "./scheduled-update-dialog";
import { DocumentImportExport } from "./document-import-export";

interface DocumentListProps {
  knowledgeBaseId: number;
}

interface Document {
  id: number;
  title: string;
  description?: string;
  status: string;
  sourceType: string;
  sourceUrl?: string;
  filePath?: string;
  fileSize?: number;
  content?: string;
  metadata?: any;
  processingInfo?: any;
  embeddingIds?: string[];
  createdAt: string;
  tags?: string[];
}

interface FilterOptions {
  searchTerm: string;
  documentTypes: string[];
  tags: string[];
  dateRange: { from: Date | null; to: Date | null };
  customFields: Record<string, string>;
}

export function DocumentList({ knowledgeBaseId }: DocumentListProps) {
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    searchTerm: "",
    documentTypes: [],
    tags: [],
    dateRange: { from: null, to: null },
    customFields: {}
  });

  const [viewType, setViewType] = useState<"grid" | "list">("list");
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"date" | "name">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data: documents, isLoading, error } = useQuery({
    queryKey: [`/api/knowledge-bases/${knowledgeBaseId}/documents`, refreshKey],
    refetchInterval: 2000, // Poll every 2 seconds for updates
    queryFn: () => fetch(`/api/knowledge-bases/${knowledgeBaseId}/documents`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    }).then(res => {
      if (!res.ok) throw new Error('Failed to fetch documents');
      return res.json();
    })
  });

  // Get all tags from documents for the filter
  useEffect(() => {
    if (documents) {
      const tags = documents.reduce((acc: string[], doc: Document) => {
        if (doc.tags && doc.tags.length > 0) {
          doc.tags.forEach(tag => {
            if (!acc.includes(tag)) {
              acc.push(tag);
            }
          });
        }
        return acc;
      }, []);
      setAvailableTags(tags);
    }
  }, [documents]);

  // Filter documents based on filter options
  const filterDocuments = (docs: Document[]): Document[] => {
    if (!docs) return [];
    
    return docs.filter((doc: Document) => {
      // Filter by search term
      if (filterOptions.searchTerm && !doc.title.toLowerCase().includes(filterOptions.searchTerm.toLowerCase()) && 
          (!doc.description || !doc.description.toLowerCase().includes(filterOptions.searchTerm.toLowerCase()))) {
        return false;
      }

      // Filter by document types
      if (filterOptions.documentTypes.length > 0 && !filterOptions.documentTypes.includes(doc.sourceType)) {
        return false;
      }

      // Filter by tags
      if (filterOptions.tags.length > 0 && 
          (!doc.tags || !filterOptions.tags.some(tag => doc.tags?.includes(tag)))) {
        return false;
      }

      // Filter by date range
      if (filterOptions.dateRange.from && new Date(doc.createdAt) < filterOptions.dateRange.from) {
        return false;
      }
      if (filterOptions.dateRange.to) {
        const toDateEnd = new Date(filterOptions.dateRange.to);
        toDateEnd.setHours(23, 59, 59, 999);
        if (new Date(doc.createdAt) > toDateEnd) {
          return false;
        }
      }

      // Filter by custom fields
      if (Object.keys(filterOptions.customFields).length > 0) {
        for (const fieldKey of Object.keys(filterOptions.customFields)) {
          const fieldValue = filterOptions.customFields[fieldKey];
          if (fieldValue && (!doc.metadata?.customFields || 
              !doc.metadata.customFields[fieldKey] || 
              !doc.metadata.customFields[fieldKey].toLowerCase().includes(fieldValue.toLowerCase()))) {
            return false;
          }
        }
      }

      return true;
    });
  };

  // Sort documents function
  const sortDocuments = (docs: Document[]): Document[] => {
    if (!docs) return [];
    
    return [...docs].sort((a, b) => {
      if (sortBy === "date") {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      } else { // sort by name
        const nameA = a.title.toLowerCase();
        const nameB = b.title.toLowerCase();
        return sortOrder === "asc" 
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      }
    });
  };

  // Apply filter and sort
  const filteredDocuments = documents ? sortDocuments(filterDocuments(documents)) : [];

  const getSourceTypeIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'pdf':
      case 'document':
        return <FileText className="h-4 w-4 text-red-500" />;
      case 'url':
        return <Globe className="h-4 w-4 text-blue-500" />;
      case 'youtube':
        return <Youtube className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processed':
        return <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Processed</Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'embedding_failed':
        return <Badge variant="destructive">Embedding Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const deleteDocument = useMutation({
    mutationFn: async (documentId: number) => {
      return apiRequest(`/api/knowledge-bases/${knowledgeBaseId}/documents/${documentId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/knowledge-bases/${knowledgeBaseId}/documents`] });
    }
  });

  const processDocument = useMutation({
    mutationFn: async (documentId: number) => {
      return apiRequest(`/api/knowledge-bases/${knowledgeBaseId}/documents/${documentId}/process`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/knowledge-bases/${knowledgeBaseId}/documents`] });
    }
  });

  const reprocessEmbeddings = useMutation({
    mutationFn: async (documentId: number) => {
      return apiRequest(`/api/knowledge-bases/${knowledgeBaseId}/documents/${documentId}/reprocess-embeddings`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/knowledge-bases/${knowledgeBaseId}/documents`] });
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error loading documents</AlertTitle>
        <AlertDescription>
          There was an error loading the documents. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with title and upload buttons */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <h2 className="text-xl font-bold">Documents</h2>
        <div className="flex flex-wrap items-center gap-2">
          <DocumentImportExport knowledgeBaseId={knowledgeBaseId} />
          <ScheduledUpdateDialog knowledgeBaseId={knowledgeBaseId} />
          <MultiplePdfUploadDialog knowledgeBaseId={knowledgeBaseId} />
          <UploadDocumentDialog knowledgeBaseId={knowledgeBaseId} />
          <div className="ml-auto"></div>
          <div className="flex items-center space-x-2">
            {/* Sort options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  <span>Sort: {sortBy === "date" ? "Date" : "Name"}</span>
                  {sortOrder === "asc" ? (
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                      <path d="M7.5 3L7.5 12M7.5 3L3.5 7M7.5 3L11.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                      <path d="M7.5 12L7.5 3M7.5 12L3.5 8M7.5 12L11.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white border-gray-200">
                <DropdownMenuItem onClick={() => { setSortBy("date"); setSortOrder("desc"); }}>
                  <Clock className="mr-2 h-4 w-4" />
                  Date (newest first)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("date"); setSortOrder("asc"); }}>
                  <Clock className="mr-2 h-4 w-4" />
                  Date (oldest first)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("name"); setSortOrder("asc"); }}>
                  <FileText className="mr-2 h-4 w-4" />
                  Name (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("name"); setSortOrder("desc"); }}>
                  <FileText className="mr-2 h-4 w-4" />
                  Name (Z-A)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* View toggle */}
            <ToggleGroup type="single" value={viewType} onValueChange={(value) => value && setViewType(value as "grid" | "list")}>
              <ToggleGroupItem value="grid" aria-label="Grid view">
                <Grid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List view">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </div>

      {/* Document filters */}
      {documents && documents.length > 0 && (
        <div>
          <DocumentFilters
            onFilterChange={setFilterOptions}
            availableTags={availableTags}
            activeFilters={filterOptions}
            customFields={documents[0]?.metadata?.customFields ? 
              Object.keys(documents[0].metadata.customFields).map(key => ({
                id: key,
                name: key,
                type: 'text'
              })) : []
            }
          />
        </div>
      )}

      {/* No documents at all */}
      {!documents || documents.length === 0 ? (
        <Card className="p-8 flex flex-col items-center justify-center text-center">
          <FileText className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium mb-2">No documents yet</h3>
          <p className="text-gray-500 mb-4">Add documents to your knowledge base to get started</p>
          <UploadDocumentDialog 
            knowledgeBaseId={knowledgeBaseId}
            trigger={
              <Button>
                Upload your first document
              </Button>
            }
          />
        </Card>
      /* No documents match filters */
      ) : filteredDocuments.length === 0 ? (
        <div className="col-span-2 flex flex-col items-center justify-center text-center p-8">
          <FilesIcon className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium mb-2">No documents match your filters</h3>
          <p className="text-gray-500">Try changing your filter criteria or clear filters</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => setFilterOptions({
              searchTerm: "",
              documentTypes: [],
              tags: [],
              dateRange: { from: null, to: null },
              customFields: {}
            })}
          >
            Clear all filters
          </Button>
        </div>
      /* Show documents in grid or list view */
      ) : (
        <>
          {viewType === "grid" ? (
            /* Grid view */
            <div className="grid gap-4 md:grid-cols-2">
              {filteredDocuments.map((doc: Document) => (
                <Card key={doc.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          {getSourceTypeIcon(doc.sourceType)}
                          <CardTitle className="ml-2">{doc.title}</CardTitle>
                        </div>
                        <CardDescription>{doc.description || "No description"}</CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(doc.status)}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                              </svg>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white border-gray-200">
                            {/* Edit document option */}
                            <EditDocumentDialog
                              document={{
                                id: doc.id,
                                title: doc.title,
                                description: doc.description,
                                metadata: doc.metadata || {},
                                tags: doc.tags || [],
                                knowledgeBaseId: knowledgeBaseId
                              }}
                              trigger={
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Document
                                </DropdownMenuItem>
                              }
                            />
                            
                            <DocumentContentDialog
                              document={{
                                id: doc.id,
                                title: doc.title,
                                knowledgeBaseId: knowledgeBaseId,
                                sourceType: doc.sourceType,
                                content: doc.content,
                                sourceUrl: doc.sourceUrl
                              }}
                              trigger={
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  View/Edit Content
                                </DropdownMenuItem>
                              }
                            />
                            
                            {(doc.status === 'failed' || doc.status === 'embedding_failed') && (
                              <DropdownMenuItem onClick={() => processDocument.mutate(doc.id)}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Retry Processing
                              </DropdownMenuItem>
                            )}
                            {doc.status === 'processed' && (
                              <DropdownMenuItem onClick={() => reprocessEmbeddings.mutate(doc.id)}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Reprocess Embeddings
                              </DropdownMenuItem>
                            )}
                            {doc.sourceType === 'url' && doc.sourceUrl && (
                              <DropdownMenuItem asChild>
                                <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Open Source URL
                                </a>
                              </DropdownMenuItem>
                            )}
                            {doc.sourceType === 'youtube' && doc.sourceUrl && (
                              <DropdownMenuItem asChild>
                                <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer">
                                  <Youtube className="mr-2 h-4 w-4" />
                                  Open YouTube Video
                                </a>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => deleteDocument.mutate(doc.id)}
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="text-sm">
                      {['pending', 'processing', 'processed', 'embedding_failed', 'failed'].includes(doc.status) && doc.processingInfo && (
                        <div className="mb-2">
                          <div className="flex justify-between text-xs mb-1">
                            <span>{doc.processingInfo.status_message || 'Processing'}</span>
                            <span>{doc.processingInfo.progress || 0}%</span>
                          </div>
                          <Progress 
                            value={doc.processingInfo.progress || 0} 
                            className={`h-2 ${doc.status === 'failed' || doc.status === 'embedding_failed' ? 'bg-destructive/20' : ''}`} 
                          />
                        </div>
                      )}
                      
                      {(doc.status === 'failed' || doc.status === 'embedding_failed') && doc.processingInfo?.error && (
                        <Alert variant="destructive" className="mb-2 p-2 text-xs">
                          <AlertTitle>{doc.status === 'embedding_failed' ? 'Embedding failed' : 'Processing failed'}</AlertTitle>
                          <AlertDescription>
                            {doc.processingInfo.error}
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                        <div className="text-gray-500">Source:</div>
                        <div className="truncate">
                          {doc.sourceType === 'url' ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center cursor-help">
                                    URL <Globe className="ml-1 h-3 w-3" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs break-all">{doc.sourceUrl}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : doc.sourceType === 'pdf' || doc.sourceType === 'document' ? (
                            <span className="inline-flex items-center">
                              {doc.sourceType === 'pdf' ? 'PDF' : 'Document'} <FileUp className="ml-1 h-3 w-3" />
                              {doc.fileSize && (
                                <span className="ml-1 text-xs text-gray-400">
                                  ({(doc.fileSize / (1024 * 1024)).toFixed(1)} MB)
                                </span>
                              )}
                            </span>
                          ) : doc.sourceType === 'youtube' ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center cursor-help">
                                    YouTube <Youtube className="ml-1 h-3 w-3" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs break-all">{doc.sourceUrl}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span>Text</span>
                          )}
                        </div>
                        
                        <div className="text-gray-500">Added:</div>
                        <div>{new Date(doc.createdAt).toLocaleDateString()}</div>

                        {doc.tags && doc.tags.length > 0 && (
                          <>
                            <div className="text-gray-500">Tags:</div>
                            <div className="flex flex-wrap gap-1">
                              {doc.tags.map((tag, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </>
                        )}
                        
                        {doc.status === 'processed' && (
                          <>
                            <div className="text-gray-500">Chunks:</div>
                            <div>
                              {doc.metadata?.chunk_count || 
                               (doc.embeddingIds && doc.embeddingIds.length > 0 ? doc.embeddingIds.length : 
                               (doc.metadata?.chunks?.length > 0 ? doc.metadata.chunks.length : 
                               (doc.processingInfo?.chunks ? doc.processingInfo.chunks : 'N/A')))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <DocumentContentDialog
                      document={{
                        id: doc.id,
                        title: doc.title,
                        knowledgeBaseId: knowledgeBaseId,
                        sourceType: doc.sourceType,
                        content: doc.content,
                        sourceUrl: doc.sourceUrl
                      }}
                      trigger={
                        <Button 
                          variant={doc.status === 'processed' ? 'default' : 'outline'} 
                          className="w-full"
                          disabled={doc.status !== 'processed'}
                        >
                          View Content
                        </Button>
                      }
                    />
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            /* List view */
            <div className="flex flex-col gap-2">
              {filteredDocuments.map((doc: Document) => (
                <Card key={doc.id} className="overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    <div className="flex-1 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        {getSourceTypeIcon(doc.sourceType)}
                        <h3 className="font-medium text-lg">{doc.title}</h3>
                        {getStatusBadge(doc.status)}
                      </div>
                      
                      {doc.description && (
                        <p className="text-gray-500 text-sm mb-2">{doc.description}</p>
                      )}
                      
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs text-gray-500">
                          Added: {new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                        
                        {doc.tags && doc.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-xs text-gray-500">Tags:</span>
                            {doc.tags.map((tag, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        
                        {doc.status === 'processed' && (
                          <span className="text-xs text-gray-500">
                            Chunks: {doc.metadata?.chunk_count || 
                                    (doc.embeddingIds && doc.embeddingIds.length > 0 ? doc.embeddingIds.length : 
                                    (doc.metadata?.chunks?.length > 0 ? doc.metadata.chunks.length : 
                                    (doc.processingInfo?.chunks ? doc.processingInfo.chunks : 'N/A')))}
                          </span>
                        )}
                      </div>
                      
                      {['pending', 'processing', 'processed', 'embedding_failed', 'failed'].includes(doc.status) && doc.processingInfo && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs mb-1">
                            <span>{doc.processingInfo.status_message || 'Processing'}</span>
                            <span>{doc.processingInfo.progress || 0}%</span>
                          </div>
                          <Progress 
                            value={doc.processingInfo.progress || 0} 
                            className={`h-2 ${doc.status === 'failed' || doc.status === 'embedding_failed' ? 'bg-destructive/20' : ''}`} 
                          />
                        </div>
                      )}
                      
                      {(doc.status === 'failed' || doc.status === 'embedding_failed') && doc.processingInfo?.error && (
                        <Alert variant="destructive" className="mt-2 p-2 text-xs">
                          <AlertTitle>{doc.status === 'embedding_failed' ? 'Embedding failed' : 'Processing failed'}</AlertTitle>
                          <AlertDescription>
                            {doc.processingInfo.error}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                    
                    <div className="flex md:flex-col justify-end p-4 border-t md:border-t-0 bg-gray-50 dark:bg-gray-900">
                      <DocumentContentDialog
                        document={{
                          id: doc.id,
                          title: doc.title,
                          knowledgeBaseId: knowledgeBaseId,
                          sourceType: doc.sourceType,
                          content: doc.content,
                          sourceUrl: doc.sourceUrl
                        }}
                        trigger={
                          <Button 
                            variant={doc.status === 'processed' ? 'default' : 'outline'} 
                            className="mr-2 md:mr-0 md:mb-2"
                            disabled={doc.status !== 'processed'}
                            size="sm"
                          >
                            View Content
                          </Button>
                        }
                      />
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            Actions
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white border-gray-200">
                          <EditDocumentDialog
                            document={{
                              id: doc.id,
                              title: doc.title,
                              description: doc.description,
                              metadata: doc.metadata || {},
                              tags: doc.tags || [],
                              knowledgeBaseId: knowledgeBaseId
                            }}
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Document
                              </DropdownMenuItem>
                            }
                          />
                          
                          <DocumentContentDialog
                            document={{
                              id: doc.id,
                              title: doc.title,
                              knowledgeBaseId: knowledgeBaseId,
                              sourceType: doc.sourceType,
                              content: doc.content,
                              sourceUrl: doc.sourceUrl
                            }}
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <FileText className="mr-2 h-4 w-4" />
                                View/Edit Content
                              </DropdownMenuItem>
                            }
                          />
                          
                          {(doc.status === 'failed' || doc.status === 'embedding_failed') && (
                            <DropdownMenuItem onClick={() => processDocument.mutate(doc.id)}>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Retry Processing
                            </DropdownMenuItem>
                          )}
                          
                          {doc.status === 'processed' && (
                            <DropdownMenuItem onClick={() => reprocessEmbeddings.mutate(doc.id)}>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Reprocess Embeddings
                            </DropdownMenuItem>
                          )}
                          
                          {doc.sourceType === 'url' && doc.sourceUrl && (
                            <DropdownMenuItem asChild>
                              <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open Source URL
                              </a>
                            </DropdownMenuItem>
                          )}
                          
                          {doc.sourceType === 'youtube' && doc.sourceUrl && (
                            <DropdownMenuItem asChild>
                              <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer">
                                <Youtube className="mr-2 h-4 w-4" />
                                Open YouTube Video
                              </a>
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => deleteDocument.mutate(doc.id)}
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}