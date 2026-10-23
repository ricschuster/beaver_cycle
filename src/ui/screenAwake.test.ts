import { describe, expect, it } from 'vitest';
import { createScreenAwake, IDLE_MS, type ScreenAwakeEnv } from './screenAwake';

function fake(withApi = true) {
  const log = { requests: 0, releases: 0 };
  let hidden = false;
  let input = () => {};
  let visibility = () => {};
  let fire: (() => void) | null = null;
  const env: ScreenAwakeEnv = {
    wakeLock: withApi
      ? {
          request: async () => {
            log.requests++;
            return { release: async () => void log.releases++ };
          },
        }
      : undefined,
    hidden: () => hidden,
    onInput: (cb) => (input = cb),
    onVisibility: (cb) => (visibility = cb),
    setTimeout: (cb) => ((fire = cb), 1),
    clearTimeout: () => (fire = null),
  };
  const settle = () => new Promise((r) => setTimeout(r, 0));
  return { env, log, settle, input: () => input(), hide: (h: boolean) => ((hidden = h), visibility()), idle: () => fire?.() };
}

describe('screen awake', () => {
  it('holds the screen at once and lets go when switched off', async () => {
    const f = fake();
    const awake = createScreenAwake(f.env, true);
    await f.settle();
    expect(f.log.requests).toBe(1);
    awake.setEnabled(false);
    expect(f.log.releases).toBe(1);
    awake.setEnabled(true);
    await f.settle();
    expect(f.log.requests).toBe(2);
  });

  it('does nothing when switched off', async () => {
    const f = fake();
    createScreenAwake(f.env, false);
    await f.settle();
    expect(f.log.requests).toBe(0);
  });

  it('asks again when the page shows after being hidden', async () => {
    const f = fake();
    createScreenAwake(f.env, true);
    await f.settle();
    f.hide(true);
    f.hide(false);
    await f.settle();
    expect(f.log.requests).toBe(2);
  });

  it('lets go after the idle time and takes the lock back on input', async () => {
    const f = fake();
    createScreenAwake(f.env, true, IDLE_MS);
    await f.settle();
    f.idle();
    expect(f.log.releases).toBe(1);
    f.input();
    await f.settle();
    expect(f.log.requests).toBe(2);
  });

  it('asks once while an answer is pending', async () => {
    const f = fake();
    createScreenAwake(f.env, true);
    f.input();
    f.input();
    await f.settle();
    expect(f.log.requests).toBe(1);
  });

  it('is quiet without the API', () => {
    const f = fake(false);
    const awake = createScreenAwake(f.env, true);
    awake.setEnabled(false);
    f.input();
  });
});
