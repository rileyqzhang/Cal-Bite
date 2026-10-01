# Deploy backend to Vercel + GitHub Actions

Host the Next.js API on Vercel (Hobby works) and run the daily scrape + 7:30 AM push from GitHub Actions, so nothing depends on your laptop or Vercel Pro.

## Architecture

```
GitHub Actions (6:17 AM PDT / 5:17 AM PST)
    → npm run cron:daily
    → scrape Berkeley Dining (today + future dates)
    → upload JSON to Supabase Storage

GitHub Actions (7:30 AM Pacific)
    → npm run cron:notify
    → match opted-in users and send Expo push digests

Mobile / web app
    → reads menus from your Vercel API
    → reads users/favorites from Supabase
```

## Prerequisites

- [Supabase](https://supabase.com) project with migrations applied (`supabase/migrations/`)
- [Vercel](https://vercel.com) account
- GitHub repo (recommended) or Vercel CLI

## Step 1: Push code to GitHub

```bash
git init
git add .
git commit -m "Berkeley Dining app"
git remote add origin https://github.com/YOU/berkeley-dining.git
git push -u origin main
```

## Step 2: Import project on Vercel

1. [vercel.com/new](https://vercel.com/new) → Import your repo
2. **Root Directory:** `apps/web` (important for monorepo)
3. **Framework:** Next.js (auto-detected)
4. **Build Command:** `cd ../.. && npm install && npm run build --workspace @berkeley-dining/web`
   - Or set Root Directory to repo root and use:
   - Install: `npm install`
   - Build: `npm run build --workspace @berkeley-dining/web`
   - Output: `apps/web/.next`

Simplest Vercel monorepo setup:

| Setting | Value |
|---------|-------|
| Root Directory | `apps/web` |
| Install Command | `npm install` (runs from repo root if you link the whole repo) |

If build fails on `@berkeley-dining/shared`, set **Root Directory** to the **repo root** and override:

- **Install Command:** `npm install`
- **Build Command:** `npm run build --workspace @berkeley-dining/web`
- **Output Directory:** `apps/web/.next`

## Step 3: Environment variables

In Vercel → Project → Settings → Environment Variables, add:

| Name | Value |
|------|-------|
| `SUPABASE_URL` | `https://YOUR-REF.supabase.co` |
| `SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (secret) |
| `CRON_SECRET` | random string (Vercel may auto-set `CRON_SECRET` on Pro) |

Optional for push notifications:

| Name | Value |
|------|-------|
| `EXPO_ACCESS_TOKEN` | from expo.dev |

Copy values from `apps/web/.env.local`.

## Step 4: Cron schedule (GitHub Actions)

[`.github/workflows/cron.yml`](../../.github/workflows/cron.yml) scrapes at **13:17 UTC** (6:17 AM PDT / 5:17 AM PST) and ticks notify every 10 min from **14:00–17:50 UTC**. Notify sends on the first tick between 7:25 and 9:59 AM `America/Los_Angeles` (PDT and PST) and dedupes through `notification_sends`, so late GitHub schedules still deliver once.

1. GitHub repo → **Settings → Secrets and variables → Actions** → New repository secret:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `EXPO_ACCESS_TOKEN` (optional)
2. Forks: enable workflows in the **Actions** tab.
3. **Actions → Daily cron → Run workflow** (`job: daily`) to test. Use `job: notify` + `force` to run the digest outside the 7:30 window (users already sent today are still skipped).

No Vercel Cron is configured. On Vercel Pro you can still hit the `/api/cron/*` routes with `Authorization: Bearer $CRON_SECRET` (or re-add a `crons` block in `vercel.json`); don't also schedule them while the Actions workflow is enabled — the two schedulers share no lock and overlapping notify runs can double-send. Pick one.

## Step 5: Deploy and test

After deploy, your API is at `https://YOUR-PROJECT.vercel.app`.

Manual scrape (replace secret):

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://YOUR-PROJECT.vercel.app/api/cron/daily
```

Expect JSON like:

```json
{
  "ok": true,
  "scraped_dates": ["2026-08-11", "2026-08-12", ...]
}
```

Verify menus:

```bash
curl https://YOUR-PROJECT.vercel.app/api/menus/available-dates
```

## Step 6: Point mobile app at production

In `apps/mobile/.env` (or EAS secrets for production builds):

```
EXPO_PUBLIC_API_URL=https://YOUR-PROJECT.vercel.app
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Rebuild/restart Expo after changing.

## Supabase auth for production

Authentication → URL Configuration:

- **Site URL:** your app URL (e.g. `https://YOUR-PROJECT.vercel.app` or Expo scheme)
- **Redirect URLs:** add production URLs

## Monitoring

- GitHub → **Actions → Daily cron**: run history + JSON result for each job
- Supabase → **Storage** → `menus` bucket: new JSON files each day

## Cost snapshot (typical student app)

- **Supabase** free tier: auth + DB + storage
- **Vercel** Hobby: API hosting
- **GitHub Actions**: free for public repos (private repos: well within the free minutes)
- **Expo** push: free tier usually sufficient
