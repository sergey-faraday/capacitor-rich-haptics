import type { RichHapticsPlugin } from './definitions';
import { RichHaptics as defaultPlugin } from './plugin';

/**
 * Recorded plugin call: the method name, its arguments, and the wall-clock
 * offset (ms) since recording began.
 */
export interface RecordedHapticCall {
  /** Method on `RichHapticsPlugin` (e.g. 'preset', 'play', 'playPattern'). */
  method: string;
  /** Argument list passed to the method (usually 0 or 1 entries). */
  args: unknown[];
  /** Milliseconds since recording started. */
  at: number;
}

export interface HapticRecording {
  events: RecordedHapticCall[];
  /** Total duration of the recording (ms from first to last event). */
  duration: number;
  /** Wall-clock time when recording started (Date.now()). */
  startedAt: number;
}

const RECORDED_METHODS = [
  'play',
  'preset',
  'playPattern',
  'playAHAP',
  'playAHAPFromString',
  'playPreloaded',
  'startContinuous',
  'updateParameters',
  'stopPlayer',
  'stop',
] as const;

type RecordedMethod = (typeof RECORDED_METHODS)[number];

export interface HapticRecorder {
  /** Begin recording subsequent plugin calls. Idempotent — re-arms a fresh recording. */
  start(): void;
  /** Stop recording and return the captured trace. */
  stop(): HapticRecording;
  /** Whether recording is currently active. */
  readonly active: boolean;
  /**
   * Replay a recording by scheduling each call at its original offset. Returns
   * a handle whose `cancel()` aborts any in-flight scheduled calls. Resolves
   * when the last event has fired (or immediately on cancel).
   */
  replay(recording: HapticRecording): { promise: Promise<void>; cancel: () => void };
}

/**
 * Wrap a plugin instance in a recorder. The wrapped plugin is API-identical
 * but logs every call when `start()` has been invoked. Useful for designer
 * workflows ("hold the button while I tweak the dial, save the trace") and
 * E2E test fixtures.
 *
 * The recorder does NOT hijack the global `RichHaptics` import — pass it the
 * plugin instance you want to wrap (or none, to wrap the default).
 *
 * @example
 * import { RichHaptics, createHapticRecorder } from 'capacitor-rich-haptics';
 *
 * const recorder = createHapticRecorder();
 * recorder.start();
 * await RichHaptics.preset({ name: 'softTap' });
 * await new Promise(r => setTimeout(r, 200));
 * await RichHaptics.preset({ name: 'success' });
 * const recording = recorder.stop();
 *
 * // Later — replay the same trace exactly:
 * await recorder.replay(recording).promise;
 *
 * Note: replay() uses `setTimeout`, so timing is best-effort. Sub-10ms accuracy
 * isn't guaranteed under JS event-loop pressure.
 */
export function createHapticRecorder(plugin: RichHapticsPlugin = defaultPlugin): HapticRecorder {
  let recording = false;
  let events: RecordedHapticCall[] = [];
  let startedAt = 0;

  // Patch each recordable method on the plugin in place. Restore on stop().
  // We keep a map of original references so re-arming and stopping is safe.
  let originals: Partial<Record<RecordedMethod, (...args: unknown[]) => unknown>> = {};

  const arm = () => {
    const target = plugin as unknown as Record<string, (...args: unknown[]) => unknown>;
    for (const name of RECORDED_METHODS) {
      const fn = target[name];
      if (typeof fn !== 'function') continue;
      const original = fn.bind(target);
      originals[name] = original;
      target[name] = ((...args: unknown[]) => {
        if (recording) {
          events.push({ method: name, args, at: Date.now() - startedAt });
        }
        return original(...args);
      }) as typeof fn;
    }
  };

  const restore = () => {
    const target = plugin as unknown as Record<string, (...args: unknown[]) => unknown>;
    for (const name of RECORDED_METHODS) {
      const orig = originals[name];
      if (orig) target[name] = orig;
    }
    originals = {};
  };

  return {
    get active() {
      return recording;
    },

    start(): void {
      if (recording) return;
      events = [];
      startedAt = Date.now();
      recording = true;
      if (Object.keys(originals).length === 0) arm();
    },

    stop(): HapticRecording {
      if (!recording) {
        return { events: [], duration: 0, startedAt: Date.now() };
      }
      recording = false;
      restore();
      const captured = events.slice();
      events = [];
      const duration = captured.length > 0 ? captured[captured.length - 1].at : 0;
      return { events: captured, duration, startedAt };
    },

    replay(rec: HapticRecording): { promise: Promise<void>; cancel: () => void } {
      const target = plugin as unknown as Record<string, (...args: unknown[]) => unknown>;
      const handles: ReturnType<typeof setTimeout>[] = [];
      let cancelled = false;
      let resolveReplay: (() => void) | null = null;

      const promise = new Promise<void>((resolve) => {
        resolveReplay = resolve;
        if (rec.events.length === 0) {
          resolve();
          return;
        }

        let remaining = rec.events.length;
        for (const ev of rec.events) {
          const handle = setTimeout(() => {
            if (cancelled) return;
            const fn = target[ev.method];
            if (typeof fn === 'function') {
              try {
                const result = fn(...ev.args);
                if (result instanceof Promise)
                  result.catch(() => {
                    /* noop */
                  });
              } catch {
                /* noop */
              }
            }
            remaining -= 1;
            if (remaining === 0) {
              resolveReplay = null;
              resolve();
            }
          }, ev.at);
          handles.push(handle);
        }
      });

      return {
        promise,
        cancel: () => {
          cancelled = true;
          handles.forEach(clearTimeout);
          handles.length = 0;
          if (resolveReplay !== null) {
            const resolve = resolveReplay;
            resolveReplay = null;
            resolve();
          }
        },
      };
    },
  };
}
