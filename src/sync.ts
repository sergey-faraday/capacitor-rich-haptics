import type { AHAPPattern } from './definitions';
import { RichHaptics } from './plugin';

export interface BPMLoopOptions {
  /** Beats per minute. */
  bpm: number;
  /** Pattern to fire on each beat. */
  pattern: AHAPPattern;
  /** Beats between hits. Default 1 (every beat). 2 = half-time, 4 = whole-note. */
  every?: number;
  /** Number of beats to play. Default Infinity. */
  count?: number;
  /** Fire the first beat immediately on start (vs after one interval). Default true. */
  fireImmediately?: boolean;
}

export interface BPMLoopHandle {
  /** Stop the loop. Idempotent. */
  stop: () => void;
  /** True if the loop is still active. */
  readonly running: boolean;
}

/**
 * Start a metronomic haptic loop locked to a BPM. Returns a handle you must
 * `stop()` to cancel — otherwise it runs forever (or until `count` is reached).
 *
 * @example
 * // Kick drum on every beat at 120 BPM
 * const loop = startBPMLoop({ bpm: 120, pattern: patterns.drumKick });
 * // ...later
 * loop.stop();
 *
 * @example
 * // Snare on every other beat (back-beat) for 16 beats
 * startBPMLoop({ bpm: 100, pattern: patterns.drumSnare, every: 2, count: 16 });
 */
export function startBPMLoop(options: BPMLoopOptions): BPMLoopHandle {
  const { bpm, pattern, every = 1, count = Infinity, fireImmediately = true } = options;
  if (bpm <= 0) throw new Error('bpm must be positive');

  const intervalMs = (60_000 / bpm) * every;
  let fired = 0;
  let stopped = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const tick = () => {
    if (stopped || fired >= count) return;
    fired++;
    RichHaptics.playPattern({ pattern }).catch(() => {
      /* noop */
    });
    timerId = setTimeout(tick, intervalMs);
  };

  if (fireImmediately) {
    tick();
  } else {
    timerId = setTimeout(tick, intervalMs);
  }

  return {
    stop: () => {
      stopped = true;
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    },
    get running() {
      return !stopped && fired < count;
    },
  };
}

/**
 * Convenience: convert BPM to milliseconds per beat.
 *
 * @example
 * msPerBeat(120) // → 500
 */
export function msPerBeat(bpm: number): number {
  return 60_000 / bpm;
}
