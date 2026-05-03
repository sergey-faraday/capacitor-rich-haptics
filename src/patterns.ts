import { ahap } from './ahap';
import type { AHAPPattern } from './definitions';

export type PatternCategory =
  | 'body'
  | 'nature'
  | 'mechanical'
  | 'ui'
  | 'game'
  | 'music'
  | 'camera'
  | 'notifications'
  | 'effects'
  | 'finance'
  | 'security'
  | 'social';

const tag = (category: PatternCategory, description: string) => (b: ReturnType<typeof ahap>) =>
  b.meta('category', category).meta('description', description);

// ─── Body ────────────────────────────────────────────────────────────────

export const heartbeat: AHAPPattern = tag(
  'body',
  'Two-stage heartbeat, repeated.',
)(
  ahap()
    .tap({ intensity: 1.0, sharpness: 0.4 })
    .wait(0.18)
    .tap({ intensity: 0.7, sharpness: 0.3 })
    .wait(0.72)
    .tap({ intensity: 1.0, sharpness: 0.4 })
    .wait(0.18)
    .tap({ intensity: 0.7, sharpness: 0.3 }),
).build();

export const breatheIn: AHAPPattern = tag(
  'body',
  'Slow inhale — gentle build-up.',
)(
  ahap()
    .continuous({ duration: 1.6, intensity: 0.3, sharpness: 0.0 })
    .rampIntensity({ from: 0.3, to: 0.7, duration: 1.6 }),
).build();

export const breatheOut: AHAPPattern = tag(
  'body',
  'Slow exhale — fade to silence.',
)(
  ahap()
    .continuous({ duration: 2.0, intensity: 0.7, sharpness: 0.0 })
    .rampIntensity({ from: 0.7, to: 0.0, duration: 2.0 }),
).build();

// ─── Nature ──────────────────────────────────────────────────────────────

export const waterDrop: AHAPPattern = tag(
  'nature',
  'Splash — sharp hit then a soft dampening.',
)(
  ahap()
    .tap({ intensity: 0.4, sharpness: 0.9 })
    .wait(0.05)
    .continuous({ duration: 0.25, intensity: 0.5, sharpness: 0.2 })
    .rampIntensity({ from: 0.5, to: 0.0, duration: 0.25 }),
).build();

export const raindrops: AHAPPattern = tag(
  'nature',
  'Random light raindrops over ~1s.',
)(
  ahap()
    .tap({ intensity: 0.4, sharpness: 0.95, time: 0.0 })
    .tap({ intensity: 0.6, sharpness: 0.95, time: 0.13 })
    .tap({ intensity: 0.3, sharpness: 0.95, time: 0.27 })
    .tap({ intensity: 0.5, sharpness: 0.95, time: 0.42 })
    .tap({ intensity: 0.7, sharpness: 0.95, time: 0.55 })
    .tap({ intensity: 0.4, sharpness: 0.95, time: 0.7 })
    .tap({ intensity: 0.5, sharpness: 0.95, time: 0.84 }),
).build();

export const thunder: AHAPPattern = tag(
  'nature',
  'Distant rumble climbing into a sharp crack.',
)(
  ahap()
    .continuous({ duration: 0.8, intensity: 0.3, sharpness: 0.0 })
    .rampIntensity({ from: 0.3, to: 1.0, duration: 0.8 })
    .tap({ intensity: 1.0, sharpness: 1.0, time: 0.85 })
    .continuous({ duration: 0.6, intensity: 0.7, sharpness: 0.0, time: 0.9 })
    .rampIntensity({ from: 0.7, to: 0.0, duration: 0.6, time: 0.9 }),
).build();

export const wind: AHAPPattern = tag(
  'nature',
  'Gusty hum — breath of air through trees.',
)(
  ahap()
    .continuous({ duration: 1.5, intensity: 0.2, sharpness: 0.0 })
    .rampIntensity({ from: 0.2, to: 0.6, duration: 0.5 })
    .rampIntensity({ from: 0.6, to: 0.1, duration: 1.0, time: 0.5 }),
).build();

// ─── Mechanical ──────────────────────────────────────────────────────────

