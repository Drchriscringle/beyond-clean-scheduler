import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";

export function usePendingClaims() {
  return useQuery({ queryKey: ["pendingClaims"], queryFn: api.listPendingClaims });
}

export function useClaimChore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ choreId, childId, familyId }) => api.claimChore(choreId, childId, familyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingClaims"] });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "activity" });
    },
  });
}

export function useDecideClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ claimId, approve }) => api.decideClaim(claimId, approve),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingClaims"] });
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
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "balance" });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "activity" });
    });
    return unsubscribe;
  }, [familyId, queryClient]);
}
