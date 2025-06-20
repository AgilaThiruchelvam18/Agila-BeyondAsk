import { Button } from "@/components/ui/button";
import { useAuth } from "./auth-provider";
import { LogIn } from "lucide-react";

interface LoginButtonProps {
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  showIcon?: boolean;
}

export function LoginButton({ className, variant = "default", showIcon = true }: LoginButtonProps) {
  const { login } = useAuth();

  return (
    <Button onClick={login} className={className || "bg-[#6D6AFF] text-white hover:bg-[#FF4BCB] transition-all duration-300 rounded-lg px-5 py-2 font-medium"} variant={variant}>
      {showIcon && <LogIn className="h-4 w-4 mr-2" />}
      Sign In
    </Button>
  );
}
