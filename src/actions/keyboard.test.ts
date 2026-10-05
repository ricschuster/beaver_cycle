import { describe, expect, it } from 'vitest';
import { createKeyboardInput } from './keyboard';

// A bare event target stands in for the window.
function setup(): { read: ReturnType<typeof createKeyboardInput>; press(code: string, repeat?: boolean): void; release(code: string): void } {
  const target = new EventTarget();
  const key = (type: string, code: string, repeat = false): void => {
    const e = new Event(type, { cancelable: true });
    Object.assign(e, { code, repeat });
    target.dispatchEvent(e);
  };
  return {
    read: createKeyboardInput(target as unknown as Window),
    press: (code, repeat) => key('keydown', code, repeat),
    release: (code) => key('keyup', code),
  };
}

describe('createKeyboardInput', () => {
  it('moves with WASD and the arrow keys', () => {
    const k = setup();
    k.press('KeyW');
    k.press('KeyA');
    expect(k.read().move).toEqual({ x: 1, z: 1 });
    k.release('KeyW');
    k.release('KeyA');
    expect(k.read().move).toEqual({ x: 0, z: 0 });
  });

  it('dives while Space is held', () => {
    const k = setup();
    k.press('Space');
    expect(k.read().dive).toBe(true);
    expect(k.read().dive).toBe(true);
    k.release('Space');
    expect(k.read().dive).toBe(false);
  });

  it('slaps once per press of T, not while held', () => {
    const k = setup();
    k.press('KeyT');
    expect(k.read().slap).toBe(true);
    expect(k.read().slap).toBe(false);
    k.press('KeyT', true); // key repeat from holding it down
    expect(k.read().slap).toBe(false);
    k.release('KeyT');
    k.press('KeyT');
    expect(k.read().slap).toBe(true);
  });

  it('keeps Space from pressing the focused button', () => {
    const target = new EventTarget();
    createKeyboardInput(target as unknown as Window);
    const e = new Event('keydown', { cancelable: true });
    Object.assign(e, { code: 'Space', repeat: false });
    target.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });
});
