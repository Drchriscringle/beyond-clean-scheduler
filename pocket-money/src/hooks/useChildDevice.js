import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";

// Which child (if any) this anonymous session is signed in as.
export function useMyChildDevice(enabled) {
  return useQuery({
    queryKey: ["childDevice"],
    queryFn: api.getMyChildDevice,
    enabled,
    retry: false,
    refetchOnWindowFocus: true,
  });
}

export function useChildSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ username, pin }) => api.signInAsChild(username, pin),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["childDevice"] }),
  });
}

export function useChildSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.signOutChildDevice,
    onSettled: () => queryClient.clear(),
  });
}

// The family row a child device belongs to (currency, trial state).
export function useFamilyById(familyId) {
  return useQuery({
    queryKey: ["family", familyId],
    queryFn: () => api.getFamilyById(familyId),
    enabled: !!familyId,
  });
}

// Keep "last seen" fresh while the child has the app open.
export function useTouchChildDevice(active) {
  useEffect(() => {
    if (!active) return;
    api.touchChildDevice().catch(() => {});
    const t = setInterval(() => api.touchChildDevice().catch(() => {}), 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [active]);
}

/* ---------------- parent side ---------------- */

export function useChildDevices() {
  return useQuery({ queryKey: ["childDevices"], queryFn: api.listChildDevices });
}

export function useRevokeChildDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.revokeChildDevice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["childDevices"] }),
  });
}

export function useUpdateChildUsername() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ childId, username }) => api.updateChildUsername(childId, username),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["children"] }),
  });
}

export function useUpdateChildPin() {
  return useMutation({ mutationFn: ({ childId, pin }) => api.updateChildPin(childId, pin) });
}

export function useRevealChildPin() {
  return useMutation({ mutationFn: (childId) => api.revealChildPin(childId) });
}

export function useRenameChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ childId, name }) => api.renameChild(childId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["children"] });
      queryClient.invalidateQueries({ queryKey: ["pendingClaims"] });
    },
  });
}
