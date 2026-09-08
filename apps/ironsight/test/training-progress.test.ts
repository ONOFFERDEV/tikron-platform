import { describe, expect, it } from 'vitest';
import { TrainingProgress } from '../client/training-progress.js';
import { ARENA2 } from '../src/map/arena2.js';
import { MODES } from '../src/config.js';

const goal = ARENA2.caps.a;
function prerequisites(p: TrainingProgress) {
  for (let i = 0; i <= 5; i++) p.sample(true, goal.x - 10 + i, goal.z, true, 100);
}
function hold(p: TrainingProgress, ms: number) {
  for (let t = 0; t < ms; t += 50) p.sample(true, goal.x, goal.z, false, Math.min(50, ms - t));
}

describe('training objective rehearsal', () => {
  it('requires movement and aim before a continuous neutral-capture hold', () => {
    const p = new TrainingProgress(false, goal);
    hold(p, 5000);
    expect(p.step).toBe(0);
    expect(p.heldMs).toBe(0);
    prerequisites(p);
    expect(p.step).toBe(4);
    p.sample(true, goal.x, goal.z, false, 50); // discontinuous arrival cannot count
    expect(p.heldMs).toBe(0);
    hold(p, 100000 / MODES.dom.capturePerSec - 50);
    expect(p.step).toBe(4);
    hold(p, 50);
    expect(p.step).toBe(5);
    p.confirmPing('self', 'self', true);
    expect(p.step).toBe(3);
    p.sample(false, 0, 0, false, 5000);
    expect(p.step).toBe(3); // learned lessons survive pauses/deaths
  });

  it('resets an unfinished hold outside the real capture radius and while inactive', () => {
    const p = new TrainingProgress(false, goal);
    prerequisites(p);
    hold(p, 1000);
    expect(p.heldMs).toBeGreaterThan(0);
    p.sample(true, goal.x + MODES.dom.captureRadius + .01, goal.z, false, 50);
    expect(p.heldMs).toBe(0);
    hold(p, 1000);
    p.sample(false, goal.x, goal.z, false, 1000);
    expect(p.heldMs).toBe(0);
    p.sample(true, goal.x, goal.z, false, 60000);
    expect(p.heldMs).toBe(100); // a stalled frame never skips the lesson
    expect(p.step).toBe(4);
  });

  it('retains Relay confirmed-hit and Switchyard exploration progression', () => {
    const relay = new TrainingProgress(true), exploration = new TrainingProgress(false);
    prerequisites(relay); prerequisites(exploration);
    expect(relay.step).toBe(2);
    expect(exploration.step).toBe(5);
    relay.confirmHit();
    expect(relay.step).toBe(5);
    relay.confirmPing('self', 'self', true);
    expect(relay.step).toBe(3);
  });

  it('requires an active own server echo during the ping lesson, never an earlier or ally mark', () => {
    const p = new TrainingProgress(false);
    p.confirmPing('self', 'self', true);
    prerequisites(p);
    expect(p.step).toBe(5);
    p.confirmPing('ally', 'self', true);
    p.confirmPing('self', 'self', false);
    expect(p.step).toBe(5);
    p.confirmPing('self', 'self', true);
    expect(p.step).toBe(3);
    p.sample(false, 0, 0, false, 1000);
    expect(p.step).toBe(3);
    expect(new TrainingProgress(false).step).toBe(0);
  });
});
