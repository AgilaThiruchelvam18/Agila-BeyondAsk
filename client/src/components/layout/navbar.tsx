import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LoginButton } from "@/components/auth/login-button";
import { LogoutButton } from "@/components/auth/logout-button";
import { useAuth } from "@/components/auth/auth-provider";
import { Menu, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Logo from "@/components/ui/logo";

export function Navbar({ hideLogo = false }: { hideLogo?: boolean }) {
  const { isAuthenticated, user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState("");
  const isInApplication = currentPath.startsWith('/dashboard') || 
                        currentPath.startsWith('/agents') || 
                        currentPath.startsWith('/agent') || 
                        currentPath.startsWith('/profile') ||
                        currentPath.startsWith('/api-keys') ||
                        currentPath.startsWith('/knowledge-base') ||
                        currentPath.startsWith('/chat') ||
                        currentPath.startsWith('/unanswered-questions') ||
                        currentPath.startsWith('/pinecone-explorer') ||
                        currentPath.startsWith('/api-keys') ||
                        currentPath.startsWith('/teams') ||
                        currentPath.startsWith('/team') ||
                        currentPath.startsWith('/scheduled-updates') ||
                        currentPath.startsWith('/integrations') ||
                        currentPath.startsWith('/metrics') ||
                        currentPath.startsWith('/api-webhook-keys') ||
    currentPath.startsWith('/visualizer-boards') ||
    currentPath.startsWith('/visualizer-board/') ||
                        currentPath.startsWith('/contacts');
                        
  useEffect(() => {
    setCurrentPath(window.location.pathname);
    
    const handleRouteChange = () => {
      setCurrentPath(window.location.pathname);
    };
    
    window.addEventListener('popstate', handleRouteChange);
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <nav className=" w-full z-50 backdrop-filter backdrop-blur-lg bg-opacity-95 bg-[var(--color-background)] border-b border-[var(--color-border)]">
      <div className="w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {!isInApplication && (
              <Link href="/" className="flex-shrink-0">
                <Logo size="md" />
              </Link>
            )}
          </div>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {!isInApplication && (
              <>
                <Link href="/">
                  <span className="nav-link font-medium">Home</span>
                </Link>
                <Link href="/#features">
                  <span className="nav-link font-medium">Features</span>
                </Link>
                <Link href="/#pricing">
                  <span className="nav-link font-medium">Pricing</span>
                </Link>
              </>
            )}
            
            {isAuthenticated ? (
              <div className="flex items-center gap-4">
                <Link href="/dashboard">
                  <span className="nav-link font-medium">Dashboard</span>
                </Link>
                <LogoutButton variant="ghost" className="nav-link font-medium" />
                <Link href="/profile">
                  <Avatar className="h-8 w-8 cursor-pointer">
                    <AvatarImage src={user?.picture} alt={user?.name || ""} />
                    <AvatarFallback>
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              </div>
            ) : (
              <LoginButton />
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <Button variant="ghost" size="icon" onClick={toggleMenu} className="text-foreground">
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile navigation */}
      {isMenuOpen && (
        <div className="md:hidden border-t p-4 flex flex-col space-y-4 bg-[var(--color-background)]">
          {!isInApplication && (
            <>
              <Link href="/" onClick={closeMenu}>
                <span className="block py-2 nav-link">Home</span>
              </Link>
              <Link href="/#features" onClick={closeMenu}>
                <span className="block py-2 nav-link">Features</span>
              </Link>
              <Link href="/#pricing" onClick={closeMenu}>
                <span className="block py-2 nav-link">Pricing</span>
              </Link>
              <Link href="/components" onClick={closeMenu}>
                <span className="block py-2 nav-link">UI Components</span>
              </Link>
            </>
          )}
          
          {isAuthenticated ? (
            <>
              <Link href="/dashboard" onClick={closeMenu}>
                <span className="block py-2 nav-link">Dashboard</span>
              </Link>
              <Link href="/profile" onClick={closeMenu}>
                <span className="block py-2 nav-link">Profile</span>
              </Link>
              <LogoutButton className="w-full" />
            </>
          ) : (
            <LoginButton className="w-full" />
          )}
        </div>
      )}
    </nav>
  );
}
