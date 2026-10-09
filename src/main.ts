import { mergeActions, noActions, relativeToView } from './actions/actions';
import { createHeldKeys, createKeyboardInput } from './actions/keyboard';
import { createCameraRig } from './render/cameraRig';
import { fly as flyStep, flyTarget, glide, look as lookAround, pickGround, zoomFree, type FlyTarget } from './render/flyCam';
import { createRenderer } from './render/renderer';
import { newWear } from './sim/wear';
import { LODGE_WOOD, findSite, atHole, atNest, checkSite, lodgeProgress } from './sim/lodge';
import { DAY_SECONDS, withSeason, withTimeOfDay } from './sim/clock';
import { canRest, canSleep, newLife, sleepUntil, createWorld, setClock, setInLodge, setSpeedMultiplier, sleep, teleport, setStage } from './sim/state';
import { STAGES, lifeAt, type Stage } from './sim/life';
import { createLifeHud } from './ui/lifeHud';
import { step } from './sim/step';
import { CHOP_TIME, noTrees, type TreeSource } from './sim/trees';
import { flatTerrain } from './sim/terrain';
import { loadTileStore } from './terrain/loader';
import { createBreathMeter } from './ui/breathMeter';
import { createCarryHud, foodInfoOf } from './ui/carryHud';
import { ACHIEVEMENT_TEXT, achievementLines } from './sim/achievements';
import { createToast } from './ui/toast';
import { createClockHud } from './ui/clockHud';
import { createStashPanel } from './ui/stashPanel';
import { storeCapacity, storeCondition } from './sim/food';
import { createTouchControls, wantsTouchControls } from './ui/touchControls';
import { createSleepPrompt } from './ui/sleepPrompt';
import { createTestMenu } from './ui/testMenu';
import { createFlyButtons } from './ui/flyButtons';
import { loadDamSites } from './render/damSites';
import { LEVEL_COST, placed, spotAt } from './sim/dam';
import { lodgeGround, pondsOf, withPonds } from './sim/pond';
import { withNewSpots } from './sim/newSpots';
import { firstSpots, nearestQualifying, spawnNear } from './sim/damSpots';
import { treeTuning } from './terrain/trees';