export const lockClick: AHAPPattern = tag(
  'mechanical',
  'Two-stage mechanical lock click.',
)(ahap().tap({ intensity: 0.6, sharpness: 0.9 }).wait(0.04).tap({ intensity: 1.0, sharpness: 1.0 })).build();

export const keyJangle: AHAPPattern = tag(
  'mechanical',
  'Cluster of high-frequency clinks.',
)(
  ahap()
    .tap({ intensity: 0.5, sharpness: 1.0, time: 0.0 })
    .tap({ intensity: 0.7, sharpness: 1.0, time: 0.04 })
    .tap({ intensity: 0.4, sharpness: 1.0, time: 0.09 })
    .tap({ intensity: 0.6, sharpness: 1.0, time: 0.16 })
    .tap({ intensity: 0.3, sharpness: 1.0, time: 0.22 }),
).build();

export const watchTick: AHAPPattern = tag(
  'mechanical',
  'Three even ticks — clock cadence.',
)(
  ahap()
    .tap({ intensity: 0.25, sharpness: 1.0, time: 0.0 })
    .tap({ intensity: 0.25, sharpness: 1.0, time: 0.5 })
    .tap({ intensity: 0.25, sharpness: 1.0, time: 1.0 }),
).build();

export const gearShift: AHAPPattern = tag(
  'mechanical',
  'Ratchet snap — two-stage detent.',
)(
  ahap()
    .continuous({ duration: 0.08, intensity: 0.5, sharpness: 0.7 })
    .tap({ intensity: 1.0, sharpness: 1.0, time: 0.1 }),
).build();

export const dialPad: AHAPPattern = tag(
  'mechanical',
  'Crisp telephone-button click.',
)(ahap().tap({ intensity: 0.7, sharpness: 1.0 })).build();

export const ratchet: AHAPPattern = tag(
  'mechanical',
  'Five evenly spaced sharp clicks.',
)(
  ahap()
    .tap({ intensity: 0.6, sharpness: 1.0, time: 0.0, androidPrimitive: 'tick' })
    .tap({ intensity: 0.6, sharpness: 1.0, time: 0.08, androidPrimitive: 'tick' })
    .tap({ intensity: 0.6, sharpness: 1.0, time: 0.16, androidPrimitive: 'tick' })
    .tap({ intensity: 0.6, sharpness: 1.0, time: 0.24, androidPrimitive: 'tick' })
    .tap({ intensity: 0.6, sharpness: 1.0, time: 0.32, androidPrimitive: 'tick' }),
).build();

// ─── UI ──────────────────────────────────────────────────────────────────

export const typewriter: AHAPPattern = tag(
  'ui',
  '6 staccato keystrokes — typewriter rhythm.',
)(
  ahap()
    .tap({ intensity: 0.5, sharpness: 0.95, time: 0.0 })
    .tap({ intensity: 0.55, sharpness: 0.95, time: 0.08 })
    .tap({ intensity: 0.5, sharpness: 0.95, time: 0.18 })
    .tap({ intensity: 0.6, sharpness: 0.95, time: 0.27 })
    .tap({ intensity: 0.5, sharpness: 0.95, time: 0.36 })
    .tap({ intensity: 0.55, sharpness: 0.95, time: 0.46 }),
).build();

export const refreshPull: AHAPPattern = tag(
  'ui',
  'Sustained tug then a sharp release tick.',
)(
  ahap()
    .continuous({ duration: 0.4, intensity: 0.4, sharpness: 0.3 })
    .rampIntensity({ from: 0.4, to: 0.8, duration: 0.4 })
    .tap({ intensity: 1.0, sharpness: 1.0, time: 0.45 }),
).build();

export const swipeReveal: AHAPPattern = tag(
  'ui',
  'Quick scrub — sliding feedback.',
)(
  ahap()
    .continuous({ duration: 0.15, intensity: 0.3, sharpness: 0.6 })
    .tap({ intensity: 0.6, sharpness: 1.0, time: 0.18 }),
).build();

export const deletePop: AHAPPattern = tag(
  'ui',
  'Sharp pop — destructive action.',
)(ahap().tap({ intensity: 1.0, sharpness: 1.0 }).tap({ intensity: 0.4, sharpness: 0.2, time: 0.05 })).build();

