import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { tokenManager } from "@/lib/token-manager";

// Auth0 configuration 
const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN || "your-auth0-domain.auth0.com";
const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID || "your-client-id";
// The audience should match what's configured in Auth0
const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE || "https://api.knowledge-assistant.com";

// Auth0 configuration is set up

interface User {
  id: number;
  authId: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
  login: () => void;
  logout: () => void;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  getToken: async () => null,
});

export const useAuth = () => {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Function to refresh access token using refresh token
  const refreshAccessToken = async (): Promise<string | null> => {
    try {
      const refreshToken = tokenManager.getRefreshToken();
      if (!refreshToken) {
        return null;
      }

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          tokenManager.updateAccessToken(data.accessToken, data.expiresIn);
          if (data.user) {
            setUser(data.user);
          }
          return data.accessToken;
        }
      }

      // Refresh failed, clear tokens
      tokenManager.clearTokens();
      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      tokenManager.clearTokens();
      return null;
    }
  };

  // Load auth state from token manager on startup
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const accessToken = tokenManager.getAccessToken();
        
        if (accessToken) {
          // Token exists and is valid
          setToken(accessToken);
          setIsAuthenticated(true);
          
          // Try to get user info from the token or API
          try {
            const response = await apiRequest('/api/auth/me');
            if (response.success) {
              setUser(response.user);
            }
          } catch (error) {
            console.error("Failed to get user info:", error);
            // Token might be invalid, clear it
            tokenManager.clearTokens();
            setIsAuthenticated(false);
            setToken(null);
          }
        } else if (tokenManager.hasRefreshToken()) {
          // Try to refresh the token
          const newToken = await refreshAccessToken();
          if (newToken) {
            setToken(newToken);
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
            setToken(null);
          }
        } else {
          // No tokens available
          setIsAuthenticated(false);
          setUser(null);
          setToken(null);
        }
      } catch (error) {
        console.error("Auth status check failed:", error);
        tokenManager.clearTokens();
        setIsAuthenticated(false);
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuthStatus();
  }, []);

  const login = () => {
    // Redirect to Auth0 login
    const redirectUri = `${window.location.origin}/callback`;
    const authUrl = `https://${AUTH0_DOMAIN}/authorize?` +
      `response_type=token&` +
      `client_id=${AUTH0_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `audience=${encodeURIComponent(AUTH0_AUDIENCE)}&` +
      `scope=openid%20profile%20email`;
    
    window.location.href = authUrl;
  };

  const logout = async () => {
    try {
      // Call logout endpoint if authenticated
      if (token) {
        await apiRequest('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
    }
    
    // Clear all auth state
    tokenManager.clearTokens();
    setIsAuthenticated(false);
    setUser(null);
    setToken(null);
    queryClient.clear();
    
    // Redirect to Auth0 logout
    const returnTo = window.location.origin;
    window.location.href = `https://${AUTH0_DOMAIN}/v2/logout?client_id=${AUTH0_CLIENT_ID}&returnTo=${encodeURIComponent(returnTo)}`;
  };

  const getToken = async (): Promise<string | null> => {
    // Check if current token is still valid
    const currentToken = tokenManager.getAccessToken();
    
    if (currentToken) {
      // Token is valid and not expired
      return currentToken;
    }
    
    // Token is expired or missing, try to refresh
    if (tokenManager.hasRefreshToken()) {
      console.log('Token expired, attempting refresh...');
      const newToken = await refreshAccessToken();
      if (newToken) {
        setToken(newToken);
        return newToken;
      }
    }
    
    // No valid token available
    setIsAuthenticated(false);
    setToken(null);
    setUser(null);
    return null;
  };

  const refreshToken = async () => {
    try {
      // Auth0 implicit flow doesn't support refresh tokens
      // So we need to use silent authentication (hidden iframe)
      const redirectUri = `${window.location.origin}/callback`;
      const authUrl = `https://${AUTH0_DOMAIN}/authorize?` +
        `response_type=token&` +
        `client_id=${AUTH0_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `audience=${encodeURIComponent(AUTH0_AUDIENCE)}&` +
        `scope=openid%20profile%20email&` +
        `prompt=none`; // Silent authentication

      return new Promise<void>((resolve, reject) => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = authUrl;

        const handleMessage = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          
          if (event.data.type === 'auth_success') {
            localStorage.setItem("auth_token", event.data.token);
            setToken(event.data.token);
            window.removeEventListener('message', handleMessage);
            document.body.removeChild(iframe);
            resolve();
          } else if (event.data.type === 'auth_error') {
            window.removeEventListener('message', handleMessage);
            document.body.removeChild(iframe);
            // Silent auth failed, redirect to login
            login();
            reject(new Error('Silent authentication failed'));
          }
        };

        window.addEventListener('message', handleMessage);
        document.body.appendChild(iframe);

        // Timeout after 10 seconds
        setTimeout(() => {
          window.removeEventListener('message', handleMessage);
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          reject(new Error('Silent authentication timeout'));
        }, 10000);
      });
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Redirect to login if refresh fails
      login();
    }
  };

  // Handle Auth0 callback
  useEffect(() => {
    if (window.location.hash && window.location.hash.includes("access_token=")) {
      const hashParams = window.location.hash.substring(1).split("&").reduce<Record<string, string>>((acc, curr) => {
        const [key, value] = curr.split("=");
        acc[key] = decodeURIComponent(value);
        return acc;
      }, {});
      
      if (hashParams.access_token) {
        // Store token
        localStorage.setItem("auth_token", hashParams.access_token);
        setToken(hashParams.access_token);
        
        // Fetch user info
        const fetchUserInfo = async () => {
          try {
            const response = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
              headers: {
                Authorization: `Bearer ${hashParams.access_token}`
              }
            });
            
            if (response.ok) {
              const userInfo = await response.json();
              
              // Process the user info received from Auth0
              
              // Verify we have the required fields from Auth0
              if (!userInfo.sub || !userInfo.email || !userInfo.name) {
                console.error("Missing required user info from Auth0:", userInfo);
                throw new Error("Auth0 did not provide all required user information");
              }
              
              // Create or get user in our system
              const authUser = {
                authId: userInfo.sub,
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture
              };
              
              try {
                // Check if user exists
                try {
                  const userResponse = await fetch("/api/user", {
                    headers: {
                      'Authorization': `Bearer ${hashParams.access_token}`
                    }
                  });
                  
                  if (userResponse.status === 404 || userResponse.status === 401) {
                    // Create user if not found
                    try {
                      // Make a direct fetch request to create the user with proper headers and body
                      const createResponse = await fetch("/api/user", {
                        method: "POST",
                        headers: {
                          'Authorization': `Bearer ${hashParams.access_token}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(authUser)
                      });
                      
                      if (createResponse.ok) {
                        const createdUser = await createResponse.json();
                        setUser(createdUser);
                        localStorage.setItem("auth_user", JSON.stringify(createdUser));
                        setIsAuthenticated(true);
                      } else {
                        let errorData;
                        try {
                          errorData = await createResponse.json();
                        } catch (e) {
                          errorData = { message: `HTTP error ${createResponse.status}` };
                        }
                        console.error("Failed to create user:", errorData);
                        throw new Error(`Failed to create user: ${errorData.message || "Unknown error"}`);
                      }
                    } catch (postError) {
                      console.error("Error creating user:", postError);
                      throw postError;
                    }
                  } else if (userResponse.ok) {
                    const existingUser = await userResponse.json();
                    setUser(existingUser);
                    localStorage.setItem("auth_user", JSON.stringify(existingUser));
                    setIsAuthenticated(true);
                  } else {
                    let errorData;
                    try {
                      errorData = await userResponse.json();
                    } catch (e) {
                      errorData = { message: `HTTP error ${userResponse.status}` };
                    }
                    console.error("Unexpected response from user API:", errorData);
                    throw new Error(`Unexpected response: ${errorData.message || "Unknown error"}`);
                  }
                } catch (err) {
                  console.error("Error fetching user data:", err);
                  const message = err instanceof Error ? err.message : "Unknown error";
                  throw new Error(`Failed to fetch user data: ${message}`);
                }
              } catch (error) {
                console.error("Error setting up user:", error);
                alert("Authentication error: " + (error instanceof Error ? error.message : "Failed to authenticate"));
              }
            }
          } catch (error) {
            console.error("Failed to fetch user info:", error);
          }
        };
        
        fetchUserInfo();
        
        // Remove hash from URL
        window.history.replaceState(null, document.title, window.location.pathname);
      }
    }
  }, []);

  // Apply token to API requests without overriding global fetch
  useEffect(() => {
    if (!token) return;
    
    // Set token in queryClient defaults
    queryClient.setDefaultOptions({
      queries: {
        meta: { token },
      },
      mutations: {
        meta: { token },
      },
    });
  }, [token, queryClient]);

  const value = {
    isAuthenticated,
    isLoading,
    user,
    token,
    login,
    logout,
    getToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
