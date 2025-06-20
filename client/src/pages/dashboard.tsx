import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import { useQuery } from "@tanstack/react-query";
import { Loader2, BrainCircuit, Database, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { defaultFetcher } from "@/lib/queryClient";
import { useKnowledgeBases, usePredefinedAgents, useAgents } from "@/hooks/use-shared-data";
import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { UseTemplateButton } from "@/components/use-template-button";

export default function Dashboard() {
  const { user, token } = useAuth();
  const { toast } = useToast();

  // Log authentication details
  useEffect(() => {
    console.log("Auth status on dashboard:", {
      user: user ? "User authenticated" : "No user",
      userId: user?.id,
      authId: user?.authId,
      token: token ? "Token exists" : "No token"
    });
  }, [user, token]);

  const { 
    data: agents = [], 
    isLoading: agentsLoading, 
    error: agentsError,
    refetch: refetchAgents 
  } = useAgents();

  const { 
    data: knowledgeBases = [], 
    isLoading: kbLoading, 
    error: kbError,
    refetch: refetchKnowledgeBases 
  } = useKnowledgeBases();
  
  // Get predefined agent templates
  const { 
    data: predefinedAgents = [], 
    isLoading: predefinedAgentsLoading 
  } = usePredefinedAgents();
  
  // Get a random selection of featured agents
  const featuredAgents = useMemo(() => {
    if (predefinedAgents.length === 0) return [];
    
    // Shuffle the array to get a random selection
    console.log("predefinedAgents", predefinedAgents);
    const shuffled = [...predefinedAgents].sort(() => 0.5 - Math.random());
    // Return 6 random agents or all if less than 6
    return shuffled.slice(0, Math.min(6, shuffled.length));
  }, [predefinedAgents]);
  
  // Get the current date for usage metrics
  const currentDate = new Date();
  const startDate = new Date();
  startDate.setDate(currentDate.getDate() - 30); // Last 30 days
  
  // Type definitions for metrics
  interface UsageSummary {
    [key: string]: { 
      current: number; 
      lifetime: number; 
    };
  }
  
  interface DailyMetric {
    id: number;
    userId: number;
    date: string;
    metricType: string;
    metricValue: number;
    teamId?: number;
    region?: string;
    storageType?: string;
    source?: string;
    createdAt: string;
    updatedAt: string;
  }
  
  // Define state for metrics data and loading states
  const [summaryData, setSummaryData] = useState<UsageSummary | null>(null);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [isMetricsLoading, setIsMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<Error | null>(null);

  // Function to fetch metrics data manually
  const fetchMetricsData = async () => {
    if (!user?.id) return;
    
    setIsMetricsLoading(true);
    setMetricsError(null);
    
    try {
      // Create URL parameters
      const params = new URLSearchParams();
      params.append('startDate', startDate.toISOString().split('T')[0]); // YYYY-MM-DD format
      params.append('endDate', currentDate.toISOString().split('T')[0]); // YYYY-MM-DD format
      
      // Get auth token
      const authToken = localStorage.getItem('auth_token');
      
      // Fetch summary data with auth token
      const summaryResponse = await fetch(`/api/metrics/usage-summary?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!summaryResponse.ok) throw new Error(`Failed to fetch usage summary: ${summaryResponse.status} ${summaryResponse.statusText}`);
      const summaryResult = await summaryResponse.json();
      
      // Fetch daily metrics with auth token
      const dailyResponse = await fetch(`/api/metrics/daily?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!dailyResponse.ok) throw new Error(`Failed to fetch daily metrics: ${dailyResponse.status} ${dailyResponse.statusText}`);
      const dailyResult = await dailyResponse.json();
      
      // Update state with fetched data
      setSummaryData(summaryResult);
      setDailyMetrics(dailyResult);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      setMetricsError(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      setIsMetricsLoading(false);
    }
  };
  
  // Load metrics once when dashboard loads
  useEffect(() => {
    if (user?.id) {
      fetchMetricsData();
    }
  }, [user?.id]);
  
  // Function to refresh metrics data
  const refreshMetricsData = () => {
    fetchMetricsData();
  };
  
  // Process daily metrics into chart data format
  const processedDailyData = useMemo(() => {
    if (!dailyMetrics || dailyMetrics.length === 0) return [];
    
    // Group data by date
    const groupedByDate = dailyMetrics.reduce((acc: Record<string, any>, metric: DailyMetric) => {
      let dateObj: Date;
      
      try {
        // Handle various date formats
        dateObj = new Date(metric.date);
        if (isNaN(dateObj.getTime())) {
          console.error('Invalid date found:', metric.date);
          return acc; // Skip this entry if date is invalid
        }
      } catch (e) {
        console.error('Error parsing date:', e);
        return acc;
      }
      
      // Use ISO format as the key (YYYY-MM-DD)
      const dateKey = dateObj.toISOString().split('T')[0];
      
      if (!acc[dateKey]) {
        // Store both formatted date for display and original date for sorting
        acc[dateKey] = { 
          date: dateKey,
          displayDate: `${dateObj.getMonth()+1}/${dateObj.getDate()}`
        };
      }
      
      // If this metric type doesn't exist in accumulator, add it with current value
      if (!acc[dateKey][metric.metricType]) {
        acc[dateKey][metric.metricType] = 0;
      }
      
      // Add the metric value
      acc[dateKey][metric.metricType] += metric.metricValue;
      
      return acc;
    }, {});
    
    // Convert grouped data to array for the chart and sort by date
    return Object.values(groupedByDate).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [dailyMetrics]);
  
  // Helper function to format numbers
  const formatNumber = (num: number | undefined | null) => {
    if (num == null || num === undefined) {
      return '0';
    }
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // Render the dashboard UI
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-gray-500">Welcome back, {user?.name}!</p>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Summary card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
              <BrainCircuit className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              {agentsLoading ? (
                <div className="flex items-center justify-center h-12">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : agentsError ? (
                <div className="flex flex-col items-center space-y-2 h-auto py-2 text-red-500">
                  <div className="flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    <span className="text-sm">Error loading agents</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => refetchAgents()}
                    className="text-xs h-8 px-2"
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="text-2xl font-bold">{agents?.length || 0}</div>
              )}
              <Link href="/agents">
                <Button variant="link" className="px-0">View all agents &rarr;</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Knowledge bases card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Knowledge Bases</CardTitle>
              <Database className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              {kbLoading ? (
                <div className="flex items-center justify-center h-12">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : kbError ? (
                <div className="flex flex-col items-center space-y-2 h-auto py-2 text-red-500">
                  <div className="flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    <span className="text-sm">Error loading knowledge bases</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => refetchKnowledgeBases()}
                    className="text-xs h-8 px-2"
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="text-2xl font-bold">{knowledgeBases?.length || 0}</div>
              )}
              <Link href="/knowledge-bases">
                <Button variant="link" className="px-0">View all knowledge bases &rarr;</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Quick actions card */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks you can perform</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Link href="/agents?create=true">
                <Button className="w-full justify-start" variant="outline">
                  <BrainCircuit className="mr-2 h-4 w-4" />
                  Create New Agent
                </Button>
              </Link>
              <Link href="/knowledge-bases?create=true">
                <Button className="w-full justify-start" variant="outline">
                  <Database className="mr-2 h-4 w-4" />
                  Create Knowledge Base
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        
        
        {/* Random Predefined Agents section */}
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Featured Agent Templates</CardTitle>
              <CardDescription>Ready-to-use agent templates to get you started quickly</CardDescription>
            </div>
            <Link href="/agent-marketplace">
              <Button variant="outline" size="sm">
                View All Templates
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {predefinedAgentsLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : featuredAgents.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                No agent templates available
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {featuredAgents.slice(0, 3).map(agent => (
                  <Card key={agent.id} className="overflow-hidden bg-gradient-to-br from-muted/50 to-muted/10">
                    <CardHeader className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-xl">
                          {agent.icon || "🤖"}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{agent.name}</CardTitle>
                          <CardDescription className="text-xs mt-1">{agent.category || "AI Assistant"}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                      <p className="text-sm text-muted-foreground mb-3">{agent.description}</p>
                      <UseTemplateButton 
                        templateId={agent.id} 
                        templateName={agent.name} 
                        className="w-full" 
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Metrics Section */}
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Usage Metrics</CardTitle>
              <CardDescription>Your system usage for the past 30 days</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={refreshMetricsData}
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Link href="/metrics/usage">
                <Button variant="outline" size="sm">
                  View Detailed Metrics
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isMetricsLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : metricsError ? (
              <div className="text-center py-10 text-red-500">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <h3 className="text-lg font-semibold">Error loading metrics</h3>
                <p className="text-muted-foreground">
                  {metricsError.message || "We couldn't load your usage metrics. Please try again."}
                </p>
              </div>
            ) : summaryData && Object.keys(summaryData).length > 0 ? (
              <div className="space-y-6">
                {/* Usage summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(summaryData).slice(0, 4).map(([key, value]) => {
                    const { current, lifetime } = value as { current: number; lifetime: number };
                    return (
                      <div key={key} className="bg-muted/50 p-3 rounded-lg">
                        <div className="text-xs uppercase font-medium text-muted-foreground mb-1">
                          {key.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xl font-bold">
                          {formatNumber(current)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Lifetime: {formatNumber(lifetime)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Usage trends chart */}
                {processedDailyData.length > 0 && (
                  <div className="bg-card rounded-lg p-4 mt-6 border">
                    <h4 className="text-base font-medium mb-3">Usage Trends (30-Day)</h4>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={processedDailyData}
                          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                          <XAxis 
                            dataKey="displayDate" 
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip 
                            formatter={(value: any, name: any) => {
                              if (value !== undefined) {
                                return [Number(value).toLocaleString(), String(name).replace(/_/g, ' ')];
                              }
                              return ['', ''];
                            }}
                          />
                          <Legend />
                          {processedDailyData.length > 0 && 
                            Object.keys(processedDailyData[0])
                              .filter(key => key !== 'date')
                              .map((key, index) => {
                                const colors = ['#4f46e5', '#16a34a', '#ea580c', '#8b5cf6'];
                                return (
                                  <Line 
                                    key={key}
                                    type="monotone" 
                                    dataKey={key} 
                                    stroke={colors[index % colors.length]}
                                    name={String(key).replace(/_/g, ' ')}
                                  />
                                );
                              })
                          }
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10">
                <h3 className="text-lg font-semibold">No usage data found</h3>
                <p className="text-muted-foreground">
                  Start using the system to generate usage metrics.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Recent activity section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your recent interactions with the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-8 text-center text-gray-500">
              <p>No recent activity to display.</p>
              <p className="text-sm mt-2">Activity will appear here as you use the system.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