export const tabSwitch: AHAPPattern = tag(
  'ui',
  'Segment / tab change — quick rising click.',
)(
  ahap()
    .tap({ intensity: 0.4, sharpness: 0.6, androidPrimitive: 'tick' })
    .tap({ intensity: 0.7, sharpness: 1.0, time: 0.04, androidPrimitive: 'click' }),
).build();

export const pageTransition: AHAPPattern = tag(
  'ui',
  'Push/pop navigation — short fading slide.',
)(
  ahap()
    .continuous({ duration: 0.12, intensity: 0.4, sharpness: 0.5, androidPrimitive: 'slowRise' })
    .rampIntensity({ from: 0.4, to: 0.0, duration: 0.12 }),
).build();

export const modalOpen: AHAPPattern = tag(
  'ui',
  'Sheet rising — ramping continuous capped with a tick.',
)(
  ahap()
    .continuous({ duration: 0.2, intensity: 0.3, sharpness: 0.4, androidPrimitive: 'slowRise' })
    .rampIntensity({ from: 0.3, to: 0.7, duration: 0.2 })
    .tap({ intensity: 0.6, sharpness: 0.8, time: 0.2, androidPrimitive: 'tick' }),
).build();

export const modalClose: AHAPPattern = tag(
  'ui',
  'Sheet dismissing — soft tick then fading drop.',
)(
  ahap()
    .tap({ intensity: 0.6, sharpness: 0.4, androidPrimitive: 'tick' })
    .continuous({ duration: 0.18, intensity: 0.5, sharpness: 0.3, time: 0.04, androidPrimitive: 'quickFall' })
    .rampIntensity({ from: 0.5, to: 0.0, duration: 0.18, time: 0.04 }),
).build();

export const pullThreshold: AHAPPattern = tag(
  'ui',
  'Pull-to-refresh threshold — sharp confirming click.',
)(ahap().tap({ intensity: 1.0, sharpness: 1.0, androidPrimitive: 'click' })).build();

export const pullRelease: AHAPPattern = tag(
  'ui',
  'Pull released — soft fade-out confirm.',
)(
  ahap()
    .continuous({ duration: 0.1, intensity: 0.3, sharpness: 0.2, androidPrimitive: 'lowTick' })
    .rampIntensity({ from: 0.3, to: 0.0, duration: 0.1 }),
).build();

export const copy: AHAPPattern = tag(
  'ui',
  'Clipboard copy — two crisp ticks.',
)(
  ahap()
    .tap({ intensity: 0.5, sharpness: 0.9, androidPrimitive: 'tick' })
    .tap({ intensity: 0.5, sharpness: 0.9, time: 0.05, androidPrimitive: 'tick' }),
).build();

export const paste: AHAPPattern = tag(
  'ui',
  'Clipboard paste — small tick into a low thud.',
)(
  ahap()
    .tap({ intensity: 0.4, sharpness: 0.6, androidPrimitive: 'tick' })
    .tap({ intensity: 0.9, sharpness: 0.2, time: 0.1, androidPrimitive: 'thud' }),
).build();

// ─── Game ────────────────────────────────────────────────────────────────

export const levelUp: AHAPPattern = tag(
  'game',
  'Crescendo to a sharp resolving click.',
)(
  ahap()
    .continuous({
      duration: 0.3,
      intensity: 0.5,
      sharpness: 0.3,
      androidPrimitive: 'slowRise',
    })
    .rampIntensity({ from: 0.5, to: 1.0, duration: 0.3 })
    .rampSharpness({ from: 0.3, to: 0.9, duration: 0.3 })
    .wait(0.05)
    .tap({ intensity: 1.0, sharpness: 1.0, androidPrimitive: 'click' }),
).build();

export const explosion: AHAPPattern = tag(
  'game',
  'Sharp impact then a fading low rumble.',
)(
  ahap()
    .tap({ intensity: 1.0, sharpness: 1.0, androidPrimitive: 'click' })
    .continuous({
      duration: 0.6,
      intensity: 1.0,
      sharpness: 0.0,
      androidPrimitive: 'thud',
    })
    .rampIntensity({ from: 1.0, to: 0.0, duration: 0.6 }),
).build();

