import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Shared hook for knowledge bases data - OPTIMIZED to reduce calls
export function useKnowledgeBases() {
  return useQuery<any[]>({
    queryKey: ["/api/knowledge-bases"],
    queryFn: async () => {
      try {
        const response = await apiRequest("/api/knowledge-bases");
        return response;
      } catch (error) {
        console.error("Error fetching knowledge bases:", error);
        throw error;
      }
    }
  });
}

// Shared hook for agents data - OPTIMIZED to reduce calls
export function useAgents() {
  return useQuery<any[]>({
    queryKey: ["/api/agents"],
    queryFn: () => apiRequest("/api/agents"),
    staleTime: 1000 * 60 * 10, // 10 minutes - longer cache
    gcTime: 1000 * 60 * 15, // 15 minutes cache retention
    refetchOnWindowFocus: false, // Prevent excessive refetching
    refetchOnMount: false, // Don't refetch on component mount if data exists
    refetchInterval: false, // Disable automatic polling
  });
}

// Shared hook for predefined agents - OPTIMIZED to reduce calls
export function usePredefinedAgents() {
  return useQuery<any[]>({
    queryKey: ["/api/predefined-agents"],
    queryFn: () => apiRequest("/api/predefined-agents"),
    staleTime: 1000 * 60 * 15, // 15 minutes (changes less frequently)
    gcTime: 1000 * 60 * 20, // 20 minutes cache retention
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't refetch on component mount if data exists
    refetchInterval: false, // Disable automatic polling
  });
}

// Shared hook for document counts - SUPER OPTIMIZED to stop excessive calls
export function useDocumentCounts(knowledgeBases: any[]) {
  return useQuery<Record<number, number>>({
    queryKey: ['/api/knowledge-bases', 'documents', 'counts'],
    queryFn: async () => {
      if (!knowledgeBases || knowledgeBases.length === 0) {
        return {};
      }
      
      const counts: Record<number, number> = {};
      
      // Fetch document counts for each knowledge base in parallel
      await Promise.all(knowledgeBases.map(async (kb) => {
        try {
          const documents = await apiRequest(`/api/knowledge-bases/${kb.id}/documents`);
          counts[kb.id] = Array.isArray(documents) ? documents.length : 0;
        } catch (error) {
          console.error(`Error fetching documents for KB ${kb.id}:`, error);
          counts[kb.id] = 0;
        }
      }));
      
      return counts;
    },
    // Only fetch if we have knowledge bases
    enabled: knowledgeBases.length > 0,
    staleTime: 1000 * 60 * 8, // 8 minutes - much longer cache
    gcTime: 1000 * 60 * 12, // 12 minutes cache retention
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't refetch on component mount if data exists
    refetchInterval: false, // Disable automatic polling
  });
}