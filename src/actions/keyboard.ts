import { noActions, type Actions } from './actions';

/** Keyboard input for desktop play, next to touch (issue #40). Key hints are in ui/keyHints.ts. */
export function createKeyboardInput(target: Window): () => Actions {
  const down = new Set<string>();
  // Presses since the last read, so a held key slaps once.
  const pressed = new Set<string>();
  target.addEventListener('keydown', (e) => {
    // Space would also press whichever button has focus, such as the test menu's.
    if (e.code === 'Space') e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    down.add(e.code);
  });
  target.addEventListener('keyup', (e) => down.delete(e.code));
  return () => {
    const a = noActions();
    if (down.has('KeyW') || down.has('ArrowUp')) a.move.z += 1;
    if (down.has('KeyS') || down.has('ArrowDown')) a.move.z -= 1;
    if (down.has('KeyD') || down.has('ArrowRight')) a.move.x -= 1;
    if (down.has('KeyA') || down.has('ArrowLeft')) a.move.x += 1;
    // A tap shorter than a frame still counts for one read, so the dream's hop is not lost.
    a.dive = down.has('Space') || pressed.has('Space');
    a.slap = pressed.has('KeyT');
    a.chop = pressed.has('KeyE');
    a.grab = pressed.has('KeyG');
    a.build = pressed.has('KeyB');
    pressed.clear();
    return a;
  };
}

/** Whether a key is held now, by its `KeyboardEvent.code`. For keys that are not game actions, such as the fly view's zoom. */
export function createHeldKeys(target: Window): (code: string) => boolean {
  const down = new Set<string>();
  target.addEventListener('keydown', (e) => down.add(e.code));
  target.addEventListener('keyup', (e) => down.delete(e.code));
  return (code) => down.has(code);
}
