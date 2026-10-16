import { useQueries, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";

// One bills query per child, combined into a childId -> bill[] map.
export function useChildrenBills(children) {
  const results = useQueries({
    queries: (children || []).map((kid) => ({
      queryKey: ["bills", kid.id],
      queryFn: () => api.listBillsForChild(kid.id),
      enabled: !!kid.id,
    })),
  });

  const bills = {};
  (children || []).forEach((kid, i) => {
    if (results[i]?.data) bills[kid.id] = results[i].data;
  });
  return bills;
}

export function useAddBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.addBill,
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ["bills", variables.childId] }),
  });
}

export function useRemoveBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.removeBill,
    onSuccess: () => queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "bills" }),
  });
}

export function useRunBillsNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.runBillsNow,
    onSuccess: (_data, childId) => {
      queryClient.invalidateQueries({ queryKey: ["balance", childId] });
      queryClient.invalidateQueries({ queryKey: ["billRuns", childId] });
    },
  });
}

export function useBillRuns(childId) {
  return useQuery({
    queryKey: ["billRuns", childId],
    queryFn: () => api.listBillRuns(childId),
    enabled: !!childId,
  });
}
