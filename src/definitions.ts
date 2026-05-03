// ─── Android primitive hint ─────────────────────────────────────────────────

/**
 * Hint for Android `VibrationEffect.Composition` primitive selection. iOS
 * ignores this — Core Haptics is fine-grained enough that no hint is needed.
 *
 * Stored on each AHAP `Event` as a non-standard `_androidPrimitive` key —
 * stripped before iOS serialization. Add via the `ahap()` builder
 * (`.tap({ androidPrimitive: 'spin' })`) or by writing the field directly.
 */
export type AndroidPrimitive = 'click' | 'tick' | 'lowTick' | 'thud' | 'spin' | 'quickRise' | 'slowRise' | 'quickFall';

// ─── AHAP types ─────────────────────────────────────────────────────────────

/** Apple Haptic and Audio Pattern (AHAP) — full type definitions. */

export type AHAPEventType = 'HapticTransient' | 'HapticContinuous' | 'AudioContinuous' | 'AudioCustom';

export type AHAPEventParameterID =
  | 'HapticIntensity'
  | 'HapticSharpness'
  | 'AttackTime'
  | 'DecayTime'
  | 'ReleaseTime'
  | 'Sustained'
  | 'AudioVolume'
  | 'AudioPan'
  | 'AudioPitch'
  | 'AudioBrightness';

export type AHAPDynamicParameterID =
  | 'HapticIntensityControl'
  | 'HapticSharpnessControl'
  | 'HapticAttackTimeControl'
  | 'HapticDecayTimeControl'
  | 'HapticReleaseTimeControl'
  | 'AudioVolumeControl'
  | 'AudioPanControl'
  | 'AudioPitchControl'
  | 'AudioBrightnessControl'
  | 'AudioAttackTimeControl'
  | 'AudioDecayTimeControl'
  | 'AudioReleaseTimeControl';

export interface AHAPEventParameter {
  ParameterID: AHAPEventParameterID;
  ParameterValue: number;
}

export interface AHAPEvent {
  Time: number;
  EventType: AHAPEventType;
  EventDuration?: number;
  EventWaveformPath?: string;
  EventWaveformLoopEnabled?: boolean;
  EventParameters?: AHAPEventParameter[];
  /**
   * Android primitive hint — chosen on Android (API 31+) when picking a
   * `VibrationEffect.Composition` primitive. Ignored on iOS.
   * Non-standard AHAP extension; stripped before iOS serialization.
   */
  _androidPrimitive?: AndroidPrimitive;
}

export interface AHAPDynamicParameter {
  ParameterID: AHAPDynamicParameterID;
  ParameterValue: number;
  Time: number;
}

export interface AHAPParameterCurveControlPoint {
  Time: number;
  ParameterValue: number;
}

export interface AHAPParameterCurve {
  ParameterID: AHAPDynamicParameterID;
  Time: number;
  ParameterCurveControlPoints: AHAPParameterCurveControlPoint[];
}

export type AHAPElement =
  | { Event: AHAPEvent }
  | { Parameter: AHAPDynamicParameter }
  | { ParameterCurve: AHAPParameterCurve };

export interface AHAPPattern {
  Version?: number;
  Metadata?: Record<string, unknown>;
  Pattern: AHAPElement[];
}

// ─── Plugin API ─────────────────────────────────────────────────────────────

export type HapticEngine = 'core-haptics' | 'composition' | 'basic' | 'web' | 'none';

export type HapticPreset =
  // Original 7 — basic UI vocabulary
  | 'softTap'
  | 'sharpClick'
  | 'scrollTick'
  | 'gentlePulse'
  | 'success'
  | 'warning'
  | 'error'
  // UIKit-aligned impact styles (UIImpactFeedbackGenerator)
  | 'mediumImpact'
  | 'heavyImpact'
  | 'softImpact'
  | 'rigidImpact'
  // Selection / picker
  | 'selectionStrong'
  | 'detent'
  // Gestures (mirrors Android HapticFeedbackConstants where applicable)
  | 'longPress'
  | 'dragStart'
  | 'dragEnd'
  // Lighter notification family — between selection and success/error
  | 'confirm'
  | 'reject'
  | 'info'
  | 'alert'
  // Toggle / switch UI
  | 'toggleOn'
  | 'toggleOff'
  // UI actions
  | 'expand'
  | 'collapse'
  | 'pop'
  // Specific physical metaphors
  | 'subtle'
  | 'keyTap'
  | 'bump'
  | 'loadingPulse';

