import { Server, type Connection, type ConnectionContext } from "partyserver";
import { encode, ServerMessageType } from "@tikron/protocol";
import {
  Room,
  CLOSE_INVALID_SESSION,
  CLOSE_UNAUTHORIZED,
  type RoomConnection,
  type RoomContext,
  type RoomServices,
  type RoomStorage,
  type RoomInit,
  type LeaderboardSubmit,
  type ClientAuth,
} from "./room.js";

export type RoomClass<TState> = new (init: RoomInit) => Room<TState>;

/**
 * What an {@link DefineRoomOptions.onAuth} may return. A boolean keeps the
 * original contract (`true` accepts with no identity, `false` rejects). Return an
 * object to also carry the verified player identity into room code: `id` (or a
 * `claims.sub` string when `id` is omitted) becomes {@link Client.auth}.`id`, and
 * `claims` are exposed on {@link Client.auth}.`claims`. Live-only — a client's
 * auth is NOT persisted across Durable Object eviction (phase-2).
 */
export type AuthResult = boolean | { id?: string; claims?: Record<string, unknown> };

/**
 * Derive the durable {@link ClientAuth} from an {@link AuthResult}. A boolean (or
 * an object with neither `id` nor a string `claims.sub`) yields no identity — the
 * connection is authorized but anonymous, and `client.auth` stays undefined.
 */
function authFromResult(res: AuthResult): ClientAuth | undefined {
  if (typeof res !== "object") return undefined; // boolean true → authorized, no identity
  const claims = res.claims ?? {};
  const sub = typeof claims.sub === "string" ? claims.sub : undefined;
  const id = res.id ?? sub;
  return id !== undefined ? { id, claims } : undefined;
}

/** The Durable Object class shape produced by {@link defineRoom} (wrangler-bindable). */
export type DefinedRoomClass = new (
  ...args: ConstructorParameters<typeof Server>
) => Server<Cloudflare.Env>;

/** A room's live occupancy, as reported to {@link DefineRoomOptions.reportOccupancy}. */
export interface OccupancyReport {
  roomId: string;
  /** Seated clients, including any inside a reconnection window. */
  count: number;
  /** Stable client ids (session keys) currently holding a seat. */
  sessions: string[];
  /** Monotonic per-room counter; receivers must discard reports arriving out of order. */
  seq: number;
  /** Owning project (from the `_project` query param), for usage attribution. */
  projectId?: string | null;
  /** Developer messages processed since the previous report (usage metering). */
  messages?: number;
}

export interface DefineRoomOptions {
  /**
   * Called whenever the room's occupancy changes (join, final leave). Wire this
   * to your matchmaker so lobby listings reflect live counts instead of
   * reservation guesses. Errors are swallowed (reporting is best-effort).
   */
  reportOccupancy?: (env: unknown, report: OccupancyReport) => void | Promise<void>;
  /**
   * Optional guard for self-supplied session keys. When configured and a
   * connection carries a session key (`?_session=`), it is awaited BEFORE the
   * room accepts the connection; returning false rejects it with an
   * `invalid_session` error and closes the socket. Connections without a session
   * key (which fall back to the transport connection id) skip validation.
   */
  validateSession?: (
    env: unknown,
    info: { roomId: string; session: string },
  ) => boolean | Promise<boolean>;
  /**
   * Optional player-token auth, invoked BEFORE {@link validateSession}. Receives
   * the `_auth` query token (or null) and the `_session` key (or null); returning
   * false rejects the connection with an `unauthorized` error. Wire this to verify
   * a per-project player JWT. Absent → no player-token enforcement.
   */
  onAuth?: (
    env: unknown,
    info: { roomId: string; projectId: string | null; token: string | null; session: string | null },
  ) => AuthResult | Promise<AuthResult>;
  /**
   * Optional platform services the host exposes to room code (see
   * {@link RoomServices}). Each is invoked with the host env plus the room's
   * owning project id (null when unmetered / dev). Absent → the service is simply
   * unavailable to rooms. Wired here so the platform-agnostic core never imports
   * the database.
   */
  services?: {
    /** Persist a leaderboard score to the platform DB (fire-and-forget). */
    submitScore?: (
      env: unknown,
      entry: { projectId: string | null } & LeaderboardSubmit,
    ) => void | Promise<void>;
  };
}

