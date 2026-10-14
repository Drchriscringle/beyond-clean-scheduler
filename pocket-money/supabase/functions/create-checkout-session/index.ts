// Creates a Stripe Checkout session (subscription mode) for the caller's
// family and returns its URL for the client to redirect to.
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_PRICE_ID = Deno.env.get("STRIPE_PRICE_ID")!;
const APP_URL = Deno.env.get("APP_URL")!; // e.g. https://pocketmoney.app — no trailing slash

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401 });
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  const { data: parentRow, error: parentError } = await userClient
    .from("parents")
    .select("family_id, families(id, name, stripe_customer_id)")
    .maybeSingle();
  if (parentError || !parentRow) {
    return new Response(JSON.stringify({ error: "No family found for this account" }), { status: 400 });
  }

  const family = parentRow.families;
  let customerId = family.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userData.user.email,
      metadata: { family_id: family.id },
    });
    customerId = customer.id;
    // Service role needed: stripe_customer_id isn't client-updatable (see schema.sql grants).
    const adminClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await adminClient.from("families").update({ stripe_customer_id: customerId }).eq("id", family.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${APP_URL}/?checkout=success`,
    cancel_url: `${APP_URL}/?checkout=cancelled`,
    client_reference_id: family.id,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
