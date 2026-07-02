import { Room, type Client, type AOIConfig } from "./room.js";
import { LagCompensator } from "./lag-compensation.js";
import type { Codec } from "@tikron/schema";
import type { Vec2 } from "@tikron/sim";

/**
 * Genre presets — a one-decision surface over the {@link Room} core.
 *
 * The core is deliberately genre-agnostic (it knows nothing of ticks, codecs, or
 * interest management), which means assembling a room from first principles is a
 * series of correct-but-tedious choices: JSON or binary sync? a simulation tick?
 * acks? AOI? a reconnection window? These presets collapse that into **picking a
 * base class by genre**. Each one wires the right modules and owns the fiddly
 * lifecycle boilerplate (notably the reconnection try/catch), so game code writes
 * only game logic.
 *
 * ## Choosing a preset
 *
 * | Preset                | Use for                                              | Sync            | Tick | Reconnection      | You implement                          |
 * | --------------------- | ---------------------------------------------------- | --------------- | ---- | ----------------- | -------------------------------------- |
 * | {@link TurnBasedRoom} | card / board / turn / word games                     | JSON on mutation| no   | opt-in (manual)   | onCreate, onJoin, onLeave              |
 * | {@link CasualRealtimeRoom} | cursors, whiteboards, party games, shared canvases | JSON, throttled | no   | built-in (30s)    | onCreate, onJoin, onSeatExpired        |
 * | {@link IoArenaRoom}   | .io arenas, shooters, racers — continuous movement   | binary deltas   | yes  | built-in (30s)    | codec, onTick, onReady, onSeatExpired  |
 *
 * Rule of thumb: no continuous motion and turns alternate → `TurnBasedRoom`.
 * Everyone moves freely but you don't run physics every frame → `CasualRealtimeRoom`.
 * You integrate positions/collisions on a fixed timestep → `IoArenaRoom`.
 *
 * Outgrowing a preset is never a dead end: every preset is a thin `Room` subclass,
 * so you can drop back to the raw core and wire modules by hand at any time.
 */

/**
 * Use for: card, board, turn, and word games — anything where players act in
 * alternating turns and nothing moves between them.
 *
 * The genre-agnostic core, nothing added: state syncs as **JSON on mutation**
 * (mutate `this.state`, call `markStateChanged()`), there is **no simulation
 * tick**, and there is **no binary codec**. This is the lightest possible room —
 * a tic-tac-toe or poker table needs no more.
 *
 * Implement `onCreate` (initial state + `onMessage` handlers), `onJoin`, and
 * `onLeave`. If you want a disconnected player's seat held for a grace period,
 * call `allowReconnection` from `onLeave` yourself, or use {@link CasualRealtimeRoom}.
 *
 * ```ts
 * class Poker extends TurnBasedRoom<PokerState> {
 *   override onCreate() {
 *     this.setState({ pot: 0, turn: 0, hands: {} });
 *     this.onMessage("bet", (client, amount) => { ...; this.markStateChanged(); });
 *   }
 * }
 * ```
 */
export abstract class TurnBasedRoom<TState = unknown> extends Room<TState> {}

/**
 * Use for: cursors, whiteboards, shared canvases, party games — everyone moves
 * freely and you sync on change, but you do NOT run a physics tick.
 *
 * Adds two things over the core: state syncs as **throttled JSON** (all mutations
 * in a {@link Room.syncIntervalMs}-window ~20 Hz coalesce into one broadcast), and
 * a **built-in reconnection window** — a dropped player's seat (id, `client.data`,
 * their entry in `this.state`) is held for {@link reconnectWindowSec} seconds so a
 * tab-switch or network blip doesn't wipe them. You never write the
 * `allowReconnection` try/catch: override {@link onSeatExpired} to clean up a
 * player once their window really lapses.
 *
 * Implement `onCreate` (initial state + handlers), `onJoin`, and `onSeatExpired`.
 *
 * ```ts
 * class Whiteboard extends CasualRealtimeRoom<BoardState> {
 *   override onCreate() { this.setState({ strokes: [], cursors: {} }); ... }
 *   override onJoin(c: Client) { this.state.cursors[c.id] = { x: 0, y: 0 }; this.markStateChanged(); }
 *   protected override onSeatExpired(c: Client) { delete this.state.cursors[c.id]; this.markStateChanged(); }
 * }
 * ```
 */