/** The query parameter carrying a client's stable session key. */
export const SESSION_QUERY_PARAM = "_session";
/** The query parameter carrying the owning project id (added by the host on enforced connects). */
export const PROJECT_QUERY_PARAM = "_project";
/** The query parameter carrying a player auth token (JWT). */
export const AUTH_QUERY_PARAM = "_auth";
/**
 * Dev/loadtest-only override to RAISE a room's seat cap, honored solely when the
 * host runs with `DEV_MODE === "1"`. Ignored in production, so a room's real
 * capacity (what its code sets) can never be lifted by a query param there.
 */
export const MAX_CLIENTS_QUERY_PARAM = "maxClients";
/** Hard ceiling on the dev seat-cap override, regardless of the requested value. */
const DEV_MAX_CLIENTS_CAP = 120;

/** The subset of a partyserver host a Room needs — keeps the core decoupled. */
interface PartyHost {
  readonly name: string;
  getConnections(): Iterable<RoomConnection>;
  getConnection(id: string): RoomConnection | undefined;
  broadcast(data: string, without?: string[]): void;
}

function makeContext(
  host: PartyHost,
  getEnv: () => unknown,
  getProjectId: () => string | null,
  storage: RoomStorage | undefined,
  options?: DefineRoomOptions,
): RoomContext {
  const report = options?.reportOccupancy;
  const submitScore = options?.services?.submitScore;
  return {
    roomId: host.name,
    // Injected once at room creation: gates the room's verbose per-drop dev
    // warnings (F119). Read here rather than passed as a flag so the core stays
    // env-agnostic. `wrangler dev` sets DEV_MODE=1 via the scaffold's dev script.
    devMode: (getEnv() as { DEV_MODE?: string }).DEV_MODE === "1",
    connections: () => host.getConnections(),
    connection: (id) => host.getConnection(id),
    broadcastRaw: (data, exceptIds) => host.broadcast(data, exceptIds),
    reportOccupancy: report
      ? (count, sessions, seq, messages) => {
          void Promise.resolve(
            report(getEnv(), {
              roomId: host.name,
              count,
              sessions,
              seq,
              projectId: getProjectId(),
              messages,
            }),
          ).catch(() => {});
        }
      : undefined,
    storage,
    services: submitScore
      ? {
          leaderboard: {
            submit: (entry) => {
              void Promise.resolve(
                submitScore(getEnv(), { projectId: getProjectId(), ...entry }),
              ).catch(() => {});
            },
          },
        }
      : undefined,
  };
}

function queryParam(ctx: ConnectionContext, name: string): string | undefined {
  try {
    return new URL(ctx.request.url).searchParams.get(name) ?? undefined;
  } catch {
    return undefined;
  }
}

function sessionFrom(ctx: ConnectionContext): string | undefined {
  return queryParam(ctx, SESSION_QUERY_PARAM);
}

/**
 * Wrap a {@link Room} subclass into a partyserver Durable Object class suitable
 * for a wrangler `class_name` binding.
 *
 * Framework rooms keep authoritative state in memory for the room's active
 * lifetime (hibernation disabled so in-memory state survives between messages).
 * A persist-and-hibernate optimization for idle rooms is planned for a later
 * milestone; it does not change this public API.
 */
