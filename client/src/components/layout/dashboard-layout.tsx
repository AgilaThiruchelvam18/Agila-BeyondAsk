import { ReactNode } from "react";
import { Navbar } from "./navbar";
import { Sidebar } from "./sidebar";
import { useMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/components/auth/auth-provider";
import { LoginButton } from "@/components/auth/login-button";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const isMobile = useMobile();
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading authentication...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8 rounded-lg border bg-card p-6 shadow-md">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-foreground">Authentication Required</h2>
            <p className="mt-2 text-muted-foreground">You need to log in to access this page</p>
          </div>
          <div className="pt-4">
            <LoginButton className="w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex flex-1 flex-col">
          <Sidebar />
          <main className="flex-1 p-4">
            {children}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-auto">
        <Navbar hideLogo={true} />
        <main className="flex-1 p-6 mt-16 mx-2">{children}</main>
      </div>
    </div>
  );
}
