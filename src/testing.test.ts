import { describe, expect, it } from 'vitest';

import { createMockHaptics } from './testing';

describe('createMockHaptics', () => {
  it('returns a full plugin shape', async () => {
    const mock = createMockHaptics();
    expect(typeof mock.play).toBe('function');
    expect(typeof mock.preset).toBe('function');
    expect(typeof mock.startContinuous).toBe('function');
    expect(typeof mock.preload).toBe('function');
    expect(typeof mock.stop).toBe('function');
  });

  it('records preset calls', async () => {
    const mock = createMockHaptics();
    await mock.preset({ name: 'softTap' });
    await mock.preset({ name: 'sharpClick' });

    expect(mock.log.length).toBe(2);
    expect(mock.callsTo('preset').length).toBe(2);
    expect(mock.callsTo('preset')[0].args[0]).toEqual({ name: 'softTap' });
    expect(mock.callsTo('preset')[1].args[0]).toEqual({ name: 'sharpClick' });
  });

  it('records play calls with options', async () => {
    const mock = createMockHaptics();
    await mock.play({ intensity: 0.5, sharpness: 0.8 });
    expect(mock.callsTo('play')[0].args[0]).toEqual({ intensity: 0.5, sharpness: 0.8 });
  });

  it('reset() clears log', async () => {
    const mock = createMockHaptics();
    await mock.preset({ name: 'softTap' });
    expect(mock.log.length).toBe(1);
    mock.reset();
    expect(mock.log.length).toBe(0);
  });

  it('isSupported override controls returned engine', async () => {
    const mock = createMockHaptics({
      isSupported: { supported: true, engine: 'composition', userEnabled: false },
    });
    const result = await mock.isSupported();
    expect(result.engine).toBe('composition');
    expect(result.userEnabled).toBe(false);
  });

  it('startContinuous returns a unique id', async () => {
    const mock = createMockHaptics();
    const a = await mock.startContinuous({ intensity: 0.5 });
    const b = await mock.startContinuous({ intensity: 0.5 });
    expect(a.id).not.toBe(b.id);
  });

  it('callsTo filters by method name', async () => {
    const mock = createMockHaptics();
    await mock.preset({ name: 'softTap' });
    await mock.play({ intensity: 0.5 });
    await mock.preset({ name: 'sharpClick' });

    expect(mock.callsTo('preset').length).toBe(2);
    expect(mock.callsTo('play').length).toBe(1);
    expect(mock.callsTo('stop').length).toBe(0);
  });

  it('records playPattern, playAHAP, playAHAPFromString, stop', async () => {
    const mock = createMockHaptics();
    await mock.playPattern({ pattern: { Pattern: [] } });
    await mock.playAHAP({ name: 'X' });
    await mock.playAHAPFromString({ json: '{}' });
    await mock.stop();
    expect(mock.callsTo('playPattern').length).toBe(1);
    expect(mock.callsTo('playAHAP').length).toBe(1);
    expect(mock.callsTo('playAHAPFromString').length).toBe(1);
    expect(mock.callsTo('stop').length).toBe(1);
  });

  it('records continuous + preload + audio + diagnostics', async () => {
    const mock = createMockHaptics();
    const { id } = await mock.startContinuous({ intensity: 0.5 });
    await mock.updateParameters({ id, intensity: 0.8 });
    await mock.stopPlayer({ id });
    await mock.preload({ id: 'tick', intensity: 0.3 });
    await mock.playPreloaded({ id: 'tick' });
    await mock.unload({ id: 'tick' });
    await mock.registerAudio({ id: 'click', filename: 'click.wav' });
    const d = await mock.getDiagnostics();

    expect(mock.callsTo('startContinuous').length).toBe(1);
    expect(mock.callsTo('updateParameters').length).toBe(1);
    expect(mock.callsTo('stopPlayer').length).toBe(1);
    expect(mock.callsTo('preload').length).toBe(1);
    expect(mock.callsTo('playPreloaded').length).toBe(1);
    expect(mock.callsTo('unload').length).toBe(1);
    expect(mock.callsTo('registerAudio').length).toBe(1);
    expect(mock.callsTo('getDiagnostics').length).toBe(1);
    expect(d.engine).toBeDefined();
  });

  it('addListener / removeAllListeners are recorded', async () => {
    // The mock includes Capacitor-style addListener/removeAllListeners
    // (inherited from WebPlugin in the real impl) so test code type-checks.
    const mock = createMockHaptics() as unknown as {
      addListener: (e: string, fn: () => void) => Promise<{ remove: () => Promise<void> }>;
      removeAllListeners: () => Promise<void>;
      callsTo: (m: string) => unknown[];
    };
    const handle = await mock.addListener('engineDidReset', () => {
      /* noop */
    });
    await handle.remove();
    await mock.removeAllListeners();
    expect(mock.callsTo('addListener').length).toBe(1);
    expect(mock.callsTo('removeAllListeners').length).toBe(1);
  });
});
