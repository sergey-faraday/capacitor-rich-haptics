# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.3] – 2026-05-04

### Changed

- **README trimmed from 675 to 153 lines.** Was a full reference doc duplicating most of `AGENT.md` / `CLAUDE.md`. Now a focused landing page: highlights, install, quick start, compatibility, live-modulation demo, migration codemod, "why this exists", license, plus a pointer to `AGENT.md` for the deep guide. Big tables (60 patterns, 29 presets) moved out of the npm landing page; they remain in `AGENT.md`. No code or API changes.
- **README hero** now shows two animated pattern timelines (`heartbeat`, `levelUp`) generated via the plugin's own `renderHapticTimelineSVG`. Replaces the previous broken `./media/playground.gif` placeholder.

## [0.10.2] – 2026-05-03

### Fixed

- **iOS `play()` channel leak (CoreHaptics error -10851)** — every transient `play()` call appended its `CHHapticPatternPlayer` to a private array that was never cleared. After ~32 rapid plays (the iOS Core Haptics per-engine player-channel limit) every subsequent `engine.makePlayer(with:)` failed with `"Unable to add an additional player channel"`, error code -10851. Hot paths (typewriter `keyTap` preset, breathing exercises, fast button mashing) hit the wall reliably within seconds. Apple-recommended pattern is fire-and-forget for transient patterns — the player can be released after `start(atTime:)`, and the engine reclaims the channel when the haptic finishes. `transientPlayers` array removed; `stop()` now only halts continuous players (transients are <50ms and complete before `stop()` returns). `preset()` benefits transitively since it goes through `play()` internally.

### Changed

- **`isAHAPPattern` JSDoc example** no longer uses `fetch()`. The example was triggering Socket.dev's static "Network access" alert (it was in a comment, not real code), which showed a yellow warning on the package page. Replaced with `JSON.parse(rawAhapString)` — same teaching value, no false positive. The plugin has never made network calls.

## [0.10.1] – 2026-05-03

### Fixed

- **Repository / homepage / bugs URLs** now point to `github.com/sergey-faraday/...` (with hyphen) — the actual GitHub username. v0.10.0 shipped with `sergeyfaraday` (no hyphen), which 404s on GitHub. Same fix applied to the podspec, README badges, issue-template `Discussions` link, playground page, and example app footer.
- **`bin` field** in `package.json` rewritten from `./bin/cli.js` to `bin/cli.js`. npm 11 silently strips bin entries with the `./` prefix on publish; v0.10.0's `npx capacitor-rich-haptics ...` command did not work as a result.

## [0.10.0] – 2026-05-03

### Fixed — lint + formatting

- **`.eslintignore`** added — eslint was scanning `dist/`, `playground/`, etc. and reporting 1200+ false errors on auto-generated `.d.ts` files. Now scoped to `src/` only.
- **`.prettierignore`** added — same scoping for prettier.
- **`.prettierrc.json`** populated with the actual `@ionic/prettier-config` content + `prettier-plugin-java` registration. Previously was a string reference that prettier didn't resolve, breaking Java formatting.
- **Explicit return types** on `useHaptics` / `useHapticDrag` / `HapticTimeline` / `HapticButton` / `HapticPressable` to satisfy `@typescript-eslint/explicit-module-boundary-types`.
- **Auto-fixed type-only imports** across all source files (1200+ `consistent-type-imports` errors).
- **Sequence test rewrite** — the "rejected promise from RichHaptics call does not abort sequence" test was tautological (mock never rejected). Now actually injects a rejecting `preset` mid-sequence and verifies the sequence continues.
- **Lint result: 0 errors, 0 warnings.** Achieved by:
  - Adding `argsIgnorePattern: '^_'` / `varsIgnorePattern: '^_'` to the unused-vars rule (standard convention for intentionally unused interface params — was 6 warnings).
  - Override for `*.test.ts` files to allow `no-non-null-assertion` (tactical assertions in test fixtures are normal — was 20 warnings).
  - Removing dead `lastTop` variable in `useHapticScroll` (React).
  - Removing unused `HapticPreset` import in `testing.ts`.
  - Replacing 3 source-side non-null assertions with proper guards (`recorder.ts` arm closure capture, `vue.ts` rAF callback closure capture, `web.ts` `ensureAudioCtx` local-then-assign).

### Changed — documentation consolidation

