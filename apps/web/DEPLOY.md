# Deploy backend to Vercel (daily scraper)

Host the Next.js API on Vercel so `/api/cron/daily` runs every morning without your laptop.

## Architecture

```
Vercel Cron (~6 AM Pacific)
    → GET /api/cron/daily
    → scrape Berkeley Dining (today + future dates)
    → upload JSON to Supabase Storage

Vercel Cron (7:30 AM Pacific)
    → GET /api/cron/notify
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

## Step 4: Cron schedule

[`vercel.json`](vercel.json) scrapes at **13:00 UTC** (~6 AM Pacific) and notifies at **14:30 and 15:30 UTC**. The notify job only sends when it is 7:30 AM in `America/Los_Angeles`.

**Note:** Vercel Cron requires **Pro plan** on many accounts. Hobby has limited cron. The scrape route uses `maxDuration = 300` (5 min), which also needs Pro.

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
  "scraped_dates": ["2026-08-11", "2026-08-12", ...],
  "notifications": { "sent": 0, "failed": 0, "skipped": 0 }
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

- Vercel → Project → **Cron Jobs** tab: see run history
- Vercel → **Logs**: filter `/api/cron/daily`
- Supabase → **Storage** → `menus` bucket: new JSON files each day

## Alternatives to Vercel Cron

If you stay on Vercel Hobby or scrape times out:

1. **GitHub Actions** — daily workflow runs `curl` to `/api/cron/daily` or Python scraper + Supabase upload
2. **Split cron** — one job scrapes, one sends notifications (two Vercel cron entries)
3. **`seed-fast`** pattern — scrape without nutrition on cron, lazy-load nutrition later

## Cost snapshot (typical student app)

- **Supabase** free tier: auth + DB + storage
- **Vercel** Pro (~$20/mo): cron + 300s functions (check current pricing)
- **Expo** push: free tier usually sufficient
