import { mergeActions, relativeToView } from './actions/actions';
import { DO_LABEL, doHere, noIntent, takeHere, takeLabel, type Around, type DoKind } from './sim/buttons';
import { createHeldKeys, createKeyboardInput } from './actions/keyboard';
import { createCameraRig } from './render/cameraRig';
import { fly as flyStep, flyTarget, glide, look as lookAround, pickGround, zoomFree, type FlyTarget } from './render/flyCam';
import { createRenderer } from './render/renderer';
import { SEASON_FULL_DAY } from './render/seasonLook';
import { newWear } from './sim/wear';
import { LODGE_WOOD, findSite, atHole, atNest, checkSite, lodgeProgress } from './sim/lodge';
import { DAY_SECONDS, dateAt, daylight, withSeason, withTimeOfDay } from './sim/clock';
import { canRest, canSleep, newLife, sleepUntil, createWorld, setClock, setInLodge, setSpeedMultiplier, sleep, teleport, setStage, intoLodge, leaveHome, withPartners, type WorldState } from './sim/state';
import { STAGES, STAGE_RULES, isCalledBack, lifeAt, type Stage } from './sim/life';
import { formerParentsAt, parentsAt } from './sim/family';
import { homeDam } from './sim/routines';
import { AnimalField, capFor, type Animal } from './sim/animals';
import { growNeighbours, neighboursAt } from './sim/neighbours';
import { nameOf, pondName } from './sim/names';
import { DIG_REACH, DIG_TIME, HEAR_RANGE, escortBeaver, nearestStuck, rescue, startEscort, stepEscort, stuckBeaver, stuckNow, whereTo, digging } from './sim/escort';
import { answerNews, type Surroundings } from './sim/news';
import { CALL_SLOT, deedsFor, giftThanks, greetingFor, overheard, partnerRemark } from './sim/chatter';
import { BYE_SECONDS, TALK_END, LINE_SECONDS, choicesFor, factsFor, greeting, nearestSpeaker, noteTalk, replyLine, roleOf, speakersOf, type Reply, type Speaker, type TalkFacts } from './sim/talk';
import { REPLY_LABEL } from './sim/talkLines';
import { createTalkBubble } from './ui/talkBubble';
import { giftFamilies, greetedBy, familyMood, familyTrust, reactFamilies, spreadWord, startleFamilies } from './sim/familyMoods';
import { FEED_TRUST, banishFox, atStore, boltingDeer, feedAnimals, foxesAtStore, react, startle } from './sim/moods';
import { lead, leaderAnimal } from './sim/guides';
import { pondGuests, trackPonds } from './sim/pondGuests';
import { isPredator, meetPredators, predatorAnimals, type PredatorEvent } from './sim/predators';
import { CUE_EVERY, HEARD_DISTANCE, follower, mateOf } from './sim/partners';
import { LONE_NEWS, loneBeaverWay, pointerDots, pointerTarget, startPointer, type WayPointer } from './sim/wayToPartner';
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
import { filledBut, storeCapacity, storeCondition } from './sim/food';
import { createTouchControls, wantsTouchControls } from './ui/touchControls';
import { createKeyHints } from './ui/keyHints';
import { WELCOME_KEY, createHelpPanel, wantsWelcome } from './ui/helpPanel';
import { COACH_KEY, createCoach, wantsCoach } from './ui/coach';
import { askContinue } from './ui/continueCard';
import { AUTOSAVE_EVERY, ago, clearSave, loadSave, wantsSave, writeSave, type SaveStorage, type SavedCoach } from './persist/save';
import { createSleepPrompt } from './ui/sleepPrompt';
import { createDreamScreen } from './ui/dreamScreen';
import { createTestMenu } from './ui/testMenu';
import { STREAM_HEARD } from './audio/mix';
import { createWebAudio } from './audio/webAudio';
import { watchBeaver, watchWorld } from './audio/effects';
import { babbleCue, dreamCues } from './audio/talkDream';
import { LAYERS, createSound, wireBrowser } from './audio/sound';
import { createMuteButton } from './ui/muteButton';
import { createFlyButtons } from './ui/flyButtons';
import { createMinimap, minimapMode, nextMode, type MinimapMode } from './ui/minimap';
import { loadDamSites } from './render/damSites';
import { LEVEL_COST, placed, spotAt } from './sim/dam';
import { lodgeGround, pondsOf, withPonds } from './sim/pond';
import { lilyPadsNear } from './sim/lily';
import { rocksNear } from './sim/haul';
import { withNewSpots } from './sim/newSpots';
import { firstSpots, nearestQualifying, spawnNear } from './sim/damSpots';
import { treeTuning } from './terrain/trees';
import { drainBuildTimes } from './terrain/buildTimes';

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

/** The beaver at the start of a life stage. A baby is born in the lodge. */
function startStage(world: WorldState, stage: Stage): WorldState {
  const staged = setStage(world, stage);
  return stage === 'baby' ? intoLodge(staged) : staged;
}

