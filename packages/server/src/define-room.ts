import { Server, type Connection, type ConnectionContext } from "partyserver";
import { Room, type RoomConnection, type RoomContext, type RoomInit } from "./room.js";

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
    static override options = { hibernate: false };

    #room: Room<TState> | null = null;

    async #ensure(): Promise<Room<TState>> {
      if (!this.#room) {
        this.#room = new RoomImpl({
          id: this.name,
          ctx: makeContext(this, () => this.env, options),
        });
        await this.#room._create();
      }
      return this.#room;
    }

    // NOTE: do not create the room in onStart — partyserver's `this.name` is not
    // reliably set that early in some runtimes (e.g. `wrangler dev`). The room is
    // created lazily on the first connection, where the name is guaranteed.
    override async onConnect(conn: Connection, ctx: ConnectionContext): Promise<void> {
      const room = await this.#ensure();
      await room._connect(conn, sessionFrom(ctx));
    }

    override async onMessage(conn: Connection, message: string | ArrayBuffer): Promise<void> {
      const room = await this.#ensure();
      await room._message(conn, message);
    }

    override async onClose(conn: Connection): Promise<void> {
      const room = await this.#ensure();
      await room._close(conn);
    }
  };
}
