import type { AHAPPattern, HapticPreset, PlayOptions } from './definitions';
import { RichHaptics } from './plugin';

/**
 * Steps that can appear in a haptic sequence. Use the helpers below to
 * construct them; you should rarely build these objects by hand.
 */
export type SequenceStep =
  | { type: 'preset'; name: HapticPreset }
  | { type: 'play'; options: PlayOptions }
  | { type: 'pattern'; pattern: AHAPPattern }
  | { type: 'wait'; ms: number }
  | { type: 'custom'; run: () => void | Promise<void> }
  | { type: 'sequence'; steps: SequenceStep[] };

// ─── Step constructors ────────────────────────────────────────────────────

/** Fire a cross-platform UX preset. */
export const preset = (name: HapticPreset): SequenceStep => ({ type: 'preset', name });

/** Fire a single haptic with custom intensity / sharpness / duration. */
export const play = (options: PlayOptions): SequenceStep => ({ type: 'play', options });

/** Fire a multi-event AHAP pattern. */
export const pattern = (p: AHAPPattern): SequenceStep => ({ type: 'pattern', pattern: p });

/** Pause `ms` milliseconds before the next step. */
export const wait = (ms: number): SequenceStep => ({ type: 'wait', ms });

/**
 * Run any side effect at this point in the sequence. Useful for analytics,
 * logging, or playing audio cues that aren't part of the haptic engine.
 */
export const custom = (run: () => void | Promise<void>): SequenceStep => ({ type: 'custom', run });

// ─── Sequence ────────────────────────────────────────────────────────────

export interface SequenceHandle {
  /** Resolves when the sequence finishes naturally. Rejects only on cancel. */
  promise: Promise<void>;
  /** Whether the sequence is still running. */
  readonly running: boolean;
  /** Cancel any pending steps. The promise resolves anyway (no rejection). */
  cancel(): void;
}

export interface HapticSequence {
  /** The flattened list of steps (sub-sequences inlined). */
  readonly steps: readonly SequenceStep[];
  /** Begin executing the sequence. Returns a handle for cancellation/awaiting. */
  play(): SequenceHandle;
  /** Repeat the entire sequence `count` times. Returns a NEW sequence (immutable). */
  repeat(count: number): HapticSequence;
  /** Concatenate another sequence after this one. Returns a NEW sequence. */
  then(other: HapticSequence | SequenceStep): HapticSequence;
  /** Total wait time in milliseconds (excluding execution overhead). */
  readonly duration: number;
}

/**
 * Compose haptic events into an ordered timeline. Cleaner than `setTimeout`
 * chains — and reusable.
 *
 * @example
 * import { sequence, preset, wait, pattern } from 'capacitor-rich-haptics/sequence';
 * import { patterns } from 'capacitor-rich-haptics';
 *
 * const intro = sequence(
 *   preset('softTap'),
 *   wait(200),
 *   preset('success'),
 *   wait(500),
 *   pattern(patterns.coinFlip),
 * );
 *
 * await intro.play().promise;
 *
 * @example
 * // Repeat + chain:
 * const heartbeat = sequence(preset('softTap'), wait(150), preset('softTap'), wait(700));
 * await heartbeat.repeat(3).play().promise;
 *
 * @example
 * // Cancellable:
 * const handle = sequence(preset('warning'), wait(2000), preset('error')).play();
 * setTimeout(() => handle.cancel(), 500);
 */
export function sequence(...steps: SequenceStep[]): HapticSequence {
  const flat = flatten(steps);
  return makeSequence(flat);
}

function flatten(steps: SequenceStep[]): SequenceStep[] {
  const out: SequenceStep[] = [];
  for (const s of steps) {
    if (s.type === 'sequence') out.push(...flatten(s.steps));
    else out.push(s);
  }
  return out;
}

function makeSequence(steps: SequenceStep[]): HapticSequence {
  const duration = steps.reduce((sum, s) => sum + (s.type === 'wait' ? s.ms : 0), 0);

  return {
    steps,
    duration,

    play(): SequenceHandle {
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let running = true;

      const promise = (async () => {
        for (const step of steps) {
          if (cancelled) break;
          await runStep(step);
          if (cancelled) break;
        }
        running = false;
      })();

      function runStep(step: SequenceStep): Promise<void> {
        switch (step.type) {
          case 'preset':
            return RichHaptics.preset({ name: step.name }).catch(() => undefined);
          case 'play':
            return RichHaptics.play(step.options).catch(() => undefined);
          case 'pattern':
            return RichHaptics.playPattern({ pattern: step.pattern }).catch(() => undefined);
          case 'wait':
            return new Promise((resolve) => {
              timer = setTimeout(() => {
                timer = null;
                resolve();
              }, step.ms);
            });
          case 'custom':
            try {
              const r = step.run();
              return r instanceof Promise ? r.catch(() => undefined) : Promise.resolve();
            } catch {
              return Promise.resolve();
            }
          case 'sequence':
            // Already flattened — should not occur, but be safe.
            return Promise.resolve();
        }
      }

      return {
        promise,
        get running() {
          return running;
        },
        cancel() {
          cancelled = true;
          running = false;
          if (timer !== null) {
            clearTimeout(timer);
            timer = null;
          }
        },
      };
    },

    repeat(count: number): HapticSequence {
      if (count < 1) return makeSequence([]);
      const repeated: SequenceStep[] = [];
      for (let i = 0; i < count; i++) repeated.push(...steps);
      return makeSequence(repeated);
    },

    then(other: HapticSequence | SequenceStep): HapticSequence {
      const more = isSequence(other) ? other.steps : [other];
      return makeSequence([...steps, ...flatten([...more])]);
    },
  };
}

function isSequence(x: unknown): x is HapticSequence {
  return typeof x === 'object' && x !== null && 'steps' in x && 'play' in x;
}
