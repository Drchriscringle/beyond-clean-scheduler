import { supabase } from "../supabaseClient";

const CHORE_COLUMNS = "id, family_id, child_id, name, icon, value_pence, times_per_week, custom_value, schedule, dates, active, created_at";

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
// schedule: 'weekly' (any days, timesPerWeek), 'daily', or 'dates' (+ dates[]).
export async function addChore({ familyId, childId, name, icon, timesPerWeek = 1, customValue = false, valuePence = 1, schedule = "weekly", dates = [] }) {
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
      schedule,
      dates,
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

// Re-derives this week's completion counts for date-planned chores (weeks
// roll over while nobody is editing). Cheap; called when the app opens.
export async function refreshChoreSchedules() {
  const { error } = await supabase.rpc("refresh_chore_schedules");
  if (error) throw error;
}
