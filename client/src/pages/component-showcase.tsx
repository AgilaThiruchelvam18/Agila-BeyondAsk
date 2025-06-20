import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { 
  Table, 
  TableHeader, 
  TableRow, 
  TableHead, 
  TableBody, 
  TableCell
} from "@/components/ui/table";
import { 
  InfoCircledIcon, 
  CheckCircledIcon, 
  ExclamationTriangleIcon, 
  CrossCircledIcon
} from "@radix-ui/react-icons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function ComponentShowcase() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-7xl">
      <header className="mb-12">
        <h1 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)]">BeyondAsk UI Component System</h1>
        <p className="text-[var(--color-text-secondary)] mb-6">
          A showcase of the BeyondAsk UI components and design system.
        </p>
        <div className="flex space-x-4">
          <Link href="/">
            <a className="inline-block">
              <Button variant="outline">Back to Home</Button>
            </a>
          </Link>
        </div>
      </header>

      {/* Button Showcase */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-[var(--color-border)]">Buttons</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl font-semibold mb-4">Button Variants</h3>
            <div className="flex flex-wrap gap-4 mb-6">
              <Button variant="default">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
            <div className="flex flex-wrap gap-4">
              <Button variant="success">Success</Button>
              <Button variant="warning">Warning</Button>
              <Button variant="destructive">Error</Button>
            </div>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-4">Button Sizes</h3>
            <div className="flex flex-wrap gap-4 items-center">
              <Button size="sm" variant="default">Small</Button>
              <Button size="default" variant="default">Medium</Button>
              <Button size="lg" variant="default">Large</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Form Elements */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-[var(--color-border)]">Form Elements</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl font-semibold mb-4">Text Inputs</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-text-primary)]">Default Input</label>
                <Input type="text" placeholder="Enter text here" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-text-primary)]">With Helper Text</label>
                <Input type="email" placeholder="Enter your email" />
                <p className="text-xs text-[var(--color-text-secondary)]">We'll never share your email with anyone else.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-text-primary)]">With Error</label>
                <Input type="text" placeholder="Enter text here" className="border-[var(--color-error)]" />
                <p className="text-xs text-[var(--color-error)]">This field is required.</p>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-4">Other Inputs</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--color-text-primary)]">Textarea</label>
                <Textarea placeholder="Enter your message" rows={3} />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="switch1" />
                <label htmlFor="switch1" className="text-sm cursor-pointer">Toggle switch example</label>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cards */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-[var(--color-border)]">Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-2">Simple Card</h3>
              <p className="text-[var(--color-text-secondary)]">This is a simple card with hover effect.</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Card with Header</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[var(--color-text-secondary)]">This card has a separate header section.</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Complete Card</CardTitle>
              <CardDescription>With header, body, and footer</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-[var(--color-text-secondary)]">This card has header, body, and footer sections.</p>
            </CardContent>
            <CardFooter>
              <Button size="sm">Action</Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* Badges and Alerts */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-[var(--color-border)]">Badges & Alerts</h2>
        
        <h3 className="text-xl font-semibold mb-4">Badges</h3>
        <div className="flex flex-wrap gap-4 mb-8">
          <Badge variant="default">Primary</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="destructive">Error</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
        
        <h3 className="text-xl font-semibold mb-4">Alerts</h3>
        <div className="space-y-4">
          <Alert variant="info">
            <InfoCircledIcon className="h-4 w-4" />
            <AlertTitle>Information alert!</AlertTitle>
            <AlertDescription>This is an informational message.</AlertDescription>
          </Alert>
          
          <Alert variant="success">
            <CheckCircledIcon className="h-4 w-4" />
            <AlertTitle>Success alert!</AlertTitle>
            <AlertDescription>Your action was completed successfully.</AlertDescription>
          </Alert>
          
          <Alert variant="warning">
            <ExclamationTriangleIcon className="h-4 w-4" />
            <AlertTitle>Warning alert!</AlertTitle>
            <AlertDescription>Please proceed with caution.</AlertDescription>
          </Alert>
          
          <Alert variant="destructive">
            <CrossCircledIcon className="h-4 w-4" />
            <AlertTitle>Error alert!</AlertTitle>
            <AlertDescription>Something went wrong. Please try again later.</AlertDescription>
          </Alert>
        </div>
      </section>

      {/* Tables */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-[var(--color-border)]">Tables</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Jane Cooper</TableCell>
                <TableCell>jane@example.com</TableCell>
                <TableCell>Admin</TableCell>
                <TableCell>
                  <Badge variant="success">Active</Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">Edit</Button>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Michael Scott</TableCell>
                <TableCell>michael@example.com</TableCell>
                <TableCell>User</TableCell>
                <TableCell>
                  <Badge variant="warning">Pending</Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">Edit</Button>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Dwight Schrute</TableCell>
                <TableCell>dwight@example.com</TableCell>
                <TableCell>User</TableCell>
                <TableCell>
                  <Badge variant="destructive">Inactive</Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">Edit</Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Tooltips */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 pb-2 border-b border-[var(--color-border)]">Tooltips</h2>
        <div className="flex flex-wrap gap-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover me</Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>This is a tooltip with helpful information</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary">Help</Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Tooltips can provide additional context</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon">
                  <InfoCircledIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Informational tooltip</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </section>
    </div>
  );
}