import { supabase } from "../supabaseClient";

// Goes through claim_chore() so the weekly / once-a-day limits are enforced
// server-side. `claimDay` is the device's local date ('YYYY-MM-DD').
export async function claimChore(choreId, childId, claimDay) {
  const { data, error } = await supabase.rpc("claim_chore", { target_chore_id: choreId, target_child_id: childId, claim_day: claimDay });
  if (error) throw error;
  return data;
}

// Every claim this week (Mon 00:00 UTC) — used for "2 of 7 left" counts
// and the weekly earnings total.
export async function listWeekClaims(weekStartIso) {
  const { data, error } = await supabase
    .from("chore_claims")
    .select("id, chore_id, child_id, status, claimed_at, decided_at, for_day, chores(value_pence, name, icon)")
    .gte("claimed_at", weekStartIso)
    .order("claimed_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listPendingClaims() {
  const { data, error } = await supabase
    .from("chore_claims")
    .select("id, claimed_at, chores(id, name, icon, value_pence), children(id, name, avatar, avatar_url, theme)")
    .eq("status", "pending")
    .order("claimed_at");
  if (error) throw error;
  return data;
}

export async function decideClaim(claimId, approve) {
  const { error } = await supabase.rpc("decide_chore_claim", { claim_id: claimId, approve });
  if (error) throw error;
}

export async function listRecentActivity(limit = 10, childId = null) {
  let query = supabase
    .from("chore_claims")
    .select("id, status, claimed_at, decided_at, chores(icon, name, value_pence), children(id, name)")
    .order("claimed_at", { ascending: false })
    .limit(limit);
  if (childId) query = query.eq("child_id", childId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Realtime: parent sees claims appear/change live without polling.
export function subscribeToClaims(familyId, onChange) {
  const channel = supabase
    .channel(`claims-${familyId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "chore_claims", filter: `family_id=eq.${familyId}` },
      onChange
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
