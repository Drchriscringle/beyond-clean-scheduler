import { supabase } from "../supabaseClient";

export async function claimChore(choreId, childId, familyId) {
  const { data, error } = await supabase
    .from("chore_claims")
    .insert({ chore_id: choreId, child_id: childId, family_id: familyId })
    .select()
    .single();
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
