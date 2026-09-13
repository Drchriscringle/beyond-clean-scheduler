# PrintedPlanCompany Dashboard

A single-user business dashboard for an Etsy shop selling digital planning templates. It gives Chris one daily standup view, tracks products on Etsy, pins on Pinterest and posts on Instagram, runs the content-production pipeline, holds every piece of copy, and charts performance over time.

- **Frontend:** React 19 + Vite + Tailwind CSS v4 + React Router + Recharts
- **Backend:** Supabase (Postgres + Auth + Row Level Security)
- **Hosting:** Vercel (frontend) + Supabase (database)

| Doc | What it covers |
| --- | --- |
| [SETUP.md](./SETUP.md) | Deploying from scratch or re-deploying: Supabase, Vercel, environment variables, creating the login |
| [USER_GUIDE.md](./USER_GUIDE.md) | How to use every page, written for a non-technical reader |
| [supabase/schema.sql](./supabase/schema.sql) | The full database schema (tables, enums, triggers, RLS policies). Safe to re-run |

## Quick start (local)

```bash
cd printedplan-dashboard
cp .env.example .env         # then paste in your Supabase URL + anon/publishable key
npm install
npm run dev                  # http://localhost:5173
```

Other scripts:

```bash
npm run build     # production build into dist/
npm run preview   # serve the production build locally
npm run lint      # oxlint
npm test          # unit tests for the business formulas (node --test)
```

## Pages

| Route | Page | Purpose |
| --- | --- | --- |
| `/login` | Login | Email + password (Supabase Auth). Sign-up is disabled. Optional two-factor code. |
| `/` | Dashboard | Today's critical actions, yesterday's numbers, this week's deadlines, blockers |
| `/etsy` | Etsy Tracker | Product table with 30-day views/sales/revenue, readiness toggles, CRUD |
| `/pinterest` | Pinterest Tracker | 14-day timeline + table, CTR %, "needs redesign" flag, CRUD |
| `/instagram` | Instagram Tracker | Ready-to-post queue, publish workflow, posted archive with editable stats |
| `/pipeline` | Content Pipeline | Six-step production checklist per product, auto "fully ready", bottleneck |
| `/copy` | Copy Library | Every description/caption/post per product, unlimited variants, copy to clipboard |
| `/analytics` | Performance Analytics | Date-range metrics with trend %, four charts, top performers, daily log entry |
| `/settings` | Settings | Email, password, two-factor, CSV import, JSON export, delete all, timezone |

## Formulas (see `src/lib/calc.js`, tested in `tests/`)

- Etsy revenue = `etsy_sales_30d × price` (always calculated, never trusted from storage)
- Pinterest CTR % = `clicks_7d ÷ impressions_7d × 100` (only when impressions > 0); live pins under 15 % are flagged **Needs redesign**
- Daily average = `total ÷ days in range`
- Trend % = `(current − previous) ÷ previous × 100` against the same-length period immediately before
- Fully ready = all six pipeline steps ticked (a generated column in Postgres, mirrored client-side for instant feedback)
- Urgency colour: overdue → dark red, today → red, later this week → yellow, after this week → green

## Project layout

```
printedplan-dashboard/
├── index.html, vite.config.js, postcss.config.js, vercel.json
├── supabase/schema.sql          # database setup script
├── src/
│   ├── App.jsx                  # router + auth guards
│   ├── pages/                   # one file per page
│   ├── components/              # Layout, ui primitives, modals, charts
│   ├── hooks/                   # useAuth, useToast, useSettings, useQuery, useData (CRUD)
│   └── lib/                     # supabase client, constants, calc, dates, format, csv
└── tests/calc.test.js           # formula + date unit tests
```

## Phase 2 ideas (not built)

Etsy / Pinterest / Instagram API sync (the API-key fields in Settings are placeholders), email digests, dark mode, second user, drag-and-drop rescheduling.
