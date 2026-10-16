import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";

export function useFamily(enabled) {
  return useQuery({
    queryKey: ["family"],
    queryFn: api.getMyFamily,
    enabled,
  });
}

export function useCreateFamily() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name) => api.createFamily(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["family"] }),
  });
}

export function useRedeemFamilyInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code) => api.redeemFamilyInvite(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["family"] }),
  });
}

export function useCreateFamilyInvite() {
  return useMutation({ mutationFn: api.createFamilyInvite });
}

export function useUpdateFamilyCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ familyId, currency }) => api.updateFamilyCurrency(familyId, currency),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["family"] }),
  });
}

export function useDeleteMyAccount() {
  return useMutation({ mutationFn: api.deleteMyAccount });
}
