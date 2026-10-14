import { supabase } from "../supabaseClient";

export async function savePushSubscription({ familyId, endpoint, keys }) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ family_id: familyId, user_id: userData.user.id, endpoint, keys, active: true }, { onConflict: "endpoint" });
  if (error) throw error;
}

export async function deactivatePushSubscription(endpoint) {
  const { error } = await supabase.from("push_subscriptions").update({ active: false }).eq("endpoint", endpoint);
  if (error) throw error;
}

export async function isPushEndpointActive(endpoint) {
  const { data, error } = await supabase.from("push_subscriptions").select("active").eq("endpoint", endpoint).maybeSingle();
  if (error) throw error;
  return data?.active === true;
}

// Fire-and-forget from the child's device after a chore is marked done.
export async function sendPush({ title, body, url, excludeEndpoint }) {
  const { error } = await supabase.functions.invoke("send-push", { method: "POST", body: { title, body, url, excludeEndpoint } });
  if (error) throw error;
}
