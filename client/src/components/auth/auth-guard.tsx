import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "./auth-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading, login } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="flex flex-col items-center justify-center pt-6">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p className="text-center text-sm text-gray-600">
              Verifying authentication...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h1>
            <p className="mb-6 text-sm text-gray-600">
              You need to be logged in to access this page.
            </p>
            <div className="flex gap-4">
              <Button onClick={login} className="flex-1">
                Sign In
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                className="flex-1"
              >
                Go to Home Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
