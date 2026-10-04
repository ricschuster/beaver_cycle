import { createKeyboardInput } from './actions/keyboard';
import { createRenderer } from './render/renderer';
import { createWorld } from './sim/state';
import { step } from './sim/step';

const readActions = createKeyboardInput(window);
const renderer = createRenderer(document.body);

let world = createWorld();
let last = performance.now();

function frame(now: number): void {
  // Cap dt so a paused tab does not teleport the beaver.
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  world = step(world, readActions(), dt);
  renderer.draw(world);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
