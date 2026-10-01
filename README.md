# Berkeley Dining App

Monorepo for scraping Berkeley Dining menus, serving them via a Next.js API on Vercel (Hobby is fine), and delivering a mobile app with favorite-food matching and 7:30 AM Pacific push notifications.

## Project layout

```
scraper/                 Python scraper (local dev + validation)
apps/web/                Next.js API + cron jobs
.github/workflows/       GitHub Actions schedule for the cron jobs
apps/mobile/             Expo React Native app
packages/shared/         Shared TypeScript types/helpers
supabase/migrations/     Postgres schema + Storage policies
output/                  Local Python scrape output
```

## 1. Python scraper (local)

```bash
python3 -m pip install -r requirements.txt
python3 -m scraper --date 2026-07-22
python3 -m scraper --through-available
python3 -m scraper --through-available --no-nutrition
```

## 2. Supabase setup

1. Create a Supabase project.
2. Run migrations in [`supabase/migrations/`](supabase/migrations/) via the SQL editor or Supabase CLI.
3. Confirm the public `menus` storage bucket exists.
4. Enable Email auth (or your preferred provider) under Authentication.

Tables:

- `profiles`
- `favorite_foods`
- `push_tokens`

Storage bucket:

- `menus/YYYY-MM-DD.json`

## 3. Web API (Vercel)

```bash
cd "/path/to/dining hall scanner"
npm install
cp apps/web/.env.example apps/web/.env.local
npm run dev:web
```

Set these env vars in Vercel:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side reads/writes |
| `CRON_SECRET` | Protect `/api/cron/daily` and `/api/cron/notify` (manual triggers) |

Deploy with root directory `apps/web` or configure Vercel monorepo settings accordingly.

### Daily jobs (GitHub Actions — no Vercel Pro needed)

[`.github/workflows/cron.yml`](.github/workflows/cron.yml) runs the jobs directly against Supabase, so they don't depend on Vercel Cron or function time limits:

- **Scrape** at 13:17 UTC (6:17 AM PDT / 5:17 AM PST): today + future menus → Supabase Storage.
- **Notify** at 7:30 AM Pacific: ticks every 10 min (14:00–17:50 UTC) and sends on the first tick between 7:25 and 9:59 AM Pacific, all year. GitHub schedules often start late; `notification_sends` keeps it to one digest per user per day.

Setup (works on a fork too):

1. Repo → **Settings → Secrets and variables → Actions** → add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and optionally `EXPO_ACCESS_TOKEN`.
2. On a fork, open the **Actions** tab and enable workflows (forks start disabled).
3. **Actions → Daily cron → Run workflow** with `job: daily` to scrape once and check it works.

GitHub pauses scheduled workflows in public repos after 60 days with no commits; re-enable from the Actions tab if that happens.

Run the same jobs locally (reads `apps/web/.env.local`, Node 22.9+):

```bash
npm run cron:daily --workspace @berkeley-dining/web
npm run cron:notify --workspace @berkeley-dining/web -- --force
```

### API routes

| Route | Auth |
|-------|------|
| `GET /api/menus/available-dates` | Public |
| `GET /api/menus/[date]` | Public |
| `GET /api/menus/[date]/matches` | Bearer JWT |
| `GET/POST/DELETE /api/favorites` | Bearer JWT |
| `GET/PATCH /api/settings` | Bearer JWT |
| `POST /api/push/register` | Bearer JWT |
| `POST /api/push/unregister` | Bearer JWT |
| `GET /api/cron/daily` | `Authorization: Bearer $CRON_SECRET` |
| `GET /api/cron/notify` | `Authorization: Bearer $CRON_SECRET` |

Manual cron test:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/notify?force=1"
```

## 4. Mobile app (Expo)

```bash
cp apps/mobile/.env.example apps/mobile/.env
npm run dev:mobile
```

Set:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_URL` (your deployed Vercel URL)

### Student flow

1. Sign up / sign in with Supabase Auth.
2. Add favorite foods by name.
3. Home screen: pick a date, see favorite matches first (hall + meal period).
4. Tap **View full menu** for the complete menu.
5. Opt in to one daily push at 7:30 AM Pacific from Settings.

## 5. Validation checklist

1. `python3 -m scraper --through-available --no-nutrition` writes JSON for today + future dates.
2. `GET /api/cron/daily` uploads menus to Supabase Storage.
3. Mobile home loads matches for a signed-in user with favorites.
4. Settings enables morning notifications and registers an Expo push token.
5. `/api/cron/notify` sends one digest per opted-in user at 7:30 AM Pacific.

## Notes

- The site only publishes about 8 days of menus (yesterday through ~6 days ahead). The cron refreshes **today + future** dates each morning.
- The daily jobs run on GitHub Actions, so Vercel Hobby is enough for the API. (On Vercel Hobby, Vercel Cron can fire up to 59 min late, which misses the 7:30 notify window, and a full scrape takes ~3 min against the 300 s function cap.)
- Mac sleep / local cron is no longer required; GitHub Actions + Vercel + Supabase run in the cloud.
