# Pocket Money

A virtual-ledger chores-and-allowance app for families — kids claim chores,
parents approve them, and real-looking (but entirely virtual) pocket money
moves between save/spend/give jars. Ships as an installable PWA, billed via
Stripe.

## Project layout

```
src/
  screens/        One file per top-level screen (AuthGate, FamilyDashboard, ChildView, Settings, Paywall, legal/…)
  components/     Presentational pieces, grouped by domain (children/, chores/, bills/)
  hooks/          TanStack Query hooks — one file per domain, wrapping lib/api
  lib/api/        Thin Supabase client calls, split by domain, re-exported from index.js
  lib/            Pure helpers: money formatting, currency, subscription-status logic
supabase/functions/   Edge functions (Deno): delete-account, create-checkout-session,
                      create-billing-portal-session, stripe-webhook
schema.sql        Full Postgres schema — tables, RLS policies, and every
                  security-definer RPC. Source of truth; paste into the
                  Supabase SQL Editor (or apply as a migration).
```

## Setup

1. **Create a Supabase project** — [supabase.com](https://supabase.com) → New project.
   Use a **paid plan**, not the free tier — free projects pause after a week
   of inactivity, which breaks the app for real users.
2. **Run `schema.sql`** in the SQL Editor. Creates every table, the balance
   view, RLS policies, and RPCs (including `check_child_pin`,
   `delete_my_family`).
3. **Get your credentials** — Project Settings → API → Project URL and
   `anon`/publishable key. Put them in `.env` (copy `.env.example`).
4. **Deploy the edge functions** (`supabase/functions/*`) via the Supabase
   CLI or dashboard. Each needs its own secrets set (Project Settings → Edge
   Functions → Secrets):
   - `delete-account`: no extra secrets (uses the automatically-provided
     `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`).
   - `create-checkout-session`, `create-billing-portal-session`,
     `stripe-webhook`: also need `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` (the
     subscription Price ID from the Stripe dashboard), `APP_URL` (your
     deployed site's origin, no trailing slash), and — for the webhook only
     — `STRIPE_WEBHOOK_SECRET` (from the Stripe dashboard once you've pointed
     a webhook endpoint at that function's URL, listening for
     `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`).
5. **Turn on email auth** — Authentication → Providers → Email (on by
   default).
6. `npm install && npm run dev`

## Billing model

Every new family gets a 14-day free trial (`families.trial_ends_at`, set by
`create_family()`). After that, the app shows a paywall until
`families.subscription_status` is `active` — which only the `stripe-webhook`
edge function can set (the client cannot write that column at all; see the
column-level `revoke`/`grant` in `schema.sql`). "Manage billing" in Settings
opens the Stripe customer portal for cancellation/payment updates.

## How the data model works

- **Append-only ledger.** A child's balance is never a mutable counter —
  it's the sum of their `transactions` rows (`child_balances` view). Can't
  drift, full history for free.
- **Money only moves through two paths**, both `security definer` functions:
  `decide_chore_claim()` (approving a chore) and `run_bills_for_child()`
  ("pay day"). The client never writes to `transactions` directly.
- **Row Level Security** everywhere, scoped by `my_family_id()` — a parent
  only ever sees their own family's rows, enforced by Postgres itself.
- **Children aren't separate `auth.users`.** One parent authenticates per
  household; "child mode" is a UI view within that session, gated by a
  4-digit PIN. The PIN is verified server-side via `check_child_pin()` and is
  never selected back to the client — still a convenience lock, not a
  security boundary, since anyone with the parent's unlocked device is
  already inside the RLS boundary.
- **Co-parent invites**: `create_family_invite()` mints a 6-character code
  (ambiguous characters removed), valid 24 hours, single-use;
  `redeem_family_invite(code)` consumes it.
- **Bills**: recurring per-child bills, deducted from total balance (not any
  one jar) via "Pay day" → `run_bills_for_child()`. Pays what it can by
  default rather than going negative (`bill_runs.shortfall_pence` records the
  rest) unless `children.allow_negative_balance` is set.

## Account deletion

Settings → "Delete my family & account" calls the `delete-account` edge
function, which runs `delete_my_family()` (cascades through every table,
owner-only) and then deletes the parent's own `auth.users` row via the
service-role key — something a client can never do for itself.

## Testing

`npm run test` (Vitest + React Testing Library) — covers the money
formatter, the jar-split rounding invariant (mirrors the SQL logic in
`decide_chore_claim`), and a smoke test per key screen.

## Explicitly out of scope (for now)

- **Real money movement.** Every balance in this app is virtual, by design —
  turning it into an actual bank/e-money product is a different, much more
  heavily regulated business, not a feature to bolt on.
- **Native iOS/Android app stores.** Ships as an installable PWA for now.
  `retro-premier-manager/MOBILE.md` elsewhere in this repo is the Capacitor
  template + submission checklist to reuse if/when that becomes worth doing.
