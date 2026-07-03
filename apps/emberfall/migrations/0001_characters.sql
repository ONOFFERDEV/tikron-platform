-- Emberfall character storage (anonymous token save/load, PLAN-EMBERFALL §5).
-- Timestamps are epoch milliseconds (INTEGER). id is a UUID (TEXT).

CREATE TABLE characters (
  id             TEXT PRIMARY KEY,
  token_hash     TEXT NOT NULL,        -- SHA-256 hex of the anonymous save token
  nickname       TEXT NOT NULL UNIQUE,
  class          TEXT NOT NULL,        -- "warrior" | "mage" | "cleric"
  level          INTEGER NOT NULL DEFAULT 1,
  xp             INTEGER NOT NULL DEFAULT 0,
  gold           INTEGER NOT NULL DEFAULT 0,
  inventory_json TEXT NOT NULL DEFAULT '[]',
  equipment_json TEXT NOT NULL DEFAULT '{}',
  zone           TEXT NOT NULL DEFAULT 'village',
  x              REAL NOT NULL DEFAULT 0,
  y              REAL NOT NULL DEFAULT 0,
  hp             INTEGER NOT NULL DEFAULT 0,
  mp             INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  play_ms        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_characters_token_hash ON characters (token_hash);
