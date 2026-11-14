# Going live

About an hour. You need free accounts with **Supabase**, **Stripe**, **Resend** and a host (**Vercel** or **Netlify**).

## 1. Supabase (database + owner login)

1. Create a project at [supabase.com](https://supabase.com) (region: London).
2. **SQL Editor** → paste all of [`supabase/schema.sql`](./supabase/schema.sql) → **Run**.
3. **Authentication → Users → Add user**: your email and a strong password. Then in the SQL Editor:
   ```sql
   insert into admins (user_id) select id from auth.users where email = 'YOUR EMAIL';
   ```
4. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up".
5. **Project Settings → API**: copy the Project URL and the anon / publishable key for step 4.

## 2. Stripe (monthly payments)

1. Create an account at [stripe.com](https://stripe.com) and finish the business details so payouts reach your bank.
2. **Developers → API keys**: copy the secret key (`sk_live_…`, or `sk_test_…` while testing).
3. **Settings → Billing → Customer portal**: switch it on and allow customers to update cards, see invoices and cancel.
4. The webhook is added in step 3 once the functions are deployed.

## 3. Edge Functions (payments + the ping)

Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then from `beyond-clean/`:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF

supabase functions deploy create-checkout --no-verify-jwt
supabase functions deploy billing-portal  --no-verify-jwt
supabase functions deploy stripe-webhook  --no-verify-jwt
supabase functions deploy notify          --no-verify-jwt
```

**Stripe webhook:** Stripe → Developers → Webhooks → Add endpoint
- URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
- Events: `checkout.session.completed`, `checkout.session.expired`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Copy the signing secret (`whsec_…`).

**Email:** sign up at [resend.com](https://resend.com), verify your domain, create an API key.

**Secrets** (one command, your values):

```bash
supabase secrets set \
  SITE_URL=https://YOUR-APP-ADDRESS/ \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  RESEND_API_KEY=re_... \
  FROM_EMAIL="Beyond Clean <bookings@yourdomain.co.uk>" \
  OWNER_EMAIL=you@yourdomain.co.uk \
  NOTIFY_SECRET=$(openssl rand -hex 24)
```

Optional text-message pings to your phone (Twilio, about 4p a text):
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (your Twilio number), `OWNER_MOBILE` (e.g. `+447700900123`).

**Database webhooks** (these trigger the ping): Supabase → **Database → Webhooks → Create** twice:

| Name | Table | Events | Type | URL | Header |
| --- | --- | --- | --- | --- | --- |
| enquiry-alerts | `enquiries` | Insert, Update | Supabase Edge Function → `notify` | (filled in) | `x-webhook-secret: <your NOTIFY_SECRET>` |
| plan-alerts | `subscriptions` | Update | Supabase Edge Function → `notify` | (filled in) | same |

## 4. Host the app

Vercel or Netlify → import this repo → root directory `beyond-clean` → build `npm run build`, output `dist`.
Environment variables:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your anon / publishable key
```

Point a domain at it (e.g. `book.beyondclean.co.uk`) and make sure `SITE_URL` matches.

## 5. Test it end to end

1. Send yourself an enquiry from your phone → you should get an email (and text) within seconds, and the owner inbox dings.
2. Reply with a quote → the customer email arrives → tap **Accept** → you get "accepted".
3. With Stripe **test** keys, buy a plan using card `4242 4242 4242 4242`, any future date, any CVC → the plan shows **Active** and you get "New plan".
4. Switch to live keys (and the live webhook secret) when happy.

## Owner app on your phone

Open `https://YOUR-APP-ADDRESS/#/admin`, sign in, then **Share → Add to Home Screen**. Email/text alerts arrive even when the app is closed; the in-app ding works while it's open.
