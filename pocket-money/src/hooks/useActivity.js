import { useQuery } from "@tanstack/react-query";
import * as api from "../lib/api";

export function useRecentActivity(childId, limit = 6) {
  return useQuery({
    queryKey: ["activity", childId, limit],
    queryFn: () => api.listRecentActivity(limit, childId),
    enabled: !!childId,
    retry: false, // non-critical — the rest of the screen still works if this fails
  });
}