export const gameOver: AHAPPattern = tag(
  'game',
  'Three descending heavy thuds.',
)(
  ahap()
    .tap({ intensity: 1.0, sharpness: 0.4, androidPrimitive: 'thud' })
    .wait(0.18)
    .tap({ intensity: 0.7, sharpness: 0.2, androidPrimitive: 'quickFall' })
    .wait(0.22)
    .tap({ intensity: 0.4, sharpness: 0.0, androidPrimitive: 'quickFall' }),
).build();

export const jump: AHAPPattern = tag(
  'game',
  'Quick lift — light up-tick.',
)(
  ahap()
    .tap({ intensity: 0.5, sharpness: 0.6, androidPrimitive: 'quickRise' })
    .tap({ intensity: 0.8, sharpness: 1.0, time: 0.06, androidPrimitive: 'click' }),
).build();

export const hit: AHAPPattern = tag(
  'game',
  'Single hard impact.',
)(
  ahap()
    .tap({ intensity: 1.0, sharpness: 0.7 })
    .continuous({ duration: 0.08, intensity: 0.6, sharpness: 0.2, time: 0.02 }),
).build();

export const powerUp: AHAPPattern = tag(
  'game',
  'Six ascending sparkles into a click.',
)(
  ahap()
    .tap({ intensity: 0.3, sharpness: 1.0, time: 0.0 })
    .tap({ intensity: 0.4, sharpness: 1.0, time: 0.06 })
    .tap({ intensity: 0.5, sharpness: 1.0, time: 0.12 })
    .tap({ intensity: 0.6, sharpness: 1.0, time: 0.18 })
    .tap({ intensity: 0.8, sharpness: 1.0, time: 0.24 })
    .tap({ intensity: 1.0, sharpness: 1.0, time: 0.32 }),
).build();

export const parry: AHAPPattern = tag(
  'game',
  'Two crisp clicks — block-and-counter.',
)(ahap().tap({ intensity: 1.0, sharpness: 1.0 }).tap({ intensity: 0.7, sharpness: 1.0, time: 0.06 })).build();

export const shield: AHAPPattern = tag(
  'game',
  'Sustained pulse — protective hum.',
)(
  ahap()
    .continuous({ duration: 0.5, intensity: 0.5, sharpness: 0.2 })
    .rampSharpness({ from: 0.2, to: 0.6, duration: 0.5 }),
).build();

// ─── Music ───────────────────────────────────────────────────────────────

export const drumKick: AHAPPattern = tag(
  'music',
  'Low transient — kick drum thump.',
)(
  ahap()
    .tap({ intensity: 1.0, sharpness: 0.0 })
    .continuous({ duration: 0.08, intensity: 0.6, sharpness: 0.0, time: 0.0 })
    .rampIntensity({ from: 0.6, to: 0.0, duration: 0.08 }),
).build();

export const drumSnare: AHAPPattern = tag(
  'music',
  'Sharp transient with rattling tail.',
)(
  ahap()
    .tap({ intensity: 1.0, sharpness: 1.0 })
    .tap({ intensity: 0.4, sharpness: 1.0, time: 0.02 })
    .tap({ intensity: 0.3, sharpness: 1.0, time: 0.05 }),
).build();

export const pianoKey: AHAPPattern = tag(
  'music',
  'Soft attack with mid decay.',
)(
  ahap()
    .continuous({ duration: 0.25, intensity: 0.6, sharpness: 0.5, attack: 0.0, decay: 0.2 })
    .rampIntensity({ from: 0.6, to: 0.0, duration: 0.25 }),
).build();

export const guitarStrum: AHAPPattern = tag(
  'music',
  'Quick ascending sweep — six strings.',
)(
  ahap()
    .tap({ intensity: 0.7, sharpness: 0.4, time: 0.0 })
    .tap({ intensity: 0.7, sharpness: 0.5, time: 0.02 })
    .tap({ intensity: 0.7, sharpness: 0.6, time: 0.04 })
    .tap({ intensity: 0.7, sharpness: 0.7, time: 0.06 })
    .tap({ intensity: 0.7, sharpness: 0.8, time: 0.08 })
    .tap({ intensity: 0.7, sharpness: 0.9, time: 0.1 }),
).build();

