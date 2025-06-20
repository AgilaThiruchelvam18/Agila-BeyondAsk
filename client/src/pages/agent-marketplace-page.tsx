import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Plus, Gift, Tag, Info, Database, AlertCircle, Filter, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuGroup,
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

// Agent template type
interface AgentTemplate {
  id: number;
  name: string;
  description: string | null;
  isPredefined: boolean;
  icon: string | null;
  tags: string[];
  providerId: number;
  modelId: number;
  promptTemplate: string | null;
  rules: string[];
  configuration: any;
  confidenceThreshold: string;
  fallbackMessage: string;
  enableConversationMemory: boolean;
  allowContinuousGeneration: boolean;
}

// Category group definitions
const categoryGroups = {
  "Content & Writing": [
    "content", "blogging", "writing", "copywriting", "content marketing", 
    "technical", "documentation", "help", "knowledge base", "summarization", 
    "UX writing", "microcopy"
  ],
  "Marketing & Advertising": [
    "marketing", "advertising", "social media", "facebook", "google ads", 
    "PPC", "search", "email marketing", "newsletter", "landing page", 
    "conversion", "branding", "slogans", "taglines"
  ],
  "Sales & Customer Relations": [
    "sales", "outreach", "email", "lead generation", "customer feedback", 
    "reviews", "sentiment analysis", "insights", "customer service", 
    "support", "help desk", "follow-up", "surveys"
  ],
  "Business Strategy": [
    "business plan", "entrepreneurship", "startup", "planning", "business", 
    "strategy", "strategic planning", "SWOT", "business analysis", "KPI", 
    "reporting", "data analysis", "business intelligence"
  ],
  "E-commerce & Product": [
    "e-commerce", "shopify", "amazon", "product descriptions", "conversion"
  ],
  "Professional Development": [
    "linkedin", "professional", "thought leadership", "productivity", 
    "meetings", "communication"
  ],
  "Creative & Design": [
    "AI", "midjourney", "design", "art", "prompting", "generative AI", 
    "image generation", "creative", "interface design"
  ],
  "Business Communication": [
    "investor pitch", "sales deck", "presentations", "fundraising", "PR", 
    "press release", "media", "communications", "announcements", "proposals", 
    "business development", "pitching"
  ]
};

