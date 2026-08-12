#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$ROOT/.tools/node/bin"
export PATH="$NODE_BIN:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "Node not found. Install Node 20+ or run:"
  echo "  curl -fsSL https://nodejs.org/dist/v22.14.0/node-v22.14.0-darwin-\$(uname -m).tar.gz | tar -xz -C $ROOT/.tools/node --strip-components=1"
  exit 1
fi

cd "$ROOT"

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies..."
  npm install
fi

stop_dev() {
  echo "Stopping dev servers on ports 3000, 8081, 8082..."
  for port in 3000 8081 8082; do
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      kill $pids 2>/dev/null || true
      echo "  stopped port $port"
    fi
  done
}

case "${1:-}" in
  web)
    npm run dev:web
    ;;
  mobile)
    cd "$ROOT/apps/mobile"
    npx expo start
    ;;
  mobile-web)
    cd "$ROOT/apps/mobile"
    npx expo start --web --clear
    ;;
  stop)
    stop_dev
    ;;
  seed)
    echo "Scraping today + future dates from Berkeley Dining (full nutrition, ~2-3 min)..."
    curl -s -H "Authorization: Bearer ${CRON_SECRET:-local-dev-cron-secret}" \
      "http://localhost:3000/api/cron/daily"
    echo
    ;;
  seed-fast)
    echo "Scraping without nutrition (faster dev seed)..."
    cd "$ROOT/apps/web"
    npx tsx scripts/seed-local.ts --no-nutrition
    ;;
  *)
    echo "Usage: $0 {web|mobile|mobile-web|stop|seed|seed-fast}"
    echo
    echo "  web        - Next.js API on http://localhost:3000"
    echo "  mobile     - Expo for phone/simulator (Metro on http://localhost:8081)"
    echo "  mobile-web - Expo web app on http://localhost:8081 (clears cache)"
    echo "  stop       - Kill processes on ports 3000, 8081, 8082"
    echo "  seed       - Scrape menus + upload to Supabase (~2-3 min, needs web running)"
    echo "  seed-fast  - Scrape without nutrition (faster, needs web env + Supabase)"
    exit 1
    ;;
esac