- **`CLAUDE.md` is now the single canonical agent + contributor guide.** Previously split between `CLAUDE.md` (135 lines, contributor-focused) and `AGENT.md` (401 lines, consumer-focused), which meant Claude Code only saw half the content and other AI tooling only saw the other half.
- **`AGENT.md` is now an auto-generated mirror** of `CLAUDE.md`. The new `scripts/sync-docs.js` regenerates it on every `npm run build` (hooked via `npm run sync-docs`). Both files have identical content so any AI tool — Claude Code, Cursor, Aider, generic `AGENTS.md` readers — sees the full guide regardless of which filename it reads.
- **New `Extending the plugin` section** in CLAUDE.md (~250 lines) covering:
  - Adding a preset to your **own app** (3 paths: alias, custom `play()`, AHAP builder)
  - Adding a preset to **the plugin** itself (worked example: `doorbell` across 5 files — definitions.ts, web.ts, iOS Swift, Android Java, README)
  - Adding a pattern to the plugin (single file with `androidPrimitive` hint guide)
  - Adding a transform (conventions + example)
  - **Tuning the feel** — full reference for picking intensity / sharpness / duration values, with real-world physical metaphors (Lego snap, distant thunder, pencil tap on paper, etc.)
- Added top-level "Quick navigation" table so each audience finds its sections fast.

### Added

- **`sequence()` builder** at `capacitor-rich-haptics/sequence` — compose haptic timelines from steps (`preset`, `play`, `pattern`, `wait`, `custom`). Returns an immutable `HapticSequence` with `.play() → { promise, cancel }`, `.repeat(n)`, `.then(other)`. Cleaner than chained `setTimeout` and reusable. 12 unit tests covering ordering, cancellation, repeat, then-chaining, nested flattening.
- **Global intensity scale** — `RichHaptics.setIntensityScale({ scale })` / `getIntensityScale()`. Applies to `play`, `preset`, `playPattern` (walks AHAP and multiplies HapticIntensity values), `startContinuous`, `updateParameters`, `preload`. Implemented natively on iOS Swift (with `applyIntensityScale` AHAP walker), Android Java, web, mock. Doesn't retroactively rescale already-preloaded patterns — document.
- **Tree-shakeable patterns** — every pattern is now a top-level `export const`. Combined with `"sideEffects": false` in `package.json`, modern bundlers (Rollup, esbuild, Webpack 5+, Vite) strip unused patterns:
  ```ts
  import { heartbeat } from 'capacitor-rich-haptics';  // ~1 KB
  // vs the legacy
  import { patterns } from 'capacitor-rich-haptics';   // ~50 KB
  ```
  Backward-compatible — the `patterns` object still works for playgrounds and pattern pickers.
- **README** — new sections for Sequence builder, Global intensity scale, Tree-shaking patterns. Features list updated.

### Stats
- 277 tests passing (+12 from 0.9.0). Coverage holding at 94%+.
- 18 plugin methods (added `setIntensityScale`, `getIntensityScale`).
- 12 subpath exports (added `./sequence`).

## [0.9.0] – Unreleased

### Added — preset vocabulary expansion

- **10 more presets** — total now **29** (was 19 in 0.8.0). New additions, organized by use case:
  - **Selection/picker**: `detent` (between `scrollTick` and `selectionStrong`)
  - **Notification family**: `info` (neutral notification), `alert` (attention without alarm)
  - **UI actions**: `expand`, `collapse`, `pop`
  - **Physical metaphors**: `subtle` (barely-there ambient), `keyTap` (keyboard typing), `bump` (soft collision), `loadingPulse` (slow ambient rumble)
- All 10 implemented natively on iOS Swift (`presetParams`), Android Java (`playPresetByName` with appropriate primitive selection — `PRIMITIVE_LOW_TICK` for `subtle`, `PRIMITIVE_QUICK_FALL` for `collapse`, `PRIMITIVE_THUD` for `bump`, etc.), web (durations + Web Audio fallback), and mock plugin.
- **README has a categorized preset reference** — 8 sub-tables organized by domain so users can find the right preset for their interaction.

## [0.8.0] – Unreleased

### Added — vocabulary expansion

