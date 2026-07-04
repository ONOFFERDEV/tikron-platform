-- 0004 leaderboard board cap (F044/F107): a free-tier ceiling on how many
-- distinct boards a single project may create, so a self-hosted game reporting
-- scores through POST /api/ingest/score can't grow D1 rows without bound.
-- Adjustable in D1 without a deploy (like the other free_* caps). No API-key
-- scope column is added: key class is derived from the tk_pub_/tk_live_ prefix,
-- which the stored key hash already binds tamper-proof.
INSERT INTO config (k, v) VALUES ('free_leaderboard_boards', '50')
  ON CONFLICT(k) DO NOTHING;
