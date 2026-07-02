-- Tikron platform (M5-lite) schema.
-- Timestamps are epoch milliseconds (INTEGER). Ids are text UUIDs except
-- users.github_id (the GitHub numeric id, stored as text).

CREATE TABLE users (
  github_id   TEXT PRIMARY KEY,
  login       TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE projects (
  id                 TEXT PRIMARY KEY,
  owner_github_id    TEXT NOT NULL,
  name               TEXT NOT NULL,
  -- Per-project HS256 secret for optional player-token auth (generated on create).
  player_jwt_secret  TEXT NOT NULL,
  -- When 1, connections must carry a valid player token (default off so nothing breaks).
  require_player_auth INTEGER NOT NULL DEFAULT 0,
  created_at         INTEGER NOT NULL
);
CREATE INDEX idx_projects_owner ON projects (owner_github_id);

CREATE TABLE api_keys (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  key_hash    TEXT NOT NULL,        -- SHA-256 hex of the full key
  key_prefix  TEXT NOT NULL,        -- first 12 chars, for display
  created_at  INTEGER NOT NULL,
  revoked_at  INTEGER               -- NULL while active (soft revoke)
);
CREATE UNIQUE INDEX idx_api_keys_hash ON api_keys (key_hash);
CREATE INDEX idx_api_keys_project ON api_keys (project_id);

CREATE TABLE usage_daily (
  project_id  TEXT NOT NULL,
  day         TEXT NOT NULL,        -- UTC "YYYY-MM-DD"
  room_hours  REAL NOT NULL DEFAULT 0,
  peak_ccu    INTEGER NOT NULL DEFAULT 0,
  messages    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, day)
);

CREATE TABLE config (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);

-- Default free-tier caps (adjustable in D1). Room-hours are per calendar month.
INSERT INTO config (k, v) VALUES
  ('free_room_hours_per_month', '1000'),
  ('free_concurrent_rooms', '20'),
  ('free_players_per_room', '20');
