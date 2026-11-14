# Going live

About an hour and a half. You need free accounts with **Supabase**, **Stripe**, **Resend** and a host (**Vercel** or **Netlify**).
Twilio is optional (text messages).

## 1. Supabase (database, logins, photos)

1. Create a project at [supabase.com](https://supabase.com) (region: London).
2. **SQL Editor** → paste all of [`supabase/schema.sql`](./supabase/schema.sql) → **Run**. It also creates the two private photo buckets.
   Safe to run again after any update.
3. **Authentication → Users → Add user**: your email and a strong password. Then in the SQL Editor:
   ```sql
   insert into admins (user_id) select id from auth.users where email = 'YOUR EMAIL';
   ```
4. **Authentication → Sign In / Providers → Email**: leave **sign-ups on**. Customers and cleaners sign in with an emailed code.
   Being signed in only ever shows someone their own bookings, so this is safe.
5. **Authentication → Emails → Magic Link** template: make sure it includes the code, e.g.
   `<p>Your Beyond Clean sign-in code is <b>{{ .Token }}</b></p>`.
   While you're there, set up custom SMTP (Resend works) so these emails come from your own address.
6. **Project Settings → API**: copy the Project URL and the anon / publishable key for step 4.

## 2. Stripe (payments)

1. Create an account at [stripe.com](https://stripe.com) and finish the business details so payouts reach your bank.
2. **Developers → API keys**: copy the secret key (`sk_live_…`, or `sk_test_…` while testing).
3. **Settings → Billing → Customer portal**: switch it on. Allow updating cards, viewing invoices, and cancelling **at the end of the billing period**.
4. The webhook is added in step 3, once the functions are deployed.

What the app does in Stripe for you:
- **Plans** are monthly subscriptions. Discount and referral codes become Stripe coupons.
- **Skipped cleans** (with notice) and holiday pauses are credited to the customer's Stripe balance, so they come off the next bill.
- **Extras** added to a plan clean are added to the next invoice.
- **Referrals:** when a referred friend's plan starts, the referrer gets a credit.
- **One-off deposits and balances** are card payments through Stripe Checkout.

## 3. Edge Functions (payments, alerts, reminders, calendar)

Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then from `beyond-clean/`:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
for f in create-checkout billing-portal pay-quote plan-action stripe-webhook notify reminders calendar; do
  supabase functions deploy $f --no-verify-jwt
done
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
  NOTIFY_SECRET=$(openssl rand -hex 24) \
  CALENDAR_KEY=$(openssl rand -hex 16)
```

Optional texts through Twilio (about 4p each):
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (your Twilio number), `OWNER_MOBILE` (e.g. `+447700900123`) for your own alerts,
and `REMIND_BY_SMS=true` to also text customers the day before their clean.

**Database webhooks** (these trigger the ping and the customer emails): Supabase → **Database → Webhooks → Create**, one per row:

| Name | Table | Events |
| --- | --- | --- |
| enquiry-alerts | `enquiries` | Insert, Update |
| plan-alerts | `subscriptions` | Update |
| change-alerts | `plan_changes` | Insert, Update |
| review-alerts | `reviews` | Insert, Update |

For each one: type **Supabase Edge Function** → `notify`, and add the HTTP header `x-webhook-secret: <your NOTIFY_SECRET>`.

**Daily reminders and review requests:** Supabase → **Integrations → Cron → Create job**
- Schedule: `0 17 * * *` (5pm UTC every day)
- Type: **Supabase Edge Function** → `reminders`, method POST, header `x-webhook-secret: <your NOTIFY_SECRET>`

## 4. Host the app

Vercel or Netlify → import this repo → root directory `beyond-clean` → build `npm run build`, output `dist`.
Environment variables:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your anon / publishable key
```

Point a domain at it (e.g. `book.beyondclean.co.uk`) and make sure `SITE_URL` matches.

## 5. Set up the business

Sign in at `#/admin` and work through:
1. **Settings**: phone, email, Google review link, postcode areas, prices, extras, deposit, notice periods, checklists, discount codes.
2. **Team**: add each cleaner with their **email address**. They open `#/cleaner`, sign in with that email (they're emailed a code) and add it to their home screen.
3. **Team → Calendar feeds**: add your feed (and each cleaner's) to Google Calendar or your iPhone.
4. **Plans**: set the regular cleaner for each plan. Use **Week** to swap cleaners for single cleans (cover).

## 6. Test it end to end

1. Send yourself an enquiry from your phone with a photo. You should get an email (and a text) within seconds, and the owner inbox dings.
2. Reply with a quote and a deposit. Accept it as the customer, pay with test card `4242 4242 4242 4242` (any future date, any CVC), and check it shows **Booked**.
3. Buy a plan with Stripe **test** keys. Skip a clean, then check Stripe → Customers → the customer → **Balance** shows the credit.
4. Sign in to `#/cleaner` as a cleaner, start and finish a job, and check the Week view shows ✅.
5. Mark a one-off **done**, then check the customer gets the thank-you email with the review and pay-balance links.
6. Switch to live Stripe keys (and the live webhook secret) when you're happy.

## Owner app on your phone

Open `https://YOUR-APP-ADDRESS/#/admin`, sign in, then **Share → Add to Home Screen**. Email and text alerts arrive even when the app is closed; the in-app ding works while it's open.
