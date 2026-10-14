import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";

export function useChildren() {
  return useQuery({ queryKey: ["children"], queryFn: api.listChildren });
}

export function useAddChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.addChild,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["children"] }),
  });
}

export function useCheckChildPin() {
  return useMutation({
    mutationFn: ({ childId, pin }) => api.checkChildPin(childId, pin),
  });
}