const AgentMarketplacePage: React.FC = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [customName, setCustomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [currentCategory, setCurrentCategory] = useState("all");
  const [currentCategoryGroup, setCurrentCategoryGroup] = useState("All Categories");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Fetch predefined agent templates
  const { data: templates, isLoading, error } = useQuery<AgentTemplate[]>({
    queryKey: ["predefined-agents"],
    queryFn: async () => {
      const baseUrl = window.location.origin;
      const url = `${baseUrl}/api/predefined-agents`;
      
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }
      
      const data = await response.json();
      return data;
    },
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });

  // Process templates once loaded

  // Ensure templates have properly formatted tags and make a normalized copy for use
  const normalizedTemplates = templates?.map(template => {
    if (!template) return null;
    
    // Create a deep copy to avoid mutating the original data
    const normalizedTemplate = {...template};
    
    // Normalize tags array
    if (!normalizedTemplate.tags) {
      normalizedTemplate.tags = [];
    } else if (typeof normalizedTemplate.tags === 'string') {
      // Try to parse JSON string
      try {
        normalizedTemplate.tags = JSON.parse(normalizedTemplate.tags);
      } catch (e) {
        normalizedTemplate.tags = [];
      }
    } else if (!Array.isArray(normalizedTemplate.tags)) {
      normalizedTemplate.tags = [];
    }
    
    return normalizedTemplate;
  }).filter(Boolean) as AgentTemplate[]; // Remove nulls and cast to expected type
  
  // Check if a tag belongs to the current category group
  const isTagInCurrentCategoryGroup = (tag: string) => {
    if (currentCategoryGroup === "All Categories") {
      return true;
    }
    
    return categoryGroups[currentCategoryGroup as keyof typeof categoryGroups]?.includes(tag.toLowerCase());
  };
  
  // Filter templates based on search, category, and category group
  const filteredTemplates = normalizedTemplates?.filter(template => {    
    // Check if it matches search query
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template.description && template.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Check if it matches selected category
    const matchesCategory = currentCategory === "all" ||
      template.tags.includes(currentCategory);
    
    // Check if it belongs to the selected category group
    const matchesCategoryGroup = currentCategoryGroup === "All Categories" ||
      template.tags.some(tag => isTagInCurrentCategoryGroup(tag));
    
    return matchesSearch && matchesCategory && matchesCategoryGroup;
  });

  // Templates are already fetched via React Query, no need for manual fetch

  // Get all tags in flat array from category groups
  const allTags = Object.values(categoryGroups).flat();

  // Handle creating a new agent from template
  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate) return;

    setIsCreating(true);
    
    try {
      const name = customName.trim() || `${selectedTemplate.name} Copy`;
      
      const newAgent = await apiRequest(
        `/api/agents/from-template/${selectedTemplate.id}`, 
        {
          method: "POST",
          data: { name }
        }
      );
      
      // Invalidate queries to refresh agent list
      queryClient.invalidateQueries({queryKey: ["/api/agents"]});
      
      toast({
        title: "Agent created successfully",
        description: `Your new agent "${newAgent.name}" is ready to use.`,
      });
      
      // Reset and close dialog
      setCustomName("");
      setSelectedTemplate(null);
      
    } catch (error) {
      console.error("Error creating agent from template:", error);
      toast({
        title: "Error creating agent",
        description: "There was a problem creating your agent. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">AI Agent Marketplace</h1>
      </div>
      
      <p className="text-muted-foreground mb-6">
        Browse our collection of pre-configured AI agents designed for specific tasks. 
        Select a template to quickly create a customized agent ready for your knowledge base.
      </p>
      
      {/* Search and filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search templates..." 
            className="pl-8" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2">
          {/* Category Group Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex gap-2 items-center">
                <Filter className="h-4 w-4" />
                {currentCategoryGroup}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-white w-56">
              <DropdownMenuLabel>Categories</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => {
                  setCurrentCategoryGroup("All Categories");
                  setCurrentCategory("all");
                }}
                className={currentCategoryGroup === "All Categories" ? "bg-accent" : ""}
              >
                All Categories
              </DropdownMenuItem>
              
              {Object.keys(categoryGroups).map(group => (
                <DropdownMenuItem 
                  key={group}
                  onClick={() => {
                    setCurrentCategoryGroup(group);
                    setCurrentCategory("all"); // Reset individual category when selecting a group
                  }}
                  className={currentCategoryGroup === group ? "bg-accent" : ""}
                >
                  {group}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Tag filter - only show this if a category group is selected */}
          {currentCategoryGroup !== "All Categories" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex gap-2 items-center">
                  <Tag className="h-4 w-4" />
                  {currentCategory === "all" ? "All Tags" : currentCategory}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-white">
                <DropdownMenuLabel>Filter by Tag</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setCurrentCategory("all")}
                  className={currentCategory === "all" ? "bg-accent" : ""}
                >
                  All Tags
                </DropdownMenuItem>
                
                {/* Only show tags from the current category group */}
                {currentCategoryGroup !== "All Categories" && 
                  categoryGroups[currentCategoryGroup as keyof typeof categoryGroups].map(tag => (
                    <DropdownMenuItem 
                      key={tag}
                      onClick={() => setCurrentCategory(tag)}
                      className={currentCategory === tag ? "bg-accent" : ""}
                    >
                      {tag}
                    </DropdownMenuItem>
                  ))
                }
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      
      {/* Templates grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading templates...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64 text-destructive">
          <p>Failed to load agent templates. Please try again later.</p>
        </div>
      ) : filteredTemplates?.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <p>No templates found matching your criteria.</p>
          <Button variant="link" onClick={() => { setSearchQuery(""); setCurrentCategory("all"); }}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates?.map(template => {
            console.log("Rendering template card:", template.id, template.name);
            return (
              <TemplateCard 
                key={template.id} 
                template={template} 
                onSelect={() => {
                  console.log("Selected template:", template);
                  setSelectedTemplate(template);
                  setCustomName("");
                }} 
              />
            );
          })}
        </div>
      )}
      
      {/* Template selection dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        {selectedTemplate && (
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <span className="text-2xl mr-2">{selectedTemplate.icon || '🤖'}</span>
                <span>{selectedTemplate.name}</span>
              </DialogTitle>
              <DialogDescription>
                {selectedTemplate.description}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedTemplate.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="capitalize">
                  {tag}
                </Badge>
              ))}
            </div>
            
            <Separator className="my-4" />
            
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Template Rules</h4>
                {selectedTemplate.rules.length > 0 ? (
                  <ul className="text-sm text-muted-foreground space-y-1 pl-5 list-disc">
                    {selectedTemplate.rules.map((rule, index) => (
                      <li key={index}>{rule}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No specific rules defined for this template.</p>
                )}
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-2">Customize Agent Name (Optional)</h4>
                <Input 
                  placeholder={`${selectedTemplate.name} Copy`}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>
            </div>
            
            <DialogFooter className="mt-4">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleCreateFromTemplate} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Agent
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </DashboardLayout>
  );
};

// Template card component
const TemplateCard: React.FC<{ 
  template: AgentTemplate; 
  onSelect: () => void;
}> = ({ template, onSelect }) => {
  console.log("TemplateCard rendering template:", template.id, template.name);
  console.log("Template tags in card component:", template.tags);
  
  // Ensure tags is an array
  const tags = Array.isArray(template.tags) 
    ? template.tags 
    : typeof template.tags === 'string' 
      ? (
          // Try to parse the string as JSON
          (() => {
            try { return JSON.parse(template.tags as string); }
            catch { return []; }
          })()
        )
      : [];
  
  // Ensure rules is an array
  const rules = Array.isArray(template.rules) 
    ? template.rules 
    : typeof template.rules === 'string' 
      ? (
          // Try to parse the string as JSON
          (() => {
            try { return JSON.parse(template.rules as string); }
            catch { return []; }
          })()
        )
      : [];
  
  console.log("Processed tags for display:", tags);
  
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center">
            <span className="text-3xl mr-3">{template.icon || '🤖'}</span>
            <div>
              <CardTitle className="text-lg">{template.name}</CardTitle>
            </div>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Templates use GPT-4o by default</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {tags.map((tag: string, index: number) => (
            <Badge key={`${tag}-${index}`} variant="secondary" className="text-muted-foreground capitalize">
              <Tag className="h-3 w-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>
        <CardDescription className="mt-1 line-clamp-2">
          {template.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="line-clamp-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Capabilities: </span>
          {rules.length > 0 ? (
            rules.slice(0, 3).join(". ") + (rules.length > 3 ? "..." : "")
          ) : (
            "A general purpose assistant with no specific rules."
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={onSelect} 
          className="w-full"
        >
          <Gift className="mr-2 h-4 w-4" />
          Use Template
        </Button>
      </CardFooter>
    </Card>
  );
};

export default AgentMarketplacePage;