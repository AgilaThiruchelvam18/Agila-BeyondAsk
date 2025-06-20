import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// Define schema for lead information
const leadFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  company: z.string().optional(),
  phone: z.string().optional(),
});

// Create type from schema
type LeadFormData = z.infer<typeof leadFormSchema>;

// Define component props
interface LeadCollectionFormProps {
  onSubmit: (data: LeadFormData) => Promise<void>;
  onCancel?: () => void;
  title?: string;
  description?: string;
  isLoading?: boolean;
  primaryColor?: string;
  textColor?: string;
}

export function LeadCollectionForm({
  onSubmit,
  onCancel,
  title = "Please Introduce Yourself",
  description = "To help us serve you better, please provide your contact information.",
  isLoading = false,
  primaryColor = "#4f46e5", // indigo-600
  textColor = "#ffffff",
}: LeadCollectionFormProps) {
  // Initialize form with default values
  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      phone: "",
    },
  });

  // Handler for form submission
  const handleSubmit = async (data: LeadFormData) => {
    try {
      await onSubmit(data);
      form.reset();
    } catch (error) {
      console.error("Error submitting lead form:", error);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader style={{ backgroundColor: primaryColor, color: textColor }} className="rounded-t-lg">
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
        <CardDescription className="text-sm opacity-90" style={{ color: textColor }}>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="email@example.com" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Your company" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Your phone number" type="tel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <CardFooter className="flex justify-between px-0 pt-2">
              {onCancel && (
                <Button variant="outline" onClick={onCancel} type="button">
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isLoading} style={{ backgroundColor: primaryColor, color: textColor }}>
                {isLoading ? "Submitting..." : "Submit"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}