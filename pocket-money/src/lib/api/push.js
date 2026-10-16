import { supabase } from "../supabaseClient";

// `audience` is who this device belongs to: 'parent' (default) or 'child'
// (with the child's id), so alerts can be aimed at the right people.
export async function savePushSubscription({ familyId, endpoint, keys, audience = "parent", childId = null }) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { family_id: familyId, user_id: userData.user.id, endpoint, keys, active: true, audience, child_id: childId },
      { onConflict: "endpoint" }
    );
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

// Fire-and-forget. `to` is 'parents' (every parent device in the family) or
// 'child' with `childId` (that child's devices).
export async function sendPush({ title, body, url, excludeEndpoint, to = "parents", childId = null, tag }) {
  const { error } = await supabase.functions.invoke("send-push", {
    method: "POST",
    body: { title, body, url, excludeEndpoint, to, childId, tag },
  });
  if (error) throw error;
}