export interface PlayOptions {
  /** Force of the haptic, 0.0–1.0. Default 1.0. */
  intensity?: number;
  /** Crispness, 0.0 (soft thud) to 1.0 (sharp click). Default 0.5. iOS only. */
  sharpness?: number;
  /** Seconds. 0 = transient tap, >0 = continuous. Default 0. */
  duration?: number;
}

export interface IsSupportedResult {
  supported: boolean;
  /**
   * Which engine will service `play()` calls on this device:
   * - `core-haptics` — iOS A13+ with `CHHapticEngine` (full intensity + sharpness)
   * - `composition`  — Android 12+ (API 31+) with `VibrationEffect.Composition` primitives
   * - `basic`        — Android 8+ (API 26+) with `VibrationEffect.createOneShot` (intensity only)
   * - `web`          — `navigator.vibrate` or Web Audio fallback (best-effort)
   * - `none`         — no vibration hardware
   */
  engine: HapticEngine;
  /**
   * Whether the user has not disabled haptics in OS settings.
   * iOS: false if Reduce Motion or System Haptics is off.
   * Android: typically true unless system-wide vibration is off.
   * When `false`, all play methods become no-ops.
   */
  userEnabled: boolean;
}

export interface PlayPatternOptions {
  /** AHAP pattern. Either an object built with `ahap()` or a raw AHAP-shaped JSON object. */
  pattern: AHAPPattern;
}

export interface PlayAHAPFromStringOptions {
  /** AHAP pattern as a JSON string. */
  json: string;
}

export interface PlayAHAPOptions {
  /** AHAP filename in the iOS app bundle, without extension (e.g. "Heartbeat"). */
  name: string;
}

export interface PresetOptions {
  name: HapticPreset;
}

export interface StartContinuousOptions {
  intensity?: number;
  sharpness?: number;
}

export interface StartContinuousResult {
  /** Player handle for `updateParameters` and `stopPlayer`. */
  id: string;
}

export interface UpdateParametersOptions {
  id: string;
  intensity?: number;
  sharpness?: number;
}

export interface PlayerOptions {
  id: string;
}

export interface PreloadOptions {
  /** Caller-supplied identifier; pass to `playPreloaded` to fire instantly. */
  id: string;
  /** A single-event pattern as intensity/sharpness/duration, OR a full AHAP pattern. */
  intensity?: number;
  sharpness?: number;
  duration?: number;
  pattern?: AHAPPattern;
}

export interface PlayPreloadedOptions {
  id: string;
}

export interface UnloadOptions {
  id: string;
}

export interface RegisterAudioOptions {
  /** Caller-supplied identifier referenced by AHAP `EventWaveformPath`. */
  id: string;
  /** Filename in the iOS app bundle (with extension, e.g. "click.wav"). */
  filename: string;
}

export type RichHapticsEvent = 'engineDidReset';

export interface PluginListenerHandle {
  remove: () => Promise<void>;
}

export interface DiagnosticsResult {
  /** Same engine string as `isSupported()`. */
  engine: HapticEngine;
  /** True if the native haptic engine is currently running and ready to play. */
  engineRunning: boolean;
  /** Number of currently preloaded patterns (via `preload`). */
  preloadedCount: number;
  /** Number of currently active continuous players (via `startContinuous`). */
  activeContinuousPlayers: number;
  /** Number of registered audio resources (via `registerAudio`). iOS only — 0 elsewhere. */
  registeredAudioCount: number;
  /** Last error message from the native side, if any. Null when healthy. */
  lastError: string | null;
}

export interface RichHapticsPlugin {
  /**
   * Detect whether haptics are available, which engine will be used, and whether
   * the user has enabled them in OS settings. Always check `userEnabled` before
   * playing — iOS Reduce Motion users expect silence.
   *
   * @example
   * const { supported, engine, userEnabled } = await RichHaptics.isSupported();
   * if (supported && userEnabled) {
   *   await RichHaptics.preset({ name: 'softTap' });
   * }
   */
  isSupported(): Promise<IsSupportedResult>;

  /**
   * Play a single haptic event with custom intensity / sharpness / duration.
   *
   * - **iOS:** uses `CHHapticEngine` for the full Core Haptics nuance.
   * - **Android (API 31+):** maps `sharpness` to the closest `Composition` primitive
   *   (`PRIMITIVE_CLICK` / `TICK` / `THUD`) and applies `intensity` as the scale.
   * - **Android (API 26+):** falls back to `VibrationEffect.createOneShot` (intensity only).
   * - **Web:** `navigator.vibrate(ms)` on mobile, Web Audio click on desktop.
   *
   * @example
   * // Light, sharp tap (like a UI selection)
   * await RichHaptics.play({ intensity: 0.4, sharpness: 1.0 });
   *
   * @example
   * // Soft thud (like a heavy ball landing)
   * await RichHaptics.play({ intensity: 1.0, sharpness: 0.0 });
   *
   * @example
   * // 200ms continuous low rumble
   * await RichHaptics.play({ intensity: 0.5, sharpness: 0.0, duration: 0.2 });
   */
  play(options: PlayOptions): Promise<void>;

