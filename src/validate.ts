import type { AHAPEvent, AHAPParameterCurve, AHAPPattern } from './definitions';

const EVENT_TYPES = new Set(['HapticTransient', 'HapticContinuous', 'AudioContinuous', 'AudioCustom']);
const EVENT_PARAMETER_IDS = new Set([
  'HapticIntensity',
  'HapticSharpness',
  'AttackTime',
  'DecayTime',
  'ReleaseTime',
  'Sustained',
  'AudioVolume',
  'AudioPan',
  'AudioPitch',
  'AudioBrightness',
]);
const DYNAMIC_PARAMETER_IDS = new Set([
  'HapticIntensityControl',
  'HapticSharpnessControl',
  'HapticAttackTimeControl',
  'HapticDecayTimeControl',
  'HapticReleaseTimeControl',
  'AudioVolumeControl',
  'AudioPanControl',
  'AudioPitchControl',
  'AudioBrightnessControl',
  'AudioAttackTimeControl',
  'AudioDecayTimeControl',
  'AudioReleaseTimeControl',
]);
const HAPTIC_RANGE_IDS = new Set(['HapticIntensity', 'HapticSharpness']);
const HAPTIC_CONTROL_RANGE_IDS = new Set(['HapticIntensityControl', 'HapticSharpnessControl']);

/**
 * Type guard: true when `value` looks like a valid AHAP pattern. Useful for
 * validating server-provided patterns before passing them to `playPattern`.
 *
 * Note: this is a structural check, not a deep validation. Use `validateAHAP`
 * for a list of specific issues.
 *
 * @example
 * const json = JSON.parse(rawAhapString); // from your AHAP source
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
      } else {
        if (!EVENT_TYPES.has(ev.EventType)) {
          errors.push(`Pattern[${i}].Event.EventType '${ev.EventType}' is not supported`);
        }
        if (ev.EventType === 'HapticContinuous') {
          if (typeof ev.EventDuration !== 'number') {
            errors.push(`Pattern[${i}].Event.EventDuration required for HapticContinuous`);
          } else if (ev.EventDuration <= 0) {
            errors.push(`Pattern[${i}].Event.EventDuration must be positive`);
          }
        }
        if (ev.EventType === 'AudioCustom' && typeof ev.EventWaveformPath !== 'string') {
          errors.push(`Pattern[${i}].Event.EventWaveformPath required for AudioCustom`);
        }
      }
      if (ev.EventParameters !== undefined) {
        if (!Array.isArray(ev.EventParameters)) {
          errors.push(`Pattern[${i}].Event.EventParameters must be an array`);
        } else {
          ev.EventParameters.forEach((p, j) => {
            if (typeof p?.ParameterID !== 'string') {
              errors.push(`Pattern[${i}].EventParameters[${j}].ParameterID missing`);
            } else if (!EVENT_PARAMETER_IDS.has(p.ParameterID)) {
              errors.push(`Pattern[${i}].EventParameters[${j}].ParameterID '${p.ParameterID}' is not supported`);
            }
            if (typeof p?.ParameterValue !== 'number') {
              errors.push(`Pattern[${i}].EventParameters[${j}].ParameterValue missing`);
            } else if (HAPTIC_RANGE_IDS.has(String(p.ParameterID)) && (p.ParameterValue < 0 || p.ParameterValue > 1)) {
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
      } else if (!DYNAMIC_PARAMETER_IDS.has(c.ParameterID)) {
        errors.push(`Pattern[${i}].ParameterCurve.ParameterID '${c.ParameterID}' is not supported`);
      }
      if (typeof c.Time !== 'number') {
        errors.push(`Pattern[${i}].ParameterCurve.Time missing`);
      } else if (c.Time < 0) {
        errors.push(`Pattern[${i}].ParameterCurve.Time must be non-negative`);
      }
      if (!Array.isArray(c.ParameterCurveControlPoints)) {
        errors.push(`Pattern[${i}].ParameterCurve.ParameterCurveControlPoints must be an array`);
      } else {
        let previousTime = -Infinity;
        c.ParameterCurveControlPoints.forEach((p, j) => {
          if (typeof p?.Time !== 'number') {
            errors.push(`Pattern[${i}].ParameterCurveControlPoints[${j}].Time missing`);
          } else {
            if (p.Time < 0) {
              errors.push(`Pattern[${i}].ParameterCurveControlPoints[${j}].Time must be non-negative`);
            }
            if (p.Time < previousTime) {
              errors.push(`Pattern[${i}].ParameterCurveControlPoints[${j}].Time must be non-decreasing`);
            }
            previousTime = p.Time;
          }
          if (typeof p?.ParameterValue !== 'number') {
            errors.push(`Pattern[${i}].ParameterCurveControlPoints[${j}].ParameterValue missing`);
          } else if (
            typeof c.ParameterID === 'string' &&
            HAPTIC_CONTROL_RANGE_IDS.has(c.ParameterID) &&
            (p.ParameterValue < 0 || p.ParameterValue > 1)
          ) {
            errors.push(
              `Pattern[${i}].ParameterCurveControlPoints[${j}].${c.ParameterID} (${p.ParameterValue}) out of [0, 1]`,
            );
          }
        });
      }
    }

    if (hasParameter) {
      const p = e.Parameter as { ParameterID?: unknown; ParameterValue?: unknown; Time?: unknown };
      if (typeof p.ParameterID !== 'string') {
        errors.push(`Pattern[${i}].Parameter.ParameterID missing`);
      } else if (!DYNAMIC_PARAMETER_IDS.has(p.ParameterID)) {
        errors.push(`Pattern[${i}].Parameter.ParameterID '${p.ParameterID}' is not supported`);
      }
      if (typeof p.Time !== 'number') {
        errors.push(`Pattern[${i}].Parameter.Time missing`);
      } else if (p.Time < 0) {
        errors.push(`Pattern[${i}].Parameter.Time must be non-negative`);
      }
      if (typeof p.ParameterValue !== 'number') {
        errors.push(`Pattern[${i}].Parameter.ParameterValue missing`);
      } else if (
        typeof p.ParameterID === 'string' &&
        HAPTIC_CONTROL_RANGE_IDS.has(p.ParameterID) &&
        (p.ParameterValue < 0 || p.ParameterValue > 1)
      ) {
        errors.push(`Pattern[${i}].Parameter.${p.ParameterID} (${p.ParameterValue}) out of [0, 1]`);
      }
    }
  });

  return errors;
}
