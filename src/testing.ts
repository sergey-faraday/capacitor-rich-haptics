import type {
  DiagnosticsResult,
  IntensityScaleResult,
  IsEnabledResult,
  IsSupportedResult,
  PlayerOptions,
  PlayOptions,
  PlayPatternOptions,
  PlayPreloadedOptions,
  PreloadOptions,
  PresetOptions,
  RegisterAudioOptions,
  RichHapticsPlugin,
  SetEnabledOptions,
  SetIntensityScaleOptions,
  StartContinuousOptions,
  StartContinuousResult,
  UnloadOptions,
  UpdateParametersOptions,
} from './definitions';

export type MockMethodName = keyof RichHapticsPlugin | 'addListener' | 'removeAllListeners';

/** A single recorded call from the mock plugin. */
export interface MockHapticCall {
  method: MockMethodName;
  args: unknown[];
  at: number;
}

export interface MockHaptics extends RichHapticsPlugin {
  /** Chronological list of every call made to the plugin. */
  log: MockHapticCall[];
  /** Reset the call log. */
  reset(): void;
  /** Convenience: filtered log for one method. */
  callsTo(method: MockMethodName): MockHapticCall[];
}

export interface CreateMockOptions {
  /** Override what `isSupported()` returns. Default: { supported: true, engine: 'core-haptics', userEnabled: true }. */
  isSupported?: IsSupportedResult;
}

/**
 * Build a mock plugin that records every call.
 *
 * Useful in Jest/Vitest tests:
 *
 * ```ts
 * import { createMockHaptics } from 'capacitor-rich-haptics/testing';
 *
 * const mock = createMockHaptics();
 * jest.mock('capacitor-rich-haptics', () => ({ RichHaptics: mock }));
 *
 * await myComponent.handleTap();
 * expect(mock.callsTo('preset')).toHaveLength(1);
 * expect(mock.callsTo('preset')[0].args[0]).toEqual({ name: 'softTap' });
 * ```
 */
export function createMockHaptics(options: CreateMockOptions = {}): MockHaptics {
  const log: MockHapticCall[] = [];
  let nextId = 1;

  const support: IsSupportedResult = options.isSupported ?? {
    supported: true,
    engine: 'core-haptics',
    userEnabled: true,
  };

  const record = (method: MockMethodName, args: unknown[]): void => {
    log.push({ method, args, at: Date.now() });
  };

  return {
    log,
    reset: () => {
      log.length = 0;
    },
    callsTo: (method: MockMethodName) => log.filter((c) => c.method === method),

    isSupported: async (): Promise<IsSupportedResult> => {
      record('isSupported', []);
      return support;
    },

    play: async (opts: PlayOptions) => {
      record('play', [opts]);
    },
    preset: async (opts: PresetOptions) => {
      record('preset', [opts]);
    },
    playPattern: async (opts: PlayPatternOptions) => {
      record('playPattern', [opts]);
    },
    playAHAP: async (opts: { name: string }) => {
      record('playAHAP', [opts]);
    },
    playAHAPFromString: async (opts: { json: string }) => {
      record('playAHAPFromString', [opts]);
    },
    stop: async () => {
      record('stop', []);
    },

    startContinuous: async (opts: StartContinuousOptions): Promise<StartContinuousResult> => {
      record('startContinuous', [opts]);
      return { id: `mock-${nextId++}` };
    },
    updateParameters: async (opts: UpdateParametersOptions) => {
      record('updateParameters', [opts]);
    },
    stopPlayer: async (opts: PlayerOptions) => {
      record('stopPlayer', [opts]);
    },

    preload: async (opts: PreloadOptions) => {
      record('preload', [opts]);
    },
    playPreloaded: async (opts: PlayPreloadedOptions) => {
      record('playPreloaded', [opts]);
    },
    unload: async (opts: UnloadOptions) => {
      record('unload', [opts]);
    },

    registerAudio: async (opts: RegisterAudioOptions) => {
      record('registerAudio', [opts]);
    },

    getDiagnostics: async (): Promise<DiagnosticsResult> => {
      record('getDiagnostics', []);
      return {
        engine: support.engine,
        engineRunning: support.supported,
        preloadedCount: 0,
        activeContinuousPlayers: 0,
        registeredAudioCount: 0,
        lastError: null,
      };
    },

    setEnabled: async (opts: SetEnabledOptions) => {
      record('setEnabled', [opts]);
    },
    isEnabled: async (): Promise<IsEnabledResult> => {
      record('isEnabled', []);
      return { enabled: true };
    },

    setIntensityScale: async (opts: SetIntensityScaleOptions) => {
      record('setIntensityScale', [opts]);
    },
    getIntensityScale: async (): Promise<IntensityScaleResult> => {
      record('getIntensityScale', []);
      return { scale: 1.0 };
    },

    addListener: (eventName: string, _: (...args: unknown[]) => void) => {
      record('addListener', [eventName]);
      return Promise.resolve({ remove: () => Promise.resolve() });
    },
    removeAllListeners: () => {
      record('removeAllListeners', []);
      return Promise.resolve();
    },
  } as unknown as MockHaptics;

  // Note: addListener / removeAllListeners are inherited via WebPlugin in the real plugin.
  // The mock provides them so apps that subscribe to events still type-check in tests.
}

/** Casts the mock to a real plugin type for `jest.mock()` factory returns. */
export function asPlugin(mock: MockHaptics): RichHapticsPlugin {
  return mock as unknown as RichHapticsPlugin;
}
