import { runDailyNotify, runDailyScrape } from "../src/lib/cron/jobs";

// Runs the cron jobs directly (no HTTP, no Vercel). Used by
// .github/workflows/cron.yml; also handy locally (reads apps/web/.env.local):
//   npm run cron:daily --workspace @berkeley-dining/web
//   npm run cron:notify --workspace @berkeley-dining/web -- --force

async function main() {
  const [job, ...flags] = process.argv.slice(2);
  const force = flags.includes("--force");

  let result;
  if (job === "daily") {
    result = await runDailyScrape();
  } else if (job === "notify") {
    result = await runDailyNotify({ force, catchUp: true });
  } else {
    console.error("Usage: tsx scripts/cron.ts <daily|notify> [--force]");
    process.exit(2);
  }

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
