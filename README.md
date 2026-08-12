# Berkeley Dining App

Monorepo for scraping Berkeley Dining menus, serving them via a Next.js API on Vercel, and delivering a mobile app with favorite-food matching and 7 AM push notifications.

## Project layout

```
scraper/                 Python scraper (local dev + validation)
apps/web/                Next.js API + Vercel cron
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
| `SUPABASE_SERVICE_ROLE_KEY` | Cron uploads + push fan-out |
| `CRON_SECRET` | Protect `/api/cron/daily` |
| `EXPO_ACCESS_TOKEN` | Optional Expo push auth |

Deploy with root directory `apps/web` or configure Vercel monorepo settings accordingly.

Cron schedule is defined in [`apps/web/vercel.json`](apps/web/vercel.json) (`0 14 * * *` UTC ≈ 7:00 AM Pacific during PDT).

### API routes

| Route | Auth |
|-------|------|
| `GET /api/menus/available-dates` | Public |
| `GET /api/menus/[date]` | Public |
| `GET /api/menus/[date]/matches` | Bearer JWT |
| `GET/POST/DELETE /api/favorites` | Bearer JWT |
| `POST /api/push/register` | Bearer JWT |
| `GET /api/cron/daily` | `Authorization: Bearer $CRON_SECRET` |

Manual cron test:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily
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
5. Receive one daily push at 7 AM when favorites appear today.

## 5. Validation checklist

1. `python3 -m scraper --through-available --no-nutrition` writes JSON for today + future dates.
2. `GET /api/cron/daily` uploads menus to Supabase Storage.
3. Mobile home loads matches for a signed-in user with favorites.
4. Expo push token registers via `POST /api/push/register`.
5. Cron sends digest pushes for users with matches today.

## Notes

- The site only publishes about 8 days of menus (yesterday through ~6 days ahead). The cron refreshes **today + future** dates each morning.
- Vercel Cron and long-running scrapes may require a Pro plan (`maxDuration = 300` on the cron route).
- Mac sleep / local cron is no longer required; Vercel + Supabase run in the cloud.
