import React, { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Loader2, FileText, Folder, ChevronRight, RefreshCw, Settings } from 'lucide-react';

// Define types for SharePoint entities
interface SharePointSite {
  id: string;
  name: string;
  url: string;
}

interface SharePointDrive {
  id: string;
  name: string;
  webUrl: string;
  driveType: string;
}

interface SharePointFile {
  id: string;
  name: string;
  webUrl: string;
  size: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  mimeType: string;
  isFolder: boolean;
  parentId?: string;
}

interface SharePointCredentials {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri?: string;
}

interface SharePointDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  knowledgeBaseId: number;
  onDocumentCreated?: (document: any) => void;
}

export function SharePointDocumentDialog({
  open,
  onOpenChange,
  knowledgeBaseId,
  onDocumentCreated,
}: SharePointDocumentDialogProps) {
  const { toast } = useToast();
  
  // SharePoint credentials
  const [credentials, setCredentials] = useState<SharePointCredentials>({
    clientId: '',
    clientSecret: '',
    tenantId: '',
    redirectUri: '',
  });
  
  // SharePoint browsing state
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sites, setSites] = useState<SharePointSite[]>([]);
  const [drives, setDrives] = useState<SharePointDrive[]>([]);
  const [files, setFiles] = useState<SharePointFile[]>([]);
  
  // Navigation state
  const [selectedSite, setSelectedSite] = useState<SharePointSite | null>(null);
  const [selectedDrive, setSelectedDrive] = useState<SharePointDrive | null>(null);
  const [currentFolder, setCurrentFolder] = useState<string>('root');
  const [folderPath, setFolderPath] = useState<{id: string, name: string}[]>([
    { id: 'root', name: 'Root' }
  ]);
  
  // Selected file for import
  const [selectedFile, setSelectedFile] = useState<SharePointFile | null>(null);
  const [documentTitle, setDocumentTitle] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Initialize SharePoint connection with credentials
  const initializeSharePoint = async () => {
    if (!credentials.clientId || !credentials.clientSecret || !credentials.tenantId) {
      toast({
        title: 'Missing credentials',
        description: 'Please provide SharePoint client ID, client secret, and tenant ID',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await apiRequest('/api/sharepoint/initialize', {
        method: 'POST',
        data: credentials,
      });
      
      if (response.ok) {
        toast({
          title: 'SharePoint Connected',
          description: 'Successfully connected to SharePoint',
        });
        setIsConfigured(true);
        setShowConfig(false);
        loadSites();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to connect to SharePoint');
      }
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect to SharePoint',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load SharePoint sites
  const loadSites = async () => {
    setIsLoading(true);
    
    try {
      const response = await apiRequest('/api/sharepoint/sites');
      if (response.ok) {
        const data = await response.json();
        setSites(data);
        
        // Reset selections
        setSelectedSite(null);
        setSelectedDrive(null);
        setDrives([]);
        setFiles([]);
        setCurrentFolder('root');
        setFolderPath([{ id: 'root', name: 'Root' }]);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to load SharePoint sites');
      }
    } catch (error) {
      toast({
        title: 'Failed to Load Sites',
        description: error instanceof Error ? error.message : 'Could not load SharePoint sites',
        variant: 'destructive',
      });
      setIsConfigured(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load drives for a selected site
  const loadDrives = async (site: SharePointSite) => {
    setIsLoading(true);
    setSelectedSite(site);
    
    try {
      const response = await apiRequest(`/api/sharepoint/sites/${site.id}/drives`);
      if (response.ok) {
        const data = await response.json();
        setDrives(data);
        
        // Reset selections
        setSelectedDrive(null);
        setFiles([]);
        setCurrentFolder('root');
        setFolderPath([{ id: 'root', name: 'Root' }]);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to load drives');
      }
    } catch (error) {
      toast({
        title: 'Failed to Load Drives',
        description: error instanceof Error ? error.message : 'Could not load drives for selected site',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load files for a selected drive/folder
  const loadFiles = async (drive: SharePointDrive, folderId: string = 'root') => {
    setIsLoading(true);
    setSelectedDrive(drive);
    setCurrentFolder(folderId);
    
    try {
      const response = await apiRequest(`/api/sharepoint/drives/${drive.id}/items?folderId=${folderId}`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to load files');
      }
    } catch (error) {
      toast({
        title: 'Failed to Load Files',
        description: error instanceof Error ? error.message : 'Could not load files from SharePoint',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Navigate to a subfolder
  const navigateToFolder = (file: SharePointFile) => {
    if (!selectedDrive) return;
    
    // Update folder path
    const newPath = [...folderPath];
    // Check if we're clicking on a folder that's already in the path (navigating back)
    const existingIndex = newPath.findIndex(item => item.id === file.id);
    
    if (existingIndex >= 0) {
      // If we're navigating back, truncate the path
      setFolderPath(newPath.slice(0, existingIndex + 1));
    } else {
      // If we're navigating forward, add to the path
      newPath.push({ id: file.id, name: file.name });
      setFolderPath(newPath);
    }
    
    // Load files for the folder
    loadFiles(selectedDrive, file.id);
  };
  
  // Navigate using breadcrumb
  const navigateWithBreadcrumb = (index: number) => {
    if (!selectedDrive) return;
    
    const item = folderPath[index];
    // Truncate path to this point
    setFolderPath(folderPath.slice(0, index + 1));
    // Load files for the folder
    loadFiles(selectedDrive, item.id);
  };
  
  // Select a file for import
  const selectFile = (file: SharePointFile) => {
    if (file.isFolder) {
      navigateToFolder(file);
    } else {
      setSelectedFile(file);
      setDocumentTitle(file.name); // Default title to filename
    }
  };
  
  // Import the selected file to the knowledge base
  const importFile = async () => {
    if (!selectedFile || !selectedDrive) {
      toast({
        title: 'No File Selected',
        description: 'Please select a file to import',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await apiRequest(`/api/knowledge-bases/${knowledgeBaseId}/documents/sharepoint`, {
        method: 'POST',
        data: {
          driveId: selectedDrive.id,
          fileId: selectedFile.id,
          title: documentTitle || selectedFile.name,
          metadata: {
            source: 'sharepoint',
            fileName: selectedFile.name,
            mimeType: selectedFile.mimeType,
            createdDateTime: selectedFile.createdDateTime,
            lastModifiedDateTime: selectedFile.lastModifiedDateTime,
            size: selectedFile.size,
            webUrl: selectedFile.webUrl,
          },
        },
      });
      
      if (response.ok) {
        const document = await response.json();
        toast({
          title: 'Document Imported',
          description: `Successfully imported ${selectedFile.name} to your knowledge base`,
        });
        
        // Notify parent component
        if (onDocumentCreated) {
          onDocumentCreated(document);
        }
        
        // Close dialog
        onOpenChange(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to import document');
      }
    } catch (error) {
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import document',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Reset dialog state when closed
  useEffect(() => {
    if (!open) {
      // Don't reset credentials when closing
      setSelectedFile(null);
      setDocumentTitle('');
      setIsSubmitting(false);
      
      // Only reset browsing state if not configured
      if (!isConfigured) {
        setShowConfig(false);
        setSites([]);
        setDrives([]);
        setFiles([]);
        setSelectedSite(null);
        setSelectedDrive(null);
        setCurrentFolder('root');
        setFolderPath([{ id: 'root', name: 'Root' }]);
      }
    }
  }, [open, isConfigured]);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import SharePoint Document</DialogTitle>
          <DialogDescription>
            {isConfigured 
              ? 'Browse and select a file from SharePoint to import into your knowledge base'
              : 'Connect to SharePoint to import files'}
          </DialogDescription>
        </DialogHeader>
        
        {/* SharePoint Configuration Form */}
        {(!isConfigured || showConfig) && (
          <div className="space-y-4 py-2">
            <h3 className="text-lg font-medium">SharePoint Configuration</h3>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tenant-id">Tenant ID</Label>
                <Input
                  id="tenant-id"
                  placeholder="e.g., 12a34567-89b0-12c3-45d6-789012345678"
                  value={credentials.tenantId}
                  onChange={(e) => setCredentials({...credentials, tenantId: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="client-id">Client ID</Label>
                <Input
                  id="client-id"
                  placeholder="e.g., 12a34567-89b0-12c3-45d6-789012345678"
                  value={credentials.clientId}
                  onChange={(e) => setCredentials({...credentials, clientId: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="client-secret">Client Secret</Label>
                <Input
                  id="client-secret"
                  type="password"
                  placeholder="Enter your application client secret"
                  value={credentials.clientSecret}
                  onChange={(e) => setCredentials({...credentials, clientSecret: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="redirect-uri">Redirect URI (Optional)</Label>
                <Input
                  id="redirect-uri"
                  placeholder="e.g., https://your-app.com/auth/callback"
                  value={credentials.redirectUri}
                  onChange={(e) => setCredentials({...credentials, redirectUri: e.target.value})}
                />
              </div>
              <Button 
                onClick={initializeSharePoint} 
                disabled={isLoading}
                className="mt-2"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect to SharePoint
              </Button>
            </div>
          </div>
        )}
        
        {/* SharePoint Browser */}
        {isConfigured && !showConfig && (
          <div className="flex flex-col space-y-4 overflow-hidden">
            {/* Controls */}
            <div className="flex justify-between items-center">
              <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button variant="outline" size="sm" onClick={loadSites} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            
            {/* Navigation Breadcrumbs - Only show when browsing files */}
            {selectedDrive && (
              <Breadcrumb className="border rounded-md px-3 py-2 bg-muted/50">
                <BreadcrumbList>
                  {folderPath.map((item, index) => (
                    <React.Fragment key={item.id}>
                      {index > 0 && <BreadcrumbSeparator>
                        <ChevronRight className="h-4 w-4" />
                      </BreadcrumbSeparator>}
                      <BreadcrumbItem>
                        <BreadcrumbLink 
                          onClick={() => navigateWithBreadcrumb(index)}
                          className="cursor-pointer hover:underline"
                        >
                          {item.name}
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                    </React.Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            )}
            
            {/* Site Selector - Show when no site is selected */}
            {!selectedSite && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Select a SharePoint Site</h3>
                {isLoading ? (
                  <div className="flex items-center justify-center h-60">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : sites.length === 0 ? (
                  <div className="text-center text-muted-foreground h-60 flex flex-col items-center justify-center">
                    <p>No SharePoint sites found</p>
                    <Button onClick={loadSites} variant="outline" className="mt-2">
                      Refresh
                    </Button>
                  </div>
                ) : (
                  <div className="border rounded-lg divide-y overflow-y-auto max-h-[400px]">
                    {sites.map((site) => (
                      <div
                        key={site.id}
                        className="p-3 hover:bg-muted/50 cursor-pointer flex items-center"
                        onClick={() => loadDrives(site)}
                      >
                        <Folder className="h-5 w-5 mr-2 text-blue-500" />
                        <div>
                          <p className="font-medium">{site.name}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-md">{site.url}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Drive Selector - Show when site is selected but drive is not */}
            {selectedSite && !selectedDrive && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Select a Document Library</h3>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedSite(null)}>
                    Back to Sites
                  </Button>
                </div>
                {isLoading ? (
                  <div className="flex items-center justify-center h-60">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : drives.length === 0 ? (
                  <div className="text-center text-muted-foreground h-60 flex flex-col items-center justify-center">
                    <p>No document libraries found</p>
                    <Button 
                      onClick={() => selectedSite && loadDrives(selectedSite)} 
                      variant="outline" 
                      className="mt-2"
                    >
                      Refresh
                    </Button>
                  </div>
                ) : (
                  <div className="border rounded-lg divide-y overflow-y-auto max-h-[400px]">
                    {drives.map((drive) => (
                      <div
                        key={drive.id}
                        className="p-3 hover:bg-muted/50 cursor-pointer flex items-center"
                        onClick={() => loadFiles(drive)}
                      >
                        <Folder className="h-5 w-5 mr-2 text-blue-500" />
                        <div>
                          <p className="font-medium">{drive.name}</p>
                          <p className="text-sm text-muted-foreground">{drive.driveType}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* File Browser - Show when drive is selected */}
            {selectedDrive && (
              <div className="space-y-4 flex-grow overflow-hidden flex flex-col">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Select a File</h3>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setSelectedDrive(null);
                      setFiles([]);
                      setCurrentFolder('root');
                      setFolderPath([{ id: 'root', name: 'Root' }]);
                    }}
                  >
                    Back to Libraries
                  </Button>
                </div>
                {isLoading ? (
                  <div className="flex items-center justify-center h-60">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : files.length === 0 ? (
                  <div className="text-center text-muted-foreground h-60 flex flex-col items-center justify-center">
                    <p>No files found in this location</p>
                    <Button 
                      onClick={() => selectedDrive && loadFiles(selectedDrive, currentFolder)} 
                      variant="outline" 
                      className="mt-2"
                    >
                      Refresh
                    </Button>
                  </div>
                ) : (
                  <div className="border rounded-lg divide-y overflow-y-auto max-h-[300px] flex-grow">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className={`p-3 hover:bg-muted/50 cursor-pointer flex items-center ${
                          selectedFile?.id === file.id ? 'bg-muted' : ''
                        }`}
                        onClick={() => selectFile(file)}
                      >
                        {file.isFolder ? (
                          <Folder className="h-5 w-5 mr-2 text-blue-500" />
                        ) : (
                          <FileText className="h-5 w-5 mr-2 text-green-500" />
                        )}
                        <div className="flex-grow">
                          <p className="font-medium">{file.name}</p>
                          <div className="flex text-xs text-muted-foreground">
                            <p className="mr-2">{file.isFolder ? 'Folder' : file.mimeType}</p>
                            {!file.isFolder && (
                              <p>{(file.size / 1024).toFixed(1)} KB</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* File Import Form - Show when a file is selected */}
            {selectedFile && (
              <div className="space-y-4 border-t pt-4">
                <div className="grid gap-2">
                  <Label htmlFor="document-title">Document Title</Label>
                  <Input
                    id="document-title"
                    placeholder="Enter document title"
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {isConfigured && !showConfig && selectedFile && (
            <Button onClick={importFile} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import Document
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}