-- Seed the demo fallback project (see DEMO_PROJECT_ID in wrangler.jsonc).
-- Keyless /parties connects are attributed to this project, so the public demos
-- stay metered and capped. Idempotent. Apply with:
--   pnpm exec wrangler d1 execute playedge-platform --remote --file scripts/seed-demo.sql
INSERT OR IGNORE INTO users (github_id, login, avatar_url, created_at)
  VALUES ('system', 'system', NULL, strftime('%s','now') * 1000);
INSERT OR IGNORE INTO projects (id, owner_github_id, name, player_jwt_secret, require_player_auth, created_at)
  VALUES ('demo', 'system', 'Public demos', hex(randomblob(32)), 0, strftime('%s','now') * 1000);
