import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";
import { weekStartUTC } from "../lib/week";

export function usePendingClaims() {
  return useQuery({ queryKey: ["pendingClaims"], queryFn: api.listPendingClaims });
}

export function useWeekClaims() {
  const weekStart = weekStartUTC().toISOString();
  return useQuery({ queryKey: ["weekClaims", weekStart], queryFn: () => api.listWeekClaims(weekStart) });
}

export function useClaimChore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ choreId, childId, claimDay }) => api.claimChore(choreId, childId, claimDay),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingClaims"] });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "weekClaims" });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "activity" });
    },
  });
}

export function useAttachClaimPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.uploadClaimPhoto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingClaims"] });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "weekClaims" });
    },
  });
}

// Signed URLs last an hour; refresh a little before that.
export function useClaimPhotoUrl(path) {
  return useQuery({
    queryKey: ["claimPhoto", path],
    queryFn: () => api.getClaimPhotoUrl(path),
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    retry: false,
  });
}

export function useDecideClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ claimId, approve }) => api.decideClaim(claimId, approve),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingClaims"] });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "weekClaims" });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "balance" });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "activity" });
    },
  });
}

// Realtime: refetch pending claims (and whatever else changed) when another
// device inserts/updates a chore_claims row for this family.
export function useClaimsRealtime(familyId) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!familyId) return;
    const unsubscribe = api.subscribeToClaims(familyId, () => {
      queryClient.invalidateQueries({ queryKey: ["pendingClaims"] });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "weekClaims" });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "balance" });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "activity" });
    });
    return unsubscribe;
  }, [familyId, queryClient]);
}
