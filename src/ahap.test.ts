import { describe, expect, it } from 'vitest';

import { ahap } from './ahap';
import type { AHAPEvent, AHAPParameterCurve } from './definitions';

const eventAt = (pattern: ReturnType<typeof ahap>['build'] extends () => infer R ? R : never, i: number) =>
  'Event' in pattern.Pattern[i] ? (pattern.Pattern[i] as { Event: AHAPEvent }).Event : null;

describe('ahap()', () => {
  it('returns valid AHAP shape with empty Pattern', () => {
    const p = ahap().build();
    expect(p.Version).toBe(1);
    expect(p.Pattern).toEqual([]);
  });

  it('tap() adds a HapticTransient with default intensity 1, sharpness 0.5', () => {
    const p = ahap().tap().build();
    const ev = eventAt(p, 0)!;
    expect(ev.EventType).toBe('HapticTransient');
    expect(ev.Time).toBe(0);
    expect(ev.EventParameters).toEqual([
      { ParameterID: 'HapticIntensity', ParameterValue: 1 },
      { ParameterID: 'HapticSharpness', ParameterValue: 0.5 },
    ]);
  });

  it('tap() respects intensity and sharpness', () => {
    const p = ahap().tap({ intensity: 0.3, sharpness: 0.9 }).build();
    const params = eventAt(p, 0)!.EventParameters!;
    expect(params[0].ParameterValue).toBe(0.3);
    expect(params[1].ParameterValue).toBe(0.9);
  });

  it('clamps intensity and sharpness to [0, 1]', () => {
    const p = ahap().tap({ intensity: 5, sharpness: -2 }).build();
    const params = eventAt(p, 0)!.EventParameters!;
    expect(params[0].ParameterValue).toBe(1);
    expect(params[1].ParameterValue).toBe(0);
  });

  it('wait() advances cursor', () => {
    const p = ahap().tap().wait(0.3).tap().build();
    expect(eventAt(p, 0)!.Time).toBe(0);
    expect(eventAt(p, 1)!.Time).toBeCloseTo(0.3);
  });

  it('at() sets cursor absolutely', () => {
    const p = ahap().at(0.5).tap().build();
    expect(eventAt(p, 0)!.Time).toBe(0.5);
  });

  it('continuous() advances cursor by duration', () => {
    const p = ahap().continuous({ duration: 0.4, intensity: 0.5 }).tap().build();
    expect(eventAt(p, 0)!.EventDuration).toBe(0.4);
    expect(eventAt(p, 1)!.Time).toBeCloseTo(0.4);
  });

  it('ramp after continuous defaults to continuous start time', () => {
    const p = ahap()
      .continuous({ duration: 0.5, intensity: 0.5 })
      .rampIntensity({ from: 0.5, to: 0.0, duration: 0.5 })
      .build();
    const curve = (p.Pattern[1] as { ParameterCurve: AHAPParameterCurve }).ParameterCurve;
    expect(curve.Time).toBe(0);
    expect(curve.ParameterID).toBe('HapticIntensityControl');
  });

  it('multiple ramps after one continuous all use the same start time', () => {
    const p = ahap()
      .continuous({ duration: 0.3, intensity: 0.5 })
      .rampIntensity({ from: 0.5, to: 1.0, duration: 0.3 })
      .rampSharpness({ from: 0.3, to: 0.9, duration: 0.3 })
      .build();
    const curve1 = (p.Pattern[1] as { ParameterCurve: AHAPParameterCurve }).ParameterCurve;
    const curve2 = (p.Pattern[2] as { ParameterCurve: AHAPParameterCurve }).ParameterCurve;
    expect(curve1.Time).toBe(0);
    expect(curve2.Time).toBe(0);
  });

  it('tap after a ramp resets the lastContinuousStart hint', () => {
    const p = ahap()
      .continuous({ duration: 0.3 })
      .rampIntensity({ from: 0.5, to: 1.0, duration: 0.3 })
      .tap()
      .rampSharpness({ from: 0.5, to: 0.0, duration: 0.1 })
      .build();
    // Last ramp should default to cursor (after continuous + tap), not 0
    const lastCurve = (p.Pattern[3] as { ParameterCurve: AHAPParameterCurve }).ParameterCurve;
    expect(lastCurve.Time).toBeCloseTo(0.3);
  });

  it('explicit time on ramp overrides defaults', () => {
    const p = ahap()
      .continuous({ duration: 0.5 })
      .rampIntensity({ from: 0.5, to: 0.0, duration: 0.2, time: 0.3 })
      .build();
    const curve = (p.Pattern[1] as { ParameterCurve: AHAPParameterCurve }).ParameterCurve;
    expect(curve.Time).toBe(0.3);
  });

  it('meta() attaches metadata to the final pattern', () => {
    const p = ahap().tap().meta('category', 'test').meta('description', 'a test').build();
    expect(p.Metadata).toEqual({ category: 'test', description: 'a test' });
  });

  it('audio() emits AudioCustom events', () => {
    const p = ahap().audio({ id: 'click', volume: 0.8 }).build();
    const ev = eventAt(p, 0)!;
    expect(ev.EventType).toBe('AudioCustom');
    expect(ev.EventWaveformPath).toBe('click');
    expect(ev.EventParameters).toEqual([{ ParameterID: 'AudioVolume', ParameterValue: 0.8 }]);
  });

  it('continuous() supports envelope params', () => {
    const p = ahap().continuous({ duration: 0.5, intensity: 0.7, attack: 0.1, decay: 0.2, sustained: true }).build();
    const params = eventAt(p, 0)!.EventParameters!;
    expect(params.find((x) => x.ParameterID === 'AttackTime')?.ParameterValue).toBe(0.1);
    expect(params.find((x) => x.ParameterID === 'DecayTime')?.ParameterValue).toBe(0.2);
    expect(params.find((x) => x.ParameterID === 'Sustained')?.ParameterValue).toBe(1);
  });
});
