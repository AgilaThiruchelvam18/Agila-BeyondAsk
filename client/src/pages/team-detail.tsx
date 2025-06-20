import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Clock, Edit, Loader, Mail, MoreHorizontal, Plus, Shield, Trash, User, UserMinus, UserPlus, X } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ResourcePermissions from "@/components/resource-permissions/resource-permissions";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Define types
interface Team {
  id: number;
  name: string;
  description: string | null;
  ownerId: number;
  createdAt: Date;
  updatedAt: Date;
  avatarUrl: string | null;
}

interface TeamMember {
  id: number;
  userId: number;
  teamId: number;
  role: 'admin' | 'user';
  status: string;
  joinedAt: Date;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface TeamInvitation {
  id: number;
  teamId: number;
  email: string;
  role: 'admin' | 'user';
  status: string;
  createdAt: Date;
  expiresAt: Date;
  invitedByUserId: number;
  invitedByName: string;
}

interface ActivityLog {
  id: number;
  teamId: number;
  userId: number;
  action: string;
  entityType: string;
  entityId: string;
  details: any;
  createdAt: Date;
  userName: string;
}

// Form validation schemas
const inviteFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "user"]),
});

const updateTeamFormSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  description: z.string().optional(),
});

type InviteFormValues = z.infer<typeof inviteFormSchema>;
type UpdateTeamFormValues = z.infer<typeof updateTeamFormSchema>;

