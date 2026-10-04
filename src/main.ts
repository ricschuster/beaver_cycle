import { createKeyboardInput } from './actions/keyboard';
import { createRenderer } from './render/renderer';
import { createWorld } from './sim/state';
import { step } from './sim/step';
import { flatTerrain } from './sim/terrain';
import { loadTileStore } from './terrain/loader';
import { Streamer, httpFetchTile } from './terrain/streamer';

async function start(): Promise<void> {
  // Tiles are built locally (tools/tiles/build_tiles.py); without them the
  // game falls back to a flat plane.
  const base = `${import.meta.env.BASE_URL}tiles/`;
  const store = await loadTileStore(base);
  const streamer = store ? new Streamer(store, httpFetchTile(base)) : null;
  const terrain = store ?? flatTerrain(0);
  if (streamer) await streamer.ready(0, 0, 8000);

  const readActions = createKeyboardInput(window);
  const renderer = createRenderer(document.body, store && streamer ? { store, streamer } : null);

  let world = createWorld(terrain);
  let last = performance.now();

  function frame(now: number): void {
    // Cap dt so a paused tab does not teleport the beaver.
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    world = step(world, readActions(), dt, terrain);
    streamer?.update(world.beaver.x, world.beaver.z);
    renderer.draw(world);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Read only view for tests and the coming test menu.
  (window as unknown as { __game: unknown }).__game = {
    world: () => world,
    stats: () => renderer.terrain?.stats() ?? null,
  };
}

void start();