export abstract class CasualRealtimeRoom<TState = unknown> extends Room<TState> {
  /** Seconds a dropped player's seat is held open for reconnection (default 30). */
  protected reconnectWindowSec = 30;

  /**
   * Holds the seat for {@link reconnectWindowSec} on disconnect, then calls
   * {@link onSeatExpired} exactly once if the player never returns. Override
   * `onSeatExpired`, not this — replacing `onLeave` opts out of reconnection.
   */
  override async onLeave(client: Client): Promise<void> {
    try {
      await this.allowReconnection(client, this.reconnectWindowSec);
    } catch {
      await this.onSeatExpired(client);
    }
  }

  /**
   * Called once a held seat's reconnection window expires (a real leave). Remove
   * the player from `this.state` here and call `markStateChanged()`. Default: no-op.
   */
  protected onSeatExpired(_client: Client): void | Promise<void> {}
}

/**
 * Use for: .io arenas, shooters, racers — anything with continuous movement that
 * you simulate on a fixed timestep.
 *
 * The full realtime stack, wired for you: **binary delta sync** (you supply the
 * {@link codec}), a **fixed-timestep simulation loop** at {@link tickMs} that calls
 * your {@link onTick} and then flushes state, **input acks** on (so clients can
 * reconcile prediction), an optional **{@link aoi} interest-management filter**
 * (each client only receives entities within view — a bandwidth win and an
 * anti-wallhack security boundary), and the same **built-in reconnection window**
 * as {@link CasualRealtimeRoom}. For anti-cheat on client-sent positions, use the
 * re-exported {@link validateMovement} helper in your handlers.
 *
 * Implement the {@link codec} property, {@link onTick} (per-frame simulation),
 * {@link onReady} (initial state + `onMessage` handlers — this runs in place of
 * `onCreate`, which the preset owns), and optionally {@link onSeatExpired}.
 *
 * ```ts
 * class Arena extends IoArenaRoom<ArenaState> {
 *   protected readonly codec = ArenaSchema;            // binary state codec
 *   protected override aoi = { viewRadius: 500, mapFields: ["players"], position: e => e as Vec2, viewer: (s, id) => s.players[id] ?? null };
 *   protected override onReady() { this.setState({ players: {} }); this.onMessage("move", ...); }
 *   protected override onTick(dtMs: number) { ...integrate positions... }
 *   protected override onSeatExpired(c: Client) { delete this.state.players[c.id]; }
 * }
 * ```
 */
export abstract class IoArenaRoom<TState = unknown> extends CasualRealtimeRoom<TState> {
  /**
   * The binary state codec (from `@tikron/schema`). Realtime rooms sync binary
   * deltas, not JSON, so this is required — implement it as a class field:
   * `protected readonly codec = schema({...})`.
   */
  protected abstract readonly codec: Codec<TState>;

  /** Fixed simulation-tick interval in ms (default 50 ≈ 20 Hz). */
  protected tickMs = 50;

  /**
   * Optional interest-management config. When set, each client receives only the
   * entities within `viewRadius` of its viewpoint (bandwidth + anti-wallhack).
   */
  protected aoi?: AOIConfig<TState>;

  /**
   * Enable server-side lag compensation. When true, the preset records the
   * positions from {@link lagSnapshot} after every tick, and {@link rewind}
   * returns the world as a given client saw it (RTT + interpolation delay ago) so
   * hit checks resolve against what the shooter aimed at. Override `lagSnapshot`
   * to declare which entities to track. Default: off.
   */
  protected lagCompensation = false;

  /** How far back (ms) rewind history is kept. See {@link LagCompensatorOptions}. */
  protected lagCompensationDepthMs = 250;

  /**
   * Extra ms subtracted on {@link rewind}, on top of the client's RTT, to account
   * for the client's own interpolation delay (it renders the world this far in the
   * past). Match your client interpolation buffer; default 100 (~2 ticks at 20 Hz).
   */
  protected lagInterpolationMs = 100;

