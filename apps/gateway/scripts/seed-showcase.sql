-- Seed the "Made with Tikron" showcase with our own games, pre-approved and
-- featured. project_id = 'demo' links them to the demo metering project so the
-- public gallery can show their live "N playing now" counts. Idempotent (fixed
-- ids + INSERT OR IGNORE). Apply with:
--   pnpm exec wrangler d1 execute playedge-platform --remote --file scripts/seed-showcase.sql
--
-- Both games are deployed OUTSIDE this worker (the gateway hosts no games): the
-- FPS template lives in apps/ironsight, and Nyam Duel in its own repo.

-- Retire the rows for the gateway demos removed on 2026-09-07; the pages they
-- linked to no longer exist. Safe to re-run.
DELETE FROM showcase_games WHERE id IN ('seed-fps', 'seed-io');

INSERT OR IGNORE INTO showcase_games
  (id, project_id, owner_github_id, slug, title, tagline, thumbnail_url, play_url, genres, author, status, featured, created_at, updated_at)
VALUES
  ('ironsight', 'demo', '144263374', 'ironsight',
   'ironsight',
   'Web FPS template: hybrid hit registration, rewind, tile-authored arenas.',
   '/assets/showcase/fps.svg', 'https://fps.tikron.dev', 'fps,action', 'Tikron',
   'approved', 1, strftime('%s','now') * 1000, strftime('%s','now') * 1000),
  ('nyam-duel', 'demo', '144263374', 'nyam-duel',
   '냠냠대전 (Nyam Duel)',
   'Webcam face-tracking 1v1 built on the self-hosted golden path.',
   '/assets/showcase/io.svg', 'https://nyam.tikron.dev', 'casual,other', 'Tikron',
   'approved', 1, strftime('%s','now') * 1000, strftime('%s','now') * 1000);
