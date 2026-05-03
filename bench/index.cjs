#!/usr/bin/env node
// Microbenchmarks for capacitor-rich-haptics JS layer. Doesn't measure native
// haptic latency (that requires a real device); measures only the pure-JS work
// the plugin does in the JS thread before crossing the Capacitor bridge.

const { performance } = require('node:perf_hooks');
const lib = require('../dist/plugin.cjs.js');
const { createMockHaptics } = require('../dist/esm/testing.js');

const {
  ahap, patterns, combine, repeat, scale, stretch, reverse, morph,
  renderHapticTimelineSVG, getPatternDuration,
} = lib;

const RUNS = 10000;

function bench(label, fn) {
  // Warmup
  for (let i = 0; i < 1000; i++) fn();

  const samples = [];
  for (let i = 0; i < RUNS; i++) {
    const t = performance.now();
    fn();
    samples.push(performance.now() - t);
  }
  samples.sort((a, b) => a - b);
  return {
    label,
    avg: samples.reduce((s, x) => s + x, 0) / samples.length,
    p50: samples[Math.floor(samples.length / 2)],
    p99: samples[Math.floor(samples.length * 0.99)],
    runs: samples.length,
  };
}

function format(ms) {
  if (ms < 0.001) return (ms * 1_000_000).toFixed(0) + 'ns';
  if (ms < 1) return (ms * 1000).toFixed(2) + 'µs';
  return ms.toFixed(2) + 'ms';
}

const tests = [
  // Builder
  ['ahap().tap().build() — 1 event', () => ahap().tap().build()],
  ['ahap()...build() — 5 events', () => ahap().tap().wait(0.1).tap().wait(0.1).tap().wait(0.1).tap().wait(0.1).tap().build()],
  ['ahap()...build() — continuous + 2 ramps', () =>
    ahap()
      .continuous({ duration: 0.5, intensity: 0.5 })
      .rampIntensity({ from: 0.5, to: 1.0, duration: 0.5 })
      .rampSharpness({ from: 0.3, to: 0.9, duration: 0.5 })
      .build(),
  ],
  // Transforms
  ['scale(heartbeat, {intensity: 0.5})', () => scale(patterns.heartbeat, { intensity: 0.5 })],
  ['stretch(heartbeat, 2)', () => stretch(patterns.heartbeat, 2)],
  ['reverse(heartbeat)', () => reverse(patterns.heartbeat)],
  ['combine(heartbeat, successFanfare)', () => combine(patterns.heartbeat, patterns.successFanfare)],
  ['repeat(heartbeat, 4)', () => repeat(patterns.heartbeat, 4)],
  ['morph(heartbeat, heartbeat, 0.5)', () => morph(patterns.heartbeat, patterns.heartbeat, 0.5)],
  ['getPatternDuration(applause)', () => getPatternDuration(patterns.applause)],
  // Serialization
  ['JSON.stringify(heartbeat)', () => JSON.stringify(patterns.heartbeat)],
  ['JSON.parse(JSON.stringify(heartbeat))', () => JSON.parse(JSON.stringify(patterns.heartbeat))],
  // Visualizer
  ['renderHapticTimelineSVG(heartbeat)', () => renderHapticTimelineSVG(patterns.heartbeat)],
  ['renderHapticTimelineSVG(coinFlip)', () => renderHapticTimelineSVG(patterns.coinFlip)],
];

const mock = createMockHaptics();
tests.push(['mock.preset({name: "softTap"})', () => { void mock.preset({ name: 'softTap' }); }]);
tests.push(['mock.play({intensity: 0.5})', () => { void mock.play({ intensity: 0.5 }); }]);

const results = tests.map(([label, fn]) => bench(label, fn));

console.log('Benchmark results — ' + RUNS + ' runs each, sorted samples');
console.log('Node ' + process.version + ' on ' + process.platform + '/' + process.arch);
console.log('');

const labelWidth = Math.max(...results.map((r) => r.label.length));
const header = 'operation'.padEnd(labelWidth) + '  ' + 'avg'.padStart(10) + '  ' + 'p50'.padStart(10) + '  ' + 'p99'.padStart(10);
console.log(header);
console.log('-'.repeat(header.length));
for (const r of results) {
  console.log(
    r.label.padEnd(labelWidth) +
    '  ' + format(r.avg).padStart(10) +
    '  ' + format(r.p50).padStart(10) +
    '  ' + format(r.p99).padStart(10),
  );
}

console.log('');
console.log('Markdown:');
console.log('| Operation | Avg | p50 | p99 |');
console.log('|---|---:|---:|---:|');
for (const r of results) {
  console.log('| `' + r.label + '` | ' + format(r.avg) + ' | ' + format(r.p50) + ' | ' + format(r.p99) + ' |');
}
