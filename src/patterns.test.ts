import { describe, expect, it } from 'vitest';

import { patterns, patternsByCategory } from './patterns';
import { getPatternDuration } from './transforms';

describe('patterns', () => {
  const names = Object.keys(patterns) as (keyof typeof patterns)[];

  it('exports at least 40 patterns', () => {
    expect(names.length).toBeGreaterThanOrEqual(40);
  });

  it.each(names)('%s has valid AHAP shape', (name) => {
    const p = patterns[name];
    expect(p.Version).toBe(1);
    expect(Array.isArray(p.Pattern)).toBe(true);
    expect(p.Pattern.length).toBeGreaterThan(0);
  });

  it.each(names)('%s has Metadata.category and Metadata.description', (name) => {
    const meta = patterns[name].Metadata as { category?: string; description?: string } | undefined;
    expect(meta?.category).toBeTypeOf('string');
    expect(meta?.description).toBeTypeOf('string');
  });

  it.each(names)('%s has non-negative duration', (name) => {
    // Transient-only patterns (e.g. dialPad, focusLock) end at their last tap's
    // Time, which is a valid 0 for single instantaneous taps.
    expect(getPatternDuration(patterns[name])).toBeGreaterThanOrEqual(0);
  });
});

describe('patternsByCategory', () => {
  it('returns all body patterns', () => {
    const body = patternsByCategory('body');
    expect(body.length).toBeGreaterThanOrEqual(3);
    expect(body.map((p) => p.name)).toContain('heartbeat');
  });

  it('returns all game patterns', () => {
    const game = patternsByCategory('game');
    expect(game.map((p) => p.name)).toContain('levelUp');
    expect(game.map((p) => p.name)).toContain('gameOver');
  });

  it('returns empty array for non-existent category', () => {
    // @ts-expect-error - testing runtime behaviour with bad input
    expect(patternsByCategory('nope')).toEqual([]);
  });
});
