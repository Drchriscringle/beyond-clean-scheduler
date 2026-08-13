# Pocket Ledger — Supabase backend

## Setup

1. **Create a Supabase project** — [supabase.com](https://supabase.com) → New project.
2. **Run the schema** — open the SQL Editor in your project, paste in `schema.sql`, run it. This creates all tables, the balance view, the RPC functions, and RLS policies.
3. **Get your credentials** — Project Settings → API → copy the Project URL and `anon` public key.
4. **Configure the app**:
   ```bash
   npm create vite@latest pocket-ledger -- --template react
   cd pocket-ledger
   npm install @supabase/supabase-js
   npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p
   ```
   Copy `lib/`, and `src/App.jsx` from this bundle into the new project (overwrite the default `src/App.jsx`).
   Create `.env`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
5. **Turn on email auth** — Authentication → Providers → Email is on by default. For production, turn off "Confirm email" only if you want frictionless signup, otherwise leave it on.
6. `npm run dev`

## How the pieces map to the prototype

| Prototype (localStorage demo) | This version |
|---|---|
| Family code + shared PIN | Real Supabase Auth account per parent |
| `window.storage` blob per family | Postgres tables, one row per record |
| Anyone with the code sees everything | Row Level Security — a parent only ever sees their own family's rows, enforced by Postgres itself |
| Balance = a number you overwrite | Balance = sum of an append-only `transactions` ledger (full history, can't drift) |
| Approve button directly edits balance | Approve calls `decide_chore_claim()` — a single server-side function, so money only ever moves through one audited path |

## Bills

Parents set recurring weekly bills per child (`bills` table — name, icon, pence amount). Tapping "Pay day" (or a scheduled `pg_cron` job, see the note at the bottom of `schema.sql`) calls `run_bills_for_child()`, which:

- Deducts from the child's **total** balance, not any one jar.
- By default, can't push a child below zero — it pays what it can and records the rest as a shortfall (`bill_runs.shortfall_pence`) rather than real debt. Flip `children.allow_negative_balance` on a specific child for the sharper real-world version.
- Logs every run in `bill_runs` so both parent and child can see a history, and each deduction lands in `transactions` with `jar = 'bills'` — so the ledger stays the single source of truth for balance.

## Next steps worth doing before real families use it

- **Co-parent invites**: right now `join_family_as_coparent` takes a raw family ID typed in by hand — fine for testing, but wrap it in a proper invite-link flow (a signed, expiring token) before shipping.
- **Child PIN**: stored in plain text in `children.pin` for simplicity. It's a UI convenience lock, not a security boundary (see the design note at the bottom of `schema.sql`) — but if that changes, hash it.
- **Styling**: this file keeps markup minimal on purpose. Drop in the bright, Baloo-2, jar-visual UI from the earlier prototype and swap its `window.storage` calls for the equivalent functions in `lib/api.js` — the data shapes line up directly.
- **Real money movement**: still unresolved from the design stage — this schema only tracks a virtual ledger. Decide the top-up model (manual parent top-up vs. Open Banking/Stripe) before connecting it to actual bank accounts.
