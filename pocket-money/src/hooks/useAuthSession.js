import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import * as api from "../lib/api";

// The raw Supabase session — null means signed out, undefined means "still
// checking" (so callers can tell "no session" apart from "haven't asked yet").
//
// Whenever the signed-in user changes (sign out, or a different account signs
// in on the same device) every cached query is thrown away, so one account
// can never be shown another account's family while fresh data loads.
export function useAuthSession() {
  const [session, setSession] = useState(undefined);
  const queryClient = useQueryClient();
  const lastUserId = useRef(undefined);

  useEffect(() => {
    const apply = (next) => {
      const userId = next?.user?.id ?? null;
      if (lastUserId.current !== undefined && lastUserId.current !== userId) queryClient.clear();
      lastUserId.current = userId;
      setSession(next);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const sub = api.onAuthChange(apply);
    return () => sub.unsubscribe();
  }, [queryClient]);

  return session;
}

// A password-reset email signs the parent in and lands them here with
// `type=recovery` in the URL; Supabase also fires PASSWORD_RECOVERY. While
// this is true the app shows the "choose a new password" screen.
const arrivedViaRecoveryLink = () => {
  try {
    return /[#&]type=recovery\b/.test(window.location.hash);
  } catch {
    return false;
  }
};

export function usePasswordRecovery() {
  const [recovering, setRecovering] = useState(arrivedViaRecoveryLink);
  useEffect(() => {
    const sub = api.onAuthChange((_session, event) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => sub.unsubscribe();
  }, []);
  return [recovering, () => setRecovering(false)];
}
