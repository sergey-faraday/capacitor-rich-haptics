# Contributing

Thanks for your interest! A few notes:

## Local setup

```bash
npm install
npm run build
```

## Running on a device

The plugin needs a Capacitor host app to test natively. Any Capacitor 7/8 project will do — install this package via local path:

```bash
# in your test app
npm install /path/to/capacitor-rich-haptics
npx cap sync
```

## Testing matrix

When changing native code, please test against:
- iOS A13+ device (haptics on) and a Simulator (haptics no-op)
- Android 12+ device (Composition primitives) and an Android 8 device or emulator (createOneShot fallback)

## Code style

- TS: `npm run lint` (eslint + prettier)
- Swift: keep style consistent with the existing `RichHaptics.swift`
- Java: 2-space indent, single-import lines

## PRs

Please update `CHANGELOG.md` under the `[Unreleased]` section.
