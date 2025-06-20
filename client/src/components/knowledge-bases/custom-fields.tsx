import { useFieldArray, Control } from "react-hook-form";
import { PlusCircle, X, GripVertical } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

// Define the type for a custom field
export type CustomField = {
  id: string;
  name: string;
  description?: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  required: boolean;
  options?: string[];
};

// Define the props for the CustomFieldsArray component
type CustomFieldsArrayProps = {
  control: Control<any>;
  name: string;
};

export function CustomFieldsArray({ control, name }: CustomFieldsArrayProps) {
  // Use useFieldArray to handle the array of custom fields
  const { fields, append, remove, move } = useFieldArray({
    control,
    name,
  });

  // Function to add a new custom field
  const addCustomField = () => {
    append({
      id: uuidv4(),
      name: "",
      description: "",
      type: "text",
      required: false,
      options: [],
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <FormLabel>Custom Metadata Fields</FormLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCustomField}
          className="h-8 gap-1"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          <span>Add Field</span>
        </Button>
      </div>
      <FormDescription>
        Define custom metadata fields that will be collected for each document in this knowledge base.
      </FormDescription>

      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-6 border border-dashed rounded-md">
          <p className="text-sm text-gray-500 mb-2">No custom fields defined</p>
          <Button type="button" variant="outline" size="sm" onClick={addCustomField}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Your First Custom Field
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <Card key={field.id} className="relative">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-6 w-6 text-gray-400 hover:text-gray-600"
                onClick={() => remove(index)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove</span>
              </Button>
              <CardContent className="pt-6 pb-4">
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={control}
                      name={`${name}.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Field Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name={`${name}.${index}.type`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Field Type</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="date">Date</SelectItem>
                              <SelectItem value="boolean">Yes/No</SelectItem>
                              <SelectItem value="select">Dropdown</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={control}
                    name={`${name}.${index}.description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Description or instructions for this field" 
                            className="resize-none h-20"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex items-center space-x-2">
                    <FormField
                      control={control}
                      name={`${name}.${index}.required`}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>Required field</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* @ts-ignore - field type is correctly set in the data structure */}
                  {fields[index].type === 'select' && (
                    <OptionsField 
                      control={control} 
                      name={`${name}.${index}.options`} 
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Component for handling options in select/dropdown fields
type OptionsFieldProps = {
  control: Control<any>;
  name: string;
};

function OptionsField({ control, name }: OptionsFieldProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name,
  });

  const addOption = () => {
    append("");
  };

  return (
    <div className="space-y-2">
      <FormLabel>Options</FormLabel>
      <FormDescription>
        Define the available options for this dropdown field.
      </FormDescription>
      
      {fields.length === 0 ? (
        <div className="flex justify-center p-4 border border-dashed rounded-md">
          <Button type="button" variant="outline" size="sm" onClick={addOption}>
            <PlusCircle className="mr-2 h-3 w-3" />
            Add Option
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((optionField, optionIndex) => (
            <div key={optionField.id} className="flex items-center space-x-2">
              <FormField
                control={control}
                name={`${name}.${optionIndex}`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <div className="flex space-x-2">
                        <Input {...field} placeholder={`Option ${optionIndex + 1}`} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(optionIndex)}
                          className="h-10 w-10"
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">Remove option</span>
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ))}
          
          <Button type="button" variant="outline" size="sm" onClick={addOption} className="mt-2">
            <PlusCircle className="mr-2 h-3 w-3" />
            Add Option
          </Button>
        </div>
      )}
    </div>
  );
}