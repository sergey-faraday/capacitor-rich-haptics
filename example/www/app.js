import { AHAP_PATTERNS, PATTERN_LIBRARY } from './ahap-patterns.js';

const RichHaptics = window.Capacitor?.Plugins?.RichHaptics ?? {
  isSupported: async () => ({ supported: false, engine: 'none', userEnabled: true }),
  play: async () => {},
  preset: async () => {},
  playPattern: async () => {},
  playAHAP: async () => {},
  playAHAPFromString: async () => {},
  stop: async () => {},
  startContinuous: async () => ({ id: 'web' }),
  updateParameters: async () => {},
  stopPlayer: async () => {},
  preload: async () => {},
  playPreloaded: async () => {},
  unload: async () => {},
};

const $ = (id) => document.getElementById(id);

async function init() {
  try {
    const { supported, engine, userEnabled } = await RichHaptics.isSupported();
    $('engine').innerHTML = supported
      ? `Engine: <code>${engine}</code> · userEnabled: <code>${userEnabled}</code>`
      : '<code>none</code> — open in the native app to feel haptics';
  } catch (e) {
    $('engine').textContent = 'isSupported() failed: ' + e.message;
  }

  bindSlider('intensity', 'intensityOut');
  bindSlider('sharpness', 'sharpnessOut');
  bindSlider('duration', 'durationOut');

  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => onAction(btn.dataset.action));
  });

  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => RichHaptics.preset({ name: btn.dataset.preset }));
  });

  buildPatternGrid();

  document.querySelectorAll('[data-ahap-file]').forEach((btn) => {
    btn.addEventListener('click', () => RichHaptics.playAHAP({ name: btn.dataset.ahapFile }));
  });

  document.querySelectorAll('[data-builder]').forEach((btn) => {
    btn.addEventListener('click', () =>
      RichHaptics.playAHAPFromString({ json: JSON.stringify(AHAP_PATTERNS[btn.dataset.builder]) }),
    );
  });

  bindDragPad();
}

let preloaded = false;
async function onAction(action) {
  if (action === 'play') {
    await RichHaptics.play({
      intensity: $('intensity').valueAsNumber / 100,
      sharpness: $('sharpness').valueAsNumber / 100,
      duration: $('duration').valueAsNumber / 100,
    });
  } else if (action === 'stop') {
    await RichHaptics.stop();
  } else if (action === 'preload') {
    await RichHaptics.preload({ id: 'typeTick', intensity: 0.25, sharpness: 0.8, duration: 0 });
    preloaded = true;
  } else if (action === 'fire') {
    if (!preloaded) {
      await RichHaptics.preload({ id: 'typeTick', intensity: 0.25, sharpness: 0.8, duration: 0 });
      preloaded = true;
    }
    await RichHaptics.playPreloaded({ id: 'typeTick' });
  }
}

function buildPatternGrid() {
  const grid = $('patternGrid');
  for (const name of Object.keys(PATTERN_LIBRARY)) {
    const btn = document.createElement('button');
    btn.textContent = camelToTitle(name);
    btn.addEventListener('click', () =>
      RichHaptics.playPattern({ pattern: PATTERN_LIBRARY[name] }),
    );
    grid.appendChild(btn);
  }
}

function camelToTitle(s) {
  return s
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase());
}

function bindSlider(id, outId) {
  const input = $(id);
  const out = $(outId);
  const update = () => { out.textContent = (input.valueAsNumber / 100).toFixed(2); };
  input.addEventListener('input', update);
  update();
}

function bindDragPad() {
  const pad = $('dragPad');
  const dot = $('dragDot');
  const readout = $('dragReadout');
  let playerId = null;

  const computeFromEvent = (e) => {
    const rect = pad.getBoundingClientRect();
    const t = e.touches?.[0] ?? e;
    const x = Math.max(0, Math.min(rect.width, t.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, t.clientY - rect.top));
    const sharpness = x / rect.width;
    const intensity = 1 - y / rect.height;
    return { x, y, intensity, sharpness };
  };

  const onDown = async (e) => {
    e.preventDefault();
    const { x, y, intensity, sharpness } = computeFromEvent(e);
    moveDot(x, y, intensity, sharpness);
    const { id } = await RichHaptics.startContinuous({ intensity, sharpness });
    playerId = id;
  };

  const onMove = async (e) => {
    if (!playerId) return;
    e.preventDefault();
    const { x, y, intensity, sharpness } = computeFromEvent(e);
    moveDot(x, y, intensity, sharpness);
    await RichHaptics.updateParameters({ id: playerId, intensity, sharpness });
  };

  const onUp = async () => {
    if (!playerId) return;
    const id = playerId;
    playerId = null;
    await RichHaptics.stopPlayer({ id });
  };

  const moveDot = (x, y, intensity, sharpness) => {
    dot.style.transform = `translate(${x}px, ${y}px)`;
    readout.textContent = `${intensity.toFixed(2)} / ${sharpness.toFixed(2)}`;
  };

  pad.addEventListener('pointerdown', onDown);
  pad.addEventListener('pointermove', onMove);
  pad.addEventListener('pointerup', onUp);
  pad.addEventListener('pointercancel', onUp);
  pad.addEventListener('pointerleave', onUp);
}

init();
