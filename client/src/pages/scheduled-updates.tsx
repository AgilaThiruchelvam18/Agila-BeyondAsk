import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Clock, CalendarRange, AlertTriangle, CheckCircle2, RefreshCw, Trash2, Edit2 } from "lucide-react";
import { format } from "date-fns";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function ScheduledUpdatesPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const { data: scheduledUpdates, isLoading: isLoadingUpdates } = useQuery({
    queryKey: ['/api/scheduled-knowledge-updates'],
    queryFn: () => 
      apiRequest('/api/scheduled-knowledge-updates'),
  });

  const { data: knowledgeBases } = useQuery({
    queryKey: ['/api/knowledge-bases'],
    queryFn: () => 
      apiRequest('/api/knowledge-bases'),
  });

  // Mutation to toggle schedule active status
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number, isActive: boolean }) => {
      return apiRequest(`/api/scheduled-knowledge-updates/${id}`, {
        method: 'PATCH',
        data: { isActive },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-knowledge-updates'] });
      toast({
        title: "Success",
        description: "Schedule status updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update schedule status",
        variant: "destructive",
      });
    },
  });

  // Mutation to delete a schedule
  const deleteScheduleMutation = useMutation({
    mutationFn: (id: number) => {
      return apiRequest(`/api/scheduled-knowledge-updates/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-knowledge-updates'] });
      toast({
        title: "Success",
        description: "Schedule deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete schedule",
        variant: "destructive",
      });
    },
  });

  // Manually run a schedule
  const runScheduleNow = async (id: number) => {
    setIsLoading(true);
    try {
      await apiRequest(`/api/scheduled-knowledge-updates/${id}/run-now`, {
        method: 'POST',
      });
      toast({
        title: "Success",
        description: "Schedule running in the background",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-knowledge-updates'] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to run the schedule",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Get knowledge base name from ID
  const getKnowledgeBaseName = (id: number) => {
    if (!knowledgeBases) return 'Loading...';
    const kb = knowledgeBases.find((kb: any) => kb.id === id);
    return kb ? kb.name : 'Unknown';
  };

  // Format frequency in a human-readable way
  const formatFrequency = (schedule: any) => {
    if (!schedule) return 'Unknown';
    
    const { frequency, interval, dayOfWeek, dayOfMonth, specificTime } = schedule;
    
    let result = '';
    
    switch (frequency) {
      case 'hourly':
        result = `Every ${interval} hour${interval > 1 ? 's' : ''}`;
        break;
      case 'daily':
        result = `Every ${interval} day${interval > 1 ? 's' : ''}`;
        if (specificTime) result += ` at ${specificTime}`;
        break;
      case 'weekly':
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        result = `Every ${interval} week${interval > 1 ? 's' : ''}`;
        if (dayOfWeek !== undefined) result += ` on ${days[dayOfWeek]}`;
        if (specificTime) result += ` at ${specificTime}`;
        break;
      case 'monthly':
        result = `Every ${interval} month${interval > 1 ? 's' : ''}`;
        if (dayOfMonth !== undefined) result += ` on day ${dayOfMonth}`;
        if (specificTime) result += ` at ${specificTime}`;
        break;
      case 'custom':
        result = 'Custom schedule';
        break;
      default:
        result = 'Unknown schedule';
    }
    
    return result;
  };

  // Format timestamp in a human-readable way
  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    return format(new Date(timestamp), 'MMM d, yyyy h:mm a');
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Scheduled Knowledge Updates"
        description="View and manage your automated knowledge refresh schedules"
        actions={
          <Button asChild>
            <a href="/knowledge-bases">
              Manage Knowledge Bases
            </a>
          </Button>
        }
      />

      {isLoadingUpdates ? (
        <div className="flex justify-center my-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : !scheduledUpdates || scheduledUpdates.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-12 w-12 text-muted-foreground" />}
          title="No scheduled updates"
          description="You haven't created any knowledge base update schedules yet."
          action={
            <Button asChild>
              <a href="/knowledge-bases">
                Go to Knowledge Bases
              </a>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Schedules</CardTitle>
              <CardDescription>
                All your configured knowledge update schedules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Knowledge Bases</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledUpdates.map((update: any) => (
                    <TableRow key={update.id}>
                      <TableCell className="font-medium">{update.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {update.knowledgeBaseIds.map((kbId: number) => (
                            <Badge key={kbId} variant="outline">
                              {getKnowledgeBaseName(kbId)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{formatFrequency(update.schedule)}</TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>{formatTimestamp(update.nextRun)}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {update.nextRun ? format(new Date(update.nextRun), 'PPpp') : 'Never run'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>{formatTimestamp(update.lastRun)}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {update.lastRun ? format(new Date(update.lastRun), 'PPpp') : 'Never run'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {update.isActive ? (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-500 text-amber-500">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Switch 
                                  checked={update.isActive} 
                                  onCheckedChange={(checked) => 
                                    toggleActiveMutation.mutate({ id: update.id, isActive: checked })
                                  }
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                {update.isActive ? 'Deactivate schedule' : 'Activate schedule'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => runScheduleNow(update.id)}
                                  disabled={isLoading}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Run now
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  asChild
                                >
                                  <a href={`/knowledge-bases/${update.knowledgeBaseIds[0]}`}>
                                    <Edit2 className="h-4 w-4" />
                                  </a>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Edit schedule
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    if (window.confirm('Are you sure you want to delete this schedule?')) {
                                      deleteScheduleMutation.mutate(update.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Delete schedule
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex justify-between text-sm text-muted-foreground">
              <p>Showing {scheduledUpdates.length} scheduled update{scheduledUpdates.length !== 1 ? 's' : ''}</p>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>About Scheduled Knowledge Updates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start space-x-3">
                  <CalendarRange className="h-6 w-6 text-primary" />
                  <div>
                    <h3 className="font-semibold">Regular Updates</h3>
                    <p className="text-sm text-muted-foreground">
                      Keep your knowledge base fresh with regular, automated updates.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Clock className="h-6 w-6 text-primary" />
                  <div>
                    <h3 className="font-semibold">Flexible Scheduling</h3>
                    <p className="text-sm text-muted-foreground">
                      Choose from hourly, daily, weekly, or monthly update frequencies.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}