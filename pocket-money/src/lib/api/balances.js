import { supabase } from "../supabaseClient";

export async function getChildBalance(childId) {
  const { data, error } = await supabase
    .from("child_balances")
    .select("*")
    .eq("child_id", childId)
    .maybeSingle();
  if (error) throw error;
  return data || { save_pence: 0, spend_pence: 0, give_pence: 0, total_pence: 0 };
}
