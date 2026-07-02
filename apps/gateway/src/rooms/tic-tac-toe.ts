import { TurnBasedRoom, type Client } from "@tikron/server";

/**
 * Turn-based guardrail room — proves the {@link TurnBasedRoom} preset (the
 * genre-agnostic core) works with **no simulation tick** and no movement/AOI
 * modules. State syncs purely on mutation.
 */
type Mark = "X" | "O";
type Cell = Mark | null;

interface TicTacToeState {
  board: Cell[];
  turn: Mark;
  winner: Mark | "draw" | null;
  seats: { X: string | null; O: string | null };
}

const LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export class TicTacToeImpl extends TurnBasedRoom<TicTacToeState> {
  override onCreate(): void {
    this.setState({
      board: Array<Cell>(9).fill(null),
      turn: "X",
      winner: null,
      seats: { X: null, O: null },
    });
    this.onMessage("place", (client, payload) => this.handlePlace(client, payload));
  }

  override onJoin(client: Client): void {
    // Seat the first two joiners as X then O.
    if (this.state.seats.X === null) {
      this.state.seats.X = client.id;
      client.data.mark = "X";
    } else if (this.state.seats.O === null) {
      this.state.seats.O = client.id;
      client.data.mark = "O";
    }
    this.markStateChanged();
  }

  private handlePlace(client: Client, payload: unknown): void {
    if (this.state.winner !== null) return;

    const mark = client.data.mark as Mark | undefined;
    if (!mark || mark !== this.state.turn) {
      client.send("illegal", { reason: "not_your_turn" });
      return;
    }

    const cell = this.readCell(payload);
    if (cell === null || this.state.board[cell] !== null) {
      client.send("illegal", { reason: "bad_cell" });
      return;
    }

    this.state.board[cell] = mark;
    const winner = this.checkWinner();
    if (winner !== null) {
      this.state.winner = winner;
    } else {
      this.state.turn = this.state.turn === "X" ? "O" : "X";
    }

    // No tick anywhere in this room — the core syncs state on mutation.
    this.markStateChanged();
    if (this.state.winner !== null) this.broadcast("gameOver", { winner: this.state.winner });
  }

  private readCell(payload: unknown): number | null {
    if (typeof payload !== "object" || payload === null) return null;
    const cell = (payload as Record<string, unknown>).cell;
    if (typeof cell !== "number" || !Number.isInteger(cell) || cell < 0 || cell > 8) return null;
    return cell;
  }

  private checkWinner(): Mark | "draw" | null {
    for (const [a, b, c] of LINES) {
      const v = this.state.board[a];
      if (v != null && v === this.state.board[b] && v === this.state.board[c]) return v;
    }
    return this.state.board.every((cell) => cell !== null) ? "draw" : null;
  }
}