// ─── Camera ──────────────────────────────────────────────────────────────

export const shutter: AHAPPattern = tag(
  'camera',
  'Two-stage SLR shutter — open and close.',
)(ahap().tap({ intensity: 0.7, sharpness: 1.0 }).wait(0.04).tap({ intensity: 1.0, sharpness: 1.0 })).build();

export const focusLock: AHAPPattern = tag(
  'camera',
  'Soft confirmation — focus snapped in.',
)(ahap().tap({ intensity: 0.4, sharpness: 0.7 })).build();

// ─── Notifications ───────────────────────────────────────────────────────

export const successFanfare: AHAPPattern = tag(
  'notifications',
  'Three rising taps — celebratory triad.',
)(
  ahap()
    .tap({ intensity: 0.6, sharpness: 0.5 })
    .wait(0.08)
    .tap({ intensity: 0.8, sharpness: 0.7 })
    .wait(0.08)
    .tap({ intensity: 1.0, sharpness: 0.9 }),
).build();

export const errorBuzz: AHAPPattern = tag(
  'notifications',
  'Three hard buzzes — strong negative.',
)(
  ahap()
    .continuous({ duration: 0.12, intensity: 1.0, sharpness: 0.9 })
    .wait(0.04)
    .continuous({ duration: 0.12, intensity: 1.0, sharpness: 0.9 })
    .wait(0.04)
    .continuous({ duration: 0.18, intensity: 1.0, sharpness: 0.9 }),
).build();

export const ping: AHAPPattern = tag(
  'notifications',
  'Single attention-grabbing tap.',
)(ahap().tap({ intensity: 0.5, sharpness: 1.0 }).tap({ intensity: 0.7, sharpness: 1.0, time: 0.18 })).build();

export const gentleWakeup: AHAPPattern = tag(
  'notifications',
  'Slow, soft rise — wake without alarm.',
)(
  ahap()
    .continuous({ duration: 1.5, intensity: 0.15, sharpness: 0.0 })
    .rampIntensity({ from: 0.15, to: 0.6, duration: 1.5 }),
).build();

export const messageReceive: AHAPPattern = tag(
  'notifications',
  'Incoming message — three rising taps.',
)(
  ahap()
    .tap({ intensity: 0.4, sharpness: 0.7 })
    .tap({ intensity: 0.6, sharpness: 0.9, time: 0.08, androidPrimitive: 'tick' })
    .tap({ intensity: 0.8, sharpness: 1.0, time: 0.16, androidPrimitive: 'click' }),
).build();

export const messageSend: AHAPPattern = tag(
  'notifications',
  'Outgoing message — fading whoosh.',
)(
  ahap()
    .continuous({ duration: 0.15, intensity: 0.6, sharpness: 0.8, androidPrimitive: 'quickFall' })
    .rampIntensity({ from: 0.6, to: 0.0, duration: 0.15 })
    .rampSharpness({ from: 0.8, to: 0.4, duration: 0.15 }),
).build();

// ─── Social ──────────────────────────────────────────────────────────────

export const liked: AHAPPattern = tag(
  'social',
  'Heart filling — rising into a sharp click.',
)(
  ahap()
    .continuous({ duration: 0.18, intensity: 0.4, sharpness: 0.3, androidPrimitive: 'slowRise' })
    .rampIntensity({ from: 0.4, to: 0.8, duration: 0.18 })
    .tap({ intensity: 1.0, sharpness: 1.0, time: 0.2, androidPrimitive: 'click' }),
).build();

export const share: AHAPPattern = tag(
  'social',
  'Share action — three ascending sparkles.',
)(
  ahap()
    .tap({ intensity: 0.4, sharpness: 1.0, time: 0.0, androidPrimitive: 'tick' })
    .tap({ intensity: 0.6, sharpness: 1.0, time: 0.06, androidPrimitive: 'tick' })
    .tap({ intensity: 0.9, sharpness: 1.0, time: 0.14, androidPrimitive: 'click' }),
).build();

// ─── Effects ─────────────────────────────────────────────────────────────

