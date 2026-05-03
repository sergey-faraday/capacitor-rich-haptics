import type {
  AHAPDynamicParameterID,
  AHAPElement,
  AHAPEvent,
  AHAPEventParameter,
  AHAPParameterCurveControlPoint,
  AHAPPattern,
  AndroidPrimitive,
} from './definitions';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * Fluent builder for AHAP patterns. Tracks a relative time cursor that
 * `wait()` advances; events without an explicit time use the cursor.
 *
 * @example
 * const p = ahap()
 *   .tap({ intensity: 1.0, sharpness: 0.9 })
 *   .wait(0.2)
 *   .continuous({ duration: 0.5, intensity: 0.6, sharpness: 0.2 })
 *   .rampIntensity({ from: 0.6, to: 0.0, duration: 0.5 })
 *   .build();
 */
export class AHAPBuilder {
  private elements: AHAPElement[] = [];
  private cursor = 0;
  private metadata: Record<string, unknown> = {};
  /** When set, the next ramp() defaults its time to this (the start of the most
   * recent continuous event), so chained ramps overlap with the continuous they
   * modulate. Reset by tap/wait/audio/at. */
  private lastContinuousStart: number | null = null;

  /** Add a single transient (instant) haptic tap at the current cursor. */
  tap(
    opts: {
      intensity?: number;
      sharpness?: number;
      time?: number;
      androidPrimitive?: AndroidPrimitive;
    } = {},
  ): this {
    const time = opts.time ?? this.cursor;
    const event: AHAPEvent = {
      Time: time,
      EventType: 'HapticTransient',
      EventParameters: [
        { ParameterID: 'HapticIntensity', ParameterValue: clamp01(opts.intensity ?? 1) },
        { ParameterID: 'HapticSharpness', ParameterValue: clamp01(opts.sharpness ?? 0.5) },
      ],
    };
    if (opts.androidPrimitive) event._androidPrimitive = opts.androidPrimitive;
    this.elements.push({ Event: event });
    this.lastContinuousStart = null;
    return this;
  }

  /** Add a sustained continuous haptic at the current cursor. */
  continuous(opts: {
    duration: number;
    intensity?: number;
    sharpness?: number;
    time?: number;
    attack?: number;
    decay?: number;
    release?: number;
    sustained?: boolean;
    androidPrimitive?: AndroidPrimitive;
  }): this {
    const time = opts.time ?? this.cursor;
    const params: AHAPEventParameter[] = [
      { ParameterID: 'HapticIntensity', ParameterValue: clamp01(opts.intensity ?? 1) },
      { ParameterID: 'HapticSharpness', ParameterValue: clamp01(opts.sharpness ?? 0.5) },
    ];
    if (opts.attack !== undefined) {
      params.push({ ParameterID: 'AttackTime', ParameterValue: opts.attack });
    }
    if (opts.decay !== undefined) {
      params.push({ ParameterID: 'DecayTime', ParameterValue: opts.decay });
    }
    if (opts.release !== undefined) {
      params.push({ ParameterID: 'ReleaseTime', ParameterValue: opts.release });
    }
    if (opts.sustained !== undefined) {
      params.push({ ParameterID: 'Sustained', ParameterValue: opts.sustained ? 1 : 0 });
    }

    const event: AHAPEvent = {
      Time: time,
      EventType: 'HapticContinuous',
      EventDuration: opts.duration,
      EventParameters: params,
    };
    if (opts.androidPrimitive) event._androidPrimitive = opts.androidPrimitive;
    this.elements.push({ Event: event });
    this.cursor = time + opts.duration;
    this.lastContinuousStart = time;
    return this;
  }

  /** Reference an audio file previously registered via `registerAudio` (iOS only). */
  audio(opts: { id: string; time?: number; volume?: number; pitch?: number; pan?: number }): this {
    const params: AHAPEventParameter[] = [];
    if (opts.volume !== undefined) {
      params.push({ ParameterID: 'AudioVolume', ParameterValue: clamp01(opts.volume) });
    }
    if (opts.pitch !== undefined) {
      params.push({ ParameterID: 'AudioPitch', ParameterValue: opts.pitch });
    }
    if (opts.pan !== undefined) {
      params.push({ ParameterID: 'AudioPan', ParameterValue: opts.pan });
    }

    const event: AHAPEvent = {
      Time: opts.time ?? this.cursor,
      EventType: 'AudioCustom',
      EventWaveformPath: opts.id,
      ...(params.length > 0 ? { EventParameters: params } : {}),
    };
    this.elements.push({ Event: event });
    this.lastContinuousStart = null;
    return this;
  }

  /** Advance the cursor by `seconds`. */
  wait(seconds: number): this {
    this.cursor += seconds;
    this.lastContinuousStart = null;
    return this;
  }

  /** Set the cursor absolutely. */
  at(seconds: number): this {
    this.cursor = seconds;
    this.lastContinuousStart = null;
    return this;
  }

  /**
   * Add a parameter curve that ramps a dynamic parameter (e.g. HapticIntensityControl)
   * from `from` to `to` over `duration` seconds.
   *
   * **Default time:** if a `continuous()` was the most recent non-ramp call, the
   * ramp defaults to that continuous event's start time so they overlap. Otherwise
   * the ramp starts at the current cursor. Override with `time: <seconds>`.
   */
  ramp(opts: { parameter: AHAPDynamicParameterID; from: number; to: number; duration: number; time?: number }): this {
    const startTime = opts.time ?? this.lastContinuousStart ?? this.cursor;
    const points: AHAPParameterCurveControlPoint[] = [
      { Time: 0, ParameterValue: opts.from },
      { Time: opts.duration, ParameterValue: opts.to },
    ];
    this.elements.push({
      ParameterCurve: {
        ParameterID: opts.parameter,
        Time: startTime,
        ParameterCurveControlPoints: points,
      },
    });
    return this;
  }

  /** Convenience: ramp HapticIntensityControl. */
  rampIntensity(opts: { from: number; to: number; duration: number; time?: number }): this {
    return this.ramp({ parameter: 'HapticIntensityControl', ...opts });
  }

  /** Convenience: ramp HapticSharpnessControl. */
  rampSharpness(opts: { from: number; to: number; duration: number; time?: number }): this {
    return this.ramp({ parameter: 'HapticSharpnessControl', ...opts });
  }

  /** Attach metadata (free-form) to the final pattern. */
  meta(key: string, value: unknown): this {
    this.metadata[key] = value;
    return this;
  }

  /** Build the final AHAPPattern object. */
  build(): AHAPPattern {
    const pattern: AHAPPattern = {
      Version: 1,
      Pattern: [...this.elements],
    };
    if (Object.keys(this.metadata).length > 0) {
      pattern.Metadata = { ...this.metadata };
    }
    return pattern;
  }
}

/** Start a new AHAP pattern builder. */
export function ahap(): AHAPBuilder {
  return new AHAPBuilder();
}
