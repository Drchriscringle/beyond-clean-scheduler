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

export function useUpdateChildBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ childId, pence }) => api.updateChildBudget(childId, pence),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["children"] });
      queryClient.invalidateQueries({ queryKey: ["chores"] }); // trigger re-values auto chores
    },
  });
}

export function useUpdateChildBirthYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ childId, birthYear }) => api.updateChildBirthYear(childId, birthYear),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["children"] }),
  });
}

export function useCheckChildPin() {
  return useMutation({
    mutationFn: ({ childId, pin }) => api.checkChildPin(childId, pin),
  });
}

/* ---------------- personalisation ---------------- */

export function useUpdateChildTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ childId, theme }) => api.updateChildTheme(childId, theme),
    // Optimistic: the picker should feel instant.
    onMutate: async ({ childId, theme }) => {
      await queryClient.cancelQueries({ queryKey: ["children"] });
      const previous = queryClient.getQueryData(["children"]);
      queryClient.setQueryData(["children"], (kids) => kids?.map((k) => (k.id === childId ? { ...k, theme } : k)));
      return { previous };
    },
    onError: (_err, _vars, ctx) => ctx?.previous && queryClient.setQueryData(["children"], ctx.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["children"] }),
  });
}

export function useUploadChildAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.uploadChildAvatar,
    onSuccess: (path) => {
      queryClient.invalidateQueries({ queryKey: ["avatarUrl", path] });
      queryClient.invalidateQueries({ queryKey: ["children"] });
      queryClient.invalidateQueries({ queryKey: ["pendingClaims"] });
    },
  });
}

export function useRemoveChildAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.removeChildAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["children"] });
      queryClient.invalidateQueries({ queryKey: ["pendingClaims"] });
    },
  });
}

// Signed URLs last an hour; refresh a little before that.
export function useAvatarUrl(path) {
  return useQuery({
    queryKey: ["avatarUrl", path],
    queryFn: () => api.getAvatarSignedUrl(path),
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    retry: false,
  });
}
