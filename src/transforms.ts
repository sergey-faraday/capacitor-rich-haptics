import type { AHAPElement, AHAPEvent, AHAPEventParameter, AHAPParameterCurve, AHAPPattern } from './definitions';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

const isEvent = (el: AHAPElement): el is { Event: AHAPEvent } => 'Event' in el;
const isParameterCurve = (el: AHAPElement): el is { ParameterCurve: AHAPParameterCurve } => 'ParameterCurve' in el;

/**
 * Total duration of a pattern in seconds — the latest end-time across all
 * events and parameter curves. Useful for sequencing or progress UIs.
 *
 * @example
 * getPatternDuration(patterns.heartbeat)  // → ~0.9
 */
export function getPatternDuration(pattern: AHAPPattern): number {
  return patternEnd(pattern);
}

function patternEnd(pattern: AHAPPattern): number {
  let end = 0;
  for (const el of pattern.Pattern) {
    if (isEvent(el)) {
      const evEnd = el.Event.Time + (el.Event.EventDuration ?? 0);
      if (evEnd > end) end = evEnd;
    } else if (isParameterCurve(el)) {
      const points = el.ParameterCurve.ParameterCurveControlPoints;
      const last = points[points.length - 1];
      const evEnd = el.ParameterCurve.Time + (last?.Time ?? 0);
      if (evEnd > end) end = evEnd;
    }
  }
  return end;
}

function shiftTime(el: AHAPElement, delta: number): AHAPElement {
  if (isEvent(el)) {
    return { Event: { ...el.Event, Time: el.Event.Time + delta } };
  }
  if (isParameterCurve(el)) {
    return { ParameterCurve: { ...el.ParameterCurve, Time: el.ParameterCurve.Time + delta } };
  }
  return el;
}

/**
 * Concatenate two or more patterns serially. Each pattern starts where the
 * previous one ended (with optional `gap` seconds between).
 *
 * @example
 * combine(patterns.heartbeat, patterns.successFanfare)
 * combine(patterns.heartbeat, patterns.heartbeat, { gap: 0.5 })
 */
export function combine(...args: AHAPPattern[] | [...AHAPPattern[], { gap?: number }]): AHAPPattern {
  let opts: { gap?: number } = {};
  let parts: AHAPPattern[];
  const last = args[args.length - 1];
  if (last && typeof last === 'object' && !('Pattern' in last)) {
    opts = last as { gap?: number };
    parts = args.slice(0, -1) as AHAPPattern[];
  } else {
    parts = args as AHAPPattern[];
  }
  const gap = opts.gap ?? 0;

  const out: AHAPElement[] = [];
  let cursor = 0;
  for (const part of parts) {
    for (const el of part.Pattern) out.push(shiftTime(el, cursor));
    cursor += patternEnd(part) + gap;
  }
  return { Version: 1, Pattern: out };
}

/**
 * Repeat a pattern `n` times serially with optional gap between repetitions.
 *
 * @example
 * repeat(patterns.heartbeat, 3, { gap: 0.4 })
 */
export function repeat(pattern: AHAPPattern, n: number, options: { gap?: number } = {}): AHAPPattern {
  if (n <= 0) return { Version: 1, Pattern: [] };
  const copies = new Array(n).fill(pattern);
  return combine(...copies, options);
}

/**
 * Scale intensity and/or sharpness of every event in a pattern.
 * Values multiply existing intensities (clamped to [0, 1]).
 *
 * @example
 * scale(patterns.errorBuzz, { intensity: 0.5 })  // half-volume
 */
export function scale(pattern: AHAPPattern, factors: { intensity?: number; sharpness?: number }): AHAPPattern {
  const fI = factors.intensity ?? 1;
  const fS = factors.sharpness ?? 1;

  const next = pattern.Pattern.map((el): AHAPElement => {
    if (!isEvent(el)) return el;
    const event = el.Event;
    const params = (event.EventParameters ?? []).map((p): AHAPEventParameter => {
      if (p.ParameterID === 'HapticIntensity') {
        return { ...p, ParameterValue: clamp01(p.ParameterValue * fI) };
      }
      if (p.ParameterID === 'HapticSharpness') {
        return { ...p, ParameterValue: clamp01(p.ParameterValue * fS) };
      }
      return p;
    });
    return { Event: { ...event, EventParameters: params } };
  });

  return { ...pattern, Pattern: next };
}

/**
 * Stretch all event times and durations by a factor.
 * Factor > 1 = slower; factor < 1 = faster.
 *
 * @example
 * stretch(patterns.heartbeat, 0.5)  // double-time
 */
