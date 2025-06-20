import { useContext, createContext } from 'react';

// This is a simplified authentication context
// It should match the Auth0 or your custom authentication system
interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: {
    id?: number;
    email?: string;
    name?: string;
    picture?: string;
  } | null;
  login: () => void;
  logout: () => void;
}

// Create the context
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}