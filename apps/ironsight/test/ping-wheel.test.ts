import { expect, it } from 'vitest';
import { PingGesture } from '../client/ping-gesture.js';

it('distinguishes taps from holds, including release before a delayed frame', () => {
  const gesture = new PingGesture();
  gesture.begin('KeyV', 100);
  expect(gesture.release('KeyQ', 200)).toBeUndefined();
  expect(gesture.release('KeyV', 349)).toBe('context');
  gesture.begin('KeyV', 500);
  expect(gesture.release('KeyV', 750)).toBeUndefined();
  expect(gesture.open).toBe(false);
});

it('selects explicit directions, freezes look only while open and cancels safely', () => {
  const gesture = new PingGesture();
  for (const [x, y, expected] of [[0, -60, 'context'], [-60, 0, 'go'], [60, 0, 'backup']] as const) {
    gesture.begin('KeyQ', 0);
    expect(gesture.move(10, 10, 100)).toBe(false);
    expect(gesture.move(x, y, 250)).toBe(true);
    expect(gesture.release('KeyQ', 300)).toBe(expected);
  }
  gesture.begin('KeyQ', 0); gesture.move(60, 0, 300); gesture.move(-60, 0, 310);
  expect(gesture.release('KeyQ', 400)).toBeUndefined();
  gesture.begin('KeyQ', 0); gesture.move(60, 0, 300); gesture.cancel();
  expect(gesture.release('KeyQ', 400)).toBeUndefined();
  gesture.update(500); expect(gesture.open).toBe(false);
});
