import { relativeToView } from './actions/actions';
import { createKeyboardInput } from './actions/keyboard';
import { createCameraRig } from './render/cameraRig';
import { createRenderer } from './render/renderer';
import { createWorld, setSpeedMultiplier, teleport } from './sim/state';
import { step } from './sim/step';
import { flatTerrain } from './sim/terrain';
import { loadTileStore } from './terrain/loader';
import { createTestMenu } from './ui/testMenu';
import { treeTuning } from './terrain/trees';
import { Streamer, defaultStreamerOptions, httpFetchTile, httpFetchWater } from './terrain/streamer';

async function start(): Promise<void> {
  // Tiles are built locally (tools/tiles/build_tiles.py); without them the
  // game falls back to a flat plane.
  // Stress knobs for the tablet budgets (#53): ?rings=1000,2000 and ?trees=2.
  // ?fine=300 sets how far the fine tiles (ADR 0008) show, 0 turns them off.
  const query = new URLSearchParams(location.search);
  const rings = query.get('rings')?.split(',').map(Number);
  const fineRing = query.get('fine');
  const streamOptions = {
    ...defaultStreamerOptions,
    ...(rings?.length === 2 && rings.every((r) => r > 0) ? { rings: [rings[0]!, rings[1]!] as [number, number] } : {}),
    ...(fineRing !== null && Number.isFinite(Number(fineRing)) ? { fineRing: Number(fineRing) } : {}),
  };
  const treeScale = Number(query.get('trees'));
  if (treeScale > 0) treeTuning.densityScale = treeScale;

  const base = `${import.meta.env.BASE_URL}tiles/`;
  const store = await loadTileStore(base);
  const streamer = store ? new Streamer(store, httpFetchTile(base), streamOptions, httpFetchWater(base)) : null;
  const terrain = store ?? flatTerrain(0);
  // Start on dry ground just north of the suggested lodge site on the south shore
  // (design notes). The marker itself lies on the bog that the map counts as lake.
  // Without tiles the flat plane starts at the origin.
  const startX = store ? 63 : 0;
  const startZ = store ? 1750 : 0;
  if (streamer) await streamer.ready(startX, startZ, 8000);

  const readActions = createKeyboardInput(window);
  const renderer = createRenderer(document.body, store && streamer ? { store, streamer } : null);

  const rig = createCameraRig(renderer.canvas);
  let world = createWorld(terrain, startX, startZ);
  let last = performance.now();

  // A jump holds the beaver while the streamer loads the target, then moves it.
  // The frame loop is the only caller of streamer.update, so two focus points never fight.
  let jump: { x: number; z: number; deadline: number } | null = null;
  // Locations first, then the named markers (the lake, the bog, the inflows) as test jump points.
  const anchors = store?.index.anchors ?? [];
  const menu = createTestMenu(document.body, {
    speeds: [1, 2, 5, 20, 100],
    locations: anchors.map((a) => ({ id: a.id, name: a.name, enabled: a.inTiles })),
    onSpeed(m) {
      world = setSpeedMultiplier(world, m);
      menu.setSpeed(m);
    },
    onJump(id) {
      const a = anchors.find((l) => l.id === id);
      if (!a || !a.inTiles || !streamer) return;
      // The core's anchor is the tile origin; jumping to the core means the start spot.
      const at = id === 'core' ? { x: startX, z: startZ } : a;
      jump = { x: at.x, z: at.z, deadline: performance.now() + 8000 };
      menu.setStatus('Loading...');
    },
  });
  let fps = 60;
  let lastReadout = 0;

  function frame(now: number): void {
    // Cap dt so a paused tab does not teleport the beaver.
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (dt > 0) fps += (1 / dt - fps) * 0.05;
    if (jump && streamer) {
      streamer.update(jump.x, jump.z);
      if (streamer.settled(jump.x, jump.z) || now > jump.deadline) {
        world = teleport(world, terrain, jump.x, jump.z);
        jump = null;
        menu.setStatus('');
      }
    } else {
      const actions = readActions();
      const move = relativeToView(actions.move, rig.view.yaw);
      world = step(world, { move, dive: actions.dive, slap: actions.slap }, dt, terrain);
      streamer?.update(world.beaver.x, world.beaver.z);
      rig.update(dt, world.beaver.heading, move.x !== 0 || move.z !== 0);
    }
    renderer.draw(world, rig.view);
    if (now - lastReadout > 500) {
      lastReadout = now;
      const stats = renderer.terrain?.stats() ?? null;
      const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      menu.setReadout({
        fps,
        beaver: {
          x: world.beaver.x,
          z: world.beaver.z,
          ground: terrain.heightAt(world.beaver.x, world.beaver.z),
          waterDepth: terrain.waterDepth(world.beaver.x, world.beaver.z),
        },
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
    view: () => rig.view,
    stats: () => renderer.terrain?.stats() ?? null,
  };
}

void start();
