import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, Upload, HelpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogClose 
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';

interface DocumentImportExportProps {
  knowledgeBaseId: number;
}

interface ImportResults {
  total: number;
  successful: number;
  failed: number;
  createdDocuments: { id: number; title: string; status: string }[];
  errors: { index: number; title: string; error: string }[];
}

export function DocumentImportExport({ knowledgeBaseId }: DocumentImportExportProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);

  // Handle export button click
  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Use fetch directly instead of apiRequest as we want to trigger a download
      const response = await fetch(`/api/knowledge-bases/${knowledgeBaseId}/documents/export`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        }
      });

      if (!response.ok) {
        throw new Error('Failed to export documents');
      }

      // Get the filename from the Content-Disposition header if available
      let filename = `kb_${knowledgeBaseId}_documents_export.json`;
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename=(.+)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/["']/g, '');
        }
      }

      // Convert response to blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export successful",
        description: "Documents have been exported successfully.",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "Failed to export documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0]);
      setImportResults(null); // Clear previous results
    }
  };

  // Handle import submission
  const handleImport = async () => {
    if (!importFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to import.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      // Read file content
      const fileContent = await importFile.text();
      let importData;
      
      // Parse the JSON file
      try {
        importData = JSON.parse(fileContent);
      } catch (error) {
        throw new Error('Invalid JSON file format');
      }

      // Validate the imported data
      if (!importData.documents || !Array.isArray(importData.documents)) {
        throw new Error('Invalid import format: missing documents array');
      }

      // Send to the server
      const response = await apiRequest(`/api/knowledge-bases/${knowledgeBaseId}/documents/import`, {
        method: 'POST',
        data: { documents: importData.documents }
      });

      setImportResults(response);
      
      if (response.successful > 0) {
        // Invalidate the documents query to refresh the document list
        queryClient.invalidateQueries({ queryKey: [`/api/knowledge-bases/${knowledgeBaseId}/documents`] });
        
        toast({
          title: "Import complete",
          description: `Successfully imported ${response.successful} of ${response.total} documents.`,
        });
      } else {
        toast({
          title: "Import completed with errors",
          description: "No documents were imported successfully. Check the results for details.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card className="mb-8 hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Bulk Actions</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="w-80">
                  Export all documents from this knowledge base or import multiple documents at once.
                  The export format can be used to back up your knowledge base or transfer documents
                  between knowledge bases.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>
          Export or import multiple documents at once
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center space-x-4">
        <Button 
          onClick={handleExport} 
          disabled={isExporting}
          className="flex-1 sm:flex-none"
        >
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export Documents
            </>
          )}
        </Button>
        
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline"
              className="flex-1 sm:flex-none"
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Documents
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Import Documents</DialogTitle>
              <DialogDescription>
                Import multiple documents into this knowledge base from a JSON file.
                Only text documents are supported for bulk import.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <label htmlFor="import-file" className="text-sm font-medium">
                  Select JSON File
                </label>
                <input
                  id="import-file"
                  type="file"
                  accept=".json"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={handleFileChange}
                  disabled={isImporting}
                />
              </div>
              
              {importResults && (
                <div className="mt-4">
                  <div className="mb-2">
                    <Progress value={(importResults.successful / importResults.total) * 100} className="h-2" />
                  </div>
                  
                  <div className="text-sm">
                    Imported {importResults.successful} of {importResults.total} documents
                  </div>
                  
                  {importResults.successful > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-1">Successfully imported:</h4>
                      <ul className="text-sm max-h-32 overflow-y-auto">
                        {importResults.createdDocuments.map((doc) => (
                          <li key={doc.id} className="flex items-center">
                            <span className="h-2 w-2 rounded-full bg-green-500 mr-2"></span>
                            {doc.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {importResults.failed > 0 && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertTitle>Failed to import {importResults.failed} document(s)</AlertTitle>
                      <AlertDescription>
                        <div className="max-h-32 overflow-y-auto">
                          <ul className="text-sm">
                            {importResults.errors.map((error, index) => (
                              <li key={index} className="mt-1">
                                <strong>{error.title}:</strong> {error.error}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </div>
            
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleImport} disabled={!importFile || isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  "Import"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}