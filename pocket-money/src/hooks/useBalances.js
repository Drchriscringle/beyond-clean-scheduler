import { useQueries } from "@tanstack/react-query";
import * as api from "../lib/api";

// One balance query per child, combined into a childId -> balance map —
// same shape FamilyDashboard used to build by hand in refreshAll().
export function useChildBalances(children) {
  const results = useQueries({
    queries: (children || []).map((kid) => ({
      queryKey: ["balance", kid.id],
      queryFn: () => api.getChildBalance(kid.id),
      enabled: !!kid.id,
    })),
  });

  const balances = {};
  (children || []).forEach((kid, i) => {
    if (results[i]?.data) balances[kid.id] = results[i].data;
  });
  return balances;
}
