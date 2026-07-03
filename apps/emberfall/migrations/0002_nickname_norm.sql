-- Adds normalized-nickname uniqueness (PLAN-EMBERFALL-M2 §2): case/whitespace-folded
-- so "Hero", "hero", " hero " can't coexist even though 0001's `nickname UNIQUE` is an
-- exact-string match. SQLite can't ALTER a column to add UNIQUE in place, so this adds
-- the column, backfills it (idempotent-safe if 0001 already has rows), then creates a
-- separate unique index. Every other field the addendum's SavedCharacter needs
-- (token_hash, class, level, xp, gold, inventory_json, equipment_json, zone, x, y, hp,
-- mp, play_ms, created_at, updated_at) already exists from 0001 — nothing else to add.

ALTER TABLE characters ADD COLUMN nickname_norm TEXT;

UPDATE characters
SET nickname_norm = lower(trim(nickname))
WHERE nickname_norm IS NULL;

CREATE UNIQUE INDEX idx_characters_nickname_norm ON characters (nickname_norm);