export const applause: AHAPPattern = tag(
  'effects',
  'Cluster of irregular sharp claps.',
)(
  ahap()
    .tap({ intensity: 0.5, sharpness: 1.0, time: 0.0 })
    .tap({ intensity: 0.7, sharpness: 1.0, time: 0.06 })
    .tap({ intensity: 0.4, sharpness: 1.0, time: 0.13 })
    .tap({ intensity: 0.6, sharpness: 1.0, time: 0.18 })
    .tap({ intensity: 0.8, sharpness: 1.0, time: 0.25 })
    .tap({ intensity: 0.5, sharpness: 1.0, time: 0.32 })
    .tap({ intensity: 0.7, sharpness: 1.0, time: 0.4 })
    .tap({ intensity: 0.4, sharpness: 1.0, time: 0.48 })
    .tap({ intensity: 0.6, sharpness: 1.0, time: 0.55 }),
).build();

export const magicSparkle: AHAPPattern = tag(
  'effects',
  'Twinkles fading into a high shimmer.',
)(
  ahap()
    .tap({ intensity: 0.3, sharpness: 1.0, time: 0.0 })
    .tap({ intensity: 0.45, sharpness: 1.0, time: 0.07 })
    .tap({ intensity: 0.3, sharpness: 1.0, time: 0.13 })
    .tap({ intensity: 0.6, sharpness: 1.0, time: 0.22 })
    .tap({ intensity: 0.35, sharpness: 1.0, time: 0.31 })
    .continuous({ duration: 0.3, intensity: 0.4, sharpness: 0.95, time: 0.4 })
    .rampIntensity({ from: 0.4, to: 0.0, duration: 0.3, time: 0.4 }),
).build();

export const boing: AHAPPattern = tag(
  'effects',
  'Spring snap — high impact then warbly tail.',
)(
  ahap()
    .tap({ intensity: 1.0, sharpness: 0.9, androidPrimitive: 'click' })
    .wait(0.05)
    .continuous({
      duration: 0.4,
      intensity: 0.6,
      sharpness: 0.2,
      androidPrimitive: 'spin',
    })
    .rampSharpness({ from: 0.2, to: 0.6, duration: 0.4 }),
).build();

export const rumble: AHAPPattern = tag(
  'effects',
  'Steady low rumble.',
)(ahap().continuous({ duration: 1.2, intensity: 0.5, sharpness: 0.0 })).build();

export const bounce: AHAPPattern = tag(
  'effects',
  'Decaying ricochet — three diminishing taps.',
)(
  ahap()
    .tap({ intensity: 1.0, sharpness: 0.6 })
    .tap({ intensity: 0.6, sharpness: 0.6, time: 0.12 })
    .tap({ intensity: 0.3, sharpness: 0.6, time: 0.22 }),
).build();

export const balloonPop: AHAPPattern = tag(
  'effects',
  'Sharp, brief pop.',
)(
  ahap().tap({ intensity: 1.0, sharpness: 1.0 }).continuous({ duration: 0.04, intensity: 0.3, sharpness: 0.4 }),
).build();

export const cardFlip: AHAPPattern = tag(
  'effects',
  'Card flip — tap, brief spin, landing tap.',
)(
  ahap()
    .tap({ intensity: 0.6, sharpness: 0.8, androidPrimitive: 'tick' })
    .continuous({ duration: 0.08, intensity: 0.3, sharpness: 0.5, time: 0.04, androidPrimitive: 'spin' })
    .tap({ intensity: 0.8, sharpness: 0.9, time: 0.12, androidPrimitive: 'click' }),
).build();

export const pageTurn: AHAPPattern = tag(
  'effects',
  'Book page turn — four soft rustling ticks.',
)(
  ahap()
    .tap({ intensity: 0.3, sharpness: 0.7, time: 0.0, androidPrimitive: 'lowTick' })
    .tap({ intensity: 0.4, sharpness: 0.7, time: 0.04, androidPrimitive: 'lowTick' })
    .tap({ intensity: 0.3, sharpness: 0.6, time: 0.08, androidPrimitive: 'lowTick' })
    .tap({ intensity: 0.5, sharpness: 0.8, time: 0.14, androidPrimitive: 'tick' }),
).build();

// ─── Finance ─────────────────────────────────────────────────────────────

