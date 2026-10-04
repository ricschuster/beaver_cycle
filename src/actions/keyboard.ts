import { noActions, type Actions } from './actions';

/** Temporary dev input for the scaffold. Touch controls come in M3. */
export function createKeyboardInput(target: Window): () => Actions {
  const down = new Set<string>();
  target.addEventListener('keydown', (e) => {
    // Space would also press whichever button has focus, such as the test menu's.
    if (e.code === 'Space') e.preventDefault();
    down.add(e.code);
  });
  target.addEventListener('keyup', (e) => down.delete(e.code));
  return () => {
    const a = noActions();
    if (down.has('KeyW') || down.has('ArrowUp')) a.move.z += 1;
    if (down.has('KeyS') || down.has('ArrowDown')) a.move.z -= 1;
    if (down.has('KeyD') || down.has('ArrowRight')) a.move.x -= 1;
    if (down.has('KeyA') || down.has('ArrowLeft')) a.move.x += 1;
    a.dive = down.has('Space');
    return a;
  };
}
