# capacitor-rich-haptics

[![CI](https://github.com/sergey-faraday/capacitor-rich-haptics/actions/workflows/ci.yml/badge.svg)](https://github.com/sergey-faraday/capacitor-rich-haptics/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/capacitor-rich-haptics)](https://www.npmjs.com/package/capacitor-rich-haptics)
[![coverage](https://img.shields.io/badge/coverage-93%25-brightgreen)](./bench/RESULTS.md)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

Native-quality haptic feedback for Capacitor — the same nuanced taps and textures you feel in first-party iOS apps, with a real Core Haptics engine, live parameter modulation, AHAP playback, native preloading, and a built-in pattern library.

<!--
  Pattern timelines below are rendered via the plugin's own renderHapticTimelineSVG.
  For real on-device recordings (drag-pad, recorder flow, etc.) see ./media/README.md.
-->

<p align="center">
  <img src="./media/heartbeat.gif" alt="heartbeat pattern — two pairs of transient taps with the playhead sweeping over 1.08s" width="700" />
  <br/>
  <em>The <code>heartbeat</code> pattern — four <code>HapticTransient</code> events, classic two-stage rhythm.</em>
</p>

<p align="center">
  <img src="./media/levelUp.gif" alt="levelUp pattern — sustained continuous bar with intensity ramp, capped by a final tap" width="700" />
  <br/>
  <em>The <code>levelUp</code> pattern — sustained <code>HapticContinuous</code> with a rising intensity ramp, then a single accent tap.</em>
</p>

> The official `@capacitor/haptics` plugin only exposes the legacy `UIImpactFeedbackGenerator` API (Light / Medium / Heavy). This plugin gives you the full **Core Haptics** engine on iOS — custom intensity, sharpness, continuous vibrations, AHAP files, and **live parameter modulation** — and maps the same API to Android's modern **`VibrationEffect.Composition`** primitives.

## Highlights

- **Core Haptics** on iOS + **`VibrationEffect.Composition`** on Android behind one API
- **AHAP playback** from bundle file, runtime JSON, or the fluent `ahap()` builder
- **Live parameter modulation** — change intensity/sharpness during a continuous haptic
- **60 built-in patterns** across 12 categories — tree-shakeable per pattern (~1 KB each)
- **29 cross-platform UX presets** — `softTap`, `success`, `error`, `mediumImpact`, etc.
- **React + Vue adapters** — `useHaptics`, `useHapticDrag`, `<HapticButton>`
- **App-wide kill switch** + **global intensity scale** for settings UIs
- **Reduce Motion** respected automatically
- **CLI** for validate / list / export / render / migrate

For recipes, transforms, sequence builder, recorder, diagnostics, BPM loops, SVG visualizer, testing utilities, AI-agent guide, and contributing — see the **[full guide in AGENT.md](./AGENT.md)** (auto-mirrored as `CLAUDE.md`).

## Install

```bash
npm install capacitor-rich-haptics
npx cap sync
```

Requires Capacitor 6+. iOS 14+. Android API 23+.

## Quick start

```ts
import { RichHaptics, ahap, patterns } from 'capacitor-rich-haptics';

// 1. Detect support
const { supported, engine, userEnabled } = await RichHaptics.isSupported();
// → engine: 'core-haptics' | 'composition' | 'basic' | 'web' | 'none'

// 2. Cross-platform preset (start here)
await RichHaptics.preset({ name: 'sharpClick' });

// 3. Custom haptic
await RichHaptics.play({ intensity: 0.8, sharpness: 0.4 });

// 4. Built-in pattern
await RichHaptics.playPattern({ pattern: patterns.heartbeat });

// 5. Build your own
const myPattern = ahap()
  .tap({ intensity: 1.0, sharpness: 0.9 })
  .wait(0.2)
  .continuous({ duration: 0.5, intensity: 0.6, sharpness: 0.2 })
  .rampIntensity({ from: 0.6, to: 0.0, duration: 0.5 })
  .build();
await RichHaptics.playPattern({ pattern: myPattern });
```

## Compatibility

| Capacitor | Status |
|---|---|
| **8.x / 7.x** | ✅ Tested, recommended |
| **6.x** | ✅ Supported (min peer) |
| **5.x and below** | ❌ Use `@capacitor/haptics` instead |

| Platform | Min version | Engine on supported devices |
|---|---|---|
| **iOS** | 14.0 | `CHHapticEngine` on A13+ chips (iPhone 11 / iPad Pro 2020+). Older devices get a no-op. |
| **Android** | API 23 (Android 6) | `VibrationEffect.Composition` on API 31+ • `createOneShot` on API 26+ • `vibrate(ms)` on older |
| **Web** | Modern browsers | `navigator.vibrate` on mobile • Web Audio click on desktop |

| Framework adapter | Min |
|---|---|
| React | 17+ |
| Vue | 3.0+ |
| Angular / Solid / Svelte / vanilla | works via the core `RichHaptics` plugin (no adapter needed) |

## Live parameter modulation

The Core Haptics feature that motivated this plugin — modulate intensity and sharpness mid-playback. Drag gestures, sliders, loaders, breathing animations:

```ts
const { id } = await RichHaptics.startContinuous({ intensity: 0.3, sharpness: 0.5 });

element.addEventListener('pointermove', (e) => {
  RichHaptics.updateParameters({
    id,
    intensity: e.clientY / window.innerHeight,
    sharpness: e.clientX / window.innerWidth,
  });
});

element.addEventListener('pointerup', () => RichHaptics.stopPlayer({ id }));
```

On Android the plugin simulates this by re-triggering `Composition` primitives at ~30 Hz — not as smooth as iOS, but works. React/Vue users get a more ergonomic version via `useHapticDrag` — see the full guide.

## Migrating from `@capacitor/haptics`

Run the codemod:

```bash
npx capacitor-rich-haptics migrate ./src --write
npm uninstall @capacitor/haptics
npm install capacitor-rich-haptics
npx cap sync
```

It rewrites `Haptics.impact(...)`, `Haptics.notification(...)`, `Haptics.selectionStart/Changed/End`, and `Haptics.vibrate(...)` to their `RichHaptics` equivalents. The full mapping table is in [`AGENT.md`](./AGENT.md#migration-from-capacitorhaptics).

## Why this exists

`@capacitor/haptics` wraps `UIImpactFeedbackGenerator`, which caps you at three preset weights and zero composability. Apps with custom UX — typing taps, slider scrubbing, milestone celebrations, breathing exercises, drag gestures — need **fine-grained control** over intensity & sharpness, **live modulation** during playback, and **composed AHAP patterns**. That requires `CHHapticEngine` on iOS and `VibrationEffect.Composition` on Android — both wrapped by this plugin behind one API.

## Full documentation

The deep guide lives in **[`AGENT.md`](./AGENT.md)** (auto-mirrored to `CLAUDE.md` so Claude Code, Cursor, Aider, and other AI tooling all read the same content):

- Decision tree — "user wants X → use Y" — for every preset and pattern
- All 29 presets and 60 patterns with iOS/Android tuning tables
- Recipes for React, Vue, and vanilla JS
- Pattern transformations, sequence builder, recorder, diagnostics
- BPM loops, SVG visualizer, testing utilities
- Engine reset events, accessibility, platform behaviour matrix
- Synchronized audio (iOS), CLI, live playground
- "What NOT to do" — common pitfalls
- Contributing guide — adding presets, patterns, transforms

## License

MIT © Sergey Faraday
