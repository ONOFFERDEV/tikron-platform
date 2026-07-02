import { Server, type Connection, type ConnectionContext } from "partyserver";
import { encode, ServerMessageType } from "@playedge/protocol";
import {
  Room,
  CLOSE_INVALID_SESSION,
  type RoomConnection,
  type RoomContext,
  type RoomStorage,
  type RoomInit,
} from "./room.js";

export type RoomClass<TState> = new (init: RoomInit) => Room<TState>;

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
}

/** The query parameter carrying a client's stable session key. */
export const SESSION_QUERY_PARAM = "_session";

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
  storage: RoomStorage | undefined,
  options?: DefineRoomOptions,
): RoomContext {
  const report = options?.reportOccupancy;
  return {
    roomId: host.name,
    connections: () => host.getConnections(),
    connection: (id) => host.getConnection(id),
    broadcastRaw: (data, exceptIds) => host.broadcast(data, exceptIds),
    reportOccupancy: report
      ? (count, sessions, seq) => {
          void Promise.resolve(
            report(getEnv(), { roomId: host.name, count, sessions, seq }),
          ).catch(() => {});
        }
      : undefined,
    storage,
  };
}

function sessionFrom(ctx: ConnectionContext): string | undefined {
  try {
    return new URL(ctx.request.url).searchParams.get(SESSION_QUERY_PARAM) ?? undefined;
  } catch {
    return undefined;
  }
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

    async #ensure(): Promise<Room<TState>> {
      if (!this.#room) {
        this.#room = new RoomImpl({
          id: this.name,
          // `this.ctx.storage` is the DO's durable storage (structurally a
          // RoomStorage); it lets the room persist state + reconnection windows.
          ctx: makeContext(this, () => this.env, this.ctx.storage, options),
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
      const room = await this.#ensure();
      const session = sessionFrom(ctx);
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
      await room._connect(conn, session);
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
