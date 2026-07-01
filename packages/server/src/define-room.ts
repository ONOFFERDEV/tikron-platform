import { Server, type Connection } from "partyserver";
import { Room, type RoomConnection, type RoomContext, type RoomInit } from "./room.js";

export type RoomClass<TState> = new (init: RoomInit) => Room<TState>;

/** The Durable Object class shape produced by {@link defineRoom} (wrangler-bindable). */
export type DefinedRoomClass = new (
  ...args: ConstructorParameters<typeof Server>
) => Server<Cloudflare.Env>;

/** The subset of a partyserver host a Room needs — keeps the core decoupled. */
interface PartyHost {
  readonly name: string;
  getConnections(): Iterable<RoomConnection>;
  getConnection(id: string): RoomConnection | undefined;
  broadcast(data: string, without?: string[]): void;
}

function makeContext(host: PartyHost): RoomContext {
  return {
    roomId: host.name,
    connections: () => host.getConnections(),
    connection: (id) => host.getConnection(id),
    broadcastRaw: (data, exceptIds) => host.broadcast(data, exceptIds),
  };
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
export function defineRoom<TState>(RoomImpl: RoomClass<TState>): DefinedRoomClass {
  return class extends Server<Cloudflare.Env> {
    static override options = { hibernate: false };

    #room: Room<TState> | null = null;

    async #ensure(): Promise<Room<TState>> {
      if (!this.#room) {
        this.#room = new RoomImpl({ id: this.name, ctx: makeContext(this) });
        await this.#room._create();
      }
      return this.#room;
    }

    override async onStart(): Promise<void> {
      await this.#ensure();
    }

    override async onConnect(conn: Connection): Promise<void> {
      const room = await this.#ensure();
      await room._connect(conn);
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
