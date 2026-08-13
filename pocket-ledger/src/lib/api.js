import { supabase } from "./supabaseClient";

/* ---------------- auth ---------------- */

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function sendMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return data.subscription; // caller should .unsubscribe() on unmount
}

/* ---------------- family ---------------- */

// Returns the caller's family + role, or null if the signed-in user
// hasn't created/joined a family yet.
export async function getMyFamily() {
  const { data, error } = await supabase
    .from("parents")
    .select("role, family_id, families(id, name, created_at)")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { role: data.role, ...data.families };
}

export async function createFamily(name) {
  const { data, error } = await supabase.rpc("create_family", { family_name: name });
  if (error) throw error;
  return data; // new family id
}

// Creates a 6-character invite code for the caller's family, valid for
// 24 hours and single-use. Returns the full row, including `code` and
// `expires_at`.
export async function createFamilyInvite() {
  const { data, error } = await supabase.rpc("create_family_invite");
  if (error) throw error;
  return data;
}

export async function redeemFamilyInvite(code) {
  const { error } = await supabase.rpc("redeem_family_invite", { invite_code: code });
  if (error) throw error;
}

/* ---------------- children ---------------- */

export async function listChildren() {
  const { data, error } = await supabase.from("children").select("*").order("created_at");
  if (error) throw error;
  return data;
}

export async function addChild({ name, avatar, pin, familyId }) {
  const { data, error } = await supabase
    .from("children")
    .insert({ name, avatar, pin: pin || "0000", family_id: familyId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateChildJars(childId, { jar_save, jar_spend, jar_give }) {
  const { error } = await supabase
    .from("children")
    .update({ jar_save, jar_spend, jar_give })
    .eq("id", childId);
  if (error) throw error;
}

export async function removeChild(childId) {
  const { error } = await supabase.from("children").delete().eq("id", childId);
  if (error) throw error;
}

/* ---------------- chores ---------------- */

export async function listChores() {
  const { data, error } = await supabase
    .from("chores")
    .select("*")
    .eq("active", true)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function addChore({ name, icon, value_pence, familyId }) {
  const { data, error } = await supabase
    .from("chores")
    .insert({ name, icon, value_pence, family_id: familyId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeChore(choreId) {
  // Soft delete keeps history on past chore_claims intact
  const { error } = await supabase.from("chores").update({ active: false }).eq("id", choreId);
  if (error) throw error;
}

/* ---------------- bills ---------------- */

export async function listBillsForChild(childId) {
  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .eq("child_id", childId)
    .eq("active", true)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function addBill({ familyId, childId, name, icon, amount_pence, frequency = "weekly" }) {
  const { data, error } = await supabase
    .from("bills")
    .insert({ family_id: familyId, child_id: childId, name, icon, amount_pence, frequency })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeBill(billId) {
  const { error } = await supabase.from("bills").update({ active: false }).eq("id", billId);
  if (error) throw error;
}

export async function setAllowNegativeBalance(childId, allow) {
  const { error } = await supabase.from("children").update({ allow_negative_balance: allow }).eq("id", childId);
  if (error) throw error;
}

// Runs pay day for one child now. In production, call the equivalent
// server-side function on a weekly pg_cron schedule instead (see schema.sql).
export async function runBillsNow(childId) {
  const { data, error } = await supabase.rpc("run_bills_for_child", { target_child_id: childId });
  if (error) throw error;
  return data; // { total_due_pence, total_paid_pence, shortfall_pence, ... }
}

export async function listBillRuns(childId, limit = 10) {
  const { data, error } = await supabase
    .from("bill_runs")
    .select("*")
    .eq("child_id", childId)
    .order("run_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/* ---------------- chore claims (chore done → awaiting approval) ---------------- */

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
    .select("id, claimed_at, chores(id, name, icon, value_pence), children(id, name, avatar)")
    .eq("status", "pending")
    .order("claimed_at");
  if (error) throw error;
  return data;
}

export async function decideClaim(claimId, approve) {
  const { error } = await supabase.rpc("decide_chore_claim", { claim_id: claimId, approve });
  if (error) throw error;
}

/* ---------------- balances / ledger ---------------- */

export async function getChildBalance(childId) {
  const { data, error } = await supabase
    .from("child_balances")
    .select("*")
    .eq("child_id", childId)
    .maybeSingle();
  if (error) throw error;
  return data || { save_pence: 0, spend_pence: 0, give_pence: 0, total_pence: 0 };
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

/* ---------------- realtime (optional but nice: parent sees claims live) ---------------- */

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
