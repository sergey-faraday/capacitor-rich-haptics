import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patterns } from './patterns';
import { RichHaptics } from './plugin';
import { msPerBeat, startBPMLoop } from './sync';

vi.mock('./plugin', () => ({
  RichHaptics: {
    playPattern: vi.fn().mockResolvedValue(undefined),
  },
}));
const playPattern = RichHaptics.playPattern as ReturnType<typeof vi.fn>;

describe('msPerBeat', () => {
  it('60 BPM = 1000 ms', () => {
    expect(msPerBeat(60)).toBe(1000);
  });
  it('120 BPM = 500 ms', () => {
    expect(msPerBeat(120)).toBe(500);
  });
  it('240 BPM = 250 ms', () => {
    expect(msPerBeat(240)).toBe(250);
  });
});

describe('startBPMLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    playPattern.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws on non-positive bpm', () => {
    expect(() => startBPMLoop({ bpm: 0, pattern: patterns.heartbeat })).toThrow();
    expect(() => startBPMLoop({ bpm: -10, pattern: patterns.heartbeat })).toThrow();
  });

  it('fires immediately on start by default', () => {
    const handle = startBPMLoop({ bpm: 120, pattern: patterns.heartbeat, count: 1 });
    expect(playPattern).toHaveBeenCalledTimes(1);
    handle.stop();
  });

  it('fires every (60000 / bpm * every) ms', () => {
    const handle = startBPMLoop({ bpm: 120, pattern: patterns.heartbeat });
    // bpm 120 = 500ms/beat
    expect(playPattern).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(playPattern).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(500);
    expect(playPattern).toHaveBeenCalledTimes(3);
    handle.stop();
  });

  it('respects count', () => {
    const handle = startBPMLoop({ bpm: 600, pattern: patterns.heartbeat, count: 3 });
    expect(playPattern).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);
    expect(playPattern).toHaveBeenCalledTimes(3);
    expect(handle.running).toBe(false);
  });

  it('respects every (skip beats)', () => {
    const handle = startBPMLoop({ bpm: 120, pattern: patterns.heartbeat, every: 2 });
    // bpm 120 every=2 → 1000ms between fires
    expect(playPattern).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(playPattern).toHaveBeenCalledTimes(1); // still
    vi.advanceTimersByTime(500);
    expect(playPattern).toHaveBeenCalledTimes(2);
    handle.stop();
  });

  it('fireImmediately:false delays the first beat', () => {
    const handle = startBPMLoop({
      bpm: 120,
      pattern: patterns.heartbeat,
      fireImmediately: false,
    });
    expect(playPattern).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(500);
    expect(playPattern).toHaveBeenCalledTimes(1);
    handle.stop();
  });

  it('stop() halts further fires (idempotent)', () => {
    const handle = startBPMLoop({ bpm: 120, pattern: patterns.heartbeat });
    expect(playPattern).toHaveBeenCalledTimes(1);
    handle.stop();
    handle.stop(); // idempotent
    vi.advanceTimersByTime(5000);
    expect(playPattern).toHaveBeenCalledTimes(1);
    expect(handle.running).toBe(false);
  });
});
