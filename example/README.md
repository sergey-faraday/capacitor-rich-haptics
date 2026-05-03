# Rich Haptics Demo

Minimal Capacitor app for showcasing every feature of `capacitor-rich-haptics`:

- Live sliders for intensity, sharpness, duration
- Buttons for all 7 cross-platform presets
- Bundle AHAP file (`Heartbeat.ahap`)
- AHAP from runtime JSON string (boing, rumble)
- `isSupported()` engine readout at the top

## Running

```bash
# from the plugin root, build the plugin first
cd ..
npm install
npm run build

# back into example
cd example
npm install
npx cap add ios       # or: npx cap add android
```

Drop `ahap/Heartbeat.ahap` into the iOS app target (Xcode → drag into `App/App/`, ensure "Copy items if needed" is checked).

```bash
npm run ios
# or
npm run android
```

Open the demo on a physical device — most simulators / emulators do not produce haptics.

## What to look for

- iPhone with A13+ chip → engine reads `core-haptics`, full intensity/sharpness mapping, AHAP plays as authored
- Pixel 6+ / API 31+ → engine reads `composition`, sharpness picks `PRIMITIVE_CLICK` / `TICK` / `THUD`
- Older Android → engine reads `basic`, intensity-only via `createOneShot`
- Web (any mobile browser) → engine reads `web`, single buzz via `navigator.vibrate`
