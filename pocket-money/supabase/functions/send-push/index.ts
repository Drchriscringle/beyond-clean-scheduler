// Sends a web-push notification to every device in the caller's family
// that has turned on chore alerts. Called by the app right after a child
// marks a chore done. Dead subscriptions (410/404) are switched off.
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

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401 });

  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: parentRow, error } = await userClient.from("parents").select("family_id").maybeSingle();
  if (error || !parentRow) return new Response(JSON.stringify({ error: "No family" }), { status: 400 });

  const { title, body, url, excludeEndpoint } = await req.json().catch(() => ({}));
  if (!title) return new Response(JSON.stringify({ error: "title required" }), { status: 400 });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, keys")
    .eq("family_id", parentRow.family_id)
    .eq("active", true);

  const payload = JSON.stringify({ title, body, url: url || "/" });
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

  return new Response(JSON.stringify({ sent }), { status: 200, headers: { "Content-Type": "application/json" } });
});
