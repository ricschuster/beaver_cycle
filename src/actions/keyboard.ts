import { noActions, type Actions } from './actions';

/** Temporary dev input for the scaffold. Touch controls come in M3. */
export function createKeyboardInput(target: Window): () => Actions {
  const down = new Set<string>();
  target.addEventListener('keydown', (e) => down.add(e.code));
  target.addEventListener('keyup', (e) => down.delete(e.code));
  return () => {
    const a = noActions();
    if (down.has('KeyW') || down.has('ArrowUp')) a.move.z += 1;
    if (down.has('KeyS') || down.has('ArrowDown')) a.move.z -= 1;
    if (down.has('KeyD') || down.has('ArrowRight')) a.move.x -= 1;
    if (down.has('KeyA') || down.has('ArrowLeft')) a.move.x += 1;
    return a;
  };
}
