import { describe, it, expect } from "vitest";
import { schema, mapOf, type Codec } from "@tikron/schema";
import { Room, type Client } from "./room.js";
import { createTestRoom } from "./testing.js";

// --- a tiny turn-based game to exercise the harness (JSON sync, no tick) ---

interface TttState {
  board: (string | null)[];
  turn: string | null;
  winner: string | null;
}

const WINS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

class TicTacToe extends Room<TttState> {
  private readonly players: string[] = [];

  override onCreate(): void {
    this.setState({ board: Array(9).fill(null), turn: null, winner: null });
    this.onMessage("mark", (client, payload) => {
      const cell = (payload as { cell?: unknown }).cell;
      if (typeof cell !== "number" || cell < 0 || cell > 8) return;
      if (this.state.winner || this.state.turn !== client.id || this.state.board[cell] !== null) return;

      const mark = this.players[0] === client.id ? "X" : "O";
      this.state.board[cell] = mark;
      if (WINS.some((line) => line.every((i) => this.state.board[i] === mark))) {
        this.state.winner = client.id;
        this.broadcast("win", { winner: client.id, mark });
      } else {
        this.state.turn = this.players.find((p) => p !== client.id) ?? null;
      }
      this.markStateChanged();
    });
  }

  override onJoin(client: Client): void {
    this.players.push(client.id);
    if (this.players.length === 1) this.state.turn = client.id; // first to join goes first
    this.markStateChanged();
  }
}

describe("createTestRoom — tic-tac-toe flow", () => {
  it("plays a full game: two clients, alternating moves, and a win broadcast", async () => {
    const h = await createTestRoom(TicTacToe);
    const alice = await h.connect("alice");
    const bob = await h.connect("bob");
    await h.flush();

    // Occupancy was reported on each join, with the seated session ids.
    expect(h.reports.at(-1)).toMatchObject({ count: 2, sessions: ["alice", "bob"] });
    expect(h.snapshot().turn).toBe("alice");

    // Alice takes the top row; Bob answers in the middle row. Server enforces turns.
    await alice.send("mark", { cell: 0 });
    await bob.send("mark", { cell: 3 });
    await alice.send("mark", { cell: 1 });
    await bob.send("mark", { cell: 4 });

    // An out-of-turn / occupied-cell move is ignored by the server.
    await bob.send("mark", { cell: 2 });
    await h.flush();
    expect(h.snapshot().board[2]).toBeNull();

    await alice.send("mark", { cell: 2 }); // completes 0,1,2 — Alice wins
    await h.flush();

    const state = h.snapshot();
    expect(state.winner).toBe("alice");
    expect(state.board).toEqual(["X", "X", "X", "O", "O", null, null, null, null]);

    // The win was broadcast to everyone, and each client saw it.
    const wins = h.broadcastsOf("s:msg").filter((b) => b.data.type === "win");
    expect(wins).toHaveLength(1);
    expect(wins[0]!.data.payload).toEqual({ winner: "alice", mark: "X" });
    expect(bob.frames().some((f) => f.t === "s:msg" && f.type === "win")).toBe(true);

    // lastState() reflects the JSON state each client received.
    expect((alice.lastState() as TttState).winner).toBe("alice");
  });

  it("reports the seat as gone after a client leaves (no reconnection opt-in)", async () => {
    const h = await createTestRoom(TicTacToe);
    const alice = await h.connect("alice");
    await h.connect("bob");
    await alice.close(); // TicTacToe doesn't call allowReconnection → immediate leave

    expect(h.reports.at(-1)).toMatchObject({ count: 1, sessions: ["bob"] });
    expect(h.broadcastsOf("s:peer-left")).toHaveLength(1);
  });
});

// --- a binary (codec) room to exercise binaryFrames()/lastState() decoding ---

interface BinState {
  players: Record<string, { x: number; y: number }>;
}
const BinSchema: Codec<BinState> = schema({ players: mapOf(schema({ x: "f32", y: "f32" })) });

class BinRoom extends Room<BinState> {
  override onCreate(): void {
    this.stateCodec = BinSchema; // switch to binary delta sync
    this.setState({ players: {} });
    this.onMessage("move", (client, payload) => {
      const me = this.state.players[client.id];
      const p = payload as { x?: unknown; y?: unknown };
      if (!me || typeof p.x !== "number" || typeof p.y !== "number") return;
      me.x = p.x;
      me.y = p.y;
      this.markStateChanged();
    });
  }
  override onJoin(client: Client): void {
    this.state.players[client.id] = { x: 0, y: 0 };
    this.markStateChanged();
  }
}

describe("createTestRoom — binary state decoding", () => {
  it("decodes binary state frames via the codec", async () => {
    const h = await createTestRoom(BinRoom, { codec: BinSchema });
    const a = await h.connect("a");
    await h.flush(); // initial full snapshot frame

    await a.send("move", { x: 3, y: 4 });
    await h.flush(); // a delta frame

    const frames = a.binaryFrames();
    expect(frames.length).toBeGreaterThanOrEqual(2); // full + delta

    expect(h.snapshot().players.a).toEqual({ x: 3, y: 4 });
    const seen = a.lastState() as BinState;
    expect(seen.players.a.x).toBeCloseTo(3);
    expect(seen.players.a.y).toBeCloseTo(4);
  });
});