- **12 new presets** mapping to UIKit + Android `HapticFeedbackConstants`:
  - **UIKit-aligned impacts**: `mediumImpact`, `heavyImpact`, `softImpact`, `rigidImpact` — match `UIImpactFeedbackGenerator` styles directly. Drop-in replacements for `Haptics.impact({ style: ... })` from `@capacitor/haptics`.
  - **Selection family**: `selectionStrong` (sharper than `scrollTick` for snap-to-value).
  - **Gestures**: `longPress`, `dragStart`, `dragEnd` — paired with Android `EFFECT_HEAVY_CLICK` and Composition primitives.
  - **Lighter notifications**: `confirm` (softer than `success`), `reject` (softer than `error`) — for inline form validation, action acknowledgements.
  - **Toggle**: `toggleOn`, `toggleOff` — distinct rising/falling tick for switches.
- **Total presets: 19** (was 7). Native implementations on iOS / Android / web / mock; full `HapticPreset` type union.

- **15 new patterns** for app-specific use cases:
  - **UI flow**: `tabSwitch`, `pageTransition`, `modalOpen`, `modalClose`, `pullThreshold`, `pullRelease`, `copy`, `paste`.
  - **Notifications**: `messageReceive` (rising taps), `messageSend` (fading whoosh).
  - **Social** (new category): `liked` (heart filling rising), `share` (ascending sparkles).
  - **Effects**: `cardFlip` (tick + spin + click), `pageTurn` (4× lowTick rustle).
  - **Security**: `unlock` (ascending taps).
- All new patterns use the `androidPrimitive` hint API (introduced in 0.7.0) — they auto-render on Android 12+ with the correct primitives (`spin`, `slowRise`, `quickFall`, `lowTick`, `tick`, `click`, `thud`).
- **Total patterns: 60** (was 45). New `social` category added — categories now 12.

### Stats
- 265 tests passing (was 220). The parametric pattern test contributes +3 tests per pattern.
- Coverage holds at 93%+ (no source code, just data additions).

## [0.7.0] – Unreleased

### Added — Tier 1 (parity with top haptic libraries)

- **App-wide kill switch**: `RichHaptics.setEnabled({ enabled: false })` / `isEnabled()`. Implemented natively on iOS, Android, web, and the mock plugin. While disabled, every `play* / preset / playPattern / startContinuous / playPreloaded` call is a no-op. Wire to a settings UI toggle without sprinkling `if (enabled)` checks across the codebase.
- **Extended Android primitive coverage**: previously used 3 of 8 `VibrationEffect.Composition` primitives (CLICK / TICK / THUD); now uses all 8. New: `LOW_TICK` (auto-detected for very faint taps), `SPIN`, `QUICK_RISE`, `SLOW_RISE`, `QUICK_FALL`. Opt-in per event via `ahap().tap({ androidPrimitive: 'spin' })` or `continuous({ androidPrimitive: 'quickRise' })`. iOS strips the hint before sending to Core Haptics.
- **5 built-in patterns updated** to use the new primitives — `levelUp` (slowRise + click), `jump` (quickRise + click), `gameOver` (thud + 2× quickFall), `boing` (click + spin), `ratchet` (5× tick), `explosion` (click + thud). Real fidelity win on Android 12+.
- **`@capacitor/docgen` integration** — `npm run docgen` generates `dist/docs.json` from the `RichHapticsPlugin` interface JSDoc. Standard Capacitor plugin convention; consumed by IDEs and dashboards. README is hand-written and not overwritten.
- **GitHub issue/PR templates** — `bug_report.yml` (asks for `getDiagnostics()` output, device, plugin/Capacitor versions), `feature_request.yml`, `config.yml` (links Discussions + Apple HIG), `PULL_REQUEST_TEMPLATE.md`.

### Added — Tier 2 (DX improvements)

- **`<HapticButton>` and `<HapticPressable>`** for React + Vue. Drop-in replacements for raw `<button>` / `<div role="button">` that fire a haptic on press by default. Configurable trigger event (`pointerDown` / `pointerUp` / `click`), preset or full pattern.
- **`useReducedMotion()`** hook (React + Vue). Returns true when haptics should be suppressed — combines OS Reduce Motion + app kill switch + hardware support. Auto-rechecks on `engineDidReset`.
- **Pattern recorder/replayer** — `createHapticRecorder()` wraps a plugin and captures every call as `{ method, args, at }`. Replay schedules calls at original offsets via `setTimeout`. Available at `capacitor-rich-haptics/recorder` subpath.
- **Type guards expanded**: `addListener` / `removeAllListeners` are now part of the `RichHapticsPlugin` interface (previously inherited from `WebPlugin` and not type-visible). `PluginListenerHandle` exported.
- **README hero media slot** — `./media/playground.gif` placeholder + `media/README.md` with recording instructions (ffmpeg/gifski commands, recommended specs).

