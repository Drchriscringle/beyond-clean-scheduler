import { supabase } from "../supabaseClient";

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
