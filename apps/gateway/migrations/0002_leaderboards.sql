-- 0002 leaderboards (P5): per-project score boards a room writes and any client
-- reads. Boards are namespaces within a project, created implicitly on first
-- submit. Score aggregation mode is chosen per submit (max | sum | last).
CREATE TABLE IF NOT EXISTS leaderboards (
  project_id   TEXT    NOT NULL,
  board        TEXT    NOT NULL,
  player_id    TEXT    NOT NULL,
  display_name TEXT,
  score        REAL    NOT NULL,
  updated_at   INTEGER NOT NULL, -- epoch ms
  PRIMARY KEY (project_id, board, player_id)
);

-- Top-N reads scan one (project, board) partition ordered by score descending.
CREATE INDEX IF NOT EXISTS idx_leaderboards_topn
  ON leaderboards (project_id, board, score DESC);
