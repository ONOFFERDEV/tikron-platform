/**
 * A minimal, hand-rolled `D1Database` test double covering exactly the query shapes
 * `persist.ts` issues against the `characters` table (insert-with-conflict-check,
 * select-by-token_hash, select-by-active_session_id, the session-binding CAS/release/
 * save queries added by PLAN-EMBERFALL-M2-SECFIX). Not a general SQL emulator — if
 * `persist.ts`'s queries change shape, update this alongside it. Modeled after
 * `@tikron/server/testing`'s own `FakeStorage`/`FakeConnection` test-double idiom.
 */

interface Row {
  id: string;
  token_hash: string;
  nickname: string;
  nickname_norm: string;
  class: string;
  level: number;
  xp: number;
  gold: number;
  inventory_json: string;
  equipment_json: string;
  zone: string;
  x: number;
  y: number;
  hp: number;
  mp: number;
  created_at: number;
  updated_at: number;
  play_ms: number;
  active_session_id: string | null;
  active_seen_at: number | null;
}

export interface FakeD1 {
  db: D1Database;
  rows: readonly Row[];
}

class FakeStatement {
  private args: unknown[] = [];
  constructor(
    private readonly sql: string,
    private readonly rows: Row[],
  ) {}

  bind(...args: unknown[]): FakeStatement {
    const s = new FakeStatement(this.sql, this.rows);
    s.args = args;
    return s;
  }

  async first<T>(): Promise<T | null> {
    const sql = this.sql.trim();
    if (sql.startsWith("SELECT id FROM characters WHERE nickname_norm")) {
      const [norm] = this.args as [string];
      const row = this.rows.find((r) => r.nickname_norm === norm);
      return (row ? { id: row.id } : null) as T | null;
    }
    if (sql.startsWith("SELECT * FROM characters WHERE token_hash")) {
      const [tokenHash] = this.args as [string];
      const row = this.rows.find((r) => r.token_hash === tokenHash);
      return (row ?? null) as T | null;
    }
    if (sql.startsWith("SELECT * FROM characters WHERE active_session_id")) {
      const [sessionId] = this.args as [string];
      const row = this.rows.find((r) => r.active_session_id === sessionId);
      return (row ?? null) as T | null;
    }
    throw new Error(`FakeD1: unsupported first() query: ${sql}`);
  }

  async all<T>(): Promise<{ results: T[] }> {
    throw new Error(`FakeD1: unsupported all() query: ${this.sql}`);
  }

  async run(): Promise<{ meta: { changes: number } }> {
    const sql = this.sql.trim();
    if (sql.startsWith("INSERT INTO characters")) {
      const [
        id,
        token_hash,
        nickname,
        nickname_norm,
        cls,
        level,
        xp,
        gold,
        inventory_json,
        equipment_json,
        zone,
        x,
        y,
        hp,
        mp,
        created_at,
        updated_at,
        play_ms,
      ] = this.args as [
        string, string, string, string, string, number, number, number,
        string, string, string, number, number, number, number, number, number, number,
      ];
      const conflict = this.rows.some(
        (r) => r.id === id || r.nickname === nickname || r.nickname_norm === nickname_norm,
      );
      if (conflict) return { meta: { changes: 0 } };
      this.rows.push({
        id, token_hash, nickname, nickname_norm, class: cls, level, xp, gold,
        inventory_json, equipment_json, zone, x, y, hp, mp, created_at, updated_at, play_ms,
        active_session_id: null, active_seen_at: null,
      });
      return { meta: { changes: 1 } };
    }
    // Order matters below: the session-binding queries are more specific prefixes of
    // (or otherwise overlap with) the plain "UPDATE characters SET" shape, so they're
    // matched first.
    if (sql.includes("active_session_id = NULL")) {
      // releaseSession
      const [sessionId] = this.args as [string];
      const row = this.rows.find((r) => r.active_session_id === sessionId);
      if (!row) return { meta: { changes: 0 } };
      row.active_session_id = null;
      return { meta: { changes: 1 } };
    }
    if (sql.includes("active_session_id = ?, active_seen_at = ?") && sql.includes("token_hash = ?")) {
      // claimSession (CAS)
      const [sessionId, activeSeenAt, tokenHash, sameSessionId, staleThreshold] = this.args as [
        string, number, string, string, number,
      ];
      const row = this.rows.find((r) => r.token_hash === tokenHash);
      if (!row) return { meta: { changes: 0 } };
      const ownerOk =
        row.active_session_id === null ||
        row.active_session_id === sameSessionId ||
        (row.active_seen_at ?? -Infinity) < staleThreshold;
      if (!ownerOk) return { meta: { changes: 0 } };
      row.active_session_id = sessionId;
      row.active_seen_at = activeSeenAt;
      return { meta: { changes: 1 } };
    }
    if (sql.includes("WHERE active_session_id = ?")) {
      // saveCharacterForSession (optimistic concurrency)
      const [level, xp, gold, zone, x, y, hp, mp, inventory_json, equipment_json, play_ms, updated_at, active_seen_at, sessionId] =
        this.args as [number, number, number, string, number, number, number, number, string, string, number, number, number, string];
      const row = this.rows.find((r) => r.active_session_id === sessionId);
      if (!row) return { meta: { changes: 0 } };
      Object.assign(row, { level, xp, gold, zone, x, y, hp, mp, inventory_json, equipment_json, play_ms, updated_at, active_seen_at });
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith("UPDATE characters SET")) {
      // saveCharacter (blind, by token_hash)
      const [level, xp, gold, zone, x, y, hp, mp, inventory_json, equipment_json, play_ms, updated_at, tokenHash] =
        this.args as [number, number, number, string, number, number, number, number, string, string, number, number, string];
      const row = this.rows.find((r) => r.token_hash === tokenHash);
      if (!row) return { meta: { changes: 0 } };
      Object.assign(row, { level, xp, gold, zone, x, y, hp, mp, inventory_json, equipment_json, play_ms, updated_at });
      return { meta: { changes: 1 } };
    }
    throw new Error(`FakeD1: unsupported run() query: ${sql}`);
  }
}

export function createFakeD1(): FakeD1 {
  const rows: Row[] = [];
  const db = {
    prepare(sql: string) {
      return new FakeStatement(sql, rows);
    },
  } as unknown as D1Database;
  return { db, rows };
}