  #lag: LagCompensator | null = null;

  /**
   * Wires the realtime stack (codec, acks, AOI, tick) then runs your {@link onReady}.
   * The preset owns `onCreate`; put your one-time setup in `onReady` instead.
   */
  override async onCreate(): Promise<void> {
    const codec = this.codec;
    if (!codec) {
      throw new Error(
        "IoArenaRoom requires a binary stateCodec. Fix: implement " +
          "`protected readonly codec = schema({...})` from @tikron/schema " +
          "(realtime arenas sync binary deltas, not JSON).",
      );
    }
    this.stateCodec = codec;
    this.sendAcks = true; // clients reconcile predicted movement against acked input
    this.queueInputs = true; // inputs drain at each tick so onTick sees a consistent world
    await this.onReady();
    if (this.aoi) this.enableAOI(this.aoi); // guarded: throws if the codec is missing
    if (this.lagCompensation) {
      this.#lag = new LagCompensator({ depthMs: this.lagCompensationDepthMs });
    }
    // Start the loop only after onReady has seeded state, so onTick never runs first.
    this.setSimulationInterval((dtMs) => {
      this.onTick(dtMs);
      // Record post-tick positions for rewind (only when lag compensation is on).
      this.#lag?.record(this.currentTick, Date.now(), this.lagSnapshot());
      this.markStateChanged(); // periodic authoritative frame (delta is a no-op if unchanged)
    }, this.tickMs);
  }

  /**
   * The entity positions to record for {@link rewind}, called after each tick when
   * {@link lagCompensation} is on. Override to return your tracked entities (e.g.
   * players), keyed by id. Default: empty (rewind returns nothing until overridden).
   *
   * ```ts
   * protected override lagSnapshot() {
   *   return new Map(Object.entries(this.state.players).map(([id, p]) => [id, { x: p.x, y: p.y }]));
   * }
   * ```
   */
  protected lagSnapshot(): Map<string, Vec2> {
    return new Map();
  }

  /**
   * The recorded world as `client` saw it, for server-side hit registration.
   * Requires {@link lagCompensation}.
   *
   * With no `atMs`, rewinds by the client's RTT plus {@link lagInterpolationMs} —
   * the right estimate when the input carries no timing. When the client opts into
   * subtick timestamps, pass the input's clamped `input.ts` (already an absolute
   * server-timeline instant, so it is used directly): this pins the rewind to the
   * exact moment the shooter aimed, independent of the tick rate (the CS2 model).
   *
   * ```ts
   * // no subtick timing — RTT-based estimate
   * this.onMessage("shoot", (client, aim) => {
   *   const world = this.rewind(client);          // where targets were on the shooter's screen
   *   const hit = world.get(targetId);
   *   if (hit && near(aim, hit)) score(client);
   * });
   *
   * // subtick timing (client `subtickTimestamps: true`) — pin to the exact instant
   * this.onMessage("shoot", (client, aim, _seq, input) => {
   *   const world = this.rewind(client, input?.ts);
   *   // ...resolve the hit against `world`
   * });
   * ```
   */
  protected rewind(client: Client, atMs?: number): Map<string, Vec2> {
    if (!this.#lag) {
      throw new Error(
        "rewind() requires lag compensation. Fix: set this.lagCompensation = true in onReady() " +
          "and override lagSnapshot() to return the entities to track.",
      );
    }
    const at = typeof atMs === "number" ? atMs : Date.now() - client.rttMs - this.lagInterpolationMs;
    return this.#lag.atTime(at);
  }

  /**
   * One-time room setup: seed `this.state` and register `onMessage` handlers here
   * (the realtime `IoArenaRoom` owns `onCreate`, so this is your equivalent hook).
   */
  protected onReady(): void | Promise<void> {}

  /**
   * Advance the simulation by `dtMs` (the elapsed time since the previous tick).
   * Integrate positions, resolve collisions, expire entities, etc. State is flushed
   * automatically after each tick — you do not call `markStateChanged()` here.
   */
  protected abstract onTick(dtMs: number): void;
}
