-- Session->character binding for the M2 security fix (PLAN-EMBERFALL-M2-SECFIX
-- FIX-1/FIX-2): a character can be claimed by at most one LIVE Tikron session at a
-- time (`persist.claimSession`'s CAS), so the same save token can no longer puppeteer
-- two engine units concurrently, and a room identifies "which character is this
-- connection" by session id alone (`active_session_id`), never by treating the save
-- token itself as the session key.
--
-- active_seen_at is a heartbeat (refreshed on claim + every periodic save,
-- `saveCharacterForSession`) — a session whose heartbeat goes stale past the
-- crash-recovery TTL (persist.ts's SESSION_CLAIM_TTL_MS) can be reclaimed by a fresh
-- connect for the same token, so a DO that died without an onLeave doesn't lock the
-- character out forever.

ALTER TABLE characters ADD COLUMN active_session_id TEXT;
ALTER TABLE characters ADD COLUMN active_seen_at INTEGER;
