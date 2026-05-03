import { describe, expect, it } from 'vitest';

import { ahap } from './ahap';
import type { AHAPEvent, AHAPPattern } from './definitions';
import { combine, delay, getPatternDuration, morph, repeat, reverse, scale, stretch } from './transforms';

const event = (i: number) => (p: AHAPPattern) => (p.Pattern[i] as { Event: AHAPEvent }).Event;

const simple = (): AHAPPattern =>
  ahap().tap({ intensity: 1.0, sharpness: 0.5 }).wait(0.1).tap({ intensity: 0.5, sharpness: 0.5 }).build();

describe('getPatternDuration', () => {
  it('returns the latest end time across events and curves', () => {
    expect(getPatternDuration(simple())).toBeCloseTo(0.1);

    const withCont = ahap().continuous({ duration: 0.5, intensity: 0.5 }).build();
    expect(getPatternDuration(withCont)).toBeCloseTo(0.5);

    const withRamp = ahap()
      .continuous({ duration: 0.3, intensity: 0.5 })
      .rampIntensity({ from: 0.5, to: 0, duration: 0.3 })
      .build();
    expect(getPatternDuration(withRamp)).toBeCloseTo(0.3);
  });

  it('returns 0 for empty pattern', () => {
    expect(getPatternDuration(ahap().build())).toBe(0);
  });
});

describe('combine', () => {
  it('concatenates patterns shifting the second by the first duration', () => {
    const a = simple();
    const b = simple();
    const c = combine(a, b);
    expect(c.Pattern.length).toBe(4);
    expect(event(0)(c).Time).toBe(0);
    expect(event(1)(c).Time).toBeCloseTo(0.1);
    expect(event(2)(c).Time).toBeCloseTo(0.1);
    expect(event(3)(c).Time).toBeCloseTo(0.2);
  });

  it('inserts gap between parts', () => {
    const c = combine(simple(), simple(), { gap: 0.5 });
    expect(event(2)(c).Time).toBeCloseTo(0.6);
  });
});

describe('repeat', () => {
  it('returns empty for n=0', () => {
    expect(repeat(simple(), 0).Pattern).toEqual([]);
  });

  it('triples the pattern', () => {
    const r = repeat(simple(), 3);
    expect(r.Pattern.length).toBe(6);
  });

  it('respects gap option', () => {
    const r = repeat(simple(), 3, { gap: 0.2 });
    // first repetition starts at 0, second at 0.1 + 0.2 = 0.3, third at 0.6
    expect(event(2)(r).Time).toBeCloseTo(0.3);
    expect(event(4)(r).Time).toBeCloseTo(0.6);
  });
});

describe('scale', () => {
  it('halves intensity', () => {
    const s = scale(simple(), { intensity: 0.5 });
    const params = event(0)(s).EventParameters!;
    expect(params.find((p) => p.ParameterID === 'HapticIntensity')!.ParameterValue).toBe(0.5);
  });

  it('does not exceed [0, 1]', () => {
    const s = scale(simple(), { intensity: 10 });
    const params = event(0)(s).EventParameters!;
    expect(params.find((p) => p.ParameterID === 'HapticIntensity')!.ParameterValue).toBe(1);
  });

  it('leaves time unchanged', () => {
    const s = scale(simple(), { intensity: 0.5 });
    expect(event(1)(s).Time).toBeCloseTo(0.1);
  });

  it('scales HapticIntensityControl parameter curve points', () => {
    const original = ahap()
      .continuous({ duration: 0.5, intensity: 0.8 })
      .rampIntensity({ from: 0.8, to: 0.4, duration: 0.5 })
      .build();

    const s = scale(original, { intensity: 0.5 });
    const curve = s.Pattern[1];

    expect('ParameterCurve' in curve && curve.ParameterCurve.ParameterCurveControlPoints).toEqual([
      { Time: 0, ParameterValue: 0.4 },
      { Time: 0.5, ParameterValue: 0.2 },
    ]);
  });
});

describe('stretch', () => {
  it('doubles times and durations with factor 2', () => {
    const original = ahap().continuous({ duration: 0.4, intensity: 0.5 }).tap({ time: 0.5 }).build();
    const s = stretch(original, 2);
    expect(event(0)(s).Time).toBe(0);
    expect(event(0)(s).EventDuration).toBeCloseTo(0.8);
    expect(event(1)(s).Time).toBeCloseTo(1.0);
  });

  it('compresses with factor < 1', () => {
    const s = stretch(simple(), 0.5);
    expect(event(1)(s).Time).toBeCloseTo(0.05);
  });

  it('throws on non-positive factor', () => {
    expect(() => stretch(simple(), 0)).toThrow();
    expect(() => stretch(simple(), -1)).toThrow();
  });
});

describe('reverse', () => {
  it('mirrors transient times', () => {
    // simple = tap@0, tap@0.1; total 0.1; reversed = tap@0.1, tap@0
    const r = reverse(simple());
    expect(event(0)(r).Time).toBeCloseTo(0.1);
    expect(event(1)(r).Time).toBeCloseTo(0);
  });
});

describe('delay', () => {
  it('shifts all events by N seconds', () => {
    const d = delay(simple(), 0.5);
    expect(event(0)(d).Time).toBeCloseTo(0.5);
    expect(event(1)(d).Time).toBeCloseTo(0.6);
  });
});

describe('morph', () => {
  it('returns a at t=0', () => {
    const a = simple();
    const b = ahap().tap({ intensity: 0.0 }).wait(0.1).tap({ intensity: 0.0 }).build();
    const m = morph(a, b, 0);
    expect(event(0)(m).EventParameters![0].ParameterValue).toBeCloseTo(1.0);
  });

  it('returns b at t=1', () => {
    const a = simple();
    const b = ahap().tap({ intensity: 0.0 }).wait(0.1).tap({ intensity: 0.0 }).build();
    const m = morph(a, b, 1);
    expect(event(0)(m).EventParameters![0].ParameterValue).toBeCloseTo(0.0);
  });

  it('returns midpoint at t=0.5', () => {
    const a = simple();
    const b = ahap().tap({ intensity: 0.0 }).wait(0.1).tap({ intensity: 0.0 }).build();
    const m = morph(a, b, 0.5);
    expect(event(0)(m).EventParameters![0].ParameterValue).toBeCloseTo(0.5);
  });

  it('throws when event counts differ', () => {
    const a = simple();
    const b = ahap().tap().build();
    expect(() => morph(a, b, 0.5)).toThrow(/event/i);
  });
});
