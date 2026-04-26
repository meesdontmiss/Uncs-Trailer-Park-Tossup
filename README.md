<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/7d3a5de2-a9ac-40d1-b5ad-9516f66ccbac

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Online Multiplayer + Neon

The Socket.IO server is authoritative for match state, projectile resolution, hits, kills, and match end. When `DATABASE_URL` is set, it also records player profiles, lobbies, matches, match players, projectiles, and match events into Neon Postgres.

1. Create a Neon database or use the `render.yaml` Blueprint database.
2. Set `DATABASE_URL` to the Neon pooled connection string with SSL enabled.
3. Keep `DB_AUTO_MIGRATE=true` for first deploy so `db/schema.sql` is applied automatically.
4. Deploy the repo to Render as a web service. Render will run `npm ci --force && npm run build`, then `npm run start`.
5. Use `/health` or `/api/status` to confirm the server, database setting, active match, and lobby state.

For local database testing, add `DATABASE_URL` to your local env and run `npm run dev`. Without `DATABASE_URL`, multiplayer still runs, but persistence is disabled.
