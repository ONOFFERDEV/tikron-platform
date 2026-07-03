-- Seed the "Made with Tikron" showcase with our own flagship demos, pre-approved
-- and featured. project_id = 'demo' links them to the demo metering project so the
-- public gallery can show their live "N playing now" counts. Idempotent (fixed
-- ids + INSERT OR IGNORE). Apply with:
--   pnpm exec wrangler d1 execute playedge-platform --remote --file scripts/seed-showcase.sql
INSERT OR IGNORE INTO showcase_games
  (id, project_id, owner_github_id, slug, title, tagline, thumbnail_url, play_url, genres, author, status, featured, created_at, updated_at)
VALUES
  ('seed-fps', 'demo', '144263374', 'tikron-fps-demo',
   'Tikron FPS Arena',
   '64-player edge-hosted shooter — subtick lag compensation + AOI priority tiers.',
   '/assets/showcase/fps.svg', '/shooter.html', 'fps,action', 'Tikron',
   'approved', 1, strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('seed-io', 'demo', '144263374', 'tikron-io-demo',
   'Tikron .io Arena',
   'Classic agar-style .io arena with server-authoritative growth + interest management.',
   '/assets/showcase/io.svg', '/agar.html', 'io,casual', 'Tikron',
   'approved', 1, strftime('%s','now') * 1000, strftime('%s','now') * 1000);
