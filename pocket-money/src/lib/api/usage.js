import { supabase } from "../supabaseClient";

// Child device: add a slice of on-screen time to today's total.
export async function recordChildUsage(seconds) {
  const { error } = await supabase.rpc("record_child_usage", { add_seconds: Math.round(seconds) });
  if (error) throw error;
}

// Parent: per-day seconds for every child over the last `days` days.
export async function listChildUsage(days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const { data, error } = await supabase
    .from("child_usage")
    .select("child_id, day, seconds")
    .gte("day", since.toISOString().slice(0, 10))
    .order("day");
  if (error) throw error;
  return data;
}