### Stats
- 220 tests passing (up from 213). New test files: `recorder.test.ts`. Coverage 93%.
- 11 subpath exports (added `./recorder`).
- 16 plugin methods (added `setEnabled`, `isEnabled`).

## [0.6.0] – Unreleased

### Added
- **Code coverage**: `npm run test:coverage` runs vitest with v8 coverage. CI uploads the report. Thresholds: 80% lines / 80% statements / 80% functions / 75% branches. Currently passing at 93% / 93% / 98% / 83%.
- **Type guards**: `isAHAPPattern(value)` (structural type guard) and `validateAHAP(value)` (deeper checker returning issue list). Use to validate server-provided patterns before play. Subpath: `capacitor-rich-haptics/validate`.
- **Real Android compile in CI**: workflow now runs `gradle :rich-haptics:assembleRelease` against `@capacitor/android`, catching real Java compile errors instead of just a `javac --version` smoke test.
- **`vercel.json`** in `playground/` for one-command deployment to Vercel.
- **README**: compatibility matrix (Capacitor 6/7/8, platform versions, framework adapters), CI/npm/coverage/license badges.
- **8 new tests** for `validate.ts` plus expanded `sync` (BPMLoop with fake timers) and `testing` (continuous, preload, audio, listeners) coverage. Total 207 tests.

## [0.5.0] – Unreleased

### Added
- **Vitest test suite** — 189 tests covering builder, transforms, patterns library, sync, visualizer, mock plugin. Run with `npm test`.
- **Migration codemod**: `npx capacitor-rich-haptics migrate <files...> [--write]` rewrites `@capacitor/haptics` calls to `capacitor-rich-haptics` equivalents (impact, notification, selection, vibrate). Defaults to dry-run.
- **Performance benchmark suite**: `npm run bench` runs 10000-sample microbenchmarks of the JS layer. Results documented in `bench/RESULTS.md` — every operation sub-millisecond.
- **`getDiagnostics()`** plugin method on iOS, Android, web, and mock — returns `{ engine, engineRunning, preloadedCount, activeContinuousPlayers, registeredAudioCount, lastError }` for debugging.
- **VSCode snippets**: 10 snippets in `.vscode/capacitor-rich-haptics.code-snippets` (rh-button, rh-drag, rh-preload, rh-pattern, rh-bpm, rh-mock, rh-helper, rh-respect, rh-import, rh-use).
- **AGENT.md "Common pitfalls" section** — 10 mistakes AI agents tend to make, with bad/good examples.

### Fixed
- iOS engine now records `lastError` for diagnostics on init failure.

## [0.4.0] – Unreleased

### Added
- **Pattern interpolation**: `morph(a, b, t)` linearly interpolates between two patterns of identical structure. Use for smooth state transitions.
- **`getPatternDuration(pattern)`**: public helper exported from `transforms`.
- **BPM sync**: `startBPMLoop({ bpm, pattern, every?, count? })` returns `{ stop }` for metronomic haptic loops; `msPerBeat(bpm)` helper.
- **SVG visualizer**: `renderHapticTimelineSVG(pattern, options)` returns a self-contained SVG string. Top half = intensity, bottom = sharpness, dashed = parameter curves.
- **`<HapticTimeline>`**: React + Vue components wrapping the SVG renderer with optional `playOnClick`.
- **CLI** (`npx capacitor-rich-haptics`): `validate`, `info`, `list`, `export`, `render` commands. Useful in CI for AHAP file validation.
- **Playground**: static HTML site at `playground/` for live AHAP authoring with the Pattern Builder. Deployable to Vercel/GH Pages.
- **`CLAUDE.md`**: contributor guide for AI agents and humans working on the plugin.
- **`AGENT.md`**: integration guide for AI agents adding this plugin to user apps.
- Subpath exports for `/sync` and `/visualizer`.
- Substantially expanded JSDoc with `@example` blocks across all public methods.

### Changed
- Refactored: extracted `registerPlugin` call into `src/plugin.ts` to break circular dependency between barrel exports and modules that need the plugin instance (sync, react, vue).

