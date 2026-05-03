import type { AHAPElement, AHAPEvent, AHAPParameterCurve, AHAPPattern } from './definitions';
import { getPatternDuration } from './transforms';

export interface VisualizerOptions {
  /** SVG width in px. Default 800. */
  width?: number;
  /** SVG height in px. Default 200. */
  height?: number;
  /** Override timeline duration. Defaults to pattern duration (or 1.0 if zero). */
  duration?: number;
  /** Background fill. Default '#15151c'. */
  background?: string;
  /** Color for intensity band (top half). Default '#5eead4'. */
  intensityColor?: string;
  /** Color for sharpness band (bottom half). Default '#a78bfa'. */
  sharpnessColor?: string;
  /** Axis / label color. Default '#8a8a99'. */
  axisColor?: string;
  /** Show time axis ticks at the bottom. Default true. */
  showAxis?: boolean;
  /** Pattern title shown in the corner. */
  title?: string;
}

const DEFAULTS: Required<Omit<VisualizerOptions, 'duration' | 'title'>> = {
  width: 800,
  height: 200,
  background: '#15151c',
  intensityColor: '#5eead4',
  sharpnessColor: '#a78bfa',
  axisColor: '#8a8a99',
  showAxis: true,
};

const sanitizePositiveNumber = (value: number | undefined, fallback: number, min = 1): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback;

const sanitizeDuration = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