export const coinFlip: AHAPPattern = tag(
  'finance',
  'Flip — launch click, mid-air whirr, landing thud.',
)(
  ahap()
    .tap({ intensity: 1.0, sharpness: 1.0 })
    .wait(0.06)
    .continuous({ duration: 0.4, intensity: 0.5, sharpness: 0.7 })
    .rampSharpness({ from: 0.7, to: 0.2, duration: 0.4 })
    .wait(0.05)
    .tap({ intensity: 0.8, sharpness: 0.5 }),
).build();

export const paymentSuccess: AHAPPattern = tag(
  'finance',
  'Quick triple tick — Apple Pay style.',
)(
  ahap()
    .tap({ intensity: 0.7, sharpness: 1.0, time: 0.0 })
    .tap({ intensity: 0.7, sharpness: 1.0, time: 0.07 })
    .tap({ intensity: 1.0, sharpness: 0.9, time: 0.16 }),
).build();

// ─── Security ────────────────────────────────────────────────────────────

export const biometricSuccess: AHAPPattern = tag(
  'security',
  'Soft rise resolving to a confirming tap.',
)(
  ahap()
    .continuous({ duration: 0.25, intensity: 0.4, sharpness: 0.5 })
    .rampIntensity({ from: 0.4, to: 0.8, duration: 0.25 })
    .tap({ intensity: 1.0, sharpness: 0.7, time: 0.28 }),
).build();

export const biometricFail: AHAPPattern = tag(
  'security',
  'Two crisp negatives — auth refused.',
)(ahap().tap({ intensity: 1.0, sharpness: 0.9 }).tap({ intensity: 1.0, sharpness: 0.9, time: 0.12 })).build();

export const unlock: AHAPPattern = tag(
  'security',
  'Successful unlock — three ascending taps.',
)(
  ahap()
    .tap({ intensity: 0.5, sharpness: 0.8, androidPrimitive: 'tick' })
    .tap({ intensity: 0.7, sharpness: 0.9, time: 0.1, androidPrimitive: 'click' })
    .tap({ intensity: 0.9, sharpness: 1.0, time: 0.22, androidPrimitive: 'click' }),
).build();

/**
 * Built-in AHAP pattern library — 60+ ready-made patterns across 12 categories.
 *
 * @example
 * import { RichHaptics, patterns } from 'capacitor-rich-haptics';
 * await RichHaptics.playPattern({ pattern: patterns.heartbeat });
 */
export const patterns = {
  // body
  heartbeat,
  breatheIn,
  breatheOut,
  // nature
  waterDrop,
  raindrops,
  thunder,
  wind,
  // mechanical
  lockClick,
  keyJangle,
  watchTick,
  gearShift,
  dialPad,
  ratchet,
  // ui
  typewriter,
  refreshPull,
  swipeReveal,
  deletePop,
  tabSwitch,
  pageTransition,
  modalOpen,
  modalClose,
  pullThreshold,
  pullRelease,
  copy,
  paste,
  // game
  levelUp,
  explosion,
  gameOver,
  jump,
  hit,
  powerUp,
  parry,
  shield,
  // music
  drumKick,
  drumSnare,
  pianoKey,
  guitarStrum,
  // camera
  shutter,
  focusLock,
  // notifications
  successFanfare,
  errorBuzz,
  ping,
  gentleWakeup,
  messageReceive,
  messageSend,
  // social
  liked,
  share,
  // effects
  applause,
  magicSparkle,
  boing,
  rumble,
  bounce,
  balloonPop,
  cardFlip,
  pageTurn,
  // finance
  coinFlip,
  paymentSuccess,
  // security
  biometricSuccess,
  biometricFail,
  unlock,
} as const;

export type PatternName = keyof typeof patterns;

/**
 * Get all patterns belonging to a category.
 *
 * @example
 * const games = patternsByCategory('game');
 * // [{ name: 'levelUp', pattern: ... }, { name: 'gameOver', pattern: ... }, ...]
 */
export function patternsByCategory(category: PatternCategory): { name: PatternName; pattern: AHAPPattern }[] {
  return (Object.entries(patterns) as [PatternName, AHAPPattern][])
    .filter(([, p]) => (p.Metadata as { category?: string } | undefined)?.category === category)
    .map(([name, pattern]) => ({ name, pattern }));
}