/** The fly view (?fly=1): the farthest zoom (metres), and the pan speed, a base plus a share of the zoom distance (metres per second). */
const FLY_MAX_DIST = 600;
/** The fly view starts high above the start, looking straight down with north up (yaw 0 puts the camera south of the point). */
const FLY_START_DIST = 250;
const FLY_PITCH = 1.5;
const FLY_BASE_SPEED = 8;
const FLY_SPEED_PER_M = 0.6;
/** The free fly view (?fly=free) starts this high over the start spot and a little south of it, looking north over the lake. */
const FREE_START_HEIGHT = 80;
const FREE_START_BACK = 120;
const FREE_START_PITCH = 0.3;
/** The camera's vertical field of view, degrees (renderer.ts), which the tap needs to find the ground under a finger. */
const CAMERA_FOV = 60;
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

  // The free fly view needs neither the sun's shadows nor its disc: shadows are the costliest part of a frame.
  const free = query.get('fly') === 'free';
  const readKeyboard = createKeyboardInput(window);
  const touch = createTouchControls(document.body, wantsTouchControls(navigator, query));
  const renderer = createRenderer(document.body, store && streamer ? { store, streamer } : null, {
    shadows: query.get('shadows') !== '0' && !free,
    sunDisc: !free,
    bare: free,
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
  // out it is zoomed, and the wheel zooms (up to 600 m). The clock and the ponds run on.
  const fly = query.get('fly') === '1';
  // ?fly=free: a drone. The stick or WASD flies it level over the ground (W forward, A and D sideways), Space or E climbs, Shift or
  // Q descends, a drag turns it, and a tap on the land glides it there. It keeps 3 m over the ground and the water. The beaver stands still.
  // The ground, or the water over it, for the drone to stay above.
  const surface = (x: number, z: number): number => terrain.heightAt(x, z) + (terrain.isWater(x, z) ? terrain.waterDepth(x, z) : 0);
  let glideTo: FlyTarget | null = null;
  const rig = createCameraRig(
    renderer.canvas,
    fly
      ? { maxDist: FLY_MAX_DIST, pan: (dx, dy) => panFly(dx, dy) }
      : free
        ? {
            pan: (dx, dy) => {
              glideTo = null;
              lookAround(rig.view, dx, dy);
            },
            onWheel: (delta) => {
              glideTo = null;
              zoomFree(rig.view, delta, surface);
            },
            onTap: (x, y) => {
              const hit = pickGround(rig.view, (x / window.innerWidth) * 2 - 1, 1 - (y / window.innerHeight) * 2, window.innerWidth / window.innerHeight, (CAMERA_FOV * Math.PI) / 180, surface);
              if (hit && rig.view.free) glideTo = flyTarget(rig.view.free, hit, surface);
            },
          }
        : {},
  );
  if (free) {
    touch.setActionsVisible(false);
    rig.view.yaw = 0;
    rig.view.pitch = FREE_START_PITCH;
    rig.view.free = { x: startX, y: surface(startX, startZ + FREE_START_BACK) + FREE_START_HEIGHT, z: startZ + FREE_START_BACK };
  }
  const flyButtons = createFlyButtons(document.body, free && wantsTouchControls(navigator, query));
  // North is -z and east is +x. The view looks straight down with north up, so the map slides with the finger: a drag right
  // shows more to the west. A pixel is about this many metres across at the view's distance.
  const panFly = (dx: number, dy: number): void => {
    const f = rig.view.focus;
    if (!f) return;
    const metresPerPixel = (2 * rig.view.dist * Math.tan(Math.PI / 6)) / window.innerHeight;
    rig.view.focus = { x: f.x - dx * metresPerPixel, z: f.z - dy * metresPerPixel };
  };
  const held = createHeldKeys(window);
  if (fly) {
    rig.view.dist = FLY_START_DIST;
    rig.view.pitch = FLY_PITCH;
    rig.view.yaw = 0;
    rig.view.focus = { x: startX, z: startZ };
  }
  let world = { ...createWorld(terrain, startX, startZ), spots: damSpots };
  // ?day=12&time=0.3 starts on that game day at that part of the day (0 dawn, 0.625 dusk), to look at the light.
  const startDay = Number(query.get('day') ?? 0);
  const startTime = Number(query.get('time') ?? NaN);
  if (query.has('day') || query.has('time')) {
    world = { ...world, clock: (Math.max(0, startDay) + (Number.isFinite(startTime) ? startTime : 0.05)) * DAY_SECONDS };
  }
  // ?stage=baby|teenager|adult starts the beaver at the start of that life stage (default adult).
  const stageParam = query.get('stage');
  if (STAGES.includes(stageParam as Stage)) world = setStage(world, stageParam as Stage);
  // ?age=N makes them N game days old, to try wear and repair: the lodge is worn at 40 and broken at 68, the store at 20 and
  // 34, and a dam the test menu fills in at 10 and 17.
  const ageDays = Math.max(0, Number(query.get('age') ?? 0) || 0);
  // A whole lodge near the start, so the lodge can be tried without building one first. ?lodge=0 leaves it out.
  if (query.get('lodge') !== '0') {
    const site = findSite(terrain, startX, startZ, 300);
    if (site) {
      const age = ageDays;
      const wear = newWear(world.clock - age * DAY_SECONDS);
      // The test lodge is not the player's work, so Home counts as won without a toast (design note 21).
      world = { ...world, lodge: { ...site, wood: LODGE_WOOD, wear }, storeWear: wear, achievements: [...world.achievements, 'home'] };
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
    onNewLife() {
      world = setStage(newLife(world), 'baby');
    },
    onStage(stage) {
      world = setStage(world, stage);
    },
    onSeason(season) {
      world = setClock(world, withSeason(world.clock, season));
    },
    flyMode: {
      current: free ? 'free' : fly ? 'map' : 'off',
      onSelect(mode) {
        // The views are set up at the start, so a new one restarts the game with the other settings kept.
        const next = new URLSearchParams(location.search);
        if (mode === 'off') next.delete('fly');
        else next.set('fly', mode === 'map' ? '1' : 'free');
        const qs = next.toString();
        location.assign(location.pathname + (qs ? `?${qs}` : ''));
      },
    },
    shadowsAvailable: query.get('shadows') !== '0' && !free,
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
              const near = world.spots.reduce((best, s) => (Math.hypot(s.bed.x - b.x, s.bed.z - b.z) < Math.hypot(best.bed.x - b.x, best.bed.z - b.z) ? s : best));
              menu.setStatus('Loading...');
              jump = { x: near.bed.x, z: near.bed.z, deadline: performance.now() + 8000, spawn: null };
            },
            onFill() {
              const spot = spotAt(world.spots, world.beaver.x, world.beaver.z);
              if (spot) {
                const dams = placed(world.dams, spot, LEVEL_COST[2]!, undefined, world.clock).map((d) => (d.spot === spot.id && d.wear ? { ...d, wear: newWear(world.clock - ageDays * DAY_SECONDS) } : d));
                const set = pondsOf(dams, world.spots, terrain, world.clock);
                // This tool floods the ponds itself, so `step` sees no change: look for the new spots here.
                world = { ...world, dams, ponds: set.ponds, pondCrests: set.crests, spots: withNewSpots(world.spots, set.ponds.filter((p) => p.spot === spot.id), terrain) };
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
  // The free fly view shows none of the beaver's screens: they get a detached element, which is never on the page.
  const hud = free ? document.createElement('div') : document.body;
  const breathMeter = createBreathMeter(hud);
  const clockHud = createClockHud(hud);
  const lifeHud = createLifeHud(hud);
  const carryHud = createCarryHud(hud);
  const toast = createToast(hud);
  let wonShown = -1; // set on the first frame, so achievements already won in a loaded game give no toast
  // Taps on the stash screen wait here until the next step takes them.
  let stashTap: number | undefined;
  let stashClose = false;
  const stashPanel = createStashPanel(hud, {
    onTap(slot) {
      stashTap = slot;
    },
    onClose() {
      stashClose = true;
    },
  });
  const trees: TreeSource = renderer.terrain ? { nearest: (x, z, reach, felled) => renderer.terrain!.nearestTree(x, z, reach, felled), trunksNear: (x, z, reach, felled) => renderer.terrain!.trunksNear(x, z, reach, felled) } : noTrees;
  const sleepPrompt = createSleepPrompt(hud, {
    onWake(goal) {
      world = goal === 'night' ? sleep(world) : sleepUntil(world, goal);
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
      if (free && rig.view.free) {
        // The drone leaves the beaver, which stands still. Any move or climb cancels a tap's glide; the streamer follows the drone.
        const climb = (held('Space') || held('KeyE') ? 1 : 0) - (held('ShiftLeft') || held('ShiftRight') || held('KeyQ') ? 1 : 0) + flyButtons.read();
        if (actions.move.x !== 0 || actions.move.z !== 0 || climb !== 0) glideTo = null;
        if (glideTo) {
          if (glide(rig.view, glideTo, dt)) glideTo = null;
        } else flyStep(rig.view, actions.move, climb, dt, surface);
        world = step(world, noActions(), dt, terrain, trees);
        streamer?.update(rig.view.free.x, rig.view.free.z);
      } else if (fly) {
        // The view leaves the beaver, which stands still; the stick or WASD moves the view's own point, Q and E zoom.
        const speed = FLY_BASE_SPEED + rig.view.dist * FLY_SPEED_PER_M;
        const at = rig.view.focus ?? { x: world.beaver.x, z: world.beaver.z };
        rig.view.focus = { x: at.x + move.x * speed * dt, z: at.z + move.z * speed * dt };
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
    lifeHud.set(lifeAt(world.clock, world.bornAt));
    // While dragging a log with no lodge yet, show where one would start and whether it can.
    const siteGround = lodgeGround(terrain, world.ponds);
    const site = world.drag && !world.lodge && world.beaver.mode !== 'dive' ? checkSite(siteGround, world.beaver.x, world.beaver.z, world.beaver.heading) : null;
    renderer.setLodgePreview(site ? { x: site.x, y: siteGround.heightAt(site.x, site.z) + siteGround.waterDepth(site.x, site.z), z: site.z, ok: site.problem === null } : null);
    const l = world.inLodge ? world.lodge : null;
    const spot = l ? (atHole(l, world.beaver.x, world.beaver.z) ? 'hole' : atNest(l, world.beaver.x, world.beaver.z) ? 'nest' : 'room') : null;
    carryHud.set(world.felled.length, world.drag !== null, world.chop ? world.chop.progress / CHOP_TIME : null, world.lodge ? lodgeProgress(world.lodge) : null, site?.problem ?? (site ? 'ok' : null), spot, foodInfoOf(world, withPonds(terrain, world.ponds), terrain), world.achievements.includes('wood'));
    // A toast for each achievement won since the last frame.
    if (wonShown < 0) wonShown = world.achievements.length;
    for (const id of world.achievements.slice(wonShown)) toast.show(ACHIEVEMENT_TEXT[id]);
    wonShown = world.achievements.length;
    stashPanel.set(world.stashOpen, world.store, world.carry, storeCapacity(storeCondition(world.storeWear, world.clock)));
    const rest = canRest(world);
    const stage = lifeAt(world.clock, world.bornAt).stage;
    sleepPrompt.set({ night: canSleep(world), rest, grow: rest && stage !== 'adult' ? (stage === 'baby' ? 'teenager' : 'adult') : null });
    renderer.draw(world, rig.view);
    if (now - lastReadout > 500) {
      lastReadout = now;
      const stats = renderer.terrain?.stats() ?? null;
      const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      menu.setAchievements(achievementLines(world));
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
