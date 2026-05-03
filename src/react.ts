import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from 'react';

import type { AHAPPattern, HapticPreset, IsSupportedResult, PlayOptions } from './definitions';
import { RichHaptics } from './plugin';
import { renderHapticTimelineSVG, type VisualizerOptions } from './visualizer';

export interface UseHapticsResult {
  /** Cached `isSupported()` result. `null` until the first check resolves. */
  support: IsSupportedResult | null;
  /** Direct play with intensity / sharpness / duration. */
  play: (options: PlayOptions) => Promise<void>;
  /** Cross-platform UX preset. */
  preset: (name: HapticPreset) => Promise<void>;
  /** Pre-build a tap so it fires with zero start latency. */
  preload: (id: string, options: PlayOptions) => Promise<void>;
  /** Fire a previously preloaded pattern. */
  playPreloaded: (id: string) => Promise<void>;
  /** Stop everything. */
  stop: () => Promise<void>;
}

/**
 * React hook for `capacitor-rich-haptics`.
 *
 * @example
 * const haptics = useHaptics();
 * <button onPointerDown={() => haptics.preset('softTap')}>Tap</button>
 */
export function useHaptics(): UseHapticsResult {
  const [support, setSupport] = useState<IsSupportedResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    RichHaptics.isSupported()
      .then((s) => {
        if (!cancelled) setSupport(s);
      })
      .catch(() => {
        if (!cancelled) setSupport({ supported: false, engine: 'none', userEnabled: true });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const play = useCallback((options: PlayOptions) => RichHaptics.play(options), []);
  const preset = useCallback((name: HapticPreset) => RichHaptics.preset({ name }), []);
  const preload = useCallback((id: string, options: PlayOptions) => RichHaptics.preload({ id, ...options }), []);
  const playPreloaded = useCallback((id: string) => RichHaptics.playPreloaded({ id }), []);
  const stop = useCallback(() => RichHaptics.stop(), []);

  return { support, play, preset, preload, playPreloaded, stop };
}

export interface UseHapticScrollOptions {
  /** Pixels of scroll between ticks. Default 50. */
  tickEvery?: number;
  /** Preset to fire on each tick. Default 'scrollTick'. */
  preset?: HapticPreset;
  /** Disable on this render. */
  disabled?: boolean;
}

/**
 * Fires a scrollTick haptic every N pixels of scroll on the target element.
 * Pass a ref to a scrollable element. Throttled with rAF and a configurable
 * pixel threshold so rapid scrolls don't stutter the haptic engine.
 */
export function useHapticScroll<T extends HTMLElement>(
  ref: React.RefObject<T>,
  { tickEvery = 50, preset = 'scrollTick', disabled = false }: UseHapticScrollOptions = {},
): void {
  const lastFiredAt = useRef(0);

  useEffect(() => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;

    let rafId: number | null = null;
    lastFiredAt.current = el.scrollTop;

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const top = el.scrollTop;
        if (Math.abs(top - lastFiredAt.current) >= tickEvery) {
          lastFiredAt.current = top;
          RichHaptics.preset({ name: preset }).catch(() => {
            /* noop */
          });
        }
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [ref, tickEvery, preset, disabled]);
}

export interface UseHapticDragOptions {
  /** Initial intensity. Default 0.3. */
  intensity?: number;
  /** Initial sharpness. Default 0.5. */
  sharpness?: number;
  /** Disable on this render. */
  disabled?: boolean;
}

export interface UseHapticDragResult {
  /** Pointer down — start a continuous haptic. */
  begin: () => Promise<void>;
  /** Pointer move — update intensity / sharpness in real time. */
  update: (params: { intensity?: number; sharpness?: number }) => Promise<void>;
  /** Pointer up — stop. */
  end: () => Promise<void>;
}

/**
 * Imperative continuous-haptic helper for drag gestures.
 * Wire `begin` to pointerdown, `update` to pointermove, and `end` to pointerup/leave.
 *
 * @example
 * const haptic = useHapticDrag();
 * <div
 *   onPointerDown={() => haptic.begin()}
 *   onPointerMove={(e) => haptic.update({ intensity: e.clientY / window.innerHeight })}
 *   onPointerUp={() => haptic.end()}
 * />
 */
export function useHapticDrag({
  intensity = 0.3,
  sharpness = 0.5,
  disabled = false,
}: UseHapticDragOptions = {}): UseHapticDragResult {
  const idRef = useRef<string | null>(null);

  const begin = useCallback(async () => {
    if (disabled) return;
    if (idRef.current) return;
    const { id } = await RichHaptics.startContinuous({ intensity, sharpness });
    idRef.current = id;
  }, [intensity, sharpness, disabled]);

  const update = useCallback(async (params: { intensity?: number; sharpness?: number }) => {
    if (!idRef.current) return;
    await RichHaptics.updateParameters({ id: idRef.current, ...params });
  }, []);

  const end = useCallback(async () => {
    if (!idRef.current) return;
    const id = idRef.current;
    idRef.current = null;
    await RichHaptics.stopPlayer({ id });
  }, []);

  useEffect(() => {
    return () => {
      if (idRef.current) {
        RichHaptics.stopPlayer({ id: idRef.current }).catch(() => {
          /* noop */
        });
      }
    };
  }, []);

  return { begin, update, end };
}

export interface HapticTimelineProps extends VisualizerOptions {
  pattern: AHAPPattern;
  className?: string;
  style?: CSSProperties;
  /** When true, plays the pattern when the component is clicked. Default false. */
  playOnClick?: boolean;
}

/**
 * Inline SVG visualizer for an AHAP pattern. Top half = intensity, bottom = sharpness,
 * dashed lines = parameter curves. Useful for design tools, debugging, and showcasing
 * patterns in your docs.
 *
 * @example
 * <HapticTimeline pattern={patterns.heartbeat} title="heartbeat" playOnClick />
 */
export function HapticTimeline(props: HapticTimelineProps): ReturnType<typeof createElement> {
  const { pattern, className, style, playOnClick, ...visualizerOptions } = props;
  const svg = useMemo(
    () => renderHapticTimelineSVG(pattern, visualizerOptions),
    [pattern, JSON.stringify(visualizerOptions)],
  );

  const onClick = useCallback(() => {
    if (!playOnClick) return;
    RichHaptics.playPattern({ pattern }).catch(() => {
      /* noop */
    });
  }, [pattern, playOnClick]);

  return createElement('div', {
    className,
    style: {
      cursor: playOnClick ? 'pointer' : undefined,
      lineHeight: 0,
      ...style,
    },
    role: playOnClick ? 'button' : undefined,
    onClick: playOnClick ? onClick : undefined,
    dangerouslySetInnerHTML: { __html: svg },
  });
}

// ─── Pre-built components ────────────────────────────────────────────────────

type HapticTriggerEvent = 'pointerDown' | 'pointerUp' | 'click';

export interface HapticButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Cross-platform preset to fire. Use `pattern` for richer feedback. */
  preset?: HapticPreset;
  /** Or a full AHAP pattern. Wins over `preset` when both are set. */
  pattern?: AHAPPattern;
  /** When to fire. Default `pointerDown` (feels most responsive). */
  hapticOn?: HapticTriggerEvent;
  /** Fail silently if the haptic call rejects. Default true. */
  swallowErrors?: boolean;
}

/**
 * `<button>` with a haptic that fires on press by default. Drop-in replacement
 * for raw `<button>` — saves writing `onPointerDown={() => RichHaptics.preset(...)}`
 * across the codebase.
 *
 * @example
 * <HapticButton preset="softTap" onClick={onClick}>Save</HapticButton>
 *
 * @example
 * <HapticButton pattern={patterns.successFanfare} hapticOn="click">
 *   Submit
 * </HapticButton>
 */
export function HapticButton(props: HapticButtonProps): ReturnType<typeof createElement> {
  const {
    preset = 'softTap',
    pattern,
    hapticOn = 'pointerDown',
    swallowErrors = true,
    onPointerDown,
    onPointerUp,
    onClick,
    children,
    ...rest
  } = props;

  const fire = useCallback(() => {
    const promise = pattern ? RichHaptics.playPattern({ pattern }) : RichHaptics.preset({ name: preset });
    if (swallowErrors)
      promise.catch(() => {
        /* noop */
      });
    return promise;
  }, [preset, pattern, swallowErrors]);

  return createElement(
    'button',
    {
      ...rest,
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        if (hapticOn === 'pointerDown') fire();
        onPointerDown?.(e);
      },
      onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
        if (hapticOn === 'pointerUp') fire();
        onPointerUp?.(e);
      },
      onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
        if (hapticOn === 'click') fire();
        onClick?.(e);
      },
    },
    children,
  );
}

