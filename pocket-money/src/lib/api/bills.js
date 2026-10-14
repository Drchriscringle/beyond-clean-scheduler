import { supabase } from "../supabaseClient";

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
