import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader, CheckCircle, XCircle, Mail, AlertTriangle, Clock, User } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth/auth-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type InvitationStatus = "loading" | "invalid" | "accepted" | "error";

interface InvitationDetails {
  teamId: number;
  teamName?: string;
  email: string;
  role: string;
}

export default function Invitation() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user, login } = useAuth();
  
  const [status, setStatus] = useState<InvitationStatus>("loading");
  const [invitationDetails, setInvitationDetails] = useState<InvitationDetails | null>(null);
  const [processingAccept, setProcessingAccept] = useState(false);

  // Step 1: Verify token validity
  useEffect(() => {
    const verifyInvitation = async () => {
      try {
        const response = await apiRequest(`/api/teams/invitations/verify/${token}`);
        
        if (response && response.invitation) {
          setInvitationDetails({
            teamId: response.invitation.teamId,
            email: response.invitation.email,
            role: response.invitation.role,
            teamName: response.teamName
          });
          
          // If token is valid and user is already authenticated, we can accept right away
          // if they're logged in with the right account
          if (isAuthenticated && user?.email?.toLowerCase() === response.invitation.email.toLowerCase()) {
            setStatus("loading");
          } else {
            setStatus("loading"); // Still need login
          }
        } else {
          setStatus("invalid");
        }
      } catch (error) {
        console.error("Error verifying invitation:", error);
        setStatus("invalid");
      }
    };

    if (token) {
      verifyInvitation();
    }
  }, [token, isAuthenticated, user]);

  // Step 2: Accept invitation when user is authenticated with the correct account
  useEffect(() => {
    const acceptInvitation = async () => {
      if (!isAuthenticated || !user || !invitationDetails) return;
      
      // If user email doesn't match invitation email, show error
      if (user.email?.toLowerCase() !== invitationDetails.email.toLowerCase()) {
        toast({
          title: "Login Required",
          description: `Please log in with ${invitationDetails.email} to accept this invitation.`,
          variant: "destructive"
        });
        setStatus("error");
        return;
      }
      
      // Accept invitation
      try {
        setProcessingAccept(true);
        const response = await apiRequest(`/api/teams/invitations/accept/${token}`, {
          method: "POST",
        });
        
        if (response) {
          setStatus("accepted");
          toast({
            title: "Invitation Accepted",
            description: `You are now a member of the team.`,
          });
          
          // Invalidate team data to refresh
          queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
          
          // Redirect to team page after short delay
          setTimeout(() => {
            setLocation(`/team/${invitationDetails.teamId}`);
          }, 2000);
        }
      } catch (error) {
        console.error("Error accepting invitation:", error);
        setStatus("error");
        toast({
          title: "Error",
          description: "Failed to accept invitation. Please try again.",
          variant: "destructive",
        });
      } finally {
        setProcessingAccept(false);
      }
    };

    if (isAuthenticated && user && invitationDetails && status === "loading") {
      acceptInvitation();
    }
  }, [isAuthenticated, user, invitationDetails, status, token]);

  // If still loading auth, show loading state
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Team Invitation</CardTitle>
            <CardDescription>Verifying your invitation...</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-6">
            <Loader className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Validation schemas for login/signup forms
  const loginSchema = z.object({
    email: z.string().email("Please enter a valid email").toLowerCase(),
    password: z.string().min(6, "Password must be at least 6 characters"),
  });

  const signupSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email").toLowerCase(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Please confirm your password"),
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

  // Form hooks
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: invitationDetails?.email || "",
      password: "",
    },
  });

  const signupForm = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: invitationDetails?.email || "",
      password: "",
      confirmPassword: "",
    },
  });

  // Form submission handlers
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onLoginSubmit = async (values: z.infer<typeof loginSchema>) => {
    setIsSubmitting(true);
    try {
      // Here we're using the existing Auth0/login flow
      // The email is pre-filled but we want to ensure they log in with the correct account
      login();
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Login Failed",
        description: "Please check your credentials and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSignupSubmit = async (values: z.infer<typeof signupSchema>) => {
    setIsSubmitting(true);
    try {
      // For signup we'll use the Auth0 signup flow 
      // which will then be redirected to our callback handler
      login(); // This will go to Auth0 where the user can select signup
    } catch (error) {
      console.error("Signup error:", error);
      toast({
        title: "Registration Failed",
        description: "Please check your information and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // If not authenticated, show login/signup tabs UI
  if (!isAuthenticated && invitationDetails) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Team Invitation</CardTitle>
            <CardDescription>
              You've been invited to join <span className="font-medium">{invitationDetails.teamName}</span> as a {invitationDetails.role}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center mb-6">
              <Mail className="h-12 w-12 text-primary p-2 bg-primary/10 rounded-full" />
            </div>
            
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start">
              <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                This invitation was sent to <strong>{invitationDetails.email}</strong>. 
                You must use this email address to accept the invitation.
              </p>
            </div>

            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login">Log In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              readOnly 
                              disabled
                              className="bg-muted" 
                            />
                          </FormControl>
                          <FormDescription>
                            You must use the email associated with this invitation.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="pt-4">
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                            Logging in...
                          </>
                        ) : (
                          "Continue to Login"
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </TabsContent>
              
              <TabsContent value="signup">
                <Form {...signupForm}>
                  <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4">
                    <FormField
                      control={signupForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Your name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={signupForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              readOnly 
                              disabled
                              className="bg-muted" 
                            />
                          </FormControl>
                          <FormDescription>
                            You must use the email associated with this invitation.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="pt-4">
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                            Creating Account...
                          </>
                        ) : (
                          "Continue to Sign Up"
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="justify-center border-t pt-6">
            <p className="text-sm text-muted-foreground">
              This invitation expires in 48 hours. <Clock className="inline h-3 w-3 mb-0.5" />
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // For various status states
  let content;
  
  switch (status) {
    case "loading":
      content = (
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Team Invitation</CardTitle>
            <CardDescription>Processing your invitation...</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-6">
            <Loader className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      );
      break;
      
    case "accepted":
      content = (
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Invitation Accepted</CardTitle>
            <CardDescription>You are now a member of the team.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center py-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <p className="text-center">
              You'll be redirected to the team page automatically.
            </p>
          </CardContent>
        </Card>
      );
      break;
      
    case "invalid":
      content = (
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>This invitation is invalid or has expired.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center py-4">
              <XCircle className="h-16 w-16 text-destructive" />
            </div>
            <div className="flex justify-center pt-4">
              <Button onClick={() => setLocation("/teams")} variant="outline">
                Go to Teams
              </Button>
            </div>
          </CardContent>
        </Card>
      );
      break;
      
    case "error":
      content = (
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Error</CardTitle>
            <CardDescription>There was an error processing your invitation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center py-4">
              <XCircle className="h-16 w-16 text-destructive" />
            </div>
            <div className="flex justify-center pt-4">
              <Button onClick={() => window.location.reload()} variant="outline">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      );
      break;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      {content}
    </div>
  );
}