-- 0005 leaderboard seasons (F4, PLAN-0.7): a board's rows are now partitioned by
-- a season key so a leaderboard can reset on a period (daily/weekly/monthly)
-- instead of accumulating forever. season = '' is the existing "alltime"
-- behavior, so every row from before this migration is already correctly
-- classified once copied across — no backfill needed.
--
-- SQLite cannot ALTER a PRIMARY KEY, so the table is rebuilt: new table with
-- `season` in the PK, copy every existing row in as season='', drop, rename.
-- D1 runs a migration's statements sequentially, not as one transaction, so a
-- partial failure can leave leaderboards_new behind — drop it first to make
-- re-running this file after such a failure safe.
DROP TABLE IF EXISTS leaderboards_new;
CREATE TABLE leaderboards_new (
  project_id   TEXT    NOT NULL,
  board        TEXT    NOT NULL,
  season       TEXT    NOT NULL DEFAULT '',
  player_id    TEXT    NOT NULL,
  display_name TEXT,
  score        REAL    NOT NULL,
  updated_at   INTEGER NOT NULL, -- epoch ms
  PRIMARY KEY (project_id, board, season, player_id)
);

INSERT INTO leaderboards_new (project_id, board, season, player_id, display_name, score, updated_at)
  SELECT project_id, board, '', player_id, display_name, score, updated_at FROM leaderboards;

DROP TABLE leaderboards;
ALTER TABLE leaderboards_new RENAME TO leaderboards;

DROP INDEX IF EXISTS idx_leaderboards_topn;
CREATE INDEX IF NOT EXISTS idx_leaderboards_topn
  ON leaderboards (project_id, board, season, score DESC);

-- Per-board declared reset period (F4): upserted (last write wins) whenever an
-- ingest submit carries a `period`. A missing row means the board has never
-- declared one -> treated as "alltime" in application code (not stored here).
CREATE TABLE IF NOT EXISTS leaderboard_boards (
  project_id TEXT    NOT NULL,
  board      TEXT    NOT NULL,
  period     TEXT    NOT NULL,
  updated_at INTEGER NOT NULL, -- epoch ms
  PRIMARY KEY (project_id, board)
);
