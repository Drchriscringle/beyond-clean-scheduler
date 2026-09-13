# Setup & deployment

Everything needed to deploy the dashboard from scratch, redeploy it, or self-host it. Budget: about 20 minutes.

## What's already provisioned

A Supabase project called **PrintedPlanCompany Dashboard** already exists (London region, free tier) with the full schema applied:

| Setting | Value |
| --- | --- |
| Project ref | `lvtssbxschnbmidsffrp` |
| Project URL (`VITE_SUPABASE_URL`) | `https://lvtssbxschnbmidsffrp.supabase.co` |
| Publishable key (`VITE_SUPABASE_ANON_KEY`) | `sb_publishable_84ei3mun0MdhjYRBlq0qsg_5ODoJ30Y` |
| Dashboard | https://supabase.com/dashboard/project/lvtssbxschnbmidsffrp |

The publishable key is safe to expose in the browser: Row Level Security means nothing is readable or writable without a signed-in user.

If you ever want a brand-new database instead, follow "Fresh Supabase project" below.

## 1. Create the login (one-off)

Sign-up is disabled in the app, so the single account is created in Supabase:

1. Open the Supabase dashboard → **Authentication → Users → Add user → Create new user**.
2. Enter Chris's email and a strong password, tick **Auto Confirm User**, and create.
3. **Authentication → Sign In / Providers → Email**: leave Email enabled. Then under **Authentication → Settings**, turn **off** "Allow new users to sign up" so nobody else can register.
4. (Optional) In the app's Settings page, enable two-factor authentication.

Sessions persist for as long as the refresh token stays valid (Supabase's default of effectively 30+ days when "Remember me" is ticked). Untick "Remember me" at login for a session that ends when the tab closes.

## 2. Deploy the frontend to Vercel

1. Go to https://vercel.com/new and import the GitHub repository `Drchriscringle/beyond-clean-scheduler`.
2. **Root Directory:** click *Edit* and choose `printedplan-dashboard` (the repo holds several apps).
3. Framework preset: **Vite** (detected automatically). Build command `npm run build`, output `dist`.
4. **Environment Variables** — add both, for Production and Preview:
   - `VITE_SUPABASE_URL` = `https://lvtssbxschnbmidsffrp.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `sb_publishable_84ei3mun0MdhjYRBlq0qsg_5ODoJ30Y`
5. Click **Deploy**. Vercel builds and gives you a `*.vercel.app` URL. `vercel.json` already contains the single-page-app rewrite so deep links such as `/pinterest` work on refresh.
6. Every later `git push` to `main` (touching `printedplan-dashboard/`) redeploys automatically.

### Custom domain (optional)
Vercel project → Settings → Domains → add your domain and follow the DNS instructions.

## 3. Test the live site

Open the Vercel URL, log in, then walk the checklist in [USER_GUIDE.md](./USER_GUIDE.md#first-day-checklist). Data you enter is stored in Supabase and survives refreshes, redeploys and devices.

## Running locally

```bash
cd printedplan-dashboard
cp .env.example .env     # paste the two values from the table above
npm install
npm run dev              # http://localhost:5173
```

`npm run build` produces the production bundle in `dist/`; `npm run preview` serves it.

## Fresh Supabase project (only if you want a new database)

1. https://supabase.com → **New project** (pick a region near you, e.g. London).
2. **SQL Editor → New query**, paste the whole of [`supabase/schema.sql`](./supabase/schema.sql), **Run**. It creates the six tables, enums, triggers, indexes, RLS policies and the "delete all data" function. It is idempotent, so re-running is safe.
3. **Project Settings → API**: copy the Project URL and the publishable (or legacy anon) key into `.env` locally and into Vercel's environment variables.
4. Create the login as in step 1 above.

## Self-hosting elsewhere

The app is a static site. Any static host works (Netlify, Cloudflare Pages, GitHub Pages, an S3 bucket): run `npm run build` with the two `VITE_` variables set and serve `dist/`, making sure unknown paths fall back to `index.html` (see `vercel.json` for the Vercel form of that rule).

## Backups

Settings → Data management → **Export** downloads every table as one JSON file. Supabase's free tier also keeps daily database backups for 7 days.

## Continuous integration

`.github/workflows/ci-printedplan-dashboard.yml` lints, tests and builds the app on every pull request and push to `main` that touches this folder.
