# Beyond Clean – customer app

A phone-friendly web app for Beyond Clean Ltd. Customers can:

1. **Ask for a quote**: choose the property, what to clean, the type of clean and up to 3 preferred dates and times.
2. **Sign up to a cleaning plan**: 1, 2 or 3 cleans a week, pick fixed weekly times from what's free, and pay monthly by card (Stripe).

The owner gets a **ping** (email, optional text, and a live alert in the owner inbox), replies with a price and a time, and the customer accepts with one tap.

- **Frontend:** React 19 + Vite + Tailwind CSS v4, `#/` routes so it can be hosted anywhere
- **Backend:** Supabase (Postgres, Auth, Realtime, Edge Functions)
- **Payments:** Stripe Checkout (subscriptions) and the Stripe customer portal
- **Alerts:** Resend email, optional Twilio text, live in-app ding + browser notification

Setting it up for real: **[SETUP.md](./SETUP.md)**.

## Try it now (demo mode)

```bash
cd beyond-clean
npm install
npm run dev          # http://localhost:5173
```

With no `.env`, the app runs in **demo mode**: everything is saved in your browser and payments are simulated. Open the customer side in one tab and `#/admin` in another; a new enquiry pings the owner tab.

## Screens

| Route | Who | What |
| --- | --- | --- |
| `#/` | Customer | Home: one-off quote or regular plan |
| `#/enquire` | Customer | 5-step quote form |
| `#/enquiry/<private link>` | Customer | See the reply, accept or decline the quote |
| `#/plans` | Customer | Choose cleans/week and hours, pick weekly times, pay |
| `#/plan/<private link>` | Customer | Plan details, update card, invoices, cancel (Stripe portal) |
| `#/admin` | Owner | Enquiries inbox: reply with price, date and time; WhatsApp, call or email |
| `#/admin/plans` | Owner | Subscribers, monthly income, hours per week |
| `#/admin/week` | Owner | Every clean this week: plan visits and booked one-offs |
| `#/admin/settings` | Owner | Hourly rate, discounts, weekly times, team capacity, closed days |

## How plan pricing works

`monthly = hourly rate × hours per clean × cleans per week × 52 ÷ 12`, minus the multi-clean discount, rounded to whole pounds.
Defaults are £20/hour, 5% off for 2 a week and 10% off for 3 a week. Change them in **Settings** (new plans only).

| | 2 hrs | 3 hrs | 4 hrs |
| --- | --- | --- | --- |
| 1× a week | £173 | £260 | £347 |
| 2× a week | £329 | £494 | £659 |
| 3× a week | £468 | £702 | £936 |

Each weekly time slot can be shared by as many plans as you have teams ("Plans allowed per time slot"). A slot shows as taken once it's full.
The same rules run in the browser and on the server (`supabase/functions/_shared/pricing.js`), so customers can't change the price.

## Scripts

```bash
npm run dev       # local dev server
npm run build     # production build into dist/
npm run lint      # oxlint
npm test          # pricing, slot and Stripe-signature tests
```
