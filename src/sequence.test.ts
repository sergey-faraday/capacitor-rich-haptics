import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RichHaptics } from './plugin';
import { custom, pattern, play, preset, sequence, wait } from './sequence';
import type { createMockHaptics } from './testing';

vi.mock('./plugin', async () => {
  const { createMockHaptics } = await import('./testing');
  return { RichHaptics: createMockHaptics() };
});
const mock = RichHaptics as unknown as ReturnType<typeof createMockHaptics>;

describe('sequence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mock.reset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('executes steps in order with correct timing', async () => {
    const seq = sequence(preset('softTap'), wait(100), preset('success'));
    expect(seq.duration).toBe(100);

    const h = seq.play();
    await Promise.resolve();
    expect(mock.callsTo('preset').length).toBe(1);
    expect((mock.callsTo('preset')[0].args[0] as { name: string }).name).toBe('softTap');

    vi.advanceTimersByTime(100);
    await vi.runAllTimersAsync();
    await h.promise;

    expect(mock.callsTo('preset').length).toBe(2);
    expect((mock.callsTo('preset')[1].args[0] as { name: string }).name).toBe('success');
  });

  it('preset / play / pattern / custom step types fire correct methods', async () => {
    const fakePattern = { Pattern: [] };
    let customRan = false;
    const seq = sequence(
      preset('softTap'),
      play({ intensity: 0.5 }),
      pattern(fakePattern),
      custom(() => {
        customRan = true;
      }),
    );
    await seq.play().promise;
    expect(mock.callsTo('preset').length).toBe(1);
    expect(mock.callsTo('play').length).toBe(1);
    expect(mock.callsTo('playPattern').length).toBe(1);
    expect(customRan).toBe(true);
  });

  it('cancel() halts pending steps', async () => {
    const seq = sequence(preset('softTap'), wait(500), preset('success'));
    const h = seq.play();
    await Promise.resolve();
    expect(mock.callsTo('preset').length).toBe(1);

    h.cancel();
    expect(h.running).toBe(false);

    vi.advanceTimersByTime(1000);
    await vi.runAllTimersAsync();
    await h.promise;

    expect(mock.callsTo('preset').length).toBe(1); // success never fired
  });

  it('repeat(n) replays the sequence n times', async () => {
    const seq = sequence(preset('softTap'), wait(50));
    const looped = seq.repeat(3);
    expect(looped.duration).toBe(150);

    const h = looped.play();
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    await vi.runAllTimersAsync();
    vi.advanceTimersByTime(50);
    await vi.runAllTimersAsync();
    vi.advanceTimersByTime(50);
    await vi.runAllTimersAsync();
    await h.promise;

    expect(mock.callsTo('preset').length).toBe(3);
  });

  it('repeat(0) → empty sequence', async () => {
    const seq = sequence(preset('softTap')).repeat(0);
    expect(seq.duration).toBe(0);
    expect(seq.steps.length).toBe(0);
    await seq.play().promise;
    expect(mock.callsTo('preset').length).toBe(0);
  });

  it('then() concatenates two sequences', async () => {
    const a = sequence(preset('softTap'), wait(100));
    const b = sequence(preset('success'));
    const combined = a.then(b);

    expect(combined.duration).toBe(100);
    expect(combined.steps.length).toBe(3);

    const h = combined.play();
    await Promise.resolve();
    vi.advanceTimersByTime(100);
    await vi.runAllTimersAsync();
    await h.promise;

    expect(mock.callsTo('preset').length).toBe(2);
  });

  it('then() accepts a single step', async () => {
    const combined = sequence(preset('softTap')).then(preset('success'));
    expect(combined.steps.length).toBe(2);
    await combined.play().promise;
    expect(mock.callsTo('preset').length).toBe(2);
  });

  it('nested sequences are flattened', () => {
    const inner = sequence(preset('softTap'), wait(50));
    const outer = sequence(preset('warning'), { type: 'sequence', steps: [...inner.steps] }, preset('success'));
    expect(outer.steps.length).toBe(4);
    expect(outer.steps.every((s) => s.type !== 'sequence')).toBe(true);
  });

  it('immutability — repeat/then return new sequences', () => {
    const a = sequence(preset('softTap'));
    const b = a.repeat(3);
    const c = a.then(preset('success'));
    expect(a.steps.length).toBe(1);
    expect(b.steps.length).toBe(3);
    expect(c.steps.length).toBe(2);
  });

  it('handle.running becomes false when complete', async () => {
    const seq = sequence(preset('softTap'));
    const h = seq.play();
    expect(h.running).toBe(true);
    await h.promise;
    expect(h.running).toBe(false);
  });

  it('failing custom step does not abort sequence', async () => {
    const seq = sequence(
      preset('softTap'),
      custom(() => {
        throw new Error('boom');
      }),
      preset('success'),
    );
    await seq.play().promise;
    expect(mock.callsTo('preset').length).toBe(2);
  });

  it('rejected promise from RichHaptics call does not abort sequence', async () => {
    // Replace the mock's preset with a rejecting version on the first call only.
    const original = mock.preset;
    let calls = 0;
    mock.preset = (async (opts: { name: 'softTap' | 'success' }) => {
      calls++;
      if (calls === 1) throw new Error('native engine error');
      return original.call(mock, opts);
    }) as typeof mock.preset;

    try {
      const seq = sequence(preset('softTap'), preset('success'));
      await seq.play().promise;
      // Even though the first preset rejected, the second still fired
      expect(calls).toBe(2);
    } finally {
      mock.preset = original;
    }
  });
});