async function start(): Promise<void> {
  // Tiles are built locally (tools/tiles/build_tiles.py); without them the
  // game falls back to a flat plane.
  // Stress knobs for the tablet budgets (#53): ?rings=1000,2000 and ?trees=2.
  // The sun's shadows are off by default (they halve the frame rate on the tablet, docs/design/16_shadow_cost.md); ?shadows=1 turns them on, ?shadowmap=1024 shrinks their map and ?cascades=1 keeps only the near box.
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
  const touchOn = wantsTouchControls(navigator, query);
  const touch = createTouchControls(document.body, touchOn);
  const keyHints = createKeyHints(document.body, window, !touchOn && !free);
  // The "?" button opens the manual (public/manual.html), and the first start shows a welcome card.
  // Storage can be blocked, so a failed read counts as not seen and a failed write is ignored.
  const remembered = (key: string): boolean => {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  };
  const remember = (key: string): void => {
    try {
      localStorage.setItem(key, '1');
    } catch {
      // Not remembered: it shows again next time.
    }
  };
  // The first-steps coach (docs/design/25_first_steps_coach.md). It starts after the welcome card, from the world as it is
  // then, and again at each new life stage, with that stage's steps, until the player closes it. The frame loop starts it when
  // `coachPending` is set, since the world exists only there.
  let coachPending = false;
  let coachOn = false;
  let coachStage: Stage | null = null;
  const coach = free
    ? null
    : createCoach(document.body, {
        touch: wantsTouchControls(navigator, query),
        facing: () => facing(),
        onClose: () => {
          coachOn = false;
          remember(COACH_KEY);
        },
      });
  if (!free) {
    const help = createHelpPanel(document.body, {
      manualUrl: `${import.meta.env.BASE_URL}manual.html`,
      touch: wantsTouchControls(navigator, query),
      onWelcomed() {
        remember(WELCOME_KEY);
        if (wantsCoach(remembered(COACH_KEY), query, navigator.webdriver)) coachPending = true;
      },
      onCoach: () => {
        coachPending = true;
      },
    });
    if (wantsWelcome(remembered(WELCOME_KEY), query, navigator.webdriver)) help.showWelcome();
    else if (wantsCoach(remembered(COACH_KEY), query, navigator.webdriver)) coachPending = true;
  }
  const renderer = createRenderer(document.body, store && streamer ? { store, streamer } : null, {
    shadows: query.get('shadows') === '1' && !free,
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
  // ?stage=baby|teenager|adult starts the beaver at the start of that life stage. A baby starts in the lodge. A game starts as a
  // baby (the brief: you grow up in the lodge), except in an automated browser, where the tests and playtests expect an adult.
  const stageParam = query.get('stage');
  const startAs = STAGES.includes(stageParam as Stage) ? (stageParam as Stage) : navigator.webdriver ? 'adult' : 'baby';
  if (startAs !== 'adult') world = startStage(world, startAs);
  // The saved game (docs/design/26_saving.md): one slot. When there is one, the player continues it or starts over.
  const storage: SaveStorage | null = (() => {
    try {
      return localStorage;
    } catch {
      return null;
    }
  })();
  let startNote: string | null = null;
  const saving = storage !== null && !free && wantsSave(query, navigator.webdriver);
  if (saving) {
    const found = loadSave(storage, world);
    if (found.kind === 'ok') {
      if ((await askContinue(document.body, ago(found.save.savedAt, Date.now()))) === 'continue') {
        world = found.save.world;
        // The coach goes on where it was, or stays off if it was closed.
        coachPending = false;
        coachOn = found.save.coach.on;
        coachStage = found.save.coach.stage;
        if (coachOn && found.save.coach.state) coach?.resume(world, found.save.coach.state);
      } else clearSave(storage);
    } else if (found.kind === 'unreadable') startNote = 'The saved game could not be read, so this is a new game.';
  }
  const savedCoach = (): SavedCoach => ({ on: coachOn, stage: coachStage, state: coach?.state() ?? null });
  let savedAt = performance.now();
  const saveNow = (): void => {
    if (!saving || !storage) return;
    savedAt = performance.now();
    writeSave(storage, world, savedCoach(), Date.now());
  };
  // A tablet may close the game without a word when it is put away: save when the page is hidden.
  if (saving) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveNow();
    });
    window.addEventListener('pagehide', saveNow);
  }
  let last = performance.now();

  // A jump holds the beaver while the streamer loads the target, then moves it.
  // The frame loop is the only caller of streamer.update, so two focus points never fight.
  let jump: { x: number; z: number; deadline: number; spawn: { x: number; z: number } | null } | null = null;
  // Locations first, then the named markers (the lake, the bog, the inflows) as test jump points.
  const anchors = store?.index.anchors ?? [];
  // The minimap trial (docs/design/31_minimap.md): on, turning with the camera; ?minimap=north keeps north up, ?minimap=0 or the test menu turns it off, and an automated browser needs ?minimap=1.
  const minimap = createMinimap(free ? document.createElement('div') : document.body, minimapMode(query.get('minimap'), navigator.webdriver));
  const MAP_LABEL: Record<MinimapMode, string> = { north: 'North up', turn: 'Turning', off: 'Off' };
  // Sound (docs/design/32_sound.md): the mute button is always on the screen. The free fly view and ?sound=0 stay silent.
  const soundOut = createWebAudio();
  const sound = createSound(soundOut, storage);
  const beaverCues = watchBeaver();
  const worldCues = watchWorld();
  const silent = free || query.get('sound') === '0';
  if (!silent) wireBrowser(soundOut, window, document);
  const muteButton = free ? null : createMuteButton(document.body, sound.settings().muted, () => {
    sound.setMuted(!sound.settings().muted);
    muteButton?.set(sound.settings().muted);
  });
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
    onBreathLow() {
      world = { ...world, beaver: { ...world.beaver, breath: Math.min(world.beaver.breath, 0.05) } };
    },
    onFillStore() {
      world = { ...world, store: filledBut(world.store, storeCapacity(storeCondition(world.storeWear, world.clock)), 1) };
    },
    onTimeOfDay(t) {
      world = setClock(world, withTimeOfDay(world.clock, t));
    },
    onNewLife() {
      world = startStage(newLife(world), 'baby');
    },
    onStage(stage) {
      world = startStage(world, stage);
    },
    onSeason(season) {
      // The first day with the season's own look: its first days blend from the season before (seasonLook.ts), so
      // the first day of winter would show only half its snow.
      world = setClock(world, withSeason(world.clock, season, SEASON_FULL_DAY));
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
    shadowsAvailable: query.get('shadows') === '1' && !free,
    onShadows(on) {
      renderer.setShadows(on);
    },
    damSites: damSitesFile.length > 0 ? { initiallyOn: query.get('damsites') === '1', onToggle: setDamSites } : undefined,
    sound: {
      effects: sound.settings().effects,
      music: sound.settings().music,
      onEffects: sound.setEffects,
      onMusic: sound.setMusic,
      layers: [
        ...LAYERS.map((id) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1), on: sound.layerOn(id), onToggle: (on: boolean) => sound.setLayerOn(id, on) })),
        { id: 'music', name: 'Music', on: sound.musicOn(), onToggle: sound.setMusicOn },
        { id: 'oneshots', name: 'One-shots', on: sound.oneShotsOn(), onToggle: sound.setOneShotsOn },
      ],
    },
    minimap: {
      label: MAP_LABEL[minimap.mode()],
      onNext() {
        minimap.setMode(nextMode(minimap.mode()));
        return MAP_LABEL[minimap.mode()];
      },
    },
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
    onDream() {
      startDream();
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
  if (startNote) toast.show(startNote);
  let wasCalled = false;
  let lastStage: Stage | null = null;
  let lastFollower: string | null = null;
  let lastGeneration = world.generation;
  let lastSeason = dateAt(world.clock).season;
  const heardBefore = new Set<string>();
  let cueIn = 0; // seconds until the next word on where a lone beaver is
  let wayPointer: WayPointer | null = null; // the sparkles toward a lone beaver after a hint, not saved
  // Where the player looks, in the heading convention: the camera looks at the beaver from `yaw`.
  const facing = (): number => rig.view.yaw + Math.PI;
  let padSeen: number | null | undefined; // undefined until the first frame
  let branchSeen: number | null | undefined;
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
    onDream: () => startDream(),
  });
  // The dream (docs/design/29_dream_candy_land.md): candy land over the game, made new each night from the day and the
  // generation. While it is open the frame loop gives it the input and neither steps nor draws the waking game. Waking goes
  // through the sleep prompt, which moves the clock to dawn (when the beaver could sleep) and fades the game back in.
  const dreamScreen = createDreamScreen(document.body, {
    touch: wantsTouchControls(navigator, query),
    onWake: () => sleepPrompt.wakeFromDream(),
    onEvents: (events) => {
      if (!silent) sound.cue(dreamCues(events), performance.now() / 1000);
    },
  });
  const startDream = (seed = Math.floor(world.clock / DAY_SECONDS) * 7919 + world.generation): void => dreamScreen.start(seed);
  let fps = 60;
  let lastReadout = 0;
  let animalsAt = 0;
  // Other families are found as the player comes near their ponds (note 24); cells already looked at are kept here.
  let familiesAt = 0;
  const familiesTried = new Set<string>();
  const animalField = new AnimalField();
  let readBolt = false;
  const sniffed = new Set<string>();
  const talkBubble = createTalkBubble(hud);
  let doPressed: DoKind | null = null; // what a press of Do did this frame: a talk or a dig starts here, not in step
  let doShown: DoKind | null = null; // what the Do button says this frame
  let nearby: Around = { speaker: false, drift: false }; // someone to talk to and a drift to dig, from the last frame
  let talkingTo: Speaker | null = null;
  let talks = 0;
  let movingNow = false;
  let dug = 0;
  const heardStuck = new Set<string>();
  let lastAmbient: readonly Animal[] = [];
  let lastCallSlot = -1;
  const surroundings = (): Surroundings => {
    let pad: { x: number; z: number } | null = null;
    let padDist = 90;
    for (const p of lilyPadsNear(terrain, world.beaver.x, world.beaver.z, 90, world.clock, world.picked)) {
      const d = Math.hypot(p.x - world.beaver.x, p.z - world.beaver.z);
      if (d < padDist) {
        pad = p;
        padDist = d;
      }
    }
    const threat = lastAmbient.filter((a) => isPredator(a.kind) && Math.hypot(a.x - world.beaver.x, a.z - world.beaver.z) < 100).sort((a, c) => Math.hypot(a.x - world.beaver.x, a.z - world.beaver.z) - Math.hypot(c.x - world.beaver.x, c.z - world.beaver.z))[0];
    return { pad, predator: threat ? { x: threat.x, z: threat.z, kind: threat.kind } : null, facing: facing() };
  };
  // The talk: the beaver greets the player, who may ask what it is doing, for news, for a job, or to be shown the way, at most two
  // questions, and says bye; the beaver answers each, and says goodbye before the card closes (#344, #345).
  let asked: Reply[] = [];
  let talkFacts: TalkFacts | null = null;
  // What each beaver said last, by speaker and kind of line, so it does not say the same thing twice in a row.
  const lastSaid = new Map<string, string>();
  const before = (who: Speaker, part: string): string => lastSaid.get(`${who.id}:${part}`) ?? '';
  const said = (who: Speaker, part: string, text: string): string => {
    lastSaid.set(`${who.id}:${part}`, text);
    return text;
  };
  const speak = (who: Speaker, text: string, seconds: number, facts: TalkFacts | null): void => {
    const choices = facts ? choicesFor(who, facts, asked).map((id) => ({ id, label: REPLY_LABEL[id] })) : [];
    talkBubble.say(who.name, text, seconds, choices, answer(who), roleOf(who));
    if (!silent) sound.cue([babbleCue(who.kind, who.id, text)], performance.now() / 1000);
  };
  const answer = (who: Speaker) => (id: string): void => {
    if (talkingTo?.id !== who.id || !talkFacts) return;
    if (id === 'bye') {
      speak(who, said(who, 'bye', replyLine('bye', who, talkFacts, talks++, before(who, 'bye'))), BYE_SECONDS, null);
      talkingTo = null;
      return;
    }
    if (id === 'lead') {
      const to = whereTo(world);
      talkBubble.hush();
      talkingTo = null;
      if (world.escort) toast.show(`${world.escort.name} is already showing you the way`);
      else if (!to) toast.show(`${who.name}: I do not know where to take you yet. Build a lodge first`);
      else {
        world = { ...world, escort: startEscort({ id: who.id, name: who.name, family: who.family ?? '', x: who.x, z: who.z }, to) };
        toast.show(`${who.name} leads the way. Follow`);
      }
      return;
    }
    const reply = id as Exclude<Reply, 'bye' | 'lead'>;
    asked = [...asked, reply];
    talkFacts = factsFor(world, who);
    const trusting = !who.family || familyMood(world, who.family) === 'curious';
    const text = reply === 'news' ? answerNews(world, surroundings(), trusting, talks++, before(who, 'news'), who.kind) : replyLine(reply, who, talkFacts, talks++, before(who, reply));
    speak(who, said(who, reply, text), LINE_SECONDS * 1.5, talkFacts);
    // News of a lone beaver: sparkles show the way to it.
    const lone = text.startsWith(LONE_NEWS) ? loneBeaverWay(world, facing()) : null;
    if (lone) wayPointer = startPointer(lone.partner.id, world.time);
  };
  // A family's pond is named for where it lies from the home, as in the call for help in the snow.
  const placeOf = (family: string): string | null => {
    const fam = world.neighbours.find((f) => f.id === family);
    return fam ? pondName(fam.lodge, world.formerHomes.at(-1) ?? world.lodge ?? world.beaver) : null;
  };
  const greeted = new Set<string>(); // families that have greeted the beaver this visit (#342)
  const gave = new Set<string>(); // families given a gift this visit, and startled by a slap, for what they say of the player
  const slapped = new Set<string>();
  // Word of a gift or a rescue gets around: the other families the player knows trust it a little more too.
  const spread = (from: string): void => {
    const before = world;
    world = spreadWord(world, from, FEED_TRUST, greeted);
    const homeAt = world.formerHomes.at(-1) ?? world.lodge ?? world.beaver;
    const warmer = world.neighbours.find((n) => n.id !== from && familyMood(before, n.id) !== familyMood(world, n.id));
    if (warmer) toast.show(`Word gets around. The ${pondName(warmer.lodge, homeAt)} family trusts you more too`);
  };

  // One bad frame must not freeze the game: log the error and schedule the next frame anyway.
  function frame(now: number): void {
    try {
      frameBody(now);
    } catch (err) {
      console.error('frame failed', err);
    }
    requestAnimationFrame(frame);
  }

  function frameBody(now: number): void {
    // Cap dt so a paused tab does not teleport the beaver. The first frame timestamp can come before `last`, so dt is never negative.
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.1));
    last = now;
    if (dt > 0) fps += (1 / dt - fps) * 0.05;
    if (dreamScreen.active()) {
      dreamScreen.frame(dt, mergeActions(readKeyboard(), touch.read()));
      if (!silent) sound.music('dream', fps, now / 1000);
      return;
    }
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
      movingNow = actions.move.x !== 0 || actions.move.z !== 0;
      const move = relativeToView(actions.move, rig.view.yaw);
      // What Do and Take mean here (#341): the words on the buttons, and what a press of each does this frame.
      const doNow = doHere(world, terrain, trees, nearby);
      const takeNow = takeHere(world, withPonds(terrain, world.ponds), terrain);
      touch.setLabel('do', doNow ? DO_LABEL[doNow] : 'Do');
      touch.setEnabled('do', doNow !== null);
      touch.setLabel('take', takeLabel(takeNow));
      touch.setEnabled('take', takeNow !== null);
      const b = world.beaver;
      touch.setEnabled('dive', world.inLodge ? !!world.lodge && atHole(world.lodge, b.x, b.z) : b.mode !== 'walk');
      touch.setEnabled('slap', !world.inLodge && b.mode !== 'dive');
      keyHints.setWords(doNow ? DO_LABEL[doNow] : null, takeNow ? takeLabel(takeNow) : null);
      doShown = doNow;
      doPressed = actions.act ? doNow : null;
      if (free && rig.view.free) {
        // The drone leaves the beaver, which stands still. Any move or climb cancels a tap's glide; the streamer follows the drone.
        const climb = (held('Space') || held('KeyE') ? 1 : 0) - (held('ShiftLeft') || held('ShiftRight') || held('KeyQ') ? 1 : 0) + flyButtons.read();
        if (actions.move.x !== 0 || actions.move.z !== 0 || climb !== 0) glideTo = null;
        if (glideTo) {
          if (glide(rig.view, glideTo, dt)) glideTo = null;
        } else flyStep(rig.view, actions.move, climb, dt, surface);
        world = step(world, noIntent(), dt, terrain, trees);
        streamer?.update(rig.view.free.x, rig.view.free.z);
      } else if (fly) {
        // The view leaves the beaver, which stands still; the stick or WASD moves the view's own point, Q and E zoom.
        const speed = FLY_BASE_SPEED + rig.view.dist * FLY_SPEED_PER_M;
        const at = rig.view.focus ?? { x: world.beaver.x, z: world.beaver.z };
        rig.view.focus = { x: at.x + move.x * speed * dt, z: at.z + move.z * speed * dt };
        world = step(world, noIntent(), dt, terrain, trees);
        streamer?.update(rig.view.focus.x, rig.view.focus.z);
      } else {
        world = step(world, { move, dive: actions.dive, diveTap: actions.diveTap, slap: actions.slap, do: doPressed, take: actions.take ? takeNow : null, stashTap: actions.stashTap, stashClose: actions.stashClose }, dt, terrain, trees);
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
    // A young beaver at the edge of its range hears its parents call it back.
    const home = world.lodge && !world.inLodge ? Math.hypot(world.beaver.x - world.lodge.x, world.beaver.z - world.lodge.z) : 0;
    const called = isCalledBack(home, STAGE_RULES[lifeAt(world.clock, world.bornAt).stage].range);
    if (called && !wasCalled) toast.show('Mama calls you back');
    wasCalled = called;
    // Growing up from a teenager: Mama and Papa say it is time to start a family of one's own (Q8, Q50).
    const nowStage = lifeAt(world.clock, world.bornAt).stage;
    if (lastStage === 'teenager' && nowStage === 'adult') {
      // A lone beaver lives at a dam spot that can hold a lodge pond, so the player can lead it home and build there.
      world = withPartners(leaveHome(world));
      toast.show('Mama and Papa say it is time to start a family of your own');
    }
    if (lastStage !== null && lastStage !== nowStage) saveNow();
    lastStage = nowStage;
    // The coach, after the leaving above, so the adult's steps see a world with no home. A new stage starts that stage's steps.
    if (coachPending) {
      coachPending = false;
      coachOn = true;
      coachStage = null;
    }
    if (coachOn && coachStage !== nowStage) {
      coachStage = nowStage;
      coach?.start(world, nowStage);
    }
    coach?.update(world);
    // A lone beaver the player meets slaps its tail and follows.
    const following = follower(world.partners)?.id ?? null;
    if (following && following !== lastFollower) toast.show('A beaver slaps its tail and follows you');
    lastFollower = following;
    // Nudges toward a partner: a tail slap in the distance, and a word at the start of winter that kits come in spring.
    for (const p of world.partners) {
      if (p.state === 'alone' && !heardBefore.has(p.id) && Math.hypot(p.x - world.beaver.x, p.z - world.beaver.z) <= HEARD_DISTANCE) {
        heardBefore.add(p.id);
        toast.show('A tail slaps in the distance. A lone beaver?');
        wayPointer = startPointer(p.id, world.time);
      }
    }
    // Out of earshot, now and then a word on which way the nearest lone beaver is (#254).
    cueIn -= dt;
    if (cueIn <= 0 && world.partners.length > 0) {
      const lone = loneBeaverWay(world, facing());
      if (lone && lone.d > HEARD_DISTANCE) {
        cueIn = CUE_EVERY;
        toast.show(`A lone beaver lives ${lone.words}. Follow the sparkles`);
        wayPointer = startPointer(lone.partner.id, world.time);
      }
    }
    const season = dateAt(world.clock).season;
    if (season === 'winter' && lastSeason !== 'winter' && world.partners.length > 0 && !mateOf(world.partners)) toast.show('Kits are born on the first day of spring. Find a partner and a lodge');
    if (season !== lastSeason) saveNow();
    lastSeason = season;
    if (world.generation > lastGeneration) toast.show('A kit is born');
    if (world.generation !== lastGeneration) saveNow();
    lastGeneration = world.generation;
    // A toast for each achievement won since the last frame.
    // A meal gives a lift for a while: a pad for swimming, a branch for felling. A loaded game gives no toast.
    if (world.padAt !== padSeen && padSeen !== undefined && world.padAt !== null) toast.show('Tasty! You swim faster for a minute');
    if (world.branchAt !== branchSeen && branchSeen !== undefined && world.branchAt !== null) toast.show('Well fed! You fell trees faster today');
    padSeen = world.padAt;
    branchSeen = world.branchAt;
    if (wonShown < 0) wonShown = world.achievements.length;
    for (const id of world.achievements.slice(wonShown)) toast.show(ACHIEVEMENT_TEXT[id]);
    wonShown = world.achievements.length;
    stashPanel.set(world.stashOpen, world.store, world.carry, storeCapacity(storeCondition(world.storeWear, world.clock)));
    const rest = canRest(world);
    const stage = lifeAt(world.clock, world.bornAt).stage;
    sleepPrompt.set({ night: canSleep(world), rest, grow: rest && stage !== 'adult' ? (stage === 'baby' ? 'teenager' : 'adult') : null });
    const ponded = withPonds(terrain, world.ponds);
    if (now - animalsAt > 100) {
      animalsAt = now;
      animalField.trim(world.beaver.x, world.beaver.z);
    }
    if (now - familiesAt > 3000) {
      familiesAt = now;
      const grown = growNeighbours(world.neighbours, terrain, world.beaver, world.formerHomes.at(-1) ?? world.lodge ?? world.beaver, familiesTried);
      if (grown !== world.neighbours) world = { ...world, neighbours: [...grown] };
    }
    world = trackPonds(world);
    // The animals as they stand for their mood: deer bolt from a predator, wary ones keep away, curious ones come to look, a fox sniffs at the store at night (note 24, "Interaction with animals").
    const slappedNow = world.lastSlap !== null && world.lastSlap.time === world.time;
    const around = [...animalField.near(ponded, world.beaver.x, world.beaver.z, world.clock, capFor(fps)), ...pondGuests(world, world.beaver.x, world.beaver.z)];
    // The families: shy, calm or curious by trust, thanking a gift, hurt by a slap, and greeting the beaver once each (#342).
    const stuckList = stuckNow(world, ponded);
    const away = new Set([...stuckList.map((st) => st.member), ...(world.escort ? [world.escort.id] : [])]);
    const familyBeavers = reactFamilies(neighboursAt(world.neighbours, world.clock, ponded), world, ponded).filter((n) => !away.has(n.id));
    if (slappedNow) {
      const before = world;
      world = startleFamilies(world, familyBeavers);
      for (const n of world.neighbours) if (familyTrust(world, n.id) < familyTrust(before, n.id)) slapped.add(n.id);
    }
    const gifts = giftFamilies(world, familyBeavers);
    world = gifts.world;
    // Each gift is thanked for what it is, and word of it gets around (chatter.ts, familyMoods.ts).
    for (const g of gifts.gifts) {
      gave.add(g.family);
      toast.show(giftThanks(g.kind, familyBeavers.filter((n) => n.family === g.family), dateAt(world.clock).day + gave.size));
      spread(g.family);
    }
    const visit = { gifts: gave, slaps: slapped, greeted };
    const hello = greetedBy(familyBeavers, world);
    if (hello && !greeted.has(hello)) {
      const fam = world.neighbours.find((f) => f.id === hello);
      const pond = fam ? pondName(fam.lodge, world.formerHomes.at(-1) ?? world.lodge ?? world.beaver) : 'pond';
      // The deeds are read before the family counts as greeted, so a first meeting is a first meeting.
      toast.show(greetingFor(deedsFor(world, hello, visit), familyBeavers.filter((n) => n.family === hello), pond, dateAt(world.clock).day));
      greeted.add(hello);
    }
    if (slappedNow) world = startle(world, around);
    // Talking: a press of Do when it reads Talk starts a talk with the nearest beaver in reach (#344, buttons.ts says when).
    const parents = [...parentsAt(world.lodge, world.bornAt, world.clock, world.inLodge, ponded, world.parentCoats, homeDam(world.lodge, world.spots, world.dams)), ...formerParentsAt(world.formerHomes, world.clock, ponded)];
    // A baby cannot work, but it talks to its own people from day 1 (Mama and Papa; siblings are not in the game yet).
    const grown = STAGE_RULES[lifeAt(world.clock, world.bornAt).stage].works;
    const near = !world.stashOpen ? nearestSpeaker(speakersOf(grown ? familyBeavers : [], parents, grown ? world.partners : [], nameOf, placeOf), world.beaver) : null;
    if (talkingTo && Math.hypot(talkingTo.x - world.beaver.x, talkingTo.z - world.beaver.z) > TALK_END) {
      talkBubble.hush();
      talkingTo = null;
    }
    // A press while already talking to this beaver does not start over. The greeting reads what the beaver remembers before this talk.
    if (near && doPressed === 'talk' && !(talkBubble.talking() && talkingTo?.id === near.id)) {
      talkingTo = near;
      asked = [];
      talkFacts = factsFor(world, near);
      const text = greeting(near, talkFacts, talks++, before(near, 'greet'));
      world = noteTalk(world, near.id);
      speak(near, said(near, 'greet', text), LINE_SECONDS * 1.5, talkFacts);
    }
    // A call and its reply between two beavers of a family near the player, once in a slot of the clock (#345), and else now and
    // then a word from the partner. The two lines go into the toast queue together, so the reply follows the call.
    const callSlot = Math.floor(world.clock / CALL_SLOT);
    if (callSlot !== lastCallSlot) {
      lastCallSlot = callSlot;
      const said = talkBubble.talking() ? null : overheard(familyBeavers, world.beaver, world.clock, (f) => deedsFor(world, f, visit));
      if (said) {
        toast.show(`${said.call.who}: "${said.call.text}"`);
        toast.show(`${said.reply.who}: "${said.reply.text}"`);
      } else if (!talkBubble.talking()) {
        const remark = partnerRemark(world, surroundings().pad, facing());
        if (remark) toast.show(`${remark.who}: "${remark.text}"`);
      }
    }
    talkBubble.prompt(near && doShown === 'talk' ? near.name : null, touchOn ? 'Talk' : 'E');
    talkBubble.tick(dt);
    // Winter: a beaver stuck in a drift calls for help, the player digs it out by gnawing beside it, and it becomes a guide (#346).
    const homeAt = world.formerHomes.at(-1) ?? world.lodge ?? world.beaver;
    for (const st of stuckList) {
      if (heardStuck.has(st.id) || Math.hypot(st.x - world.beaver.x, st.z - world.beaver.z) > HEAR_RANGE) continue;
      heardStuck.add(st.id);
      const fam = world.neighbours.find((f) => f.id === st.family);
      toast.show(`Someone is calling for help in the snow${fam ? ` by the ${pondName(fam.lodge, homeAt)}` : ''}. Gnaw the drift to dig`);
    }
    const drift = nearestStuck(stuckList, world.beaver, DIG_REACH);
    dug = STAGE_RULES[lifeAt(world.clock, world.bornAt).stage].works ? digging(dug, drift, world.beaver, doPressed === 'dig', movingNow, dt) : 0;
    nearby = { speaker: near !== null, following: near?.kind === 'partner' && near.id === follower(world.partners)?.id, drift: drift !== null };
    doPressed = null;
    if (drift && dug >= DIG_TIME) {
      world = rescue(world, drift);
      dug = 0;
      toast.show(`${drift.name} is free! Talk to ${drift.name} and ask to be shown the way`);
      spread(drift.family);
    } else if (drift && dug > 0) talkBubble.note(`Digging ${Math.min(99, Math.floor((dug / DIG_TIME) * 100))}%`);
    if (world.escort) {
      const led = stepEscort(world, dt);
      world = led.world;
      for (const e of led.events) toast.show(e.what === 'arrived' ? `${e.name}: Here we are` : `You lost ${e.name}`);
    }
    const ambient = foxesAtStore(react(around, world, ponded), world, ponded);
    lastAmbient = ambient;
    const led = lead(world, ambient, dt, ponded);
    world = led.world;
    for (const e of led.events) toast.show(GUIDE_TEXT[e.what](e.kind));
    const fed = feedAnimals(world, ambient);
    world = fed.world;
    for (const a of fed.fed) toast.show(a.kind === 'duck' ? 'The duck eats the lily pad and trusts you a little more' : 'The deer eats it and trusts you a little more');
    if (!readBolt && boltingDeer(ambient, world)) {
      readBolt = true;
      toast.show('The deer bolt. Something is near');
    }
    for (const a of ambient) {
      if (a.kind === 'fox' && !sniffed.has(a.id) && atStore(world, a) && Math.hypot(a.x - world.beaver.x, a.z - world.beaver.z) < 50) {
        sniffed.add(a.id);
        toast.show('A fox is sniffing at your store. Slap your tail');
      }
    }
    // A fox or owl that notices the beaver on land becomes a predator and is drawn from its own state (note 24, slice 3).
    const atTheStore = new Set(world.predators.filter((p) => p.kind === 'fox' && atStore(world, p)).map((p) => p.id));
    const met = meetPredators(world, ambient, slappedNow, dt, ponded);
    world = met.world;
    for (const e of met.events) {
      toast.show(e.what === 'scared' && e.kind === 'fox' && atTheStore.has(e.id) ? 'You chased the fox off your store' : PREDATOR_TEXT(e));
      if (e.what === 'scared' && e.kind === 'fox' && atTheStore.has(e.id)) world = banishFox(world, e.id);
    }
    const engaged = new Set(world.predators.map((p) => p.id));
    if (world.leader) engaged.add(world.leader.id);
    const animals = [...ambient.filter((a) => !engaged.has(a.id)), ...predatorAnimals(world.predators, ponded), ...(world.leader ? [leaderAnimal(world.leader, ponded, world)] : [])];
    const drawnFamily = [...familyBeavers, ...stuckList.flatMap((st) => stuckBeaver(world, st, ponded) ?? []), ...(world.escort ? [escortBeaver(world, world.escort, ponded) ?? []].flat() : [])];
    // The sparkles toward a lone beaver, until time is up or the player is close.
    const wayTo = pointerTarget(wayPointer, world);
    if (!wayTo) wayPointer = null;
    renderer.setWayDots(wayTo && !world.inLodge ? pointerDots(world.beaver, wayTo, ponded) : [], world.time);
    renderer.draw(world, rig.view, parents, animals, drawnFamily, stuckList.map((st) => ({ x: st.x, y: ponded.heightAt(st.x, st.z), z: st.z })), dug > 0);
    if (!silent) {
      const b = world.beaver;
      sound.cue([...beaverCues(world, now / 1000), ...worldCues(world, lastAmbient, now / 1000)], now / 1000);
      sound.music('valley', fps, now / 1000);
      sound.update({
        streamDistance: terrain.streamDistance?.(b.x, b.z, STREAM_HEARD) ?? Infinity,
        onWater: ponded.isWater(b.x, b.z),
        inLodge: world.inLodge,
        underwater: ponded.isWater(b.x, b.z) && ponded.waterDepth(b.x, b.z) > 1,
        daylight: daylight(dateAt(world.clock).timeOfDay),
        season: dateAt(world.clock).season,
      });
    }
    minimap.update(now, { ground: ponded, pondsKey: world.ponds, beaver: world.beaver, yaw: rig.view.yaw, lodge: world.lodge });
    if (now - lastReadout > 500) {
      lastReadout = now;
      const stats = renderer.terrain?.stats() ?? null;
      const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      menu.setAchievements(achievementLines(world));
      menu.setInLodge(world.inLodge);
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
    if (saving && performance.now() - savedAt > AUTOSAVE_EVERY * 1000) saveNow();
  }
  saveNow();
  requestAnimationFrame(frame);
  // ?dream=1 opens a dream at once, to look at it on a tablet and for the browser test; ?seed=N picks the night.
  if (query.get('dream') === '1') {
    const seed = Number(query.get('seed'));
    startDream(query.has('seed') && Number.isFinite(seed) ? Math.floor(seed) : undefined);
  }
  // Read only view for tests and the coming test menu.
  (window as unknown as { __game: unknown }).__game = {
    world: () => world,
    view: () => rig.view,
    stats: () => renderer.terrain?.stats() ?? null,
    // Per part tile build times since the last call, for the tablet bench.
    buildTimes: drainBuildTimes,
    // Where a playtest can find things to work on: the nearest standing tree, and the nearest spot a lodge could start.
    nearestTree: (x: number, z: number, reach: number) => trees.nearest(x, z, reach, new Set(world.felled)),
    lilyPadsNear: (radius: number) => lilyPadsNear(terrain, world.beaver.x, world.beaver.z, radius, world.clock, world.picked),
    // The rocks still lying within `radius` metres of the beaver, and the bare ground height at a point (to see a log climbed).
    rocksNear: (radius: number) => rocksNear(withPonds(terrain, world.ponds), world.beaver.x, world.beaver.z, radius, world.rocksTaken),
    groundAt: (x: number, z: number) => terrain.heightAt(x, z),
    // Mama and Papa as drawn now: of the player's lodge while young, and of every lodge the family has left.
    parents: () => [...parentsAt(world.lodge, world.bornAt, world.clock, world.inLodge, withPonds(terrain, world.ponds), world.parentCoats, homeDam(world.lodge, world.spots, world.dams)), ...formerParentsAt(world.formerHomes, world.clock, withPonds(terrain, world.ponds))],
    formerParents: () => formerParentsAt(world.formerHomes, world.clock, withPonds(terrain, world.ponds)),
    // The beavers of the other families as drawn now.
    neighbours: () => neighboursAt(world.neighbours, world.clock, withPonds(terrain, world.ponds)),
    // The ambient animals around the beaver now.
    animals: () => animalField.near(withPonds(terrain, world.ponds), world.beaver.x, world.beaver.z, world.clock, capFor(fps)),
    // The predators in their meeting with the beaver, and when it was hurt.
    predators: () => world.predators,
    hurtAt: () => world.hurtAt,
    lodgeSite: (radius: number) => findSite(lodgeGround(terrain, world.ponds), world.beaver.x, world.beaver.z, radius),
    // The dream's state while one is open, else null.
    dream: () => dreamScreen.state(),
  };
}

const GUIDE_TEXT = {
  called: (kind: string) => `The ${kind} calls you. Follow it to lily pads`,
  arrived: (kind: string) => `The ${kind} has brought you to lily pads`,
  lost: (kind: string) => `You lost the ${kind}`,
};

function PREDATOR_TEXT(e: PredatorEvent): string {
  const name = e.kind;
  if (e.what === 'caught') return `A ${name} caught you. You drop what you carry and slow down. Eat a lily pad`;
  if (e.what === 'scared') return `Your tail slap scared the ${name} off`;
  if (e.kind === 'owl') return 'An owl hoots nearby. Get into the water';
  if (e.kind === 'lynx') return 'A lynx is stalking you. Get into the water, or slap your tail at the water\'s edge';
  if (e.kind === 'bear') return 'A bear has seen you. Keep moving or slap your tail';
  return 'A fox has seen you. Get into the water or slap your tail';
}

void start();
