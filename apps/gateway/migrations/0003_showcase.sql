-- 0003 showcase: a public "Made with Tikron" game gallery. Developers submit a
-- game from the dashboard (defaults to `pending`); an admin approves it, then it
-- appears on the public /games page. `project_id` is optional — when set, the
-- showcase can pull that project's live room/player counts from the matchmaker
-- for a "N playing now" badge. External games (no Tikron-hosted metering) leave
-- it null and simply show no live badge.
CREATE TABLE IF NOT EXISTS showcase_games (
  id              TEXT    PRIMARY KEY,
  project_id      TEXT,                       -- optional link for live counts
  owner_github_id TEXT    NOT NULL,           -- submitter (moderation + "my games")
  slug            TEXT    NOT NULL UNIQUE,     -- url-safe deep-link handle
  title           TEXT    NOT NULL,
  tagline         TEXT    NOT NULL DEFAULT '',
  thumbnail_url   TEXT    NOT NULL,
  play_url        TEXT    NOT NULL,
  genres          TEXT    NOT NULL DEFAULT '', -- csv: io,fps,casual,board,racing,action,other
  author          TEXT    NOT NULL DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  featured        INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,           -- epoch ms
  updated_at      INTEGER NOT NULL
);

-- Public listing: approved rows, featured first, newest next.
CREATE INDEX IF NOT EXISTS idx_showcase_public
  ON showcase_games (status, featured DESC, created_at DESC);

-- "My submissions" + moderation queue scans.
CREATE INDEX IF NOT EXISTS idx_showcase_owner
  ON showcase_games (owner_github_id, created_at DESC);
