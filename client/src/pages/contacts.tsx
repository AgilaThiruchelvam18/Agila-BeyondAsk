import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

const statusColors = {
  new: 'bg-blue-500',
  verified: 'bg-green-500',
  contacted: 'bg-purple-500',
  converted: 'bg-orange-500',
  rejected: 'bg-red-500',
};

export default function ContactsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterVerified, setFilterVerified] = useState<boolean | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  
  // Function to build query parameters
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append('limit', pageSize.toString());
    params.append('offset', ((page - 1) * pageSize).toString());
    params.append('sortBy', sortField);
    params.append('sortOrder', sortOrder);
    
    if (search) params.append('search', search);
    if (filterStatus) params.append('status', filterStatus);
    if (filterVerified !== null) params.append('verified', filterVerified.toString());
    if (startDate) params.append('startDate', startDate.toISOString());
    if (endDate) params.append('endDate', endDate.toISOString());
    if (selectedAgent) params.append('agentId', selectedAgent);
    
    return params.toString();
  };
  
  // Query to fetch leads - FIXED authentication
  const { 
    data, 
    isLoading, 
    refetch 
  } = useQuery({
    queryKey: ['/api/contacts', page, pageSize, sortField, sortOrder, search, filterStatus, filterVerified, startDate, endDate, selectedAgent],
    queryFn: () => apiRequest(`/api/contacts?${buildQueryParams()}`),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    refetchOnWindowFocus: false,
  });
  
  // Query to fetch agents for filter dropdown - FIXED authentication
  const { data: agentsData } = useQuery({
    queryKey: ['/api/agents'],
    queryFn: () => apiRequest('/api/agents'),
    staleTime: 1000 * 60 * 10, // 10 minutes cache
    refetchOnWindowFocus: false,
    select: (data) => {
      // Ensure we always return an array for mapping
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.agents)) return data.agents;
      if (data && Array.isArray(data.data)) return data.data;
      return [];
    }
  });
  
  // Handle changing contact status
  const handleStatusChange = async (leadId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/contacts/${leadId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update status');
      }
      
      toast({
        title: 'Status updated',
        description: `Contact status changed to ${newStatus}`,
      });
      
      refetch();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update contact status',
        variant: 'destructive',
      });
    }
  };
  
  // Handle export
  const handleExport = async () => {
    try {
      // Build query params for export
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filterStatus) params.append('status', filterStatus);
      if (filterVerified !== null) params.append('verified', filterVerified.toString());
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      if (selectedAgent) params.append('agentId', selectedAgent);
      
      // Get the auth token
      const token = localStorage.getItem('auth_token');
      
      // Use fetch with authorization header instead of window.open
      const response = await fetch(`/api/contacts/export?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to export contacts');
      }
      
      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts.csv';
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setExportDialogOpen(false);
      
      toast({
        title: 'Export successful',
        description: 'Your contacts have been exported to CSV',
      });
    } catch (error) {
      console.error('Error exporting contacts:', error);
      toast({
        title: 'Export failed',
        description: 'An error occurred while exporting contacts',
        variant: 'destructive',
      });
    }
  };
  
  // Reset filters
  const resetFilters = () => {
    setSearch('');
    setFilterStatus(null);
    setFilterVerified(null);
    setStartDate(null);
    setEndDate(null);
    setSelectedAgent(null);
    setPage(1);
  };
  
  return (
    <DashboardLayout>
      <div className="container py-10">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Widget Lead Management</h1>
          <Button onClick={() => setExportDialogOpen(true)}>
            <Icons.download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter and search your contacts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm mb-2">Search</p>
                <Input
                  placeholder="Search name, email, or phone"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div>
                <p className="text-sm mb-2">Status</p>
                <Select
                  value={filterStatus || 'all'}
                  onValueChange={(value) => setFilterStatus(value === 'all' ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <p className="text-sm mb-2">Verification</p>
                <Select
                  value={filterVerified === null ? 'all' : filterVerified.toString()}
                  onValueChange={(value) => {
                    if (value === 'all') {
                      setFilterVerified(null);
                    } else {
                      setFilterVerified(value === 'true');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All contacts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All contacts</SelectItem>
                    <SelectItem value="true">Verified</SelectItem>
                    <SelectItem value="false">Unverified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <p className="text-sm mb-2">From Date</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'PPP') : <span>Select date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate || undefined}
                      onSelect={(day) => setStartDate(day || null)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <p className="text-sm mb-2">To Date</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'PPP') : <span>Select date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate || undefined}
                      onSelect={(day) => setEndDate(day || null)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <p className="text-sm mb-2">Agent</p>
                <Select
                  value={selectedAgent || 'all'}
                  onValueChange={(value) => setSelectedAgent(value === 'all' ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All agents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All agents</SelectItem>
                    {agentsData?.map((agent: any) => (
                      <SelectItem key={agent.id} value={agent.id.toString()}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={resetFilters}>Reset Filters</Button>
            <Button onClick={() => refetch()}>Apply Filters</Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableCaption>
                {isLoading ? 'Loading contacts...' : `Showing ${data?.leads?.length || 0} of ${data?.total || 0} contacts`}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      <div className="flex justify-center items-center py-4">
                        <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                        Loading contacts...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : data?.leads?.length > 0 ? (
                  data.leads.map((lead: any) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.id}</TableCell>
                      <TableCell>{lead.name}</TableCell>
                      <TableCell>{lead.email}</TableCell>
                      <TableCell>
                        <Badge className={cn("text-white", statusColors[lead.status as keyof typeof statusColors] || "bg-gray-500")}>
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lead.emailVerified ? (
                          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                            <Icons.check className="mr-1 h-3 w-3" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                            <Icons.alert className="mr-1 h-3 w-3" />
                            Unverified
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{new Date(lead.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <Icons.moreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setSelectedLead(lead)}>
                              <Icons.view className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'new')}>
                              <div className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                              New
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'verified')}>
                              <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                              Verified
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'contacted')}>
                              <div className="w-2 h-2 rounded-full bg-purple-500 mr-2" />
                              Contacted
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'converted')}>
                              <div className="w-2 h-2 rounded-full bg-orange-500 mr-2" />
                              Converted
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(lead.id, 'rejected')}>
                              <div className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                              Rejected
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No contacts found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <p className="text-sm text-muted-foreground mr-2">Items per page</p>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[80px]">
                  <SelectValue placeholder={pageSize.toString()} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {data?.total > 0 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: Math.min(5, Math.ceil((data?.total || 0) / pageSize)) }).map((_, i) => {
                    const pageNumber = i + 1;
                    
                    return (
                      <PaginationItem key={pageNumber}>
                        <PaginationLink
                          isActive={page === pageNumber}
                          onClick={() => setPage(pageNumber)}
                        >
                          {pageNumber}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  
                  {Math.ceil((data?.total || 0) / pageSize) > 5 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setPage(p => Math.min(Math.ceil((data?.total || 0) / pageSize), p + 1))}
                      className={page >= Math.ceil((data?.total || 0) / pageSize) ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </CardFooter>
        </Card>
      </div>
      
      {/* Lead Details Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Contact Details</DialogTitle>
            <DialogDescription>
              View and manage contact information
            </DialogDescription>
          </DialogHeader>
          
          {selectedLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Name</p>
                  <p className="text-base">{selectedLead.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-base">{selectedLead.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Phone</p>
                  <p className="text-base">{selectedLead.phone || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created</p>
                  <p className="text-base">{new Date(selectedLead.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge className={cn("mt-1 text-white", statusColors[selectedLead.status as keyof typeof statusColors] || "bg-gray-500")}>
                    {selectedLead.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Verified</p>
                  {selectedLead.emailVerified ? (
                    <Badge variant="outline" className="mt-1 bg-green-100 text-green-800 border-green-300">
                      <Icons.check className="mr-1 h-3 w-3" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="mt-1 bg-yellow-100 text-yellow-800 border-yellow-300">
                      <Icons.alert className="mr-1 h-3 w-3" />
                      Unverified
                    </Badge>
                  )}
                </div>
              </div>
              
              {selectedLead.message && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Message</p>
                  <p className="text-base whitespace-pre-wrap p-3 bg-muted rounded-md mt-1">{selectedLead.message}</p>
                </div>
              )}
              
              {selectedLead.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Notes</p>
                  <p className="text-base whitespace-pre-wrap p-3 bg-muted rounded-md mt-1">{selectedLead.notes}</p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="flex justify-between">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Change Status
                  <Icons.chevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => {
                  handleStatusChange(selectedLead.id, 'new');
                  setSelectedLead(null);
                }}>
                  <div className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                  New
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  handleStatusChange(selectedLead.id, 'verified');
                  setSelectedLead(null);
                }}>
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                  Verified
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  handleStatusChange(selectedLead.id, 'contacted');
                  setSelectedLead(null);
                }}>
                  <div className="w-2 h-2 rounded-full bg-purple-500 mr-2" />
                  Contacted
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  handleStatusChange(selectedLead.id, 'converted');
                  setSelectedLead(null);
                }}>
                  <div className="w-2 h-2 rounded-full bg-orange-500 mr-2" />
                  Converted
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  handleStatusChange(selectedLead.id, 'rejected');
                  setSelectedLead(null);
                }}>
                  <div className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                  Rejected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Export Contacts</DialogTitle>
            <DialogDescription>
              Choose export options for your contacts.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Current Filters</h3>
              <div className="rounded-md bg-slate-50 p-4 text-sm">
                <ul className="list-disc pl-4 space-y-1">
                  {search && <li>Search: {search}</li>}
                  {filterStatus && <li>Status: {filterStatus}</li>}
                  {filterVerified !== null && <li>Verified: {filterVerified ? 'Yes' : 'No'}</li>}
                  {startDate && <li>From date: {format(startDate, 'PP')}</li>}
                  {endDate && <li>To date: {format(endDate, 'PP')}</li>}
                  {selectedAgent && <li>Agent: {agentsData?.find((a: any) => a.id === selectedAgent)?.name}</li>}
                  {!search && !filterStatus && filterVerified === null && !startDate && !endDate && !selectedAgent && (
                    <li>No filters applied - will export all contacts</li>
                  )}
                </ul>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                The exported file will include contacts matching your current filters.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport}>
              <Icons.download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}