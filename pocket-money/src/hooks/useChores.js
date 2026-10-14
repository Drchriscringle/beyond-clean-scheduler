import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";

export function useChores() {
  return useQuery({ queryKey: ["chores"], queryFn: api.listChores });
}

function useChoreMutation(fn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    // The database trigger may re-value sibling chores, so refetch the lot.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chores"] }),
  });
}

export function useAddChore() {
  return useChoreMutation(api.addChore);
}

export function useUpdateChore() {
  return useChoreMutation(({ choreId, patch }) => api.updateChore(choreId, patch));
}

export function useRemoveChore() {
  return useChoreMutation(api.removeChore);
}
