import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watchEffect,
  type PropType,
  type Ref,
} from 'vue';

import type { AHAPPattern, HapticPreset, IsSupportedResult, PlayOptions } from './definitions';
import { RichHaptics } from './plugin';
import { renderHapticTimelineSVG, type VisualizerOptions } from './visualizer';

/**
 * Vue 3 composable for `capacitor-rich-haptics`.
 *
 * @example
 * <script setup>
 * const haptics = useHaptics();
 * </script>
 *
 * <button @pointerdown="haptics.preset('softTap')">Tap</button>
 */
export function useHaptics(): {
  support: Ref<IsSupportedResult | null>;
  play: (options: PlayOptions) => Promise<void>;
  preset: (name: HapticPreset) => Promise<void>;
  preload: (id: string, options: PlayOptions) => Promise<void>;
  playPreloaded: (id: string) => Promise<void>;
  stop: () => Promise<void>;
} {
  const support: Ref<IsSupportedResult | null> = ref(null);

  onMounted(async () => {
    try {
      support.value = await RichHaptics.isSupported();
    } catch {
      support.value = { supported: false, engine: 'none', userEnabled: true };
    }
  });

  return {
    support,
    play: (options: PlayOptions) => RichHaptics.play(options),
    preset: (name: HapticPreset) => RichHaptics.preset({ name }),
    preload: (id: string, options: PlayOptions) => RichHaptics.preload({ id, ...options }),
    playPreloaded: (id: string) => RichHaptics.playPreloaded({ id }),
    stop: () => RichHaptics.stop(),
  };
}

export interface UseHapticScrollOptions {
  /** Pixels of scroll between ticks. Default 50. */
  tickEvery?: number;
  /** Preset to fire on each tick. Default 'scrollTick'. */
  preset?: HapticPreset;
  /** Disable when this becomes true. */
  disabled?: Ref<boolean> | boolean;
}

/**
 * Fires a haptic tick every N pixels of scroll. Pass a template ref of a scrollable element.
 *
 * @example
 * const scrollEl = ref<HTMLElement | null>(null);
 * useHapticScroll(scrollEl, { tickEvery: 50 });
 */
