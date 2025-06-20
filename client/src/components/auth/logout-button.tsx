import { Button } from "@/components/ui/button";
import { useAuth } from "./auth-provider";
import { LogOut } from "lucide-react";

interface LogoutButtonProps {
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  showIcon?: boolean;
}

export function LogoutButton({ className, variant = "outline", showIcon = true }: LogoutButtonProps) {
  const { logout } = useAuth();

  return (
    <Button onClick={logout} className={className} variant={variant}>
      {showIcon && <LogOut className="h-4 w-4 mr-2" />}
      Sign Out
    </Button>
  );
}
