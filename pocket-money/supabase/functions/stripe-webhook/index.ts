// Stripe webhook: keeps families.subscription_status in sync with the
// customer's actual subscription state. Configure this function's URL as
// a webhook endpoint in the Stripe dashboard, listening for:
//   checkout.session.completed, customer.subscription.updated,
//   customer.subscription.deleted
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function setStatusForCustomer(customerId: string, status: string) {
  const { error } = await admin
    .from("families")
    .update({ subscription_status: status })
    .eq("stripe_customer_id", customerId);
  if (error) console.error("Failed to update subscription_status:", error.message);
}

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.customer) {
        await setStatusForCustomer(session.customer as string, "active");
      }
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await setStatusForCustomer(sub.customer as string, sub.status);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await setStatusForCustomer(sub.customer as string, "canceled");
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
