# Demo media for the README

The README shows a hero image at `./media/playground.gif`. Record yours like this — the goal is to **show on screen** what the user can't feel through the page.

## Recording haptics so they're visible

iPhone's haptic engine is silent through your laptop speakers. You have a few options:

1. **Quiet room screen recording.** Use iOS Screen Recording with the device close to a directional mic (iPhone built-in is fine). Convert to GIF with [`ffmpeg`](https://ffmpeg.org/) or [`gifski`](https://gif.ski/).
2. **Visual proxy.** Animate a circle/dot on screen that scales with `intensity` — viewers see the haptic envelope even without sound. The playground (`/playground/`) does this; record it.
3. **Two-camera shot.** Phone in foreground, hand interacting in shot, audio off. Adds emotional weight but harder to scope to <2 MB.

## Recommended specs

| File | Purpose | Width | Length | Format |
|---|---|---|---|---|
| `playground.gif` | Hero — drag pad with intensity ramp | 600 px | 5–10 s | gif (≤2 MB) or webm |
| `pattern-library.gif` | Catalog scroll showing 45+ patterns | 800 px | 8 s | gif (≤2 MB) |
| `recorder.gif` | record() → stop() → replay() flow | 600 px | 6 s | gif |
| `hero-screenshot.png` | Static fallback for npm cards | 1200 × 630 | — | png/jpg |

## Convert MOV → GIF (one-liner)

```bash
ffmpeg -i input.mov -vf "fps=15,scale=600:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
  -loop 0 playground.gif

# Then compress further with gifsicle:
gifsicle -O3 --lossy=80 playground.gif -o playground.gif
```

## Convert MOV → WebM (better quality, ~5× smaller)

```bash
ffmpeg -i input.mov -c:v libvpx-vp9 -b:v 0 -crf 35 -an playground.webm
```

If you go WebM, change the README hero image tag to `<video autoplay loop muted playsinline />`.

## What NOT to record

- **Static phone shots** — viewers can't tell anything is happening.
- **Real apps with private data** — use the demo playground or example app.
- **Loud audio** — the haptic motor's buzz is the audio cue; muffle other sound.
- **Hands obscuring the screen** — scope tight to the interactive element.
