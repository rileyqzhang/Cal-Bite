export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 720 }}>
      <h1>Berkeley Dining App API</h1>
      <p>This Next.js deployment powers the mobile app and daily menu cron.</p>
      <ul>
        <li><code>GET /api/menus/available-dates</code></li>
        <li><code>GET /api/menus/[date]</code></li>
        <li><code>GET /api/menus/[date]/matches</code> (auth)</li>
        <li><code>GET /api/foods?q=</code> (substring dish search)</li>
        <li><code>GET/POST/DELETE /api/favorites</code> (auth)</li>
        <li><code>GET/PATCH /api/settings</code> (auth)</li>
        <li><code>POST /api/push/register</code> (auth)</li>
        <li><code>POST /api/push/unregister</code> (auth)</li>
        <li><code>GET /api/cron/daily</code> (scrape cron)</li>
        <li><code>GET /api/cron/notify</code> (7:30 AM PT push cron)</li>
      </ul>
    </main>
  );
}
