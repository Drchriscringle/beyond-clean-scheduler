import { supabase } from "../supabaseClient";

// Returns the caller's family + role, or null if the signed-in user
// hasn't created/joined a family yet.
export async function getMyFamily() {
  const { data, error } = await supabase
    .from("parents")
    .select("role, family_id, families(id, name, created_at, currency, subscription_status, trial_ends_at)")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { role: data.role, ...data.families };
}

export async function updateFamilyCurrency(familyId, currency) {
  const { error } = await supabase.from("families").update({ currency }).eq("id", familyId);
  if (error) throw error;
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

// Permanently deletes the caller's family and everything in it (children,
// chores, bills, transactions, …). Does not remove the parent's auth
// account itself — see deleteMyAccount() for that.
export async function deleteMyFamily() {
  const { error } = await supabase.rpc("delete_my_family");
  if (error) throw error;
}

// Deletes the family (via delete_my_family()) AND the caller's own auth
// account, via an edge function — a client can't delete its own auth.users
// row directly.
export async function deleteMyAccount() {
  const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
  if (error) throw error;
}