export interface HapticPressableProps extends HTMLAttributes<HTMLDivElement> {
  preset?: HapticPreset;
  pattern?: AHAPPattern;
  hapticOn?: HapticTriggerEvent;
  swallowErrors?: boolean;
  children?: ReactNode;
}

/**
 * Like `HapticButton` but renders a `<div role="button">` — for non-form
 * pressables (cards, list rows, custom toggles).
 */
export function HapticPressable(props: HapticPressableProps): ReturnType<typeof createElement> {
  const {
    preset = 'softTap',
    pattern,
    hapticOn = 'pointerDown',
    swallowErrors = true,
    onPointerDown,
    onPointerUp,
    onClick,
    children,
    role = 'button',
    tabIndex = 0,
    ...rest
  } = props;

  const fire = useCallback(() => {
    const promise = pattern ? RichHaptics.playPattern({ pattern }) : RichHaptics.preset({ name: preset });
    if (swallowErrors)
      promise.catch(() => {
        /* noop */
      });
    return promise;
  }, [preset, pattern, swallowErrors]);

  return createElement(
    'div',
    {
      ...rest,
      role,
      tabIndex,
      onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
        if (hapticOn === 'pointerDown') fire();
        onPointerDown?.(e);
      },
      onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
        if (hapticOn === 'pointerUp') fire();
        onPointerUp?.(e);
      },
      onClick: (e: React.MouseEvent<HTMLDivElement>) => {
        if (hapticOn === 'click') fire();
        onClick?.(e);
      },
    },
    children,
  );
}

// ─── Accessibility hook ──────────────────────────────────────────────────────

/**
 * Returns `true` when haptics should be suppressed: either the OS-level Reduce
 * Motion is on, or the user disabled them via `RichHaptics.setEnabled(false)`,
 * or the device has no vibration hardware.
 *
 * Re-checks on `engineDidReset`. Wire to your accessibility-aware components
 * to silently skip haptics without sprinkling `if` checks everywhere.
 *
 * @example
 * const reduced = useReducedMotion();
 * <button onPointerDown={() => !reduced && haptic.preset('success')}>Save</button>
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const [support, enabled] = await Promise.all([RichHaptics.isSupported(), RichHaptics.isEnabled()]);
        if (cancelled) return;
        setReduced(!support.supported || !support.userEnabled || !enabled.enabled);
      } catch {
        if (!cancelled) setReduced(false);
      }
    };
    check();

    let listener: { remove: () => Promise<void> } | undefined;
    RichHaptics.addListener('engineDidReset', () => check())
      .then((handle) => {
        listener = handle;
      })
      .catch(() => {
        /* noop */
      });

    return () => {
      cancelled = true;
      listener?.remove().catch(() => {
        /* noop */
      });
    };
  }, []);

  return reduced;
}
