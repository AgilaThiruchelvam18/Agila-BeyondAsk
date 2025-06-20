import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { tokenManager } from "@/lib/token-manager";

export default function Callback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Check if this is running in an iframe (silent authentication)
        if (window.parent !== window) {
          // This is a silent authentication callback
          if (window.location.hash.includes("access_token=")) {
            const hashParams = window.location.hash.substring(1).split("&").reduce<Record<string, string>>((acc, curr) => {
              const [key, value] = curr.split("=");
              acc[key] = decodeURIComponent(value);
              return acc;
            }, {});
            
            if (hashParams.access_token) {
              // Send success message to parent window
              window.parent.postMessage({
                type: 'auth_success',
                token: hashParams.access_token
              }, window.location.origin);
            }
          } else if (window.location.hash.includes("error=")) {
            // Send error message to parent window
            window.parent.postMessage({
              type: 'auth_error',
              error: 'Silent authentication failed'
            }, window.location.origin);
          }
          return;
        }
        
        // Regular callback processing (not in iframe)
        // Check if we have an error in the URL
        if (window.location.hash.includes("error=")) {
          const params = new URLSearchParams(window.location.hash.substring(1));
          const error = params.get("error");
          const errorDescription = params.get("error_description");
          
          console.error("Auth0 callback error:", error, errorDescription);
          setError(errorDescription || "Authentication failed");
          
          // Redirect back to home after showing error
          setTimeout(() => {
            setLocation("/");
          }, 5000);
          return;
        }
        
        // Extract tokens from the hash fragment
        if (window.location.hash.includes("access_token=")) {
          const hashParams = window.location.hash.substring(1).split("&").reduce<Record<string, string>>((acc, curr) => {
            const [key, value] = curr.split("=");
            acc[key] = decodeURIComponent(value);
            return acc;
          }, {});
          
          if (hashParams.access_token) {
            // Store tokens using token manager
            const expiresIn = parseInt(hashParams.expires_in) || 3600; // Default 1 hour
            
            // For Auth0 implicit flow, we use the access token as both access and refresh token
            // In a real production app, you'd implement proper refresh token flow
            tokenManager.setTokens(
              hashParams.access_token, 
              hashParams.access_token, // Using access token as refresh token for demo
              expiresIn
            );
            
            console.log("Tokens stored successfully");
            
            // Clear the hash from URL for security
            window.history.replaceState({}, '', window.location.pathname);
            
            // Redirect to dashboard
            setTimeout(() => {
              setLocation("/dashboard");
            }, 1000);
            return;
          }
        }
        
        // No tokens found, redirect to home
        setError("No authentication tokens received");
        setTimeout(() => {
          setLocation("/");
        }, 3000);
      } catch (err) {
        console.error("Error processing callback:", err);
        setError("An unexpected error occurred during authentication");
        
        // Redirect back to home after showing error
        setTimeout(() => {
          setLocation("/");
        }, 5000);
      }
    };
    
    processCallback();
  }, [setLocation]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="flex flex-col items-center space-y-6 max-w-md w-full">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Authentication Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <p className="mt-2 text-sm">Redirecting to home page...</p>
          </Alert>
        ) : (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <h1 className="text-2xl font-semibold">Authenticating...</h1>
            <p className="text-gray-500">You'll be redirected shortly</p>
          </>
        )}
      </div>
    </div>
  );
}