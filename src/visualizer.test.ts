import { describe, expect, it } from 'vitest';

import { ahap } from './ahap';
import { patterns } from './patterns';
import { renderHapticTimelineSVG } from './visualizer';

describe('renderHapticTimelineSVG', () => {
  it('returns a valid SVG string', () => {
    const svg = renderHapticTimelineSVG(patterns.heartbeat);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toMatch(/<\/svg>$/);
    expect(svg).toContain('viewBox=');
  });

  it('includes title when provided', () => {
    const svg = renderHapticTimelineSVG(patterns.heartbeat, { title: 'heartbeat' });
    expect(svg).toContain('>heartbeat<');
  });

  it('escapes XML in title', () => {
    const svg = renderHapticTimelineSVG(patterns.heartbeat, { title: '<script>' });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('honors width and height', () => {
    const svg = renderHapticTimelineSVG(patterns.heartbeat, { width: 1200, height: 400 });
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="400"');
  });

  it('omits axis when showAxis is false', () => {
    const noAxis = renderHapticTimelineSVG(patterns.heartbeat, { showAxis: false });
    const withAxis = renderHapticTimelineSVG(patterns.heartbeat, { showAxis: true });
    // axis renders <text>0.00s</text>-style ticks
    expect(noAxis).not.toContain('s</text>');
    expect(withAxis).toContain('s</text>');
  });

  it('renders empty pattern without throwing', () => {
    const svg = renderHapticTimelineSVG(ahap().build());
    expect(svg).toMatch(/<svg /);
  });

  it('renders parameter curves for ramps', () => {
    const p = ahap()
      .continuous({ duration: 0.5, intensity: 0.5 })
      .rampIntensity({ from: 0.5, to: 0, duration: 0.5 })
      .build();
    const svg = renderHapticTimelineSVG(p);
    expect(svg).toContain('<polyline');
  });
});