  /**
   * Play one of the cross-platform UX presets — the standard tap feel for common
   * UI events. Use these instead of `play()` whenever the action fits a preset.
   *
   * @example
   * await RichHaptics.preset({ name: 'softTap' });    // button press
   * await RichHaptics.preset({ name: 'sharpClick' }); // toggle, selection
   * await RichHaptics.preset({ name: 'success' });    // confirmation
   * await RichHaptics.preset({ name: 'error' });      // negative feedback
   */
  preset(options: PresetOptions): Promise<void>;

  /**
   * Play a multi-event AHAP pattern. Accepts the result of `ahap()...build()`,
   * a built-in from `patterns.X`, or any object matching the AHAP spec.
   *
   * @example
   * import { patterns } from 'capacitor-rich-haptics';
   * await RichHaptics.playPattern({ pattern: patterns.heartbeat });
   *
   * @example
   * import { ahap } from 'capacitor-rich-haptics';
   * const myPattern = ahap()
   *   .tap({ intensity: 1.0, sharpness: 0.9 })
   *   .wait(0.2)
   *   .tap({ intensity: 0.5, sharpness: 0.5 })
   *   .build();
   * await RichHaptics.playPattern({ pattern: myPattern });
   */
  playPattern(options: PlayPatternOptions): Promise<void>;

  /**
   * Play an AHAP file bundled with the iOS app. The file must be added to the
   * iOS target with "Copy items if needed" checked. Android approximates with a
   * soft tap — for cross-platform AHAP, use `playPattern` or `playAHAPFromString`.
   *
   * @example
   * await RichHaptics.playAHAP({ name: 'Heartbeat' }); // looks for Heartbeat.ahap
   */
  playAHAP(options: PlayAHAPOptions): Promise<void>;

  /**
   * Play an AHAP pattern provided as a JSON string at runtime. Useful when
   * patterns are downloaded from a server or generated dynamically.
   *
   * @example
   * const json = JSON.stringify(patterns.coinFlip);
   * await RichHaptics.playAHAPFromString({ json });
   */
  playAHAPFromString(options: PlayAHAPFromStringOptions): Promise<void>;

  /**
   * Stop all in-flight haptic playback (transients, continuous players, AHAP).
   * Call this in your app's resign-active or modal-close handlers.
   */
  stop(): Promise<void>;

  // ── Live parameter modulation ────────────────────────────────────────────

  /**
   * Start a continuous haptic you can modulate in real time. Returns a player
   * `id` to use with `updateParameters` and `stopPlayer`. The killer feature:
   * map gesture position to intensity for tactile drag feedback.
   *
   * On Android, simulated by re-triggering Composition primitives at ~30Hz —
   * not as smooth as iOS but functional.
   *
   * @example
   * const { id } = await RichHaptics.startContinuous({ intensity: 0.3, sharpness: 0.5 });
   * element.addEventListener('pointermove', (e) => {
   *   RichHaptics.updateParameters({ id, intensity: e.clientY / window.innerHeight });
   * });
   * element.addEventListener('pointerup', () => RichHaptics.stopPlayer({ id }));
   */
  startContinuous(options: StartContinuousOptions): Promise<StartContinuousResult>;

  /**
   * Update intensity/sharpness of an in-flight continuous player.
   * Pass only the parameters you want to change.
   *
   * @example
   * RichHaptics.updateParameters({ id, intensity: 0.8 });
   */
  updateParameters(options: UpdateParametersOptions): Promise<void>;

  /** Stop a specific continuous player started with `startContinuous`. */
  stopPlayer(options: PlayerOptions): Promise<void>;

  // ── Preloading (zero-latency playback) ───────────────────────────────────

  /**
   * Pre-build a haptic pattern for instant later playback. Pair with
   * `playPreloaded` for hot paths fired hundreds of times (typing ticks,
   * scroll feedback, button mashing). Reduces per-call latency from ~5-10ms
   * to under 1ms.
   *
   * @example
   * // Once, on mount:
   * await RichHaptics.preload({ id: 'typeTick', intensity: 0.25, sharpness: 0.8 });
   *
   * // Hot path:
   * keyboard.addEventListener('keydown', () => RichHaptics.playPreloaded({ id: 'typeTick' }));
   *
   * // Don't forget:
   * RichHaptics.unload({ id: 'typeTick' });
   *
   * @example
   * // Preload a full pattern, not just a single tap:
   * await RichHaptics.preload({ id: 'celebration', pattern: patterns.successFanfare });
   */
  preload(options: PreloadOptions): Promise<void>;

