import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createHapticRecorder } from './recorder';
import { createMockHaptics } from './testing';

describe('createHapticRecorder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts inactive', () => {
    const mock = createMockHaptics();
    const recorder = createHapticRecorder(mock);
    expect(recorder.active).toBe(false);
  });

  it('becomes active on start, inactive on stop', () => {
    const mock = createMockHaptics();
    const recorder = createHapticRecorder(mock);
    recorder.start();
    expect(recorder.active).toBe(true);
    recorder.stop();
    expect(recorder.active).toBe(false);
  });

  it('captures method, args, and offset', async () => {
    const mock = createMockHaptics();
    const recorder = createHapticRecorder(mock);
    const t0 = Date.now();
    vi.setSystemTime(t0);

    recorder.start();
    await mock.preset({ name: 'softTap' });

    vi.setSystemTime(t0 + 200);
    await mock.preset({ name: 'success' });

    const rec = recorder.stop();
    expect(rec.events.length).toBe(2);
    expect(rec.events[0].method).toBe('preset');
    expect(rec.events[0].args).toEqual([{ name: 'softTap' }]);
    expect(rec.events[0].at).toBe(0);
    expect(rec.events[1].at).toBe(200);
    expect(rec.duration).toBe(200);
  });

  it('does not capture calls made after stop()', async () => {
    const mock = createMockHaptics();
    const recorder = createHapticRecorder(mock);
    recorder.start();
    await mock.preset({ name: 'softTap' });
    recorder.stop();
    await mock.preset({ name: 'success' });
    // Recording stopped before the second call — only the first is in.
    const rec = recorder.stop(); // empty re-stop returns empty
    expect(rec.events.length).toBe(0);
  });

  it('replay schedules calls at recorded offsets', async () => {
    const mock = createMockHaptics();
    const recorder = createHapticRecorder(mock);

    const recording = {
      events: [
        { method: 'preset', args: [{ name: 'softTap' }], at: 0 },
        { method: 'preset', args: [{ name: 'success' }], at: 100 },
      ],
      duration: 100,
      startedAt: 0,
    };

    mock.reset();
    const { promise } = recorder.replay(recording);

    vi.advanceTimersByTime(0);
    await Promise.resolve();
    expect(mock.callsTo('preset').length).toBe(1);

    vi.advanceTimersByTime(100);
    await Promise.resolve();
    expect(mock.callsTo('preset').length).toBe(2);

    await promise;
  });

  it('replay cancel() halts pending calls', async () => {
    const mock = createMockHaptics();
    const recorder = createHapticRecorder(mock);

    const recording = {
      events: [
        { method: 'preset', args: [{ name: 'softTap' }], at: 0 },
        { method: 'preset', args: [{ name: 'success' }], at: 500 },
      ],
      duration: 500,
      startedAt: 0,
    };

    mock.reset();
    const { cancel } = recorder.replay(recording);
    vi.advanceTimersByTime(0);
    await Promise.resolve();
    expect(mock.callsTo('preset').length).toBe(1);

    cancel();
    vi.advanceTimersByTime(500);
    await Promise.resolve();
    expect(mock.callsTo('preset').length).toBe(1); // never fired
  });

  it('empty recording resolves immediately', async () => {
    const mock = createMockHaptics();
    const recorder = createHapticRecorder(mock);
    const { promise } = recorder.replay({ events: [], duration: 0, startedAt: 0 });
    await expect(promise).resolves.toBeUndefined();
  });
});
