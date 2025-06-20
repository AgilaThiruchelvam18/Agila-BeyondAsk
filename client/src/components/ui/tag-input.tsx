import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";

interface TagInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  suggestedTags?: string[];
}

export function TagInput({
  tags,
  onTagsChange,
  placeholder = "Add tags...",
  maxTags = 10,
  suggestedTags = [],
  ...props
}: TagInputProps) {
  const [inputValue, setInputValue] = React.useState<string>("");
  const [showSuggestions, setShowSuggestions] = React.useState<boolean>(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Filter suggested tags to only show ones that aren't already added
  // and match the current input value
  const filteredSuggestions = suggestedTags
    .filter(tag => !tags.includes(tag))
    .filter(tag => tag.toLowerCase().includes(inputValue.toLowerCase()))
    .slice(0, 5); // Limit to 5 suggestions at a time

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (
      trimmedTag &&
      !tags.includes(trimmedTag) &&
      tags.length < maxTags
    ) {
      onTagsChange([...tags, trimmedTag]);
      setInputValue("");
    }
  };

  const removeTag = (index: number) => {
    const newTags = [...tags];
    newTags.splice(index, 1);
    onTagsChange(newTags);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue) {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const handleInputClick = () => {
    if (suggestedTags.length > 0) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2 min-h-10 p-2 border border-[var(--color-border)] rounded-md bg-background">
        {tags.map((tag, index) => (
          <Badge key={index} variant="secondary" className="gap-1 text-sm">
            {tag}
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0"
              onClick={() => removeTag(index)}
            >
              <X className="h-3 w-3" />
              <span className="sr-only">Remove {tag}</span>
            </Button>
          </Badge>
        ))}
        <div className="flex-1 flex items-center">
          <Input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onClick={handleInputClick}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 text-sm h-auto placeholder:text-muted-foreground"
            placeholder={tags.length < maxTags ? placeholder : `Maximum ${maxTags} tags`}
            disabled={tags.length >= maxTags}
            {...props}
          />
          {inputValue && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => addTag(inputValue)}
            >
              <Plus className="h-3 w-3" />
              <span className="sr-only">Add tag</span>
            </Button>
          )}
        </div>
      </div>

      {/* Suggested tags */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="mt-1 max-h-40 overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {filteredSuggestions.map((suggestion) => (
            <div
              key={suggestion}
              className="cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => addTag(suggestion)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}