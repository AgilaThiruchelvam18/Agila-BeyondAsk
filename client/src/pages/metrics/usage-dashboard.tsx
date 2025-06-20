import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useAuth } from '@/components/auth/auth-provider';
import { defaultFetcher } from '@/lib/queryClient';

// Type definitions for metrics data
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
  metadata?: {
    provider?: string;
    model?: string;
    keyType?: 'user' | 'environment';
    tokenType?: string;
    isEnvironmentKey?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface RegionalMetric {
  region: string;
  value: number;
}

interface StorageMetric {
  type: string;
  sizeKb: number;
}

interface LlmUsageMetric {
  provider: string;
  model: string;
  keyType: 'user' | 'environment' | 'unknown';
  tokens: number;
}

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// Utility functions for formatting data
const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Define date range type for type safety
type DateRangeKey = '7d' | '30d' | '90d' | 'year' | 'custom';

interface DateRangeInfo {
  label: string;
  days: number;
}

// Date range presets
const DATE_RANGES: Record<DateRangeKey, DateRangeInfo> = {
  '7d': { label: 'Last 7 days', days: 7 },
  '30d': { label: 'Last 30 days', days: 30 },
  '90d': { label: 'Last 90 days', days: 90 },
  'year': { label: 'This year', days: 365 },
  'custom': { label: 'Custom range', days: 0 }
};

export default function UsageMetricsDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // State for filters
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState<DateRangeKey>('30d');
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [teamId, setTeamId] = useState<string | undefined>(undefined);
  const [metric, setMetric] = useState<string | undefined>(undefined);

  // Update start date when date range changes
  useEffect(() => {
    if (dateRange !== 'custom') {
      const newStartDate = new Date();
      // Use type assertion to ensure TypeScript knows dateRange is a valid key
      const rangeDays = DATE_RANGES[dateRange as DateRangeKey].days;
      newStartDate.setDate(newStartDate.getDate() - rangeDays);
      setStartDate(newStartDate);
      setEndDate(new Date());
    }
  }, [dateRange]);


  // Queries for fetching data
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery<UsageSummary>({
    queryKey: ['/api/metrics/usage-summary', teamId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (teamId) params.append('teamId', teamId);
      params.append('startDate', startDate.toISOString().split('T')[0]); // YYYY-MM-DD format
      params.append('endDate', endDate.toISOString().split('T')[0]); // YYYY-MM-DD format
      
      // Get auth token directly to ensure it's included in the request
      const authToken = localStorage.getItem('auth_token');
      const response = await fetch(`/api/metrics/usage-summary?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    },
  });

  const { data: dailyMetrics, isLoading: isDailyLoading } = useQuery<DailyMetric[]>({
    queryKey: ['/api/metrics/daily', teamId, startDate, endDate, metric],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (teamId) params.append('teamId', teamId);
      params.append('startDate', startDate.toISOString().split('T')[0]); // YYYY-MM-DD format
      params.append('endDate', endDate.toISOString().split('T')[0]); // YYYY-MM-DD format
      if (metric && metric !== 'all') params.append('metricType', metric);
      
      // Get auth token directly to ensure it's included in the request
      const authToken = localStorage.getItem('auth_token');
      const response = await fetch(`/api/metrics/daily?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch daily metrics: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    },
  });

  const { data: regionalMetrics, isLoading: isRegionalLoading } = useQuery<RegionalMetric[]>({
    queryKey: ['/api/metrics/regional', teamId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (teamId) params.append('teamId', teamId);
      params.append('startDate', startDate.toISOString().split('T')[0]); // YYYY-MM-DD format
      params.append('endDate', endDate.toISOString().split('T')[0]); // YYYY-MM-DD format
      
      // Get auth token directly to ensure it's included in the request
      const authToken = localStorage.getItem('auth_token');
      const response = await fetch(`/api/metrics/regional?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch regional metrics: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    },
    enabled: activeTab === 'regional',
  });

  const { data: storageMetrics, isLoading: isStorageLoading } = useQuery<StorageMetric[]>({
    queryKey: ['/api/metrics/storage', teamId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (teamId) params.append('teamId', teamId);
      
      // Get auth token directly to ensure it's included in the request
      const authToken = localStorage.getItem('auth_token');
      const response = await fetch(`/api/metrics/storage?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch storage metrics: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    },
    enabled: activeTab === 'storage',
  });

  // Fetch LLM usage metrics specifically
  const { data: llmMetrics, isLoading: isLlmLoading, refetch: refetchLlmMetrics } = useQuery<DailyMetric[]>({
    queryKey: ['/api/metrics/llm-usage', teamId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (teamId) params.append('teamId', teamId);
      params.append('startDate', startDate.toISOString().split('T')[0]);
      params.append('endDate', endDate.toISOString().split('T')[0]);
      params.append('metricType', 'llm_tokens_used');
      
      // Get auth token directly to ensure it's included in the request
      const authToken = localStorage.getItem('auth_token');
      const response = await fetch(`/api/metrics/daily?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch LLM metrics: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    },
    enabled: activeTab === 'llm-usage',
    refetchInterval: activeTab === 'llm-usage' ? 5000 : false, // Refresh every 5 seconds when tab is active
    refetchOnWindowFocus: true,
  });

  // Process daily metrics into chart data format
  const processedDailyData = useMemo(() => {
    if (!dailyMetrics) return [];
    
    // First build a map of all dates in the range
    const dateRange: Record<string, any> = {};
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    // Get unique metric types to initialize with zeros
    const metricTypes = new Set(dailyMetrics.map(m => m.metricType));
    
    // Format date consistently using ISO format for map keys
    const formatDateKey = (date: Date) => date.toISOString().split('T')[0]; // YYYY-MM-DD
    const formatDisplayDate = (date: Date) => date.toLocaleDateString(); // Display format
    
    // Fill in all dates in the selected range, even if no data
    for (let timestamp = startTime; timestamp <= endTime; timestamp += dayInMs) {
      const currentDate = new Date(timestamp);
      const dateKey = formatDateKey(currentDate);
      const displayDate = formatDisplayDate(currentDate);
      
      // Initialize this date with display format (for the chart)
      dateRange[dateKey] = { date: displayDate };
      
      // Initialize all metric types with zero
      if (metricTypes.size > 0) {
        metricTypes.forEach(type => {
          dateRange[dateKey][type] = 0;
        });
      }
    }
    
    // Now fill in the actual data
    dailyMetrics.forEach(metric => {
      const metricDate = new Date(metric.date);
      const dateKey = formatDateKey(metricDate);
      
      if (!dateRange[dateKey]) {
        // If somehow this date wasn't in our range (should be rare)
        const displayDate = formatDisplayDate(metricDate);
        dateRange[dateKey] = { date: displayDate };
        
        // Initialize other metric types to zero
        metricTypes.forEach(type => {
          if (type !== metric.metricType) {
            dateRange[dateKey][type] = 0;
          }
        });
      }
      
      // If this metric type doesn't exist in the accumulator, add it with value 0
      if (dateRange[dateKey][metric.metricType] === undefined) {
        dateRange[dateKey][metric.metricType] = 0;
      }
      
      // Add the metric value
      dateRange[dateKey][metric.metricType] += metric.metricValue;
    });
    
    // Convert grouped data to array for the chart and sort by date
    return Object.values(dateRange).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [dailyMetrics, startDate, endDate]);

  // Define interfaces for our data structures
  interface DateMetric {
    date: string;
    openai: number;
    anthropic: number;
    mistral: number;
    custom: number;
    unknown: number;
    [key: string]: string | number; // Allow dynamic provider names
  }
  
  interface ProviderMetrics {
    [provider: string]: number;
  }
  
  interface ModelMetrics {
    [model: string]: number;
  }
  
  interface KeyTypeMetrics {
    user: number;
    environment: number;
    unknown: number;
    [key: string]: number;
  }
  
  interface DateMetrics {
    [date: string]: DateMetric;
  }
  
  interface ProcessedLlmData {
    byProvider: {name: string, value: number}[];
    byModel: {name: string, value: number}[];
    byKeyType: {name: string, value: number}[];
    byDate: any[]; // Keep this as any for now since it has a complex structure
  }
  
  // Process LLM metrics into chart data format for model-specific and provider-specific charts
  const processedLlmData = useMemo<ProcessedLlmData>(() => {
    if (!llmMetrics || llmMetrics.length === 0) return { 
      byProvider: [], 
      byModel: [], 
      byKeyType: [],
      byDate: []
    };
    
    // Prepare groups
    const byProvider: ProviderMetrics = {};
    const byModel: ModelMetrics = {};
    const byKeyType: KeyTypeMetrics = {
      user: 0,
      environment: 0,
      unknown: 0
    };
    const byDate: DateMetrics = {};
    
    // Format date consistently using ISO format for map keys
    const formatDateKey = (date: Date) => date.toISOString().split('T')[0]; // YYYY-MM-DD
    const formatDisplayDate = (date: Date) => date.toLocaleDateString(); // Display format
    
    // Fill in all dates in the selected range with zero values, even if no data
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    for (let timestamp = startTime; timestamp <= endTime; timestamp += dayInMs) {
      const currentDate = new Date(timestamp);
      const dateKey = formatDateKey(currentDate);
      const displayDate = formatDisplayDate(currentDate);
      
      // Initialize with zero values for each date
      byDate[dateKey] = { 
        date: displayDate,
        openai: 0,
        anthropic: 0, 
        mistral: 0,
        custom: 0,
        unknown: 0
      };
    }
    
    // Process metrics
    llmMetrics.forEach(metric => {
      let provider = metric.metadata?.provider || 'unknown';
      let model = metric.metadata?.model || 'unknown';
      const keyType = metric.metadata?.keyType || 'unknown';
      const metricDate = new Date(metric.date);
      const dateKey = formatDateKey(metricDate);
      
      // Map provider IDs to actual provider names if they're numeric (for backward compatibility)
      if (typeof provider === 'string' || typeof provider === 'number') {
        const providerStr = String(provider).toLowerCase();
        if (providerStr === '1') {
          provider = 'openai';
        } else if (providerStr === '2') {
          provider = 'anthropic';
        } else if (providerStr === '3') {
          provider = 'mistral';
        }
        // If it's already a slug (like 'openai', 'anthropic'), keep it as is
      } else {
        // Fallback for unexpected provider format
        provider = 'unknown';
      }
      
      // Map model IDs to names if needed (for backward compatibility)
      if (typeof model === 'string' || typeof model === 'number') {
        const modelStr = String(model).toLowerCase();
        if (modelStr === '1') {
          model = 'gpt-4o';
        } else if (modelStr === '2') {
          model = 'gpt-3.5-turbo';
        } else if (modelStr === '3') {
          model = 'claude-3-sonnet';
        }
        // If it's already a model name (like 'gpt-4o'), keep it as is
      } else {
        // Fallback for unexpected model format
        model = 'unknown';
      }
      
      // Group by provider
      if (!byProvider[provider]) {
        byProvider[provider] = 0;
      }
      byProvider[provider] += Number(metric.metricValue);
      
      // Group by model
      if (!byModel[model]) {
        byModel[model] = 0;
      }
      byModel[model] += Number(metric.metricValue);
      
      // Group by key type
      if (!byKeyType[keyType]) {
        byKeyType[keyType] = 0;
      }
      byKeyType[keyType] += Number(metric.metricValue);
      
      // Group by date with provider breakdown
      if (dateKey in byDate) {
        // Use normalized provider keys that match our predefined properties
        const providerKey = provider.toLowerCase();
        
        if (providerKey in byDate[dateKey]) {
          byDate[dateKey][providerKey] = Number(byDate[dateKey][providerKey]) + Number(metric.metricValue);
        } else {
          // If provider not in our predefined list, add to "custom"
          byDate[dateKey].custom = Number(byDate[dateKey].custom) + Number(metric.metricValue);
        }
      }
    });
    
    // Convert to array format for charts
    return {
      byProvider: Object.entries(byProvider).map(([name, value]) => ({ name, value })),
      byModel: Object.entries(byModel).map(([name, value]) => ({ name, value })),
      byKeyType: Object.entries(byKeyType).map(([name, value]) => ({ name, value: value as number })),
      byDate: Object.values(byDate).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    };
  }, [llmMetrics, startDate, endDate]);

  // Download metrics data as CSV
  const downloadMetricsCSV = () => {
    if (!dailyMetrics || dailyMetrics.length === 0) {
      toast({
        title: "No data to download",
        description: "There are no metrics data available for the selected filters.",
        variant: "destructive"
      });
      return;
    }
    
    // Create CSV header
    const headers = ['Date', 'Metric Type', 'Value', 'Region', 'Source', 'Storage Type'];
    
    // Create CSV rows
    const rows = dailyMetrics.map(metric => [
      new Date(metric.date).toLocaleDateString(),
      metric.metricType,
      metric.metricValue,
      metric.region || '',
      metric.source || '',
      metric.storageType || ''
    ]);
    
    // Combine headers and rows
    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create blob and download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `metrics_${startDate.toISOString().slice(0, 10)}_to_${endDate.toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Usage Metrics Dashboard</h1>
          <Button 
            onClick={downloadMetricsCSV} 
            disabled={isDailyLoading || !dailyMetrics || dailyMetrics.length === 0}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Data
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium">Date Range</label>
            <Select 
              value={dateRange} 
              onValueChange={(value) => {
                // Ensure value is a valid DateRangeKey
                if (value === '7d' || value === '30d' || value === '90d' || 
                    value === 'year' || value === 'custom') {
                  setDateRange(value);
                }
              }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select a date range" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DATE_RANGES).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {dateRange === 'custom' && (
            <>
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <DatePicker date={startDate} setDate={setStartDate} />
              </div>
              
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <DatePicker date={endDate} setDate={setEndDate} />
              </div>
            </>
          )}
          
          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium">Metric Type</label>
            <Select value={metric} onValueChange={setMetric}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All metrics" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All metrics</SelectItem>
                <SelectItem value="token_usage">Token Usage</SelectItem>
                <SelectItem value="api_calls">API Calls</SelectItem>
                <SelectItem value="storage_usage">Storage Usage</SelectItem>
                <SelectItem value="embedding_tokens">Embedding Tokens</SelectItem>
                <SelectItem value="document_count">Document Count</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="usage">Usage Trends</TabsTrigger>
            <TabsTrigger value="llm-usage">LLM Usage</TabsTrigger>
            <TabsTrigger value="regional">Regional Analysis</TabsTrigger>
            <TabsTrigger value="storage">Storage Utilization</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            {isSummaryLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : summaryData && Object.keys(summaryData).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(summaryData).map(([key, { current, lifetime }]) => (
                  <Card key={key}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg capitalize">{key.replace(/_/g, ' ')}</CardTitle>
                      <CardDescription>Current: {formatNumber(current)}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        Lifetime: {formatNumber(lifetime)}
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {current > 0 && lifetime > 0 ? 
                          `${Math.round((current / lifetime) * 100)}% of your lifetime usage is in the current period.` :
                          'No usage data available for the selected period.'
                        }
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <h3 className="text-lg font-semibold">No usage data found</h3>
                <p className="text-muted-foreground">
                  We don't have any usage data for the selected period.
                  Try adjusting your filters or start using the platform more to generate metrics.
                </p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="usage">
            {isDailyLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : processedDailyData && processedDailyData.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Daily Usage Trends</CardTitle>
                  <CardDescription>
                    Showing usage metrics from {startDate.toLocaleDateString()} to {endDate.toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={processedDailyData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {/* Dynamically create lines for each metric type in the data */}
                        {processedDailyData.length > 0 && Object.keys(processedDailyData[0])
                          .filter(key => key !== 'date')
                          .map((key, index) => (
                            <Line 
                              key={key}
                              type="monotone" 
                              dataKey={key} 
                              stroke={COLORS[index % COLORS.length]}
                              name={key.replace(/_/g, ' ')}
                            />
                          ))
                        }
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-10">
                <h3 className="text-lg font-semibold">No usage data found</h3>
                <p className="text-muted-foreground">
                  We don't have any daily usage data for the selected period.
                  Try adjusting your filters or start using the platform more to generate metrics.
                </p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="regional">
            {isRegionalLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : regionalMetrics && regionalMetrics.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Regional Usage Distribution</CardTitle>
                    <CardDescription>
                      Showing regional usage from {startDate.toLocaleDateString()} to {endDate.toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={regionalMetrics}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            nameKey="region"
                          >
                            {regionalMetrics.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatNumber(value as number)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Regional Usage Breakdown</CardTitle>
                    <CardDescription>
                      Comparing usage across different regions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={regionalMetrics}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 50, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="region" type="category" />
                          <Tooltip formatter={(value) => formatNumber(value as number)} />
                          <Legend />
                          <Bar dataKey="value" name="Usage" fill="#8884d8">
                            {regionalMetrics.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-10">
                <h3 className="text-lg font-semibold">No regional data found</h3>
                <p className="text-muted-foreground">
                  We don't have any regional usage data for the selected period.
                  Try adjusting your filters or start using the platform more to generate metrics.
                </p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="llm-usage">
            {activeTab === 'llm-usage' && (
              <div className="bg-muted/30 rounded-md p-3 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  <p>
                    LLM usage metrics are updated when you refresh using the buttons below. Metrics include both user API keys and environment API keys.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 shrink-0"
                  onClick={() => refetchLlmMetrics()}
                  disabled={isLlmLoading}
                >
                  {isLlmLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Refreshing...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Refresh All</span>
                    </>
                  )}
                </Button>
              </div>
            )}
            {isLlmLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : llmMetrics && llmMetrics.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>LLM Usage by Provider</CardTitle>
                      <CardDescription>
                        Distribution of token usage by provider
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => refetchLlmMetrics()}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Refresh</span>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={processedLlmData.byProvider}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={120}
                            paddingAngle={5}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, value }) => `${name}: ${formatNumber(value)}`}
                            labelLine={false}
                          >
                            {processedLlmData.byProvider.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatNumber(value as number)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>LLM Usage by Model</CardTitle>
                    <CardDescription>
                      Distribution of token usage by model
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={processedLlmData.byModel}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis type="category" dataKey="name" width={100} />
                          <Tooltip formatter={(value) => formatNumber(value as number)} />
                          <Legend />
                          <Bar dataKey="value" name="Tokens" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="lg:col-span-2">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Key Type Usage Distribution</CardTitle>
                      <CardDescription>
                        Distribution of token usage by key type (user-provided vs. environment keys)
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => refetchLlmMetrics()}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Refresh</span>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {processedLlmData.byKeyType.map((keyType, index) => (
                          <div key={index} className="flex items-center gap-4 p-4 rounded-md border">
                            <div 
                              className="w-12 h-12 rounded-full flex items-center justify-center" 
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            >
                              <span className="text-white font-semibold">
                                {keyType.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold capitalize">
                                  {keyType.name === 'environment' ? 'System API Key' : 'User API Key'}
                                </h3>
                                <Badge variant={keyType.name === 'environment' ? 'outline' : 'default'}>
                                  {keyType.name}
                                </Badge>
                              </div>
                              <p className="text-muted-foreground text-sm">
                                {formatNumber(keyType.value)} tokens
                              </p>
                              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mt-2">
                                <div 
                                  className="h-full rounded-full" 
                                  style={{ 
                                    width: `${(keyType.value / processedLlmData.byKeyType.reduce((acc, item) => acc + item.value, 0)) * 100}%`,
                                    backgroundColor: COLORS[index % COLORS.length]
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="text-center text-sm text-muted-foreground">
                        <p>
                          Total tokens used: {formatNumber(processedLlmData.byKeyType.reduce((acc, item) => acc + item.value, 0))}
                        </p>
                        {processedLlmData.byKeyType.some(type => type.name === 'environment') && (
                          <p className="mt-2">
                            System API keys are used when you haven't provided your own API keys or when your keys are unavailable.
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>LLM Usage Trends by Provider</CardTitle>
                    <CardDescription>
                      Daily LLM token usage from {startDate.toLocaleDateString()} to {endDate.toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={processedLlmData.byDate}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip formatter={(value) => formatNumber(value as number)} />
                          <Legend />
                          <Area type="monotone" dataKey="openai" stackId="1" stroke="#4ade80" fill="#4ade80" />
                          <Area type="monotone" dataKey="anthropic" stackId="1" stroke="#f97316" fill="#f97316" />
                          <Area type="monotone" dataKey="mistral" stackId="1" stroke="#3b82f6" fill="#3b82f6" />
                          <Area type="monotone" dataKey="custom" stackId="1" stroke="#a855f7" fill="#a855f7" />
                          <Area type="monotone" dataKey="unknown" stackId="1" stroke="#64748b" fill="#64748b" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-10 max-w-2xl mx-auto">
                <h3 className="text-xl font-semibold mb-3">No LLM usage data found</h3>
                <p className="text-muted-foreground mb-6">
                  We don't have any LLM token usage data for the selected period.
                  Try adjusting your filters, using the chat feature with AI agents, or manually refresh to check for recent data.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1"
                    onClick={() => refetchLlmMetrics()}
                    disabled={isLlmLoading}
                  >
                    {isLlmLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Refreshing...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Refresh Metrics</span>
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="gap-1"
                    onClick={() => {
                      setStartDate(new Date(new Date().setDate(new Date().getDate() - 30)));
                      setEndDate(new Date());
                    }}
                  >
                    <span>View Last 30 Days</span>
                  </Button>
                </div>
                <div className="mt-6 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                  <p className="font-medium mb-2">How metrics are generated:</p>
                  <ul className="list-disc list-inside space-y-1 text-left">
                    <li>Using the chat interface with AI agents generates token usage</li>
                    <li>Both your API keys and system API keys (when used as fallback) are tracked</li>
                    <li>Metrics are updated in real-time and can be manually refreshed</li>
                  </ul>
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="storage">
            {isStorageLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : storageMetrics && storageMetrics.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Storage Usage by Type</CardTitle>
                    <CardDescription>
                      Breakdown of storage utilization across different types
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={storageMetrics}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="sizeKb"
                            nameKey="type"
                          >
                            {storageMetrics.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatBytes((value as number) * 1024)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Storage Utilization</CardTitle>
                    <CardDescription>
                      Showing storage usage in KB by type
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={storageMetrics}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="type" />
                          <YAxis tickFormatter={(value) => formatBytes(value * 1024)} />
                          <Tooltip formatter={(value) => formatBytes((value as number) * 1024)} />
                          <Legend />
                          <Bar dataKey="sizeKb" name="Size" fill="#8884d8">
                            {storageMetrics.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Storage Summary</CardTitle>
                    <CardDescription>
                      Total storage used and breakdown by type
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold mb-4">
                      Total Storage: {formatBytes(storageMetrics.reduce((acc, curr) => acc + curr.sizeKb, 0) * 1024)}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {storageMetrics.map((metric) => (
                        <div key={metric.type} className="flex flex-col p-4 bg-muted rounded-lg">
                          <div className="text-lg font-semibold capitalize">{metric.type}</div>
                          <div className="text-xl">{formatBytes(metric.sizeKb * 1024)}</div>
                          <div className="text-sm text-muted-foreground">
                            {((metric.sizeKb / storageMetrics.reduce((acc, curr) => acc + curr.sizeKb, 0)) * 100).toFixed(1)}% of total
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-10">
                <h3 className="text-lg font-semibold">No storage data found</h3>
                <p className="text-muted-foreground">
                  We don't have any storage utilization data for the selected period.
                  Try adjusting your filters or start using the platform more to generate metrics.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}