import { mergeActions, noActions, relativeToView } from './actions/actions';
import { createHeldKeys, createKeyboardInput } from './actions/keyboard';
import { createCameraRig, zoom } from './render/cameraRig';
import { createRenderer } from './render/renderer';
import { newWear } from './sim/wear';
import { LODGE_WOOD, findSite, atHole, atNest, checkSite, lodgeProgress } from './sim/lodge';
import { DAY_SECONDS, withSeason, withTimeOfDay } from './sim/clock';
import { canSleep, createWorld, setClock, setInLodge, setSpeedMultiplier, sleep, teleport } from './sim/state';
import { step } from './sim/step';
import { CHOP_TIME, noTrees, type TreeSource } from './sim/trees';
import { flatTerrain } from './sim/terrain';
import { loadTileStore } from './terrain/loader';
import { createBreathMeter } from './ui/breathMeter';
import { createCarryHud, foodInfoOf } from './ui/carryHud';
import { createClockHud } from './ui/clockHud';
import { createStashPanel } from './ui/stashPanel';
import { storeCapacity, storeCondition } from './sim/food';
import { createTouchControls, wantsTouchControls } from './ui/touchControls';
import { createSleepPrompt } from './ui/sleepPrompt';
import { createTestMenu } from './ui/testMenu';
import { loadDamSites } from './render/damSites';
import { LEVEL_COST, placed, spotAt } from './sim/dam';
import { lodgeGround, pondsOf, withPonds } from './sim/pond';
import { firstSpots, nearestQualifying, spawnNear } from './sim/damSpots';
import { treeTuning } from './terrain/trees';

/** The fly view (?fly=1): the farthest zoom (metres), and the pan speed, a base plus a share of the zoom distance (metres per second). */
const FLY_MAX_DIST = 600;
/** The fly view starts high above the start, looking down steeply. */
const FLY_START_DIST = 250;
const FLY_START_PITCH = 1.0;
const FLY_BASE_SPEED = 8;
const FLY_SPEED_PER_M = 0.6;
/** Q zooms in and E zooms out at this rate (e-folds per second). */
const FLY_ZOOM_RATE = 1.2;
import { Streamer, defaultStreamerOptions, httpFetchTile, httpFetchWater } from './terrain/streamer';

async function start(): Promise<void> {
  // Tiles are built locally (tools/tiles/build_tiles.py); without them the
  // game falls back to a flat plane.
  // Stress knobs for the tablet budgets (#53): ?rings=1000,2000 and ?trees=2.
  // ?shadows=0 turns the sun shadows off and ?shadowmap=1024 shrinks their map and ?cascades=1 keeps only the near box.
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

  const readKeyboard = createKeyboardInput(window);
  const touch = createTouchControls(document.body, wantsTouchControls(navigator, query));
  const renderer = createRenderer(document.body, store && streamer ? { store, streamer } : null, {
    shadows: query.get('shadows') !== '0',
    shadowMap: Number(query.get('shadowmap')) || undefined,
    cascades: Number(query.get('cascades')) || undefined,
  });

  // Marks for the candidate dam sites from tools/dam-sites, a debug view for the dam placement talk. Off at first, the
  // test menu toggles them, and ?damsites=1 starts with them on. They load the first time they are shown.
  const damSitesFile = store ? await loadDamSites(base) : [];
  const setDamSites = (on: boolean): void => {
    if (on && !damSitesAdded) {
      renderer.addDamSites(damSitesFile);
      damSitesAdded = true;
    }
    renderer.setDamSitesVisible(on);
  };
  let damSitesAdded = false;
  // The first dam spots of every location (six each, design note 20), marked by rings that show when the beaver is near.
  // The core counts from the start spot, the others from their anchor, which a jump then moves within 200 m of the first.
  const damSpots = (store?.index.anchors ?? []).filter((l) => l.kind === 'location').flatMap((l) => firstSpots(damSitesFile, l.id, l.id === 'core' ? { x: startX, z: startZ } : l));
  renderer.setDamSpots(damSpots);
  if (query.get('damsites') === '1') setDamSites(true);

  // ?fly=1: the view comes loose from the beaver, which stands still. The stick or WASD pans it over the land, faster the further
  // out it is zoomed, and Q and E zoom (up to 600 m). The clock and the ponds run on.
  const fly = query.get('fly') === '1';
  const rig = createCameraRig(renderer.canvas, fly ? FLY_MAX_DIST : undefined);
  const held = createHeldKeys(window);
  if (fly) {
    rig.view.dist = FLY_START_DIST;
    rig.view.pitch = FLY_START_PITCH;
    rig.view.focus = { x: startX, z: startZ };
  }
  let world = { ...createWorld(terrain, startX, startZ), spots: damSpots };
  // ?day=12&time=0.3 starts on that game day at that part of the day (0 dawn, 0.625 dusk), to look at the light.
  const startDay = Number(query.get('day') ?? 0);
  const startTime = Number(query.get('time') ?? NaN);
  if (query.has('day') || query.has('time')) {
    world = { ...world, clock: (Math.max(0, startDay) + (Number.isFinite(startTime) ? startTime : 0.05)) * DAY_SECONDS };
  }
  // ?age=N makes them N game days old, to try wear and repair: the lodge is worn at 40 and broken at 68, the store at 20 and
  // 34, and a dam the test menu fills in at 10 and 17.
  const ageDays = Math.max(0, Number(query.get('age') ?? 0) || 0);
  // A whole lodge near the start, so the lodge can be tried without building one first. ?lodge=0 leaves it out.
  if (query.get('lodge') !== '0') {
    const site = findSite(terrain, startX, startZ, 300);
    if (site) {
      const age = ageDays;
      const wear = newWear(world.clock - age * DAY_SECONDS);
      world = { ...world, lodge: { ...site, wood: LODGE_WOOD, wear }, storeWear: wear };
    }
  }
  let last = performance.now();

  // A jump holds the beaver while the streamer loads the target, then moves it.
  // The frame loop is the only caller of streamer.update, so two focus points never fight.
  let jump: { x: number; z: number; deadline: number; spawn: { x: number; z: number } | null } | null = null;
  // Locations first, then the named markers (the lake, the bog, the inflows) as test jump points.
  const anchors = store?.index.anchors ?? [];
  const menu = createTestMenu(document.body, {
    speeds: [1, 2, 5, 20, 100],
    locations: anchors.map((a) => ({ id: a.id, name: a.name, enabled: a.inTiles })),
    onSpeed(m) {
      world = setSpeedMultiplier(world, m);
      menu.setSpeed(m);
    },
    onLodge(inLodge) {
      world = setInLodge(world, inLodge);
    },
    onRemoveLodge() {
      world = { ...setInLodge(world, false), lodge: null };
    },
    onTimeOfDay(t) {
      world = setClock(world, withTimeOfDay(world.clock, t));
    },
    onSeason(season) {
      world = setClock(world, withSeason(world.clock, season));
    },
    shadowsAvailable: query.get('shadows') !== '0',
    onShadows(on) {
      renderer.setShadows(on);
    },
    damSites: damSitesFile.length > 0 ? { initiallyOn: query.get('damsites') === '1', onToggle: setDamSites } : undefined,
    damTools:
      damSpots.length > 0
        ? {
            onGo() {
              if (!streamer) return;
              const b = world.beaver;
              const near = damSpots.reduce((best, s) => (Math.hypot(s.bed.x - b.x, s.bed.z - b.z) < Math.hypot(best.bed.x - b.x, best.bed.z - b.z) ? s : best));
              menu.setStatus('Loading...');
              jump = { x: near.bed.x, z: near.bed.z, deadline: performance.now() + 8000, spawn: null };
            },
            onFill() {
              const spot = spotAt(damSpots, world.beaver.x, world.beaver.z);
              if (spot) {
                const dams = placed(world.dams, spot, LEVEL_COST[2]!, undefined, world.clock).map((d) => (d.spot === spot.id && d.wear ? { ...d, wear: newWear(world.clock - ageDays * DAY_SECONDS) } : d));
                const set = pondsOf(dams, damSpots, terrain, world.clock);
                world = { ...world, dams, ponds: set.ponds, pondCrests: set.crests };
              }
            },
          }
        : undefined,
    onSleep() {
      world = sleep(world);
    },
    onJump(id) {
      const a = anchors.find((l) => l.id === id);
      if (!a || !a.inTiles || !streamer) return;
      menu.setStatus('Loading...');
      // The core's anchor is the tile origin; jumping to the core means the start spot. Other locations start on dry
      // ground within 200 m of a dam spot (design note 20), so the frame loop first loads the ground around that spot,
      // then picks the place (`spawn`), then loads the ground there.
      if (id === 'core') {
        jump = { x: startX, z: startZ, deadline: performance.now() + 8000, spawn: null };
      } else {
        const site = nearestQualifying(a, damSitesFile);
        jump = { x: site?.x ?? a.x, z: site?.z ?? a.z, deadline: performance.now() + 8000, spawn: a };
      }
    },
  });
  const breathMeter = createBreathMeter(document.body);
  const clockHud = createClockHud(document.body);
  const carryHud = createCarryHud(document.body);
  // Taps on the stash screen wait here until the next step takes them.
  let stashTap: number | undefined;
  let stashClose = false;
  const stashPanel = createStashPanel(document.body, {
    onTap(slot) {
      stashTap = slot;
    },
    onClose() {
      stashClose = true;
    },
  });
  const trees: TreeSource = renderer.terrain ? { nearest: (x, z, reach, felled) => renderer.terrain!.nearestTree(x, z, reach, felled), trunksNear: (x, z, reach, felled) => renderer.terrain!.trunksNear(x, z, reach, felled) } : noTrees;
  const sleepPrompt = createSleepPrompt(document.body, {
    onWake() {
      world = sleep(world);
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
      if (jump.spawn && (streamer.settled(jump.x, jump.z) || now > jump.deadline)) {
        const at = spawnNear(jump.spawn, damSitesFile, terrain);
        jump = { x: at.x, z: at.z, deadline: now + 8000, spawn: null };
      } else if (!jump.spawn && (streamer.settled(jump.x, jump.z) || now > jump.deadline)) {
        world = teleport(world, terrain, jump.x, jump.z);
        if (fly) rig.view.focus = { x: world.beaver.x, z: world.beaver.z };
        jump = null;
        menu.setStatus('');
      }
    } else {
      const actions = { ...mergeActions(readKeyboard(), touch.read()), stashTap, stashClose };
      stashTap = undefined;
      stashClose = false;
      const move = relativeToView(actions.move, rig.view.yaw);
      if (fly) {
        // The view leaves the beaver, which stands still; the stick or WASD moves the view's own point, Q and E zoom.
        const speed = FLY_BASE_SPEED + rig.view.dist * FLY_SPEED_PER_M;
        const at = rig.view.focus ?? { x: world.beaver.x, z: world.beaver.z };
        rig.view.focus = { x: at.x + move.x * speed * dt, z: at.z + move.z * speed * dt };
        zoom(rig.view, Math.exp(((held('KeyE') ? 1 : 0) - (held('KeyQ') ? 1 : 0)) * FLY_ZOOM_RATE * dt), FLY_MAX_DIST);
        world = step(world, noActions(), dt, terrain, trees);
        streamer?.update(rig.view.focus.x, rig.view.focus.z);
      } else {
        world = step(world, { move, dive: actions.dive, slap: actions.slap, chop: actions.chop, grab: actions.grab, build: actions.build, stashTap: actions.stashTap, stashClose: actions.stashClose }, dt, terrain, trees);
        streamer?.update(world.beaver.x, world.beaver.z);
        rig.update(dt, world.beaver.heading, move.x !== 0 || move.z !== 0);
      }
    }
    breathMeter.set(world.beaver.breath);
    clockHud.set(world.clock);
    // While dragging a log with no lodge yet, show where one would start and whether it can.
    const siteGround = lodgeGround(terrain, world.ponds);
    const site = world.drag && !world.lodge && world.beaver.mode !== 'dive' ? checkSite(siteGround, world.beaver.x, world.beaver.z, world.beaver.heading) : null;
    renderer.setLodgePreview(site ? { x: site.x, y: siteGround.heightAt(site.x, site.z) + siteGround.waterDepth(site.x, site.z), z: site.z, ok: site.problem === null } : null);
    const l = world.inLodge ? world.lodge : null;
    const spot = l ? (atHole(l, world.beaver.x, world.beaver.z) ? 'hole' : atNest(l, world.beaver.x, world.beaver.z) ? 'nest' : 'room') : null;
    carryHud.set(world.felled.length, world.drag !== null, world.chop ? world.chop.progress / CHOP_TIME : null, world.lodge ? lodgeProgress(world.lodge) : null, site?.problem ?? (site ? 'ok' : null), spot, foodInfoOf(world, withPonds(terrain, world.ponds), terrain));
    stashPanel.set(world.stashOpen, world.store, world.carry, storeCapacity(storeCondition(world.storeWear, world.clock)));
    sleepPrompt.setAvailable(canSleep(world));
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
