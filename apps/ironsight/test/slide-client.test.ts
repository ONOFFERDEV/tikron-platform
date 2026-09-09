import { describe, expect, it } from 'vitest';
import { Predictor } from '../client/predict.js';
import { ARENA1 } from '../src/map/arena1.js';
import { TICK_MS } from '../src/config.js';

describe('local slide prediction', () => {
  it('matches the room 6.4 m trajectory and resets momentum across death/respawn', () => {
    const p = new Predictor(ARENA1); p.reconcile({ x: 55, y: 0, z: 27 });
    const sprint = { mx: 0, mz: 1, sprint: true, crouch: false, jump: false };
    for (let i = 0; i < 6; i++) p.frame(TICK_MS, sprint, Math.PI / 2);
    expect(p.pos.x).toBeCloseTo(57.7);
    for (let i = 0; i < 16; i++) p.frame(TICK_MS, { ...sprint, crouch: true }, Math.PI / 2);
    expect(p.pos.x).toBeCloseTo(64.1); expect(p.isSliding).toBe(false);
    for (let i = 0; i < 30; i++) p.frame(TICK_MS, sprint, Math.PI / 2);
    p.frame(TICK_MS, { ...sprint, crouch: true }, Math.PI / 2);
    expect(p.isSliding).toBe(true);
    p.setAlive(false); expect(p.isSliding).toBe(false);
    p.setAlive(true); p.reconcile({ x: 55, y: 0, z: 27 });
    p.frame(TICK_MS, { ...sprint, crouch: true }, Math.PI / 2);
    expect(p.isSliding).toBe(false); expect(p.pos.x).toBeCloseTo(55.15);
  });
});
