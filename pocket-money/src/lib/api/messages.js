import { supabase } from "../supabaseClient";

const MESSAGE_COLUMNS = "id, family_id, child_id, sender, body, kind, created_at, read_at";

// The whole thread between the parents and one child, oldest first.
export async function listMessages(childId, limit = 200) {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.reverse();
}

// Unread messages for the caller: a parent sees what children have sent,
// a child sees what parents have sent. Returned as [{ child_id, count }].
export async function listUnreadMessages(asSender) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, child_id")
    .eq("sender", asSender)
    .is("read_at", null);
  if (error) throw error;
  const counts = {};
  for (const m of data) counts[m.child_id] = (counts[m.child_id] || 0) + 1;
  return counts;
}

export async function sendMessage({ familyId, childId, sender, body, kind = "text" }) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("messages")
    .insert({ family_id: familyId, child_id: childId, sender, sender_user_id: userData.user.id, body: body.trim(), kind })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

// Marks everything the other side sent in this thread as read.
export async function markThreadRead(childId, fromSender) {
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("child_id", childId)
    .eq("sender", fromSender)
    .is("read_at", null);
  if (error) throw error;
}

export function subscribeToMessages(familyId, onChange) {
  const channel = supabase
    .channel(`messages-${familyId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `family_id=eq.${familyId}` }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
