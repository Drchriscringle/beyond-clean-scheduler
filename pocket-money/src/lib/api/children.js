import { supabase } from "../supabaseClient";

// Note: the child's PIN is never selected back to the client (see
// check_child_pin() in schema.sql) — it's a UI convenience lock, not a
// security boundary, but there's no reason to ship its value to the browser.
const CHILD_COLUMNS = "id, family_id, name, avatar, jar_save, jar_spend, jar_give, allow_negative_balance, created_at";

export async function listChildren() {
  const { data, error } = await supabase.from("children").select(CHILD_COLUMNS).order("created_at");
  if (error) throw error;
  return data;
}

export async function addChild({ name, avatar, pin, familyId }) {
  const { data, error } = await supabase
    .from("children")
    .insert({ name, avatar, pin: pin || "0000", family_id: familyId })
    .select(CHILD_COLUMNS)
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

// Verifies a PIN server-side so the real value never reaches the browser.
export async function checkChildPin(childId, pin) {
  const { data, error } = await supabase.rpc("check_child_pin", { target_child_id: childId, candidate_pin: pin });
  if (error) throw error;
  return data === true;
}