export function useHapticScroll(target: Ref<HTMLElement | null>, options: UseHapticScrollOptions = {}): void {
  const { tickEvery = 50, preset = 'scrollTick' } = options;
  let lastFiredAt = 0;
  let rafId: number | null = null;
  let bound: HTMLElement | null = null;

  const onScroll = () => {
    if (rafId !== null || !bound) return;
    const el = bound;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      const top = el.scrollTop;
      if (Math.abs(top - lastFiredAt) >= tickEvery) {
        lastFiredAt = top;
        RichHaptics.preset({ name: preset }).catch(() => {
          /* noop */
        });
      }
    });
  };

  const cleanup = () => {
    if (bound) {
      bound.removeEventListener('scroll', onScroll);
      bound = null;
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  watchEffect(() => {
    cleanup();
    const el = target.value;
    if (!el) return;
    const isDisabled = typeof options.disabled === 'object' ? options.disabled.value : options.disabled;
    if (isDisabled) return;
    bound = el;
    lastFiredAt = el.scrollTop;
    el.addEventListener('scroll', onScroll, { passive: true });
  });

  onBeforeUnmount(cleanup);
}

export interface UseHapticDragOptions {
  intensity?: number;
  sharpness?: number;
  disabled?: Ref<boolean> | boolean;
}

/**
 * Imperative continuous-haptic helper for drag gestures.
 * Wire `begin` to pointerdown, `update` to pointermove, `end` to pointerup/leave.
 */
export function useHapticDrag(options: UseHapticDragOptions = {}): {
  begin: () => Promise<void>;
  update: (params: { intensity?: number; sharpness?: number }) => Promise<void>;
  end: () => Promise<void>;
} {
  const { intensity = 0.3, sharpness = 0.5 } = options;
  let playerId: string | null = null;

  const isDisabled = () => (typeof options.disabled === 'object' ? options.disabled.value : options.disabled);

  const begin = async () => {
    if (isDisabled() || playerId) return;
    const { id } = await RichHaptics.startContinuous({ intensity, sharpness });
    playerId = id;
  };

  const update = async (params: { intensity?: number; sharpness?: number }) => {
    if (!playerId) return;
    await RichHaptics.updateParameters({ id: playerId, ...params });
  };

  const end = async () => {
    if (!playerId) return;
    const id = playerId;
    playerId = null;
    await RichHaptics.stopPlayer({ id });
  };

  onBeforeUnmount(() => {
    if (playerId) {
      RichHaptics.stopPlayer({ id: playerId }).catch(() => {
        /* noop */
      });
    }
  });

  return { begin, update, end };
}

/**
 * Inline SVG visualizer for an AHAP pattern.
 *
 * @example
 * <HapticTimeline :pattern="patterns.heartbeat" title="heartbeat" play-on-click />
 */
export const HapticTimeline = defineComponent({
  name: 'HapticTimeline',
  props: {
    pattern: { type: Object as PropType<AHAPPattern>, required: true },
    width: { type: Number, default: undefined },
    height: { type: Number, default: undefined },
    duration: { type: Number, default: undefined },
    background: { type: String, default: undefined },
    intensityColor: { type: String, default: undefined },
    sharpnessColor: { type: String, default: undefined },
    axisColor: { type: String, default: undefined },
    showAxis: { type: Boolean, default: true },
    title: { type: String, default: undefined },
    playOnClick: { type: Boolean, default: false },
  },
  setup(props) {
    const svg = computed(() => {
      const opts: VisualizerOptions = {
        width: props.width,
        height: props.height,
        duration: props.duration,
        background: props.background,
        intensityColor: props.intensityColor,
        sharpnessColor: props.sharpnessColor,
        axisColor: props.axisColor,
        showAxis: props.showAxis,
        title: props.title,
      };
      return renderHapticTimelineSVG(props.pattern, opts);
    });

    const onClick = () => {
      if (!props.playOnClick) return;
      RichHaptics.playPattern({ pattern: props.pattern }).catch(() => {
        /* noop */
      });
    };

    return () =>
      h('div', {
        style: {
          cursor: props.playOnClick ? 'pointer' : undefined,
          lineHeight: 0,
        },
        role: props.playOnClick ? 'button' : undefined,
        onClick: props.playOnClick ? onClick : undefined,
        innerHTML: svg.value,
      });
  },
});

// ─── Pre-built components ────────────────────────────────────────────────────

const HAPTIC_TRIGGERS = ['pointerDown', 'pointerUp', 'click'] as const;
type HapticTriggerEvent = (typeof HAPTIC_TRIGGERS)[number];

function makeHapticHandlers(
  preset: HapticPreset,
  pattern: AHAPPattern | undefined,
  hapticOn: HapticTriggerEvent,
  swallowErrors: boolean,
) {
  const fire = () => {
    const promise = pattern ? RichHaptics.playPattern({ pattern }) : RichHaptics.preset({ name: preset });
    if (swallowErrors)
      promise.catch(() => {
        /* noop */
      });
    return promise;
  };
  return {
    onPointerdown:
      hapticOn === 'pointerDown'
        ? () => {
            fire();
          }
        : undefined,
    onPointerup:
      hapticOn === 'pointerUp'
        ? () => {
            fire();
          }
        : undefined,
    onClick:
      hapticOn === 'click'
        ? () => {
            fire();
          }
        : undefined,
  };
}

/**
 * `<button>` with a haptic that fires on press by default. Drop-in for raw
 * `<button>` that handles the haptic call for you.
 *
 * @example
 * <HapticButton preset="softTap" @click="onClick">Save</HapticButton>
 */
export const HapticButton = defineComponent({
  name: 'HapticButton',
  props: {
    preset: { type: String as PropType<HapticPreset>, default: 'softTap' },
    pattern: { type: Object as PropType<AHAPPattern>, default: undefined },
    hapticOn: { type: String as PropType<HapticTriggerEvent>, default: 'pointerDown' },
    swallowErrors: { type: Boolean, default: true },
  },
  setup(props, { slots, attrs }) {
    return () => {
      const handlers = makeHapticHandlers(props.preset, props.pattern, props.hapticOn, props.swallowErrors);
      return h('button', { ...attrs, ...handlers }, slots.default?.());
    };
  },
});

/** Like `HapticButton` but renders a `<div role="button">`. */
export const HapticPressable = defineComponent({
  name: 'HapticPressable',
  props: {
    preset: { type: String as PropType<HapticPreset>, default: 'softTap' },
    pattern: { type: Object as PropType<AHAPPattern>, default: undefined },
    hapticOn: { type: String as PropType<HapticTriggerEvent>, default: 'pointerDown' },
    swallowErrors: { type: Boolean, default: true },
  },
  setup(props, { slots, attrs }) {
    return () => {
      const handlers = makeHapticHandlers(props.preset, props.pattern, props.hapticOn, props.swallowErrors);
      return h('div', { role: 'button', tabindex: 0, ...attrs, ...handlers }, slots.default?.());
    };
  },
});

// ─── Accessibility composable ────────────────────────────────────────────────

/**
 * Reactive boolean — `true` when haptics should be suppressed (Reduce Motion,
 * `setEnabled(false)`, or no hardware). Re-checks on `engineDidReset`.
 *
 * @example
 * <script setup>
 * const reduced = useReducedMotion();
 * </script>
 *
 * <button @pointerdown="!reduced.value && haptic.preset('success')">Save</button>
 */
export function useReducedMotion(): Ref<boolean> {
  const reduced = ref(false);
  let listener: { remove: () => Promise<void> } | undefined;
  let cancelled = false;

  const check = async () => {
    try {
      const [support, enabled] = await Promise.all([RichHaptics.isSupported(), RichHaptics.isEnabled()]);
      if (cancelled) return;
      reduced.value = !support.supported || !support.userEnabled || !enabled.enabled;
    } catch {
      if (!cancelled) reduced.value = false;
    }
  };

  onMounted(() => {
    check();
    RichHaptics.addListener('engineDidReset', () => check())
      .then((handle) => {
        listener = handle;
      })
      .catch(() => {
        /* noop */
      });
  });

  onBeforeUnmount(() => {
    cancelled = true;
    listener?.remove().catch(() => {
      /* noop */
    });
  });

  return reduced;
}
