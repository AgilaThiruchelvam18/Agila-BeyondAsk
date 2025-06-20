import { useFieldArray, Control } from "react-hook-form";
import { PlusCircle, X } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
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

export default function CustomFieldsArray({ control, name }: CustomFieldsArrayProps) {
  // Use useFieldArray to handle the array of custom fields
  const { fields, append, remove } = useFieldArray({
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
                                <SelectValue placeholder="Select field type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="date">Date</SelectItem>
                              <SelectItem value="boolean">Boolean</SelectItem>
                              <SelectItem value="select">Select</SelectItem>
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
                            placeholder="Description of what this field is for"
                            className="resize-none"
                            rows={2}
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
                        <FormItem className="flex gap-2 items-center space-y-0">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer">Required Field</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Show options input only for select type */}
                  {control._formValues[name][index]?.type === 'select' && (
                    <FormField
                      control={control}
                      name={`${name}.${index}.options`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Options</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              value={field.value?.join('\n') || ''}
                              onChange={(e) => {
                                const options = e.target.value
                                  .split('\n')
                                  .map(option => option.trim())
                                  .filter(option => option);
                                field.onChange(options);
                              }}
                              placeholder="Enter one option per line"
                              className="resize-none"
                              rows={3}
                            />
                          </FormControl>
                          <FormDescription>
                            Enter one option per line
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
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