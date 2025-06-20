import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader, Plus, Users, UserPlus } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

// Define the Team type
interface Team {
  id: number;
  name: string;
  description: string | null;
  ownerId: number;
  createdAt: Date;
  updatedAt: Date;
  avatarUrl: string | null;
}

// Form validation schema
const teamFormSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  description: z.string().optional(),
});

type TeamFormValues = z.infer<typeof teamFormSchema>;

export default function Teams() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Create form
  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Fetch teams
  const { 
    data: teams, 
    isLoading, 
    isError,
    error
  } = useQuery({
    queryKey: ["/api/teams"],
    queryFn: () => apiRequest("/api/teams"),
    retry: 1
  });
  
  // Handle error logging in useEffect instead of deprecated onError
  useEffect(() => {
    if (isError && error) {
      console.error("Error fetching teams:", JSON.stringify(error, null, 2));
    }
  }, [isError, error]);

  console.log("Teams query state:", { 
    isLoading, 
    isError, 
    teamsData: teams, 
    errorMessage: error instanceof Error ? error.message : JSON.stringify(error)
  });

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: (data: TeamFormValues) => {
      return apiRequest("/api/teams", {
        method: "POST",
        data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Team created",
        description: "Your team has been created successfully",
      });
      setIsCreateDialogOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
    },
    onError: (error) => {
      console.error("Error creating team:", error);
      toast({
        title: "Error",
        description: "Failed to create team. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: TeamFormValues) => {
    createTeamMutation.mutate(data);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
            <p className="text-muted-foreground">
              Manage your teams and collaborate with other users
            </p>
          </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Team
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create a New Team</DialogTitle>
                  <DialogDescription>
                    Create a new team to collaborate with other users
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Team Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter team name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe the purpose of this team"
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={createTeamMutation.isPending}>
                        {createTeamMutation.isPending && (
                          <Loader className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Create Team
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Separator className="mb-6" />

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="text-center py-10">
              <p className="text-lg text-muted-foreground">Failed to load teams. Please try again later.</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/teams"] })}
              >
                Retry
              </Button>
            </div>
          ) : teams && teams.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {teams.map((team: Team) => (
                <Link key={team.id} href={`/team/${team.id}`}>
                  <Card className="h-full cursor-pointer transition-all hover:shadow-md">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{team.name}</CardTitle>
                        <div className="flex items-center">
                          <UserPlus className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <CardDescription>
                        {team.description || "No description provided"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Users className="mr-2 h-4 w-4" />
                        <span>View members and manage collaboration</span>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <div className="text-xs text-muted-foreground">
                        Created {new Date(team.createdAt).toLocaleDateString()}
                      </div>
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border border-dashed rounded-lg">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No teams found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first team to start collaborating
              </p>
              <Button 
                className="mt-4" 
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Team
              </Button>
            </div>
          )}
      </div>
    </DashboardLayout>
  );
}