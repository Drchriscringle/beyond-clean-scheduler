// Deletes the caller's family (via the delete_my_family() RPC, which
// enforces "only the owner" and cascades every table) and then the
// caller's own auth.users row — something a client can never do for
// itself, since that requires the service-role key.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401 });
  }

  // Acts as the calling parent — respects RLS and the owner-only check
  // inside delete_my_family().
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  const { error: rpcError } = await userClient.rpc("delete_my_family");
  if (rpcError) {
    return new Response(JSON.stringify({ error: rpcError.message }), { status: 400 });
  }

  // Only the service-role key can remove the auth user itself.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userData.user.id);
  if (deleteUserError) {
    return new Response(JSON.stringify({ error: deleteUserError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