// Type guard to check if an object is a Team
function isTeamObject(obj: unknown): obj is Team {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'ownerId' in obj
  );
}

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const teamId = parseInt(id);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("members");
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [isConfirmCancelInviteOpen, setIsConfirmCancelInviteOpen] = useState(false);
  const [invitationToCancel, setInvitationToCancel] = useState<TeamInvitation | null>(null);

  // Invite form
  const inviteForm = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: "",
      role: "user",
    },
  });

  // Update team form
  const updateTeamForm = useForm<UpdateTeamFormValues>({
    resolver: zodResolver(updateTeamFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Queries
  const { 
    data: team, 
    isLoading: isTeamLoading, 
    isError: isTeamError,
    error: teamError
  } = useQuery({
    queryKey: [`/api/teams/${teamId}`],
    queryFn: () => apiRequest(`/api/teams/${teamId}`),
    retry: 3
  });

  // Get team members
  const { 
    data: members, 
    isLoading: isMembersLoading, 
    isError: isMembersError 
  } = useQuery({
    queryKey: [`/api/teams/${teamId}/members`],
    queryFn: () => apiRequest(`/api/teams/${teamId}/members`),
    retry: 1,
    enabled: !!team // Only fetch members if team exists
  });

  const { 
    data: invitations, 
    isLoading: isInvitationsLoading, 
    isError: isInvitationsError 
  } = useQuery({
    queryKey: [`/api/teams/${teamId}/invitations`],
    queryFn: () => apiRequest(`/api/teams/${teamId}/invitations`),
    retry: 1,
    enabled: !!team
  });

  const { 
    data: activityLogs, 
    isLoading: isActivityLogsLoading, 
    isError: isActivityLogsError 
  } = useQuery({
    queryKey: [`/api/teams/${teamId}/activity`],
    queryFn: () => apiRequest(`/api/teams/${teamId}/activity`),
    retry: 1,
    enabled: !!team
  });

  // Set default values for the edit form when team data is loaded
  if (team && isTeamObject(team) && updateTeamForm) {
    if (team.name && updateTeamForm.getValues().name === "") {
      updateTeamForm.setValue("name", team.name);
    }
    if (updateTeamForm.getValues().description === "") {
      updateTeamForm.setValue("description", team.description || "");
    }
  }

  // Mutations
  const inviteMemberMutation = useMutation({
    mutationFn: (data: InviteFormValues) => {
      return apiRequest(`/api/teams/${teamId}/invitations`, {
        method: "POST",
        data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Invitation sent",
        description: "Team invitation has been sent successfully",
      });
      setIsInviteDialogOpen(false);
      inviteForm.reset();
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/invitations`] });
    },
    onError: (error) => {
      console.error("Error sending invitation:", error);
      toast({
        title: "Error",
        description: "Failed to send invitation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: (data: UpdateTeamFormValues) => {
      return apiRequest(`/api/teams/${teamId}`, {
        method: "PUT",
        data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Team updated",
        description: "Team details have been updated successfully",
      });
      setIsEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}`] });
    },
    onError: (error) => {
      console.error("Error updating team:", error);
      toast({
        title: "Error",
        description: "Failed to update team. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: number; role: 'admin' | 'user' }) => {
      return apiRequest(`/api/teams/${teamId}/members/${memberId}`, {
        method: "PUT",
        data: { role },
      });
    },
    onSuccess: () => {
      toast({
        title: "Role updated",
        description: "Member role has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/members`] });
    },
    onError: (error) => {
      console.error("Error updating member role:", error);
      toast({
        title: "Error",
        description: "Failed to update member role. Please try again.",
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: number) => {
      return apiRequest(`/api/teams/${teamId}/members/${memberId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Member removed",
        description: "Team member has been removed successfully",
      });
      setIsConfirmRemoveOpen(false);
      setMemberToRemove(null);
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/members`] });
    },
    onError: (error) => {
      console.error("Error removing member:", error);
      toast({
        title: "Error",
        description: "Failed to remove member. Please try again.",
        variant: "destructive",
      });
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: (invitationId: number) => {
      return apiRequest(`/api/teams/invitations/${invitationId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Invitation cancelled",
        description: "Team invitation has been cancelled successfully",
      });
      setIsConfirmCancelInviteOpen(false);
      setInvitationToCancel(null);
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/invitations`] });
    },
    onError: (error) => {
      console.error("Error cancelling invitation:", error);
      toast({
        title: "Error",
        description: "Failed to cancel invitation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resendInvitationMutation = useMutation({
    mutationFn: (invitationId: number) => {
      return apiRequest(`/api/teams/invitations/${invitationId}/resend`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Invitation resent",
        description: "Team invitation has been resent successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/invitations`] });
    },
    onError: (error) => {
      console.error("Error resending invitation:", error);
      toast({
        title: "Error",
        description: "Failed to resend invitation. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle form submissions
  const onInviteSubmit = (data: InviteFormValues) => {
    inviteMemberMutation.mutate(data);
  };

  const onUpdateTeamSubmit = (data: UpdateTeamFormValues) => {
    updateTeamMutation.mutate(data);
  };

  // Helper function to format activity log action
  const formatActivity = (activity: ActivityLog) => {
    let message = "";

    switch (activity.action) {
      case "create":
        message = `created the team`;
        break;
      case "update":
        message = `updated team details`;
        break;
      case "invite":
        message = `invited ${activity.details?.email || ''} to join as ${activity.details?.role || ''}`;
        break;
      case "cancel_invite":
        message = `cancelled invitation for ${activity.details?.email || ''}`;
        break;
      case "resend_invite":
        message = `resent invitation to ${activity.details?.email || ''}`;
        break;
      case "update_role":
        message = `changed role of a member to ${activity.details?.newRole || ''}`;
        break;
      case "remove":
        message = `removed a member from the team`;
        break;
      default:
        message = `performed action "${activity.action}" on ${activity.entityType}`;
    }

    return message;
  };

  // Handle member actions
  const handleMemberAction = (member: TeamMember, action: string) => {
    if (action === "remove") {
      setMemberToRemove(member);
      setIsConfirmRemoveOpen(true);
    } else if (action === "make_admin") {
      updateMemberRoleMutation.mutate({ memberId: member.userId, role: "admin" });
    } else if (action === "make_user") {
      updateMemberRoleMutation.mutate({ memberId: member.userId, role: "user" });
    }
  };

  // Handle invitation actions
  const handleInvitationAction = (invitation: TeamInvitation, action: string) => {
    if (action === "cancel") {
      setInvitationToCancel(invitation);
      setIsConfirmCancelInviteOpen(true);
    } else if (action === "resend") {
      resendInvitationMutation.mutate(invitation.id);
    }
  };

  // Loading state
  if (isTeamLoading) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading team details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (isTeamError) {
    // Get the error details if available
    const error = teamError as Error;
    const errorMessage = error?.message || "Unknown error";
    const isAuthError = errorMessage.includes("401") || errorMessage.includes("Unauthorized");
    
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <X className="mx-auto h-12 w-12 text-destructive" />
            <h3 className="mt-4 text-lg font-medium">Failed to load team</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAuthError 
                ? "Authentication error. Please check if you're properly logged in and have access to this team."
                : "Unable to load team details. The team might not exist or you may not have access."}
            </p>
            {import.meta.env.DEV && (
              <div className="mt-4 text-xs text-left bg-muted p-2 rounded-md overflow-auto max-h-24">
                <p className="font-mono">Error: {errorMessage}</p>
              </div>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: [`/api/user`] });
                  queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}`] });
                }}
              >
                Retry
              </Button>
              <Link href="/teams">
                <Button>Go back to teams</Button>
              </Link>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 px-4">
        <div className="mb-6">
          <Link href="/teams" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Teams
          </Link>

          {team && isTeamObject(team) && (
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{team.name}</h1>
                <p className="text-muted-foreground mt-1">
                  {team.description || "No description provided"}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>Manage members of your team</CardDescription>
                </div>
                <Button onClick={() => setIsInviteDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Member
                </Button>
              </CardHeader>
              <CardContent>
                {isMembersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : isMembersError ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Failed to load team members</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/members`] })}
                    >
                      Retry
                    </Button>
                  </div>
                ) : members && Array.isArray(members) && members.length > 0 ? (
                  <div className="space-y-4">
                    {members.map((member: TeamMember) => (
                      <div key={member.id} className="flex items-center justify-between py-2">
                        <div className="flex items-center space-x-4">
                          <Avatar>
                            <AvatarImage src={member.avatarUrl || ""} />
                            <AvatarFallback>{member.name ? member.name.charAt(0).toUpperCase() : "U"}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={member.role === "admin" ? "default" : "outline"}>
                            {member.role === "admin" ? (
                              <Shield className="mr-1 h-3 w-3" />
                            ) : (
                              <User className="mr-1 h-3 w-3" />
                            )}
                            {member.role === "admin" ? "Admin" : "Member"}
                          </Badge>
                          {team && isTeamObject(team) && member.userId !== team.ownerId && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {member.role === "user" ? (
                                  <DropdownMenuItem onClick={() => handleMemberAction(member, "make_admin")}>
                                    <Shield className="mr-2 h-4 w-4" />
                                    Make Admin
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => handleMemberAction(member, "make_user")}>
                                    <User className="mr-2 h-4 w-4" />
                                    Make Member
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem 
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleMemberAction(member, "remove")}
                                >
                                  <UserMinus className="mr-2 h-4 w-4" />
                                  Remove from Team
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No members found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Invitations</CardTitle>
                <CardDescription>Manage team invitations</CardDescription>
              </CardHeader>
              <CardContent>
                {isInvitationsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : isInvitationsError ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Failed to load invitations</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/invitations`] })}
                    >
                      Retry
                    </Button>
                  </div>
                ) : invitations && Array.isArray(invitations) && invitations.length > 0 ? (
                  <div className="space-y-4">
                    {invitations
                      .filter((invitation: TeamInvitation) => invitation.status === "pending")
                      .map((invitation: TeamInvitation) => (
                        <div key={invitation.id} className="flex items-center justify-between py-2">
                          <div>
                            <div className="flex items-center space-x-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <p className="font-medium">{invitation.email}</p>
                            </div>
                            <div className="mt-1 flex items-center space-x-2 text-sm text-muted-foreground">
                              <Badge variant="outline">
                                {invitation.role === "admin" ? (
                                  <Shield className="mr-1 h-3 w-3" />
                                ) : (
                                  <User className="mr-1 h-3 w-3" />
                                )}
                                {invitation.role === "admin" ? "Admin" : "Member"}
                              </Badge>
                              <span>•</span>
                              <span>Invited {new Date(invitation.createdAt).toLocaleDateString()}</span>
                              <span>•</span>
                              <span>Expires {new Date(invitation.expiresAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleInvitationAction(invitation, "resend")}
                            >
                              {resendInvitationMutation.isPending ? (
                                <Loader className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Mail className="mr-2 h-4 w-4" />
                                  Resend
                                </>
                              )}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleInvitationAction(invitation, "cancel")}
                            >
                              <X className="mr-2 h-4 w-4" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No pending invitations</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => setIsInviteDialogOpen(true)}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Invite Members
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resources" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Resource Permissions</CardTitle>
                <CardDescription>Manage access to agents and knowledge bases for this team</CardDescription>
              </CardHeader>
              <CardContent>
                <ResourcePermissions teamId={teamId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>Recent activities in this team</CardDescription>
              </CardHeader>
              <CardContent>
                {isActivityLogsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : isActivityLogsError ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Failed to load activity logs</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/activity`] })}
                    >
                      Retry
                    </Button>
                  </div>
                ) : activityLogs && Array.isArray(activityLogs) && activityLogs.length > 0 ? (
                  <div className="space-y-4">
                    {activityLogs.map((activity: ActivityLog) => (
                      <div key={activity.id} className="flex items-start space-x-3 py-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{activity.userName ? activity.userName.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{activity.userName || 'Unknown User'}</span>
                            <span className="text-sm text-muted-foreground">{formatActivity(activity)}</span>
                          </div>
                          <div className="flex items-center text-xs text-muted-foreground mt-1">
                            <Clock className="h-3 w-3 mr-1" />
                            <span>
                              {new Date(activity.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No activity logs found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Invite Member Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join this team.
            </DialogDescription>
          </DialogHeader>
          <Form {...inviteForm}>
            <form onSubmit={inviteForm.handleSubmit(onInviteSubmit)} className="space-y-4">
              <FormField
                control={inviteForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Email address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={inviteForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={inviteMemberMutation.isPending}
                >
                  {inviteMemberMutation.isPending && (
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Send Invitation
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>
              Update team details.
            </DialogDescription>
          </DialogHeader>
          <Form {...updateTeamForm}>
            <form onSubmit={updateTeamForm.handleSubmit(onUpdateTeamSubmit)} className="space-y-4">
              <FormField
                control={updateTeamForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Team name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={updateTeamForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Team description (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={updateTeamMutation.isPending}
                >
                  {updateTeamMutation.isPending && (
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Team
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Confirm Remove Member Dialog */}
      <AlertDialog open={isConfirmRemoveOpen} onOpenChange={setIsConfirmRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemove && (
                <>
                  Are you sure you want to remove <span className="font-medium">{memberToRemove.name}</span> from this team?
                  They will lose access to all team resources.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => memberToRemove && removeMemberMutation.mutate(memberToRemove.userId)}
              disabled={removeMemberMutation.isPending}
            >
              {removeMemberMutation.isPending && (
                <Loader className="mr-2 h-4 w-4 animate-spin" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Cancel Invitation Dialog */}
      <AlertDialog open={isConfirmCancelInviteOpen} onOpenChange={setIsConfirmCancelInviteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              {invitationToCancel && (
                <>
                  Are you sure you want to cancel the invitation sent to <span className="font-medium">{invitationToCancel.email}</span>?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => invitationToCancel && cancelInvitationMutation.mutate(invitationToCancel.id)}
              disabled={cancelInvitationMutation.isPending}
            >
              {cancelInvitationMutation.isPending && (
                <Loader className="mr-2 h-4 w-4 animate-spin" />
              )}
              Yes, Cancel Invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}