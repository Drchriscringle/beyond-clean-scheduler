// Returns a Stripe customer-portal URL so a parent can update payment
// details, see invoices, or cancel — without us building any of that UI.
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const APP_URL = Deno.env.get("APP_URL")!;

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

  const { data: parentRow, error } = await userClient
    .from("parents")
    .select("families(stripe_customer_id)")
    .maybeSingle();

  const customerId = parentRow?.families?.stripe_customer_id;
  if (error || !customerId) {
    return new Response(JSON.stringify({ error: "No billing account yet — subscribe first" }), { status: 400 });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL}/`,
  });

  return new Response(JSON.stringify({ url: portalSession.url }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