export function defineRoom<TState>(
  RoomImpl: RoomClass<TState>,
  options?: DefineRoomOptions,
): DefinedRoomClass {
  return class extends Server<Cloudflare.Env> {
    // Design decision (Phase 1b): keep hibernate:false and make idle rooms cheap
    // via persistence + a DO alarm, rather than switching to hibernatable
    // WebSockets. Rationale: realtime rooms run a `setInterval` tick that keeps
    // the DO awake regardless of this flag (an active timer is pending work), so
    // hibernate:true buys nothing while such a room is occupied — while it WOULD
    // force rebuilding the in-memory seat/connection map from socket attachments
    // on every wake (a large, risky change to the hot path). The wins we actually
    // want — surviving eviction inside a reconnection window, and restoring state
    // on cold start — are delivered here by persisting {state, seats, windows} to
    // `ctx.storage` and using `ctx.storage.setAlarm` as the durable window
    // backstop. An empty room drops its snapshot and can then be evicted freely.
    static override options = { hibernate: false };

    #room: Room<TState> | null = null;
    /** Owning project (from `_project`), captured from the first connection. */
    #projectId: string | null = null;

    async #ensure(): Promise<Room<TState>> {
      if (!this.#room) {
        this.#room = new RoomImpl({
          id: this.name,
          // `this.ctx.storage` is the DO's durable storage (structurally a
          // RoomStorage); it lets the room persist state + reconnection windows.
          ctx: makeContext(this, () => this.env, () => this.#projectId, this.ctx.storage, options),
        });
        // _create() restores any persisted snapshot, so the room is whole before
        // the first _connect / _alarm below runs against it.
        await this.#room._create();
      }
      return this.#room;
    }

    // NOTE: do not create the room in onStart — partyserver's `this.name` is not
    // reliably set that early in some runtimes (e.g. `wrangler dev`). The room is
    // created lazily on the first connection, where the name is guaranteed.
    override async onConnect(conn: Connection, ctx: ConnectionContext): Promise<void> {
      // Capture the owning project (host adds `_project` on enforced connects) so
      // occupancy reports carry it for usage attribution.
      const project = queryParam(ctx, PROJECT_QUERY_PARAM);
      if (project && !this.#projectId) this.#projectId = project;

      const room = await this.#ensure();
      const session = sessionFrom(ctx);

      // Dev/loadtest-only seat-cap raise: `?maxClients=` is honored ONLY when the
      // host runs in DEV_MODE, and only ever raises (never lowers) the room's own
      // cap, clamped to DEV_MAX_CLIENTS_CAP. Production capacity is unaffected.
      if ((this.env as { DEV_MODE?: string }).DEV_MODE === "1") {
        const raw = queryParam(ctx, MAX_CLIENTS_QUERY_PARAM);
        if (raw !== undefined) {
          const n = Number(raw);
          if (Number.isFinite(n)) room._raiseMaxClients(Math.min(Math.floor(n), DEV_MAX_CLIENTS_CAP));
        }
      }

      // Player-token auth runs first: reject before a seat or session is considered.
      // A truthy result authorizes the connect; an object result additionally
      // carries the verified identity into `client.auth` (live-only).
      let auth: ClientAuth | undefined;
      if (options?.onAuth) {
        const token = queryParam(ctx, AUTH_QUERY_PARAM) ?? null;
        const res = await options.onAuth(this.env, {
          roomId: this.name,
          projectId: this.#projectId,
          token,
          session: session ?? null,
        });
        if (!res) {
          conn.send(
            encode({ t: ServerMessageType.Error, code: "unauthorized", message: "player auth failed" }),
          );
          conn.close(CLOSE_UNAUTHORIZED, "unauthorized");
          return;
        }
        auth = authFromResult(res);
      }

      // A self-supplied session key is validated before it can claim a seat; a
      // no-session connection uses its (unguessable) conn id and is exempt.
      if (session && options?.validateSession) {
        const ok = await options.validateSession(this.env, { roomId: this.name, session });
        if (!ok) {
          conn.send(
            encode({
              t: ServerMessageType.Error,
              code: "invalid_session",
              message: "session not recognized",
            }),
          );
          conn.close(CLOSE_INVALID_SESSION, "invalid session");
          return;
        }
      }
      await room._connect(conn, session, auth);
    }

    override async onMessage(conn: Connection, message: string | ArrayBuffer): Promise<void> {
      const room = await this.#ensure();
      await room._message(conn, message);
    }

    override async onClose(conn: Connection): Promise<void> {
      const room = await this.#ensure();
      await room._close(conn);
    }

    // The DO alarm is the durable backstop for reconnection windows: it fires
    // even on a cold-started instance after eviction, so #ensure() first restores
    // the room from storage, then _alarm() finalizes any elapsed windows.
    override async onAlarm(): Promise<void> {
      const room = await this.#ensure();
      await room._alarm();
    }
  };
}
