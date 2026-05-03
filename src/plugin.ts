import { registerPlugin } from '@capacitor/core';

import type { RichHapticsPlugin } from './definitions';

/** The registered Capacitor plugin instance. */
export const RichHaptics = registerPlugin<RichHapticsPlugin>('RichHaptics', {
  web: () => import('./web').then((m) => new m.RichHapticsWeb()),
});
