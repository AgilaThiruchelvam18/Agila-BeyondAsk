import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Card, 
  CardContent
} from "@/components/ui/card";
import { 
  FileText, 
  FileUp, 
  Globe, 
  Youtube, 
  Filter, 
  X, 
  CalendarIcon 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TagInput } from "@/components/ui/tag-input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface DocumentFilterOptions {
  searchTerm: string;
  documentTypes: string[];
  tags: string[];
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  customFields: Record<string, any>;
}

interface DocumentFiltersProps {
  onFilterChange: (filters: DocumentFilterOptions) => void;
  availableTags: string[];
  customFields?: any[];
  activeFilters: DocumentFilterOptions;
}

export function DocumentFilters({ 
  onFilterChange, 
  availableTags,
  customFields = [],
  activeFilters
}: DocumentFiltersProps) {
  // Local state for filters
  const [searchTerm, setSearchTerm] = useState<string>(activeFilters.searchTerm || "");
  const [documentTypes, setDocumentTypes] = useState<string[]>(activeFilters.documentTypes || []);
  const [tags, setTags] = useState<string[]>(activeFilters.tags || []);
  const [dateRange, setDateRange] = useState<{from: Date | null, to: Date | null}>(
    activeFilters.dateRange || { from: null, to: null }
  );
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>(
    activeFilters.customFields || {}
  );

  // Count the number of active filters
  const countActiveFilters = (): number => {
    let count = 0;
    if (searchTerm) count++;
    if (documentTypes.length > 0) count++;
    if (tags.length > 0) count++;
    if (dateRange.from || dateRange.to) count++;
    
    // Count custom fields
    if (customFields) {
      Object.keys(customFieldValues).forEach(key => {
        if (customFieldValues[key] !== null && customFieldValues[key] !== undefined && customFieldValues[key] !== '') {
          count++;
        }
      });
    }
    
    return count;
  };

  // Update parent component with filter changes
  useEffect(() => {
    onFilterChange({
      searchTerm,
      documentTypes,
      tags,
      dateRange,
      customFields: customFieldValues
    });
  }, [searchTerm, documentTypes, tags, dateRange, customFieldValues]);

  // Toggle document type selection
  const toggleDocumentType = (type: string) => {
    if (documentTypes.includes(type)) {
      setDocumentTypes(documentTypes.filter(t => t !== type));
    } else {
      setDocumentTypes([...documentTypes, type]);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setDocumentTypes([]);
    setTags([]);
    setDateRange({ from: null, to: null });
    setCustomFieldValues({});
  };

  return (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search input */}
            <div className="flex-1">
              <div className="relative">
                <Input
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Filters button with count */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex gap-2 items-center whitespace-nowrap">
                  <Filter className="h-4 w-4" />
                  Filters
                  {countActiveFilters() > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {countActiveFilters()}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4" align="end">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Filter Documents</h4>
                  
                  {/* Document type filter */}
                  <div>
                    <Label className="text-xs">Document Type</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={documentTypes.includes('text') ? "default" : "outline"}
                        className="flex items-center justify-start"
                        onClick={() => toggleDocumentType('text')}
                      >
                        <FileText className="h-3 w-3 mr-2" />
                        Text
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={documentTypes.includes('pdf') ? "default" : "outline"}
                        className="flex items-center justify-start"
                        onClick={() => toggleDocumentType('pdf')}
                      >
                        <FileUp className="h-3 w-3 mr-2" />
                        PDF
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={documentTypes.includes('url') ? "default" : "outline"}
                        className="flex items-center justify-start"
                        onClick={() => toggleDocumentType('url')}
                      >
                        <Globe className="h-3 w-3 mr-2" />
                        Web URL
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={documentTypes.includes('youtube') ? "default" : "outline"}
                        className="flex items-center justify-start"
                        onClick={() => toggleDocumentType('youtube')}
                      >
                        <Youtube className="h-3 w-3 mr-2" />
                        YouTube
                      </Button>
                    </div>
                  </div>
                  
                  {/* Tags filter */}
                  <div>
                    <Label className="text-xs">Tags</Label>
                    <div className="mt-2">
                      <TagInput 
                        tags={tags} 
                        onTagsChange={setTags} 
                        placeholder="Filter by tags..." 
                        suggestedTags={availableTags}
                      />
                    </div>
                  </div>
                  
                  {/* Date range filter */}
                  <div>
                    <Label className="text-xs">Date Range</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !dateRange.from && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-3 w-3" />
                            {dateRange.from ? (
                              format(dateRange.from, "PPP")
                            ) : (
                              <span>From date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={dateRange.from || undefined}
                            onSelect={(date) => setDateRange({ ...dateRange, from: date || null })}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !dateRange.to && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-3 w-3" />
                            {dateRange.to ? (
                              format(dateRange.to, "PPP")
                            ) : (
                              <span>To date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={dateRange.to || undefined}
                            onSelect={(date) => setDateRange({ ...dateRange, to: date || null })}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  
                  {/* Custom fields filter */}
                  {customFields && customFields.length > 0 && (
                    <div>
                      <Label className="text-xs">Custom Fields</Label>
                      <div className="space-y-2 mt-2">
                        {customFields.map((field) => (
                          <div key={field.id}>
                            <Label className="text-xs">{field.name}</Label>
                            {field.type === 'text' && (
                              <Input
                                className="text-sm mt-1"
                                placeholder={`Filter by ${field.name}`}
                                value={customFieldValues[field.id] || ''}
                                onChange={(e) => 
                                  setCustomFieldValues({
                                    ...customFieldValues,
                                    [field.id]: e.target.value
                                  })
                                }
                              />
                            )}
                            {field.type === 'select' && field.options && (
                              <Select
                                value={customFieldValues[field.id] || ''}
                                onValueChange={(value) => 
                                  setCustomFieldValues({
                                    ...customFieldValues,
                                    [field.id]: value
                                  })
                                }
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder={`Any ${field.name}`} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">Any {field.name}</SelectItem>
                                  {field.options.map((option: string) => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Action buttons */}
                  <div className="flex justify-between pt-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearFilters}
                      disabled={countActiveFilters() === 0}
                    >
                      Clear all
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Active filters display */}
          {countActiveFilters() > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {searchTerm && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Search: {searchTerm}
                  <button onClick={() => setSearchTerm("")} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              
              {documentTypes.map(type => (
                <Badge key={type} variant="secondary" className="flex items-center gap-1">
                  Type: {type.charAt(0).toUpperCase() + type.slice(1)}
                  <button onClick={() => toggleDocumentType(type)} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              
              {tags.map(tag => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                  Tag: {tag}
                  <button onClick={() => setTags(tags.filter(t => t !== tag))} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              
              {dateRange.from && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  From: {format(dateRange.from, "PP")}
                  <button onClick={() => setDateRange({ ...dateRange, from: null })} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              
              {dateRange.to && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  To: {format(dateRange.to, "PP")}
                  <button onClick={() => setDateRange({ ...dateRange, to: null })} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              
              {customFields && Object.keys(customFieldValues).map(fieldId => {
                if (!customFieldValues[fieldId]) return null;
                const field = customFields.find(f => f.id === fieldId);
                if (!field) return null;
                
                return (
                  <Badge key={fieldId} variant="secondary" className="flex items-center gap-1">
                    {field.name}: {customFieldValues[fieldId]}
                    <button 
                      onClick={() => setCustomFieldValues({
                        ...customFieldValues,
                        [fieldId]: ''
                      })} 
                      className="ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters} 
                className="h-6 px-2 text-xs"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}