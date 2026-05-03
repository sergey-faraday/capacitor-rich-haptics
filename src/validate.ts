import type { AHAPEvent, AHAPParameterCurve, AHAPPattern } from './definitions';

/**
 * Type guard: true when `value` looks like a valid AHAP pattern. Useful for
 * validating server-provided patterns before passing them to `playPattern`.
 *
 * Note: this is a structural check, not a deep validation. Use `validateAHAP`
 * for a list of specific issues.
 *
 * @example
 * const json = await fetch('/api/haptics/celebration').then((r) => r.json());
 * if (isAHAPPattern(json)) {
 *   await RichHaptics.playPattern({ pattern: json });
 * }
 */
export function isAHAPPattern(value: unknown): value is AHAPPattern {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { Pattern?: unknown };
  if (!Array.isArray(v.Pattern)) return false;
  for (const el of v.Pattern) {
    if (typeof el !== 'object' || el === null) return false;
    const e = el as { Event?: unknown; ParameterCurve?: unknown; Parameter?: unknown };
    if (e.Event === undefined && e.ParameterCurve === undefined && e.Parameter === undefined) {
      return false;
    }
    if (e.Event !== undefined) {
      const ev = e.Event as { Time?: unknown; EventType?: unknown };
      if (typeof ev.Time !== 'number' || typeof ev.EventType !== 'string') return false;
    }
    if (e.ParameterCurve !== undefined) {
      const c = e.ParameterCurve as {
        ParameterID?: unknown;
        Time?: unknown;
        ParameterCurveControlPoints?: unknown;
      };
      if (
        typeof c.ParameterID !== 'string' ||
        typeof c.Time !== 'number' ||
        !Array.isArray(c.ParameterCurveControlPoints)
      ) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Walk an AHAP pattern and return a list of validation issues. Empty array
 * means valid. Use in CI, server-side validation, or before storing user
 * patterns. Does deeper checks than `isAHAPPattern`.
 *
 * @example
 * const issues = validateAHAP(pattern);
 * if (issues.length > 0) {
 *   throw new Error('Invalid AHAP:\n' + issues.join('\n'));
 * }
 */
export function validateAHAP(value: unknown): string[] {
  const errors: string[] = [];

  if (typeof value !== 'object' || value === null) {
    errors.push('Root must be an object');
    return errors;
  }
  const root = value as { Pattern?: unknown; Version?: unknown };

  if (!Array.isArray(root.Pattern)) {
    errors.push('root.Pattern must be an array');
    return errors;
  }

  if (root.Version !== undefined && typeof root.Version !== 'number') {
    errors.push('root.Version must be a number when present');
  }

  root.Pattern.forEach((el, i) => {
    if (typeof el !== 'object' || el === null) {
      errors.push(`Pattern[${i}] must be an object`);
      return;
    }
    const e = el as Record<string, unknown>;
    const hasEvent = 'Event' in e;
    const hasCurve = 'ParameterCurve' in e;
    const hasParameter = 'Parameter' in e;

    if (!hasEvent && !hasCurve && !hasParameter) {
      errors.push(`Pattern[${i}] must have Event, Parameter, or ParameterCurve`);
      return;
    }

    if (hasEvent) {
      const ev = e.Event as Partial<AHAPEvent>;
      if (typeof ev.Time !== 'number') {
        errors.push(`Pattern[${i}].Event.Time must be a number`);
      } else if (ev.Time < 0) {
        errors.push(`Pattern[${i}].Event.Time must be non-negative`);
      }
      if (typeof ev.EventType !== 'string') {
        errors.push(`Pattern[${i}].Event.EventType must be a string`);
      } else if (ev.EventType === 'HapticContinuous' && typeof ev.EventDuration !== 'number') {
        errors.push(`Pattern[${i}].Event.EventDuration required for HapticContinuous`);
      }
      if (ev.EventParameters !== undefined) {
        if (!Array.isArray(ev.EventParameters)) {
          errors.push(`Pattern[${i}].Event.EventParameters must be an array`);
        } else {
          ev.EventParameters.forEach((p, j) => {
            if (typeof p?.ParameterID !== 'string') {
              errors.push(`Pattern[${i}].EventParameters[${j}].ParameterID missing`);
            }
            if (typeof p?.ParameterValue !== 'number') {
              errors.push(`Pattern[${i}].EventParameters[${j}].ParameterValue missing`);
            } else if (
              (p.ParameterID === 'HapticIntensity' || p.ParameterID === 'HapticSharpness') &&
              (p.ParameterValue < 0 || p.ParameterValue > 1)
            ) {
              errors.push(`Pattern[${i}].EventParameters[${j}].${p.ParameterID} (${p.ParameterValue}) out of [0, 1]`);
            }
          });
        }
      }
    }

    if (hasCurve) {
      const c = e.ParameterCurve as Partial<AHAPParameterCurve>;
      if (typeof c.ParameterID !== 'string') {
        errors.push(`Pattern[${i}].ParameterCurve.ParameterID missing`);
      }
      if (typeof c.Time !== 'number') {
        errors.push(`Pattern[${i}].ParameterCurve.Time missing`);
      }
      if (!Array.isArray(c.ParameterCurveControlPoints)) {
        errors.push(`Pattern[${i}].ParameterCurve.ParameterCurveControlPoints must be an array`);
      } else {
        c.ParameterCurveControlPoints.forEach((p, j) => {
          if (typeof p?.Time !== 'number') {
            errors.push(`Pattern[${i}].ParameterCurveControlPoints[${j}].Time missing`);
          }
          if (typeof p?.ParameterValue !== 'number') {
            errors.push(`Pattern[${i}].ParameterCurveControlPoints[${j}].ParameterValue missing`);
          }
        });
      }
    }
  });

  return errors;
}
