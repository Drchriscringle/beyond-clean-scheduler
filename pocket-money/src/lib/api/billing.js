import { supabase } from "../supabaseClient";

export async function createCheckoutSession() {
  const { data, error } = await supabase.functions.invoke("create-checkout-session", { method: "POST" });
  if (error) throw error;
  return data.url;
}

export async function createBillingPortalSession() {
  const { data, error } = await supabase.functions.invoke("create-billing-portal-session", { method: "POST" });
  if (error) throw error;
  return data.url;
}
