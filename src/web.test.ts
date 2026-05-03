import { afterEach, describe, expect, it, vi } from 'vitest';

import { ahap } from './ahap';
import { RichHapticsWeb } from './web';

function installVibrate(vibrate = vi.fn()) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { vibrate },
  });
  return vibrate;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as { navigator?: Navigator }).navigator;
});

describe('RichHapticsWeb', () => {
  it('playPattern maps AHAP event timing to a vibration pattern', async () => {
    const vibrate = installVibrate();
    const haptics = new RichHapticsWeb();
    const pattern = ahap()
      .tap({ time: 0, intensity: 1 })
      .tap({ time: 0.05, intensity: 0.5 })
      .continuous({ time: 0.12, duration: 0.2, intensity: 0.7 })
      .build();

    await haptics.playPattern({ pattern });

    expect(vibrate).toHaveBeenCalledWith([15, 35, 8, 62, 200]);
  });

  it('setIntensityScale affects web preset vibration durations', async () => {
    const vibrate = installVibrate();
    const haptics = new RichHapticsWeb();

    await haptics.setIntensityScale({ scale: 0.5 });
    await haptics.preset({ name: 'heavyImpact' });

    expect(vibrate).toHaveBeenCalledWith(16);
  });
});
