# Performance benchmarks

JS-only benchmarks of the operations the plugin performs in the JavaScript thread before crossing the Capacitor bridge. Native haptic latency (the actual time from JS call to haptic firing on the device) is measured separately on real hardware — see `example/` to test on a device.

Run with: `npm run bench`

## Latest results

Sorted samples, 10000 runs each per operation. Node v22 on linux/x64.

| Operation | Avg | p50 | p99 |
|---|---:|---:|---:|
| `ahap().tap().build() — 1 event` | 896ns | 275ns | 2.16µs |
| `ahap()...build() — 5 events` | 777ns | 463ns | 1.52µs |
| `ahap()...build() — continuous + 2 ramps` | 1.29µs | 738ns | 2.61µs |
| `scale(heartbeat, {intensity: 0.5})` | 738ns | 388ns | 1.31µs |
| `stretch(heartbeat, 2)` | 375ns | 213ns | 679ns |
| `reverse(heartbeat)` | 504ns | 279ns | 1.44µs |
| `combine(heartbeat, successFanfare)` | 901ns | 752ns | 2.66µs |
| `repeat(heartbeat, 4)` | 945ns | 428ns | 2.90µs |
| `morph(heartbeat, heartbeat, 0.5)` | 1.08µs | 636ns | 2.66µs |
| `getPatternDuration(applause)` | 134ns | 89ns | 185ns |
| `JSON.stringify(heartbeat)` | 2.51µs | 2.28µs | 4.33µs |
| `JSON.parse(JSON.stringify(heartbeat))` | 7.36µs | 6.56µs | 21.59µs |
| `renderHapticTimelineSVG(heartbeat)` | 10.15µs | 8.68µs | 29.55µs |
| `renderHapticTimelineSVG(coinFlip)` | 12.59µs | 10.50µs | 36.00µs |
| `mock.preset({name: "softTap"})` | 339ns | 182ns | 456ns |
| `mock.play({intensity: 0.5})` | 610ns | 194ns | 1.52µs |

## Takeaways

- **Builder & transforms are sub-microsecond.** You can rebuild patterns inside an animation loop without breaking 60fps budget.
- **SVG render is ~10µs.** Cheap enough to re-render a `HapticTimeline` on every drag-pad update.
- **Pattern serialization round-trips in ~10µs.** Sending patterns over a websocket is fine.
- **Mock plugin overhead is ~200-600ns.** Tests run fast.

## What this doesn't measure

- Native haptic latency (from `RichHaptics.play()` call to felt vibration on iPhone). On A13+ devices, this is ~5-10ms cold and ~0.5-1ms with `playPreloaded`. To measure on a real device, instrument `RichHapticsEngine.play(...)` in `ios/Sources/RichHapticsPlugin/RichHaptics.swift` with `os_signpost`.
- Capacitor bridge overhead (JS → native message). Typically 1-3ms per call.
- Android `VibrationEffect.Composition` setup time on real devices.
