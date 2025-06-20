import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { AlertCircle, BrainCircuit, LayoutDashboard, Users, Database, Settings, ChevronLeft, ChevronRight, Key, Clock, Mail, UserPlus, Link as LinkIcon, BarChart, Store, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SidebarLink {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export function Sidebar() {
  const [location] = useLocation();
  const isMobile = useMobile();
  const [collapsed, setCollapsed] = useState(false);

  const links: SidebarLink[] = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      href: "/agent-marketplace",
      label: "Marketplace",
      icon: <Store className="h-5 w-5" />,
    },
    {
      href: "/agents",
      label: "My Agents",
      icon: <Users className="h-5 w-5" />,
    },
    {
      href: "/knowledge-bases",
      label: "Knowledge Bases",
      icon: <Database className="h-5 w-5" />,
    },
    {
      href: "/visualizer-boards",
      label: "Boards",
      icon: <UserPlus className="h-5 w-5" />,
    },
    {
      href: "/teams",
      label: "Teams",
      icon: <UserPlus className="h-5 w-5" />,
    },
    {
      href: "/integrations",
      label: "Integrations",
      icon: <LinkIcon className="h-5 w-5" />,
    },
    {
      href: "/metrics/usage",
      label: "Usage Metrics",
      icon: <BarChart className="h-5 w-5" />,
    },
    {
      href: "/scheduled-updates",
      label: "Scheduled Updates",
      icon: <Clock className="h-5 w-5" />,
    },
    {
      href: "/unanswered-questions",
      label: "Unanswered Questions",
      icon: <AlertCircle className="h-5 w-5" />,
    },
    {
      href: "/contacts",
      label: "Contacts",
      icon: <Mail className="h-5 w-5" />,
    },
    {
      href: "/api-keys-management",
      label: "API Keys",
      icon: <Key className="h-5 w-5" />,
    },
    {
      href: "/profile",
      label: "Settings",
      icon: <Settings className="h-5 w-5" />,
    },
  ];

  if (isMobile) {
    return (
      <div className="flex items-center justify-between gap-2 border-b bg-[var(--color-background)] p-2">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <svg className="h-5 w-5" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="8" fill="url(#paint1_linear)"></rect>
              <path d="M12 20C12 13.9249 16.9249 9 23 9V31C16.9249 31 12 26.0751 12 20Z" fill="white"></path>
              <path d="M24 15H28C29.6569 15 31 16.3431 31 18V22C31 23.6569 29.6569 25 28 25H24V15Z" fill="white"></path>
              <defs>
                <linearGradient id="paint1_linear" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6D6AFF"></stop>
                  <stop offset="1" stopColor="#FF4BCB"></stop>
                </linearGradient>
              </defs>
            </svg>
            <span className="ml-2 text-lg font-semibold">
              Beyond<span className="text-secondary-color">Ask</span>
            </span>
          </Link>
        </div>
        <nav className="flex items-center overflow-auto">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-9 w-9 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-medium)]",
                  location === link.href && "bg-[var(--color-primary-light)] text-white"
                )}
              >
                {link.icon}
              </Button>
            </Link>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-screen flex-col border-gray-200 bg-[var(--color-background)] transition-all duration-300",
        collapsed ? "w-[60px]" : "w-[240px]"
      )}
    >
      <div className="flex h-16 items-center border-b border-[var(--color-border)] px-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <svg className="h-6 w-6" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="8" fill="url(#paint0_linear)"></rect>
              <path d="M12 20C12 13.9249 16.9249 9 23 9V31C16.9249 31 12 26.0751 12 20Z" fill="white"></path>
              <path d="M24 15H28C29.6569 15 31 16.3431 31 18V22C31 23.6569 29.6569 25 28 25H24V15Z" fill="white"></path>
              <defs>
                <linearGradient id="paint0_linear" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6D6AFF"></stop>
                  <stop offset="1" stopColor="#FF4BCB"></stop>
                </linearGradient>
              </defs>
            </svg>
            {!collapsed && (
              <span className="ml-2 text-lg font-semibold">
                Beyond<span className="text-secondary-color">Ask</span>
              </span>
            )}
          </Link>
        </div>
      </div>
      <ScrollArea className="flex-1 py-4">
        <nav className="grid grid-flow-row gap-2 px-2">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              <Button
                variant="ghost"
                className={cn(
                  "flex w-full justify-start gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-medium)]",
                  location === link.href && "active-nav-item",
                  collapsed && "justify-center px-2"
                )}
              >
                {link.icon}
                {!collapsed && <span>{link.label}</span>}
              </Button>
            </Link>
          ))}
        </nav>
      </ScrollArea>
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-20 hidden h-6 w-6 translate-x-1/2 rounded-full border border-[var(--color-border)] bg-[var(--color-background)] md:flex"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3 text-[var(--color-text-secondary)]" />
        ) : (
          <ChevronLeft className="h-3 w-3 text-[var(--color-text-secondary)]" />
        )}
      </Button>
    </div>
  );
}