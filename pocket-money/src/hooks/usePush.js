import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import * as api from "../lib/api";
import { currentPushSubscription, pushSupport, subscribeToPush, unsubscribeFromPush } from "../lib/push";

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Chore alerts on this device: 'on' | 'off' | 'ios-install' | 'unsupported' | 'checking'
export function useChoreAlerts(familyId) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const support = pushSupport();
      if (support !== "ok") return setStatus(support);
      try {
        const sub = await currentPushSubscription();
        const on = sub ? await api.isPushEndpointActive(sub.endpoint) : false;
        if (!cancelled) setStatus(on ? "on" : "off");
      } catch {
        if (!cancelled) setStatus("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useMutation({
    mutationFn: async () => {
      const { endpoint, keys } = await subscribeToPush(PUBLIC_KEY);
      await api.savePushSubscription({ familyId, endpoint, keys });
    },
    onSuccess: () => setStatus("on"),
  });

  const disable = useMutation({
    mutationFn: async () => {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) await api.deactivatePushSubscription(endpoint);
    },
    onSuccess: () => setStatus("off"),
  });

  return { status, enable, disable, configured: !!PUBLIC_KEY };
}

// Best-effort: never let a failed notification break the child's flow.
export async function notifyParents({ title, body, url = "/" }) {
  try {
    const sub = await currentPushSubscription();
    await api.sendPush({ title, body, url, excludeEndpoint: sub?.endpoint });
  } catch (err) {
    console.warn("chore alert not sent:", err?.message || err);
  }
}
