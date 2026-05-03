// Playground for capacitor-rich-haptics. The textarea is JS code that returns
// (or assigns to `pattern`) an AHAP pattern. We execute it in a sandboxed
// Function context with `ahap`, `patterns`, and the transform helpers exposed.

import { ahap } from '../dist/esm/ahap.js';
import { patterns } from '../dist/esm/patterns.js';
import { combine, repeat, scale, stretch, reverse, delay, morph, getPatternDuration } from '../dist/esm/transforms.js';
import { renderHapticTimelineSVG } from '../dist/esm/visualizer.js';

const $ = (id) => document.getElementById(id);

const STARTER = `// Build an AHAP pattern. Last expression is the result.
// Available: ahap, patterns, combine, repeat, scale, stretch, reverse, delay, morph

ahap()
  .tap({ intensity: 1.0, sharpness: 0.9 })
  .wait(0.15)
  .continuous({ duration: 0.5, intensity: 0.7, sharpness: 0.3 })
  .rampIntensity({ from: 0.7, to: 0.0, duration: 0.5 })
  .build()`;

const CONTEXT = { ahap, patterns, combine, repeat, scale, stretch, reverse, delay, morph };

function evalCode(code) {
  const keys = Object.keys(CONTEXT);
  const args = keys.map((k) => CONTEXT[k]);
  // eslint-disable-next-line no-new-func
  const fn = new Function(...keys, '"use strict"; return (' + code + ');');
  return fn(...args);
}

function run() {
  const code = $('code').value;
  const errBox = $('error');
  errBox.hidden = true;

  let pattern;
  try {
    pattern = evalCode(code);
  } catch (e) {
    showError('Eval error: ' + e.message);
    return;
  }

  if (!pattern || !Array.isArray(pattern.Pattern)) {
    showError('Result must be an AHAP pattern (object with `Pattern` array). Got: ' + JSON.stringify(pattern).slice(0, 80));
    return;
  }

  const svg = renderHapticTimelineSVG(pattern, { width: 700, height: 240, title: 'pattern' });
  $('viz').innerHTML = svg;

  let transients = 0, continuous = 0, curves = 0;
  pattern.Pattern.forEach((el) => {
    if (el.Event?.EventType === 'HapticTransient') transients++;
    else if (el.Event?.EventType === 'HapticContinuous') continuous++;
    else if (el.ParameterCurve) curves++;
  });

  $('stats').innerHTML =
    `<span>duration</span><span>${getPatternDuration(pattern).toFixed(3)}s</span>` +
    `<span>transients</span><span>${transients}</span>` +
    `<span>continuous</span><span>${continuous}</span>` +
    `<span>curves</span><span>${curves}</span>`;

  window.__lastPattern = pattern;
}

function showError(msg) {
  const errBox = $('error');
  errBox.textContent = msg;
  errBox.hidden = false;
}

function init() {
  $('code').value = STARTER;

  const sel = $('presets');
  Object.keys(patterns).forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });

  sel.addEventListener('change', (e) => {
    const name = e.target.value;
    if (!name) return;
    $('code').value = `// ${name}\npatterns.${name}`;
    run();
    e.target.value = '';
  });

  $('run').addEventListener('click', run);
  $('code').addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run();
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target;
      const start = ta.selectionStart;
      ta.value = ta.value.slice(0, start) + '  ' + ta.value.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = start + 2;
    }
  });

  $('copyJson').addEventListener('click', async () => {
    if (!window.__lastPattern) return;
    await navigator.clipboard.writeText(JSON.stringify(window.__lastPattern, null, 2));
    $('copyJson').textContent = '✓ Copied';
    setTimeout(() => { $('copyJson').textContent = 'Copy AHAP JSON'; }, 1200);
  });

  $('downloadAhap').addEventListener('click', () => {
    if (!window.__lastPattern) return;
    const blob = new Blob([JSON.stringify(window.__lastPattern, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pattern.ahap';
    a.click();
    URL.revokeObjectURL(url);
  });

  run();
}

init();
