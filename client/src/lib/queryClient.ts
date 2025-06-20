import { QueryClient } from "@tanstack/react-query";
import axios, { AxiosRequestConfig } from "axios";
import { tokenManager } from "./token-manager";

/**
 * Create a new QueryClient instance with default settings.
 * - Default staleTime is 5 minutes
 * - Default cacheTime is 10 minutes
 * - Errors are not retried by default
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: false,
      queryFn: async ({ queryKey }) => {
        const url = queryKey[0] as string;
        return defaultFetcher(url);
      },
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Default fetcher function for React Query that handles API requests.
 * @param url - API endpoint URL
 * @returns Promise that resolves to the API response data
 */
export async function defaultFetcher<T = any>(url: string): Promise<T> {
  try {
    // Build full URL with API base URL
    const fullUrl = url.startsWith('http') ? url : `${getApiBaseUrl()}${url}`;
    const response = await axios.get(fullUrl);
    return response.data;
  } catch (error: any) {
    console.error(`Error fetching ${url}:`, error.message);
    throw error;
  }
}

/**
 * Make an API request with Axios.
 * @param url - API endpoint URL
 * @param options - Axios request options
 * @returns Promise that resolves to the API response data
 */
export async function apiRequest<T = any>(
  url: string,
  options?: AxiosRequestConfig
): Promise<T> {
  try {
    // Build full URL with API base URL
    const fullUrl = url.startsWith('http') ? url : `${getApiBaseUrl()}${url}`;
    const response = await axios(fullUrl, options);
    return response.data;
  } catch (error: any) {
    console.error(`API request error (${url}):`, error.message);
    throw error;
  }
}

/**
 * Get API base URL for the current environment
 */
export function getApiBaseUrl(): string {
  // In production, use the separate backend API URL
  // In development, use the local origin
  if (import.meta.env.PROD && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return window.location.origin;
}

// Add axios interceptors for handling common cases - ENHANCED for reliability
axios.interceptors.request.use((config) => {
  // Add authorization header if token exists in token manager
  const token = tokenManager.getAccessToken();
  
  if (token) {
    // Ensure headers object exists
    if (!config.headers) {
      config.headers = {} as any;
    }
    // Always add auth header for API calls
    if (!config.url || config.url.startsWith("/api") || config.url.includes("/api/")) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Globally handle 401 Unauthorized responses with automatic token refresh
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh the token using the refresh token
        const refreshToken = tokenManager.getRefreshToken();
        if (refreshToken) {
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
              // Update tokens in token manager
              tokenManager.updateAccessToken(data.accessToken, data.expiresIn);
              
              // Retry the original request with new token
              originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
              return axios(originalRequest);
            }
          }
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
      }
      
      // If refresh failed, clear tokens and redirect to login
      tokenManager.clearTokens();
      if (window.location.pathname !== '/') {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);