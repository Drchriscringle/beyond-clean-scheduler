import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import * as api from "../lib/api";

// The raw Supabase session — null means signed out, undefined means "still
// checking" (so callers can tell "no session" apart from "haven't asked yet").
export function useAuthSession() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const sub = api.onAuthChange(setSession);
    return () => sub.unsubscribe();
  }, []);

  return session;
}
