// Inline AHAP patterns for the demo. In a real app, import from
// `capacitor-rich-haptics/patterns` and skip this file entirely.

export const AHAP_PATTERNS = {
  boing: {
    Pattern: [
      { Event: { Time: 0.0, EventType: 'HapticTransient',
        EventParameters: [
          { ParameterID: 'HapticIntensity', ParameterValue: 1.0 },
          { ParameterID: 'HapticSharpness', ParameterValue: 0.9 },
        ]}},
      { Event: { Time: 0.08, EventType: 'HapticContinuous', EventDuration: 0.4,
        EventParameters: [
          { ParameterID: 'HapticIntensity', ParameterValue: 0.6 },
          { ParameterID: 'HapticSharpness', ParameterValue: 0.2 },
        ]}},
    ],
  },

  rumble: {
    Pattern: [
      { Event: { Time: 0.0, EventType: 'HapticContinuous', EventDuration: 1.2,
        EventParameters: [
          { ParameterID: 'HapticIntensity', ParameterValue: 0.5 },
          { ParameterID: 'HapticSharpness', ParameterValue: 0.0 },
        ]}},
      { Event: { Time: 0.0, EventType: 'HapticTransient',
        EventParameters: [
          { ParameterID: 'HapticIntensity', ParameterValue: 1.0 },
          { ParameterID: 'HapticSharpness', ParameterValue: 0.5 },
        ]}},
      { Event: { Time: 0.6, EventType: 'HapticTransient',
        EventParameters: [
          { ParameterID: 'HapticIntensity', ParameterValue: 1.0 },
          { ParameterID: 'HapticSharpness', ParameterValue: 0.5 },
        ]}},
    ],
  },
};

// Mirrored from src/patterns.ts for demo purposes (no bundler in this static example).
const tap = (i, s, t) => ({ Event: { Time: t, EventType: 'HapticTransient',
  EventParameters: [
    { ParameterID: 'HapticIntensity', ParameterValue: i },
    { ParameterID: 'HapticSharpness', ParameterValue: s },
  ]}});
const cont = (i, s, dur, t) => ({ Event: { Time: t, EventType: 'HapticContinuous', EventDuration: dur,
  EventParameters: [
    { ParameterID: 'HapticIntensity', ParameterValue: i },
    { ParameterID: 'HapticSharpness', ParameterValue: s },
  ]}});
const ramp = (param, from, to, dur, t) => ({ ParameterCurve: {
  ParameterID: param, Time: t,
  ParameterCurveControlPoints: [
    { Time: 0, ParameterValue: from },
    { Time: dur, ParameterValue: to },
  ],
}});

export const PATTERN_LIBRARY = {
  heartbeat: { Version: 1, Pattern: [
    tap(1.0, 0.4, 0.0), tap(0.7, 0.3, 0.18),
    tap(1.0, 0.4, 0.9), tap(0.7, 0.3, 1.08),
  ]},
  breatheIn: { Version: 1, Pattern: [
    cont(0.3, 0.0, 1.6, 0.0),
    ramp('HapticIntensityControl', 0.3, 0.7, 1.6, 0.0),
  ]},
  breatheOut: { Version: 1, Pattern: [
    cont(0.7, 0.0, 2.0, 0.0),
    ramp('HapticIntensityControl', 0.7, 0.0, 2.0, 0.0),
  ]},
  waterDrop: { Version: 1, Pattern: [
    tap(0.4, 0.9, 0.0),
    cont(0.5, 0.2, 0.25, 0.05),
    ramp('HapticIntensityControl', 0.5, 0.0, 0.25, 0.05),
  ]},
  raindrops: { Version: 1, Pattern: [
    tap(0.4, 0.95, 0.0), tap(0.6, 0.95, 0.13), tap(0.3, 0.95, 0.27),
    tap(0.5, 0.95, 0.42), tap(0.7, 0.95, 0.55), tap(0.4, 0.95, 0.7),
    tap(0.5, 0.95, 0.84),
  ]},
  coinFlip: { Version: 1, Pattern: [
    tap(1.0, 1.0, 0.0),
    cont(0.5, 0.7, 0.4, 0.06),
    ramp('HapticSharpnessControl', 0.7, 0.2, 0.4, 0.06),
    tap(0.8, 0.5, 0.51),
  ]},
  lockClick: { Version: 1, Pattern: [tap(0.6, 0.9, 0.0), tap(1.0, 1.0, 0.04)] },
  keyJangle: { Version: 1, Pattern: [
    tap(0.5, 1.0, 0.0), tap(0.7, 1.0, 0.04), tap(0.4, 1.0, 0.09),
    tap(0.6, 1.0, 0.16), tap(0.3, 1.0, 0.22),
  ]},
  watchTick: { Version: 1, Pattern: [
    tap(0.25, 1.0, 0.0), tap(0.25, 1.0, 0.5), tap(0.25, 1.0, 1.0),
  ]},
  typewriter: { Version: 1, Pattern: [
    tap(0.5, 0.95, 0.0), tap(0.55, 0.95, 0.08), tap(0.5, 0.95, 0.18),
    tap(0.6, 0.95, 0.27), tap(0.5, 0.95, 0.36), tap(0.55, 0.95, 0.46),
  ]},
  successFanfare: { Version: 1, Pattern: [
    tap(0.6, 0.5, 0.0), tap(0.8, 0.7, 0.08), tap(1.0, 0.9, 0.16),
  ]},
  errorBuzz: { Version: 1, Pattern: [
    cont(1.0, 0.9, 0.12, 0.0),
    cont(1.0, 0.9, 0.12, 0.16),
    cont(1.0, 0.9, 0.18, 0.32),
  ]},
  levelUp: { Version: 1, Pattern: [
    cont(0.5, 0.3, 0.3, 0.0),
    ramp('HapticIntensityControl', 0.5, 1.0, 0.3, 0.0),
    ramp('HapticSharpnessControl', 0.3, 0.9, 0.3, 0.0),
    tap(1.0, 1.0, 0.35),
  ]},
  explosion: { Version: 1, Pattern: [
    tap(1.0, 1.0, 0.0),
    cont(1.0, 0.0, 0.6, 0.0),
    ramp('HapticIntensityControl', 1.0, 0.0, 0.6, 0.0),
  ]},
  applause: { Version: 1, Pattern: [
    tap(0.5, 1.0, 0.0), tap(0.7, 1.0, 0.06), tap(0.4, 1.0, 0.13),
    tap(0.6, 1.0, 0.18), tap(0.8, 1.0, 0.25), tap(0.5, 1.0, 0.32),
    tap(0.7, 1.0, 0.4), tap(0.4, 1.0, 0.48), tap(0.6, 1.0, 0.55),
  ]},
  magicSparkle: { Version: 1, Pattern: [
    tap(0.3, 1.0, 0.0), tap(0.45, 1.0, 0.07), tap(0.3, 1.0, 0.13),
    tap(0.6, 1.0, 0.22), tap(0.35, 1.0, 0.31),
    cont(0.4, 0.95, 0.3, 0.4),
    ramp('HapticIntensityControl', 0.4, 0.0, 0.3, 0.4),
  ]},
  boing: AHAP_PATTERNS.boing,
  rumble: AHAP_PATTERNS.rumble,
};