export function stretch(pattern: AHAPPattern, factor: number): AHAPPattern {
  if (factor <= 0) throw new Error('stretch factor must be positive');

  const next = pattern.Pattern.map((el): AHAPElement => {
    if (isEvent(el)) {
      const ev: AHAPEvent = {
        ...el.Event,
        Time: el.Event.Time * factor,
        ...(el.Event.EventDuration !== undefined ? { EventDuration: el.Event.EventDuration * factor } : {}),
      };
      return { Event: ev };
    }
    if (isParameterCurve(el)) {
      const cp = el.ParameterCurve;
      return {
        ParameterCurve: {
          ...cp,
          Time: cp.Time * factor,
          ParameterCurveControlPoints: cp.ParameterCurveControlPoints.map((p) => ({
            ...p,
            Time: p.Time * factor,
          })),
        },
      };
    }
    return el;
  });

  return { ...pattern, Pattern: next };
}

/**
 * Reverse the time ordering of a pattern. Continuous events keep their
 * duration; transients fire at the mirrored time.
 *
 * @example
 * reverse(patterns.successFanfare)  // descending instead of ascending
 */
export function reverse(pattern: AHAPPattern): AHAPPattern {
  const total = patternEnd(pattern);

  const next = pattern.Pattern.map((el): AHAPElement => {
    if (isEvent(el)) {
      const ev = el.Event;
      const dur = ev.EventDuration ?? 0;
      return { Event: { ...ev, Time: total - ev.Time - dur } };
    }
    if (isParameterCurve(el)) {
      const cp = el.ParameterCurve;
      const points = cp.ParameterCurveControlPoints;
      const lastT = points[points.length - 1]?.Time ?? 0;
      const reversedPoints = [...points].map((p) => ({ ...p, Time: lastT - p.Time })).reverse();
      return {
        ParameterCurve: {
          ...cp,
          Time: total - cp.Time - lastT,
          ParameterCurveControlPoints: reversedPoints,
        },
      };
    }
    return el;
  });

  return { ...pattern, Pattern: next };
}

/**
 * Shift all events in the pattern by `seconds` (positive = later).
 *
 * @example
 * delay(patterns.successFanfare, 0.3)
 */
export function delay(pattern: AHAPPattern, seconds: number): AHAPPattern {
  return {
    ...pattern,
    Pattern: pattern.Pattern.map((el) => shiftTime(el, seconds)),
  };
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Linearly interpolate between two patterns. `t = 0` returns `a`, `t = 1` returns `b`,
 * `t = 0.5` blends evenly. Useful for continuous state transitions: e.g. morph between
 * a relaxed heartbeat and a stressed one based on a UI value.
 *
 * **Constraint:** both patterns must have the same number of `Event` elements in the
 * same order; otherwise this throws. Wrap in try/catch or pre-validate when the
 * structures aren't authored together. Parameter curves in the source patterns are
 * ignored.
 *
 * @example
 * // Slider value 0..1 morphs between calm and stressed heartbeat
 * const blended = morph(patterns.heartbeat, stressedHeartbeat, slider.value);
 * await RichHaptics.playPattern({ pattern: blended });
 */
export function morph(a: AHAPPattern, b: AHAPPattern, t: number): AHAPPattern {
  const tt = Math.max(0, Math.min(1, t));
  const aEvents = a.Pattern.filter(isEvent);
  const bEvents = b.Pattern.filter(isEvent);

  if (aEvents.length !== bEvents.length) {
    throw new Error(`morph: patterns must have the same number of events (${aEvents.length} vs ${bEvents.length})`);
  }

  const merged: AHAPElement[] = aEvents.map((aEl, i) => {
    const aEvent = aEl.Event;
    const bEvent = bEvents[i].Event;

    const aParams = aEvent.EventParameters ?? [];
    const lerpedParams: AHAPEventParameter[] = aParams.map((p) => {
      const bp = bEvent.EventParameters?.find((x) => x.ParameterID === p.ParameterID);
      return bp ? { ...p, ParameterValue: clamp01(lerp(p.ParameterValue, bp.ParameterValue, tt)) } : p;
    });

    return {
      Event: {
        ...aEvent,
        Time: lerp(aEvent.Time, bEvent.Time, tt),
        ...(aEvent.EventDuration !== undefined && bEvent.EventDuration !== undefined
          ? { EventDuration: lerp(aEvent.EventDuration, bEvent.EventDuration, tt) }
          : {}),
        EventParameters: lerpedParams,
      },
    };
  });

  return { Version: 1, Pattern: merged };
}