## [0.3.0] – Unreleased

### Added
- **Vue 3 composables**: `useHaptics`, `useHapticScroll`, `useHapticDrag` under `capacitor-rich-haptics/vue`.
- **15 new patterns** across game (`gameOver`, `jump`, `hit`, `powerUp`, `parry`, `shield`), music (`drumKick`, `drumSnare`, `pianoKey`, `guitarStrum`), camera (`shutter`, `focusLock`), nature (`thunder`, `wind`), mechanical (`gearShift`, `dialPad`, `ratchet`), ui (`refreshPull`, `swipeReveal`, `deletePop`), notifications (`ping`, `gentleWakeup`), effects (`bounce`, `balloonPop`), finance (`paymentSuccess`), security (`biometricSuccess`, `biometricFail`). Total now 45+.
- **Pattern category tags**: `patternsByCategory(category)` helper; each pattern carries `Metadata.category` and `Metadata.description`.
- **Pattern transformations**: `combine`, `repeat`, `scale`, `stretch`, `reverse`, `delay` under `capacitor-rich-haptics/transforms`.
- **Test utilities**: `createMockHaptics()` for Jest/Vitest under `capacitor-rich-haptics/testing` — records every call, supports `reset()` and `callsTo(method)`.
- **Engine reset events**: `RichHaptics.addListener('engineDidReset', ...)` fires when iOS Core Haptics engine resets (audio session interruption). Preloaded patterns are auto-invalidated; subscribe to re-preload.
- Subpath exports for `/vue`, `/transforms`, `/testing`.

## [0.2.0] – Unreleased

### Added
- **Live parameter modulation**: `startContinuous`, `updateParameters`, `stopPlayer` for in-flight intensity/sharpness changes via `CHHapticAdvancedPatternPlayer`. Android simulates with ~30Hz re-trigger.
- **Pattern preloading**: `preload`, `playPreloaded`, `unload` for sub-millisecond playback latency. Caches `CHHapticPatternPlayer` natively on iOS, `VibrationEffect` on Android.
- **AHAP Pattern Builder**: fluent `ahap()` API with `tap`, `continuous`, `audio`, `wait`, `at`, `ramp`, `rampIntensity`, `rampSharpness`, `meta`, `build`.
- **`playPattern()`**: takes a builder result or AHAP-shaped object directly (no JSON stringification needed).
- **Built-in pattern library**: 18 ready-made AHAP patterns under `capacitor-rich-haptics/patterns`.
- **Synchronized audio**: `registerAudio` for AHAP `EventWaveformPath` (iOS Core Haptics audio events).
- **Reduce Motion respect**: `isSupported()` now returns `userEnabled` flag (false when iOS Reduce Motion is enabled).
- **Web Audio fallback**: desktop browsers without `navigator.vibrate` get tiny audio clicks for preview.
- **React adapter**: `capacitor-rich-haptics/react` with `useHaptics`, `useHapticScroll`, `useHapticDrag`.
- **Android predefined effects**: presets now use `EFFECT_CLICK` / `EFFECT_DOUBLE_CLICK` / `EFFECT_HEAVY_CLICK` / `EFFECT_TICK` where supported (API 29+).
- **Full AHAP TypeScript types**: `AHAPPattern`, `AHAPEvent`, `AHAPEventParameter`, `AHAPParameterCurve`, etc.
- Subpath exports for `/react`, `/patterns`, `/ahap`.

### Changed
- Peer dependency widened to `@capacitor/core >=6.0.0` (was 7+ only).
- `isSupported()` result now includes `userEnabled: boolean`.
- iOS `CHHapticEngine.playsHapticsOnly` flipped to `false` to allow AHAP audio events.
- Android continuous vibrations now use Composition re-triggering for live modulation, falling back to `createOneShot` when modulation isn't requested.

## [0.1.0] – Initial release

### Added
- iOS `CHHapticEngine` with `play(intensity, sharpness, duration)`, `playAHAP(name)`, `playAHAPFromString(json)`.
- Android `VibrationEffect.Composition` primitives on API 31+, with graceful fallback to `createOneShot` and `vibrate(ms)`.
- Web `navigator.vibrate` fallback.
- Cross-platform `preset` API: `softTap`, `sharpClick`, `scrollTick`, `gentlePulse`, `success`, `warning`, `error`.
- Engine lifecycle handling (pause on background, restart on reset).
