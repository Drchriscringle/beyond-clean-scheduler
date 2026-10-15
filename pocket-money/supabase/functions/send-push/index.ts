// Sends a web-push notification to devices in the caller's family.
//   to: 'parents'           → every parent device with alerts on
//   to: 'child' + childId   → that child's own devices
// Called by the app when a child marks a chore done (→ parents), when a
// parent approves/declines (→ child), and when either side sends a message.
// Dead subscriptions (410/404) are switched off.
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

// Not secret: the same key is baked into the app (VITE_VAPID_PUBLIC_KEY).
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "BKzE6lLJzOTltvEaMzfteYtSur6xnqH8y-Lo568b_aeH6wAJsvvTTFvcKBsfMO1AvcaSvWTxHdUzHWCouiU4QAw";
const VAPID_SUBJECT = "https://pocket-money-family.netlify.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  // Who is calling? A parent (row in `parents`) or a child device (row in
  // `child_devices`). RLS means each query only ever returns the caller's own row.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: parentRow } = await userClient.from("parents").select("family_id").maybeSingle();
  let familyId = parentRow?.family_id as string | undefined;
  let callerChildId: string | null = null;
  if (!familyId) {
    const { data: userData } = await userClient.auth.getUser();
    const { data: device } = await userClient
      .from("child_devices")
      .select("family_id, child_id")
      .eq("user_id", userData?.user?.id ?? "")
      .is("revoked_at", null)
      .maybeSingle();
    familyId = device?.family_id;
    callerChildId = device?.child_id ?? null;
  }
  if (!familyId) return json({ error: "No family" }, 400);

  const { title, body, url, excludeEndpoint, to = "parents", childId, tag } = await req.json().catch(() => ({}));
  if (!title) return json({ error: "title required" }, 400);

  // A child device may only notify its parents; a parent may notify its
  // parents' devices or one of its children.
  if (callerChildId && to !== "parents") return json({ error: "Not allowed" }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  let query = admin.from("push_subscriptions").select("id, endpoint, keys").eq("family_id", familyId).eq("active", true);
  if (to === "child") {
    if (!childId) return json({ error: "childId required" }, 400);
    query = query.eq("audience", "child").eq("child_id", childId);
  } else {
    query = query.eq("audience", "parent");
  }
  const { data: subs } = await query;

  const payload = JSON.stringify({ title, body, url: url || "/", tag });
  let sent = 0;
  await Promise.all(
    (subs || [])
      .filter((s) => s.endpoint !== excludeEndpoint)
      .map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 60 * 60 });
          sent++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await admin.from("push_subscriptions").update({ active: false }).eq("id", s.id);
          } else {
            console.error("push failed", status, (err as Error).message);
          }
        }
      })
  );

  return json({ sent });
});
