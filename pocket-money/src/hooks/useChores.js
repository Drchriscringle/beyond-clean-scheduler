import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";

export function useChores() {
  return useQuery({ queryKey: ["chores"], queryFn: api.listChores });
}

export function useAddChore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.addChore,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chores"] }),
  });
}

export function useRemoveChore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.removeChore,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chores"] }),
  });
}
