import { supabase } from "../supabaseClient";

const CHORE_COLUMNS = "id, family_id, child_id, name, icon, value_pence, times_per_week, custom_value, active, created_at";

export async function listChores() {
  const { data, error } = await supabase
    .from("chores")
    .select(CHORE_COLUMNS)
    .eq("active", true)
    .order("created_at");
  if (error) throw error;
  return data;
}

// value_pence is only meaningful when customValue is true; auto-split chores
// are re-valued by the database trigger from the child's weekly budget.
export async function addChore({ familyId, childId, name, icon, timesPerWeek = 1, customValue = false, valuePence = 1 }) {
  const { data, error } = await supabase
    .from("chores")
    .insert({
      family_id: familyId,
      child_id: childId,
      name,
      icon,
      times_per_week: timesPerWeek,
      custom_value: customValue,
      value_pence: customValue ? valuePence : 1,
    })
    .select(CHORE_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function updateChore(choreId, patch) {
  const { error } = await supabase.from("chores").update(patch).eq("id", choreId);
  if (error) throw error;
}

export async function removeChore(choreId) {
  // Soft delete keeps history on past chore_claims intact
  const { error } = await supabase.from("chores").update({ active: false }).eq("id", choreId);
  if (error) throw error;
}
