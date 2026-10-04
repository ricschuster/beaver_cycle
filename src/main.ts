import { createKeyboardInput } from './actions/keyboard';
import { createRenderer } from './render/renderer';
import { createWorld, setSpeedMultiplier, teleport } from './sim/state';
import { step } from './sim/step';
import { flatTerrain } from './sim/terrain';
import { loadTileStore } from './terrain/loader';
import { createTestMenu } from './ui/testMenu';
import { Streamer, httpFetchTile, httpFetchWater } from './terrain/streamer';

async function start(): Promise<void> {
  // Tiles are built locally (tools/tiles/build_tiles.py); without them the
  // game falls back to a flat plane.
  const base = `${import.meta.env.BASE_URL}tiles/`;
  const store = await loadTileStore(base);
  const streamer = store ? new Streamer(store, httpFetchTile(base), undefined, httpFetchWater(base)) : null;
  const terrain = store ?? flatTerrain(0);
  // Start on dry ground just north of the suggested lodge site on the south shore
  // (design notes). The marker itself lies on the bog that the map counts as lake.
  // Without tiles the flat plane starts at the origin.
  const startX = store ? 63 : 0;
  const startZ = store ? 1750 : 0;
  if (streamer) await streamer.ready(startX, startZ, 8000);

  const readActions = createKeyboardInput(window);
  const renderer = createRenderer(document.body, store && streamer ? { store, streamer } : null);

  let world = createWorld(terrain, startX, startZ);
  let last = performance.now();

  const anchors = store?.index.anchors.filter((a) => a.kind === 'location') ?? [];
  const menu = createTestMenu(document.body, {
    speeds: [1, 5, 20, 100],
    locations: anchors.map((a) => ({ id: a.id, name: a.name, enabled: a.inTiles })),
    onSpeed(m) {
      world = setSpeedMultiplier(world, m);
      menu.setSpeed(m);
    },
    onJump(id) {
      const a = anchors.find((l) => l.id === id);
      if (!a || !a.inTiles || !streamer) return;
      // Wait for the ground at the target so the beaver does not drop to 0 m.
      void streamer.ready(a.x, a.z, 8000).then(() => {
        world = teleport(world, terrain, a.x, a.z);
      });
    },
  });
  let fps = 60;
  let lastReadout = 0;

  function frame(now: number): void {
    // Cap dt so a paused tab does not teleport the beaver.
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (dt > 0) fps += (1 / dt - fps) * 0.05;
    world = step(world, readActions(), dt, terrain);
    streamer?.update(world.beaver.x, world.beaver.z);
    renderer.draw(world);
    if (now - lastReadout > 500) {
      lastReadout = now;
      const stats = renderer.terrain?.stats() ?? null;
      const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      menu.setReadout({
        fps,
        tilesByLevel: stats?.tilesByLevel ?? null,
        triangles: stats?.triangles ?? null,
        memoryMb: heap ? heap.usedJSHeapSize / 1048576 : null,
      });
    }
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
