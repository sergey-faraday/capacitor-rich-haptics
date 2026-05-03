import { describe, expect, it } from 'vitest';

import { ahap } from './ahap';
import { patterns } from './patterns';
import { isAHAPPattern, validateAHAP } from './validate';

describe('isAHAPPattern', () => {
  it('returns true for any built-in pattern', () => {
    for (const name of Object.keys(patterns) as (keyof typeof patterns)[]) {
      expect(isAHAPPattern(patterns[name])).toBe(true);
    }
  });

  it('returns true for builder output', () => {
    expect(isAHAPPattern(ahap().tap().build())).toBe(true);
  });

  it('returns false for non-objects', () => {
    expect(isAHAPPattern(null)).toBe(false);
    expect(isAHAPPattern(undefined)).toBe(false);
    expect(isAHAPPattern(42)).toBe(false);
    expect(isAHAPPattern('Pattern: []')).toBe(false);
  });

  it('returns false for missing Pattern array', () => {
    expect(isAHAPPattern({})).toBe(false);
    expect(isAHAPPattern({ Pattern: 'not-an-array' })).toBe(false);
  });

  it('returns false for malformed Event', () => {
    expect(isAHAPPattern({ Pattern: [{ Event: { Time: 'zero' } }] })).toBe(false);
    expect(isAHAPPattern({ Pattern: [{ Event: { Time: 0 } }] })).toBe(false); // missing EventType
  });

  it('returns false for unknown element shape', () => {
    expect(isAHAPPattern({ Pattern: [{ Random: true }] })).toBe(false);
  });
});

describe('validateAHAP', () => {
  it('returns empty array for valid patterns', () => {
    expect(validateAHAP(patterns.heartbeat)).toEqual([]);
    expect(validateAHAP(ahap().tap().build())).toEqual([]);
  });

  it('reports root errors', () => {
    expect(validateAHAP(null)).toContain('Root must be an object');
    expect(validateAHAP({})).toContain('root.Pattern must be an array');
  });

  it('reports missing EventDuration on HapticContinuous', () => {
    const issues = validateAHAP({
      Pattern: [{ Event: { Time: 0, EventType: 'HapticContinuous', EventParameters: [] } }],
    });
    expect(issues.some((e) => e.includes('EventDuration required'))).toBe(true);
  });

  it('reports unknown EventType and ParameterID values', () => {
    const issues = validateAHAP({
      Pattern: [
        {
          Event: {
            Time: 0,
            EventType: 'BadEvent',
            EventParameters: [{ ParameterID: 'BadParameter', ParameterValue: 1 }],
          },
        },
      ],
    });

    expect(issues.some((e) => e.includes('Event.EventType'))).toBe(true);
    expect(issues.some((e) => e.includes('BadParameter'))).toBe(true);
  });

  it('reports negative continuous duration', () => {
    const issues = validateAHAP({
      Pattern: [{ Event: { Time: 0, EventType: 'HapticContinuous', EventDuration: -0.1 } }],
    });

    expect(issues.some((e) => e.includes('EventDuration must be positive'))).toBe(true);
  });

  it('reports out-of-range intensity', () => {
    const issues = validateAHAP({
      Pattern: [
        {
          Event: {
            Time: 0,
            EventType: 'HapticTransient',
            EventParameters: [{ ParameterID: 'HapticIntensity', ParameterValue: 5 }],
          },
        },
      ],
    });
    expect(issues.some((e) => e.includes('out of [0, 1]'))).toBe(true);
  });

  it('reports negative Time', () => {
    const issues = validateAHAP({
      Pattern: [{ Event: { Time: -1, EventType: 'HapticTransient' } }],
    });
    expect(issues.some((e) => e.includes('non-negative'))).toBe(true);
  });

  it('reports non-string ParameterID', () => {
    const issues = validateAHAP({
      Pattern: [
        {
          Event: {
            Time: 0,
            EventType: 'HapticTransient',
            EventParameters: [{ ParameterID: 42, ParameterValue: 1 }],
          },
        },
      ],
    });
    expect(issues.some((e) => e.includes('ParameterID missing'))).toBe(true);
  });

  it('reports unknown element shape', () => {
    const issues = validateAHAP({ Pattern: [{ Random: true }] });
    expect(issues.some((e) => e.includes('Event, Parameter, or ParameterCurve'))).toBe(true);
  });

  it('reports invalid ParameterCurve', () => {
    const issues = validateAHAP({
      Pattern: [
        {
          ParameterCurve: {
            ParameterID: 'HapticIntensityControl',
            Time: 0,
            ParameterCurveControlPoints: [{ Time: 0 }, { Time: 0.5, ParameterValue: 1 }],
          },
        },
      ],
    });
    expect(issues.some((e) => e.includes('ParameterValue missing'))).toBe(true);
  });

  it('reports out-of-range haptic parameter curve values', () => {
    const issues = validateAHAP({
      Pattern: [
        {
          ParameterCurve: {
            ParameterID: 'HapticIntensityControl',
            Time: 0,
            ParameterCurveControlPoints: [
              { Time: 0, ParameterValue: 0.5 },
              { Time: 0.5, ParameterValue: 2 },
            ],
          },
        },
      ],
    });

    expect(issues.some((e) => e.includes('out of [0, 1]'))).toBe(true);
  });
});
