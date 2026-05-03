import { WebPlugin } from '@capacitor/core';

import type {
  AHAPElement,
  AHAPEvent,
  DiagnosticsResult,
  HapticPreset,
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

const isEvent = (el: AHAPElement): el is { Event: AHAPEvent } => 'Event' in el;

const PRESET_DURATIONS_MS: Record<HapticPreset, number | number[]> = {
  // Original 7
  softTap: 12,
  sharpClick: 18,
  scrollTick: 8,
  gentlePulse: 200,
  success: [12, 60, 12],
  warning: [40, 80, 40],
  error: [60, 60, 60, 60, 60],
  // UIKit-aligned impacts
  mediumImpact: 20,
  heavyImpact: 32,
  softImpact: 24,
  rigidImpact: 14,
  // Selection
  selectionStrong: 10,
  detent: 9,
  // Gestures
  longPress: 30,
  dragStart: 14,
  dragEnd: 12,
  // Lighter notification family
  confirm: [12, 50, 12],
  reject: [16, 60, 16],
  info: 14,
  alert: 22,
  // Toggle
  toggleOn: 14,
  toggleOff: 12,
  // UI actions
  expand: 12,
  collapse: 14,
  pop: 12,
  // Specific physical metaphors
  subtle: 6,
  keyTap: 8,
  bump: 16,
  loadingPulse: 800,
};

const PRESET_AUDIO: Record<HapticPreset, { freq: number; duration: number; gain: number }> = {
  softTap: { freq: 320, duration: 0.02, gain: 0.04 },
  sharpClick: { freq: 1200, duration: 0.012, gain: 0.06 },
  scrollTick: { freq: 1800, duration: 0.006, gain: 0.04 },
  gentlePulse: { freq: 110, duration: 0.18, gain: 0.05 },
  success: { freq: 880, duration: 0.05, gain: 0.06 },
  warning: { freq: 220, duration: 0.08, gain: 0.07 },
  error: { freq: 90, duration: 0.12, gain: 0.08 },
  mediumImpact: { freq: 250, duration: 0.025, gain: 0.06 },
  heavyImpact: { freq: 140, duration: 0.04, gain: 0.09 },
  softImpact: { freq: 90, duration: 0.04, gain: 0.06 },
  rigidImpact: { freq: 1500, duration: 0.01, gain: 0.07 },
  selectionStrong: { freq: 2000, duration: 0.008, gain: 0.05 },
  detent: { freq: 1600, duration: 0.008, gain: 0.04 },
  longPress: { freq: 180, duration: 0.06, gain: 0.07 },
  dragStart: { freq: 400, duration: 0.018, gain: 0.05 },
  dragEnd: { freq: 280, duration: 0.014, gain: 0.04 },
  confirm: { freq: 700, duration: 0.04, gain: 0.05 },
  reject: { freq: 180, duration: 0.06, gain: 0.06 },
  info: { freq: 600, duration: 0.025, gain: 0.05 },
  alert: { freq: 900, duration: 0.04, gain: 0.07 },
  toggleOn: { freq: 1000, duration: 0.012, gain: 0.05 },
  toggleOff: { freq: 500, duration: 0.014, gain: 0.04 },
  expand: { freq: 380, duration: 0.02, gain: 0.04 },
  collapse: { freq: 220, duration: 0.025, gain: 0.04 },
  pop: { freq: 1300, duration: 0.012, gain: 0.05 },
  subtle: { freq: 360, duration: 0.008, gain: 0.025 },
  keyTap: { freq: 1100, duration: 0.008, gain: 0.045 },
  bump: { freq: 80, duration: 0.04, gain: 0.07 },
  loadingPulse: { freq: 80, duration: 0.6, gain: 0.04 },
};

export class RichHapticsWeb extends WebPlugin implements RichHapticsPlugin {
  private hasVibrate = false;
  private audioCtx: AudioContext | null = null;
  private continuousNodes = new Map<string, { osc: OscillatorNode; gain: GainNode }>();
  private nextId = 1;
  private enabled = true;
  private intensityScale = 1.0;

  constructor() {
    super();
    this.hasVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  async isSupported(): Promise<IsSupportedResult> {
    const supported = this.hasVibrate || this.hasAudioContext();
    return {
      supported,
      engine: supported ? 'web' : 'none',
      userEnabled: true,
    };
  }

  async play(options: PlayOptions): Promise<void> {
    if (!this.enabled) return;
    const intensity = (options.intensity ?? 1) * this.intensityScale;
    if (this.hasVibrate) {
      const ms =
        options.duration && options.duration > 0
          ? Math.round(options.duration * 1000)
          : Math.max(1, Math.round(15 * intensity));
      navigator.vibrate(ms);
    } else {
      this.playAudioClick(intensity, options.sharpness ?? 0.5, options.duration ?? 0.02);
    }
  }

  async preset(options: PresetOptions): Promise<void> {
    if (!this.enabled) return;
    if (this.hasVibrate) {
      navigator.vibrate(this.scaleVibrationPattern(PRESET_DURATIONS_MS[options.name] ?? 15));
    } else {
      const params = PRESET_AUDIO[options.name] ?? PRESET_AUDIO.softTap;
      this.playAudioClickRaw(params.freq, params.duration, params.gain * this.intensityScale);
    }
  }

  async playPattern(options: PlayPatternOptions): Promise<void> {
    if (!this.enabled) return;
    if (this.hasVibrate) {
      const pattern = this.patternToVibration(options.pattern);
      navigator.vibrate(pattern.length > 0 ? pattern : this.scaleVibrationPattern(30));
    } else {
      this.playAudioClickRaw(440, 0.04, 0.05 * this.intensityScale);
    }
  }

  async playAHAP(): Promise<void> {
    if (!this.enabled) return;
    if (this.hasVibrate) navigator.vibrate(20);
  }

  async playAHAPFromString(): Promise<void> {
    if (!this.enabled) return;
    if (this.hasVibrate) navigator.vibrate(20);
  }

  async stop(): Promise<void> {
    if (this.hasVibrate) navigator.vibrate(0);
    for (const [, node] of this.continuousNodes) {
      try {
        node.osc.stop();
      } catch {
        /* noop */
      }
    }
    this.continuousNodes.clear();
  }

  async startContinuous(options: StartContinuousOptions): Promise<StartContinuousResult> {
    const id = `web-${this.nextId++}`;
    if (!this.enabled || !this.hasAudioContext()) return { id };

    const ctx = this.ensureAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 60 + (options.sharpness ?? 0.5) * 200;
    gain.gain.value = (options.intensity ?? 0.5) * this.intensityScale * 0.05;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    this.continuousNodes.set(id, { osc, gain });
    return { id };
  }

  async updateParameters(options: UpdateParametersOptions): Promise<void> {
    const node = this.continuousNodes.get(options.id);
    if (!node || !this.audioCtx) return;
    const t = this.audioCtx.currentTime;
    if (options.intensity !== undefined) {
      node.gain.gain.linearRampToValueAtTime(options.intensity * this.intensityScale * 0.05, t + 0.02);
    }
    if (options.sharpness !== undefined) {
      node.osc.frequency.linearRampToValueAtTime(60 + options.sharpness * 200, t + 0.02);
    }
  }

  async stopPlayer(options: PlayerOptions): Promise<void> {
    const node = this.continuousNodes.get(options.id);
    if (!node) return;
    try {
      node.osc.stop();
    } catch {
      /* noop */
    }
    this.continuousNodes.delete(options.id);
  }

  async preload(_: PreloadOptions): Promise<void> {
    // Web has no meaningful preload; accept the call so cross-platform code works.
  }

  async playPreloaded(_: PlayPreloadedOptions): Promise<void> {
    if (!this.enabled) return;
    if (this.hasVibrate) navigator.vibrate(this.scaleVibrationPattern(15));
  }

  async unload(_: UnloadOptions): Promise<void> {
    // No-op on web.
  }

  async registerAudio(_: RegisterAudioOptions): Promise<void> {
    // No-op on web (this is for iOS AHAP audio events).
  }

  async getDiagnostics(): Promise<DiagnosticsResult> {
    const support = await this.isSupported();
    return {
      engine: support.engine,
      engineRunning: support.supported,
      preloadedCount: 0,
      activeContinuousPlayers: this.continuousNodes.size,
      registeredAudioCount: 0,
      lastError: null,
    };
  }

  async setEnabled(options: SetEnabledOptions): Promise<void> {
    this.enabled = !!options.enabled;
    if (!this.enabled) await this.stop();
  }

  async isEnabled(): Promise<IsEnabledResult> {
    return { enabled: this.enabled };
  }

  async setIntensityScale(options: SetIntensityScaleOptions): Promise<void> {
    this.intensityScale = Math.max(0, Math.min(1, options.scale ?? 1));
  }

  async getIntensityScale(): Promise<IntensityScaleResult> {
    return { scale: this.intensityScale };
  }

  // ── Web Audio fallback for desktop preview ────────────────────────────────

  private hasAudioContext(): boolean {
    return (
      typeof window !== 'undefined' &&
      (typeof (window as any).AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined')
    );
  }

  private ensureAudioCtx(): AudioContext {
    if (this.audioCtx) return this.audioCtx;
    const Ctor = (window as any).AudioContext ?? (window as any).webkitAudioContext;
    const ctx = new Ctor() as AudioContext;
    this.audioCtx = ctx;
    return ctx;
  }

  private playAudioClick(intensity: number, sharpness: number, duration: number) {
    if (!this.hasAudioContext()) return;
    const freq = 100 + sharpness * 1500;
    const dur = Math.max(0.005, duration);
    const gain = Math.max(0.005, intensity * 0.08);
    this.playAudioClickRaw(freq, dur, gain);
  }

  private playAudioClickRaw(freq: number, duration: number, gain: number) {
    if (!this.hasAudioContext()) return;
    const ctx = this.ensureAudioCtx();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const now = ctx.currentTime;
    osc.frequency.value = freq;
    gainNode.gain.setValueAtTime(gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gainNode).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private scaleVibrationPattern(pattern: number | number[]): number | number[] {
    if (this.intensityScale <= 0) return 0;
    if (typeof pattern === 'number') return Math.max(1, Math.round(pattern * this.intensityScale));
    return pattern.map((value, index) =>
      index % 2 === 0 ? Math.max(1, Math.round(value * this.intensityScale)) : Math.max(0, Math.round(value)),
    );
  }

  private patternToVibration(pattern: PlayPatternOptions['pattern']): number[] {
    if (this.intensityScale <= 0) return [];
    const events = pattern.Pattern.filter(isEvent)
      .filter((el) => el.Event.EventType === 'HapticTransient' || el.Event.EventType === 'HapticContinuous')
      .map((el) => {
        const intensity =
          el.Event.EventParameters?.find((p) => p.ParameterID === 'HapticIntensity')?.ParameterValue ?? 1;
        const duration =
          el.Event.EventType === 'HapticContinuous'
            ? Math.max(1, Math.round((el.Event.EventDuration ?? 0.03) * 1000))
            : Math.max(1, Math.round(15 * intensity * this.intensityScale));
        return {
          timeMs: Math.max(0, Math.round(el.Event.Time * 1000)),
          duration,
          intensity,
        };
      })
      .filter((event) => event.intensity * this.intensityScale > 0 && event.duration > 0)
      .sort((a, b) => a.timeMs - b.timeMs);

    const output: number[] = [];
    let cursor = 0;
    for (const event of events) {
      const pause = Math.max(0, event.timeMs - cursor);
      if (output.length === 0) {
        if (pause > 0) output.push(0, pause);
      } else {
        output.push(pause);
      }
      output.push(event.duration);
      cursor = event.timeMs + event.duration;
    }
    return output;
  }
}