  /** Fire a previously preloaded pattern with sub-millisecond start latency. */
  playPreloaded(options: PlayPreloadedOptions): Promise<void>;

  /** Release a preloaded pattern from native memory. */
  unload(options: UnloadOptions): Promise<void>;

  // ── Audio resources for synchronized audio + haptics (iOS only) ──────────

  /**
   * Register an audio file from the iOS bundle so AHAP `EventWaveformPath`
   * entries can reference it. iOS only — no-op on Android/web.
   *
   * @example
   * await RichHaptics.registerAudio({ id: 'click', filename: 'click.wav' });
   * const pattern = ahap()
   *   .tap({ intensity: 1, sharpness: 1 })
   *   .audio({ id: 'click', volume: 1 })
   *   .build();
   * await RichHaptics.playPattern({ pattern });
   */
  registerAudio(options: RegisterAudioOptions): Promise<void>;

  /**
   * Inspect current native engine state — useful for debugging when haptics
   * unexpectedly go silent. Reports the running engine, preloaded count, active
   * continuous players, registered audio, and the last native error if any.
   *
   * @example
   * const d = await RichHaptics.getDiagnostics();
   * console.log(`engine=${d.engine} running=${d.engineRunning} preloaded=${d.preloadedCount}`);
   */
  getDiagnostics(): Promise<DiagnosticsResult>;

  // ── Global enable / disable (kill switch) ────────────────────────────────

  /**
   * App-wide kill switch. When disabled, every `play*` / `preset` / `playPreloaded`
   * / `playPattern` / `startContinuous` call becomes a no-op. Useful for wiring
   * to a "Haptics" toggle in your settings UI without sprinkling `if (enabled)`
   * checks across the codebase.
   *
   * The flag lives in memory on the native side — persist it yourself
   * (Preferences, localStorage, etc.) and replay on app launch if you want it
   * to survive restarts. Defaults to `true`.
   *
   * @example
   * await RichHaptics.setEnabled({ enabled: settingsStore.hapticsOn });
   */
  setEnabled(options: SetEnabledOptions): Promise<void>;

  /**
   * Whether the kill switch is currently on. Distinct from `isSupported().userEnabled`,
   * which reflects OS-level Reduce Motion / system haptics — this one is the
   * app-level override.
   */
  isEnabled(): Promise<IsEnabledResult>;

  // ── Event subscription (inherited from Capacitor's WebPlugin) ────────────

  /**
   * Subscribe to a plugin event. Currently only `'engineDidReset'` is emitted
   * — fired on iOS when the haptic engine is forced to restart (audio session
   * interruption like a phone call). Use this to rebuild any preloaded patterns.
   */
  addListener(eventName: RichHapticsEvent, listenerFunc: () => void): Promise<PluginListenerHandle>;

  /** Remove all subscribers attached via `addListener`. */
  removeAllListeners(): Promise<void>;

  // ── Global intensity scale ───────────────────────────────────────────────

  /**
   * Multiply every haptic's intensity by this scale (0.0–1.0). Useful for
   * "Haptic intensity" sliders in user settings, or for soft-mode during
   * focus mode / late-night UX. Scale of 0 effectively disables haptics
   * (use `setEnabled(false)` for a true kill switch); scale of 1.0 is the
   * default (no scaling).
   *
   * Applies to `play`, `preset`, `playPattern`, `startContinuous`, and
   * `preload` (with intensity option). Does NOT retroactively rescale
   * already-preloaded patterns — call `unload` + `preload` to re-apply.
   *
   * @example
   * await RichHaptics.setIntensityScale({ scale: settingsStore.hapticIntensity });
   */
  setIntensityScale(options: SetIntensityScaleOptions): Promise<void>;

  /** Read the current global intensity scale. Default 1.0. */
  getIntensityScale(): Promise<IntensityScaleResult>;
}

export interface SetIntensityScaleOptions {
  /** 0.0–1.0. Values outside the range are clamped. Default 1.0. */
  scale: number;
}

export interface IntensityScaleResult {
  scale: number;
}

export interface SetEnabledOptions {
  enabled: boolean;
}

export interface IsEnabledResult {
  enabled: boolean;
}