const sanitizeColor = (value: string | undefined, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?([0-9a-f]{2})?$/i.test(trimmed)) return trimmed;
  if (/^[a-zA-Z]+$/.test(trimmed)) return trimmed;
  if (/^rgba?\(\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?(\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^hsla?\(\s*\d{1,3}(deg)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(trimmed)) {
    return trimmed;
  }
  return fallback;
};

const isEvent = (el: AHAPElement): el is { Event: AHAPEvent } => 'Event' in el;
const isCurve = (el: AHAPElement): el is { ParameterCurve: AHAPParameterCurve } => 'ParameterCurve' in el;

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const getParam = (event: AHAPEvent, id: string, fallback: number): number => {
  const p = event.EventParameters?.find((x) => x.ParameterID === id);
  return p?.ParameterValue ?? fallback;
};

/**
 * Render an AHAP pattern as a self-contained SVG string. The top half shows
 * intensity (0..1), bottom shows sharpness (0..1), with transients as dots,
 * continuous events as filled rectangles, and parameter curves as polylines.
 *
 * @example
 * import { renderHapticTimelineSVG, patterns } from 'capacitor-rich-haptics';
 * document.getElementById('preview').innerHTML =
 *   renderHapticTimelineSVG(patterns.heartbeat, { title: 'heartbeat' });
 */
export function renderHapticTimelineSVG(pattern: AHAPPattern, options: VisualizerOptions = {}): string {
  const opts = {
    width: sanitizePositiveNumber(options.width, DEFAULTS.width),
    height: sanitizePositiveNumber(options.height, DEFAULTS.height),
    background: sanitizeColor(options.background, DEFAULTS.background),
    intensityColor: sanitizeColor(options.intensityColor, DEFAULTS.intensityColor),
    sharpnessColor: sanitizeColor(options.sharpnessColor, DEFAULTS.sharpnessColor),
    axisColor: sanitizeColor(options.axisColor, DEFAULTS.axisColor),
    showAxis: options.showAxis ?? DEFAULTS.showAxis,
  };
  const w = opts.width;
  const h = opts.height;
  const padX = 16;
  const padTop = options.title ? 28 : 12;
  const padBottom = opts.showAxis ? 22 : 8;
  const innerW = w - padX * 2;
  const innerH = h - padTop - padBottom;
  const midY = padTop + innerH / 2;
  const intensityBandH = innerH / 2 - 4;
  const sharpnessBandH = innerH / 2 - 4;

  const totalDuration = sanitizeDuration(options.duration, Math.max(getPatternDuration(pattern), 0.1));
  const xFor = (t: number) => padX + (t / totalDuration) * innerW;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Haptic pattern timeline">`,
  );
  parts.push(`<rect width="${w}" height="${h}" fill="${opts.background}"/>`);

  if (options.title) {
    parts.push(
      `<text x="${padX}" y="18" fill="${opts.axisColor}" font-family="ui-monospace, monospace" font-size="12" font-weight="600">${escapeXml(options.title)}</text>`,
    );
    parts.push(
      `<text x="${w - padX}" y="18" fill="${opts.axisColor}" font-family="ui-monospace, monospace" font-size="11" text-anchor="end">${totalDuration.toFixed(2)}s</text>`,
    );
  }

  // Mid divider
  parts.push(
    `<line x1="${padX}" y1="${midY}" x2="${w - padX}" y2="${midY}" stroke="${opts.axisColor}" stroke-opacity="0.25" stroke-width="1"/>`,
  );
  parts.push(
    `<text x="${padX - 6}" y="${padTop + 8}" fill="${opts.axisColor}" font-family="ui-monospace, monospace" font-size="9" text-anchor="end" opacity="0.6">I</text>`,
  );
  parts.push(
    `<text x="${padX - 6}" y="${midY + 10}" fill="${opts.axisColor}" font-family="ui-monospace, monospace" font-size="9" text-anchor="end" opacity="0.6">S</text>`,
  );

  // Events
  for (const el of pattern.Pattern) {
    if (isEvent(el)) {
      const event = el.Event;
      const intensity = getParam(event, 'HapticIntensity', 1);
      const sharpness = getParam(event, 'HapticSharpness', 0.5);
      const x = xFor(event.Time);

      if (event.EventType === 'HapticTransient') {
        const intY = midY - intensity * intensityBandH;
        const shrY = midY + sharpness * sharpnessBandH;
        parts.push(`<circle cx="${x.toFixed(2)}" cy="${intY.toFixed(2)}" r="3.5" fill="${opts.intensityColor}"/>`);
        parts.push(`<circle cx="${x.toFixed(2)}" cy="${shrY.toFixed(2)}" r="3.5" fill="${opts.sharpnessColor}"/>`);
      } else if (event.EventType === 'HapticContinuous') {
        const dur = event.EventDuration ?? 0.05;
        const x2 = xFor(event.Time + dur);
        const intH = intensity * intensityBandH;
        const shrH = sharpness * sharpnessBandH;
        parts.push(
          `<rect x="${x.toFixed(2)}" y="${(midY - intH).toFixed(2)}" width="${Math.max(2, x2 - x).toFixed(2)}" height="${intH.toFixed(2)}" fill="${opts.intensityColor}" fill-opacity="0.6" rx="2"/>`,
        );
        parts.push(
          `<rect x="${x.toFixed(2)}" y="${midY.toFixed(2)}" width="${Math.max(2, x2 - x).toFixed(2)}" height="${shrH.toFixed(2)}" fill="${opts.sharpnessColor}" fill-opacity="0.6" rx="2"/>`,
        );
      }
    } else if (isCurve(el)) {
      const curve = el.ParameterCurve;
      const isSharpness = curve.ParameterID.startsWith('HapticSharpness');
      const color = isSharpness ? opts.sharpnessColor : opts.intensityColor;
      const baseY = isSharpness ? midY : midY;
      const bandH = isSharpness ? sharpnessBandH : intensityBandH;
      const sign = isSharpness ? 1 : -1;

      const points = curve.ParameterCurveControlPoints.map((p) => {
        const x = xFor(curve.Time + p.Time);
        const y = baseY + sign * p.ParameterValue * bandH;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(' ');
      parts.push(
        `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.85"/>`,
      );
    }
  }

  if (opts.showAxis) {
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const t = (totalDuration / ticks) * i;
      const x = xFor(t);
      parts.push(
        `<line x1="${x.toFixed(2)}" y1="${(h - padBottom).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(h - padBottom + 4).toFixed(2)}" stroke="${opts.axisColor}" stroke-opacity="0.5"/>`,
      );
      parts.push(
        `<text x="${x.toFixed(2)}" y="${(h - padBottom + 16).toFixed(2)}" fill="${opts.axisColor}" font-family="ui-monospace, monospace" font-size="10" text-anchor="middle">${t.toFixed(2)}s</text>`,
      );
    }
  }

  parts.push('</svg>');
  return parts.join('');
}
