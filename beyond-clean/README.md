# Beyond Clean – customer, owner and cleaner app

A phone-friendly web app for Beyond Clean Ltd, in three parts.

**Customers**
- **One-off cleans:** choose property, areas, extras and type of clean, see an **instant price estimate**, add **photos**, pick up to 3 dates, and use a **discount code**. Accept the quote with one tap and pay a **card deposit**. They can cancel within the policy, pay the balance by card afterwards, and **book again** in one tap.
- **Cleaning plans:** **every 2 weeks**, or 1, 2 or 3 times a week, at fixed times with a monthly Stripe payment. From their plan page they can **skip** a clean (credited off the next bill with 48 hours' notice), **pause for a holiday**, **ask to move** a clean, **add extras** like an oven clean, update their card, or cancel.
- **Access details** (key safe, pets, parking), **reviews** with a **24-hour put-it-right guarantee**, a **refer-a-friend** code, **postcode check**, a **promises and policies** page, and **My account** (sign in with an emailed code), where landlords and Airbnb hosts can **save properties and rebook** them.

**Owner** (`#/admin`)
- Inbox with live **ping** (email, optional text, and an in-app ding), quotes with deposit, cleaner assignment, mark done.
- Plans with **move requests** to confirm, regular cleaner per plan, and referral and discount tracking.
- A **week view** of every clean with **cover** (swap the cleaner for one clean), skips, and done/in-progress status from the cleaner app.
- **Team** page with cleaners, wages and **Google/Apple calendar feeds**.
- **Reviews** to publish on the home page, with put-it-right requests.
- **Reports**: income, wages and profit by cleaner and by type of clean.
- **Settings** for every price, discount, deposit, notice period, service area, checklists and discount codes.
- **Reminders** go out automatically the day before each clean, and **review requests** the day after.

**Cleaners** (`#/cleaner`)
- Their own cleans only, with directions, key safe code and pets. Each job has a **checklist**, **clock in/out** and **before and after photos**. Prices are never shown.

- **Frontend:** React 19 + Vite + Tailwind CSS v4, `#/` routes so it can be hosted anywhere
- **Backend:** Supabase (Postgres with row-level security, Auth, Realtime, Storage, Edge Functions)
- **Payments:** Stripe Checkout (plans, deposits, balances), customer balance credits, invoice items and the customer portal
- **Alerts:** Resend email, optional Twilio texts

Setting it up for real: **[SETUP.md](./SETUP.md)**.

## Try it now (demo mode)

```bash
cd beyond-clean
npm install
npm run dev          # http://localhost:5173
```

With no `.env`, the app runs in **demo mode**: everything is saved in your browser and payments are simulated. Open the customer side in one tab and `#/admin` in another; a new enquiry pings the owner tab. The demo comes with two cleaners (Zara and Chris) and a `WELCOME10` code. The account sign-in code is `123456`.

## Screens

| Route | Who | What |
| --- | --- | --- |
| `#/` | Customer | Home: promises, reviews, postcode check, one-off or plan |
| `#/enquire` | Customer | Quote form with instant estimate, photos, access details, code (`?property=` / `?from=` to rebook) |
| `#/enquiry/<private link>` | Customer | Reply, accept, deposit, cancel, pay balance, access details |
| `#/plans` | Customer | Choose how often and how long, pick times, code, pay |
| `#/plan/<private link>` | Customer | Upcoming cleans: skip, move, extras, holiday pause; card and invoices; referral code |
| `#/review/<private link>` | Customer | Star rating, and the put-it-right guarantee |
| `#/account` | Customer | Sign in by emailed code: all bookings and plans, saved properties |
| `#/policies` | Customer | Promises, cancellation, skips, refunds, privacy (numbers come from Settings) |
| `#/admin/…` | Owner | Enquiries, Plans, Week, Team, Reviews, Reports, Settings |
| `#/cleaner` | Cleaner | Their cleans, checklist, clock in/out, photos |

## How plan pricing works

`monthly = hourly rate × hours per clean × cleans per week × 52 ÷ 12`, minus the multi-clean discount, rounded to whole pounds
(every 2 weeks counts as 0.5 cleans a week). Defaults are £20/hour, 5% off for 2 a week and 10% off for 3 a week. Change them in **Settings** (new plans only).

| | 2 hrs | 3 hrs | 4 hrs |
| --- | --- | --- | --- |
| Every 2 weeks | £87 | £130 | £173 |
| 1× a week | £173 | £260 | £347 |
| 2× a week | £329 | £494 | £659 |
| 3× a week | £468 | £702 | £936 |

Each weekly time slot can be shared by as many plans as you have teams ("Plans allowed per time slot"). A slot shows as taken once it's full.
The same rules run in the browser and on the server (`supabase/functions/_shared/`), so customers can't change the price:
`pricing.js` (plans, estimates, deposits, postcodes), `schedule.js` (which cleans happen when, with skips, moves and cover),
`actions.js` (what a skip, pause, move or extra does to the bill).

## One-off estimate

`hours = (1.5 + 0.75 × bedrooms + 0.75 × bathrooms) × type` (standard 1, deep 1.6, end of tenancy 2, after builders 2.2, holiday turnover 1.1),
at £22/hour with a £50 minimum, plus extras, shown as a range from −10% to +15%. Offices are always quoted by hand. All of it is editable in Settings.

## Scripts

```bash
npm run dev       # local dev server
npm run build     # production build into dist/
npm run lint      # oxlint
npm test          # pricing, estimates, schedule, plan actions and Stripe-signature tests
```
