import { mergeActions, noActions, relativeToView } from './actions/actions';
import { DO_LABEL, doHere, noIntent, takeHere, takeLabel, type Around, type DoKind } from './sim/buttons';
import { createHeldKeys, createKeyboardInput } from './actions/keyboard';
import { createCameraRig } from './render/cameraRig';
import { fly as flyStep, flyTarget, glide, look as lookAround, pickGround, zoomFree, type FlyTarget } from './render/flyCam';
import { createRenderer } from './render/renderer';
import { createLookPreview } from './render/lookPreview';
import { askLook } from './ui/lookCard';
import { SEASON_FULL_DAY } from './render/seasonLook';
import { newWear } from './sim/wear';
import { LODGE_WOOD, findSite, atHole, atNest, checkSite, checkSpot, lodgeProgress } from './sim/lodge';
import { DAYS_PER_YEAR, DAY_SECONDS, dateAt, daylight, withSeason, withTimeOfDay } from './sim/clock';
import { canRest, canSleep, canSleepOut, newLife, chooseLook, sleepUntil, createWorld, setClock, setInLodge, setSpeedMultiplier, sleep, teleport, setStage, intoLodge, leaveHome, withPartners, type WorldState } from './sim/state';
import { STAGES, STAGE_RULES, isCalledBack, lifeAt, type Stage } from './sim/life';
import { formerParentsAt, parentsAt, type Coat } from './sim/family';
import { homeDam } from './sim/routines';
import { AnimalField, capFor, type Animal } from './sim/animals';
import { guestKey, pendingJoin, setPendingJoin } from './net/pending';
import { Room } from './net/room';
import { canPlayTogether, HOST_QUIET_S, hostPlugin, hostSender, joinHost, startHosting, type GuestLink } from './net/session';
import { applySnapshot, friendBeaver, friendNearby, friendTaker, hideOf, othersOf, pairingOf, partnerCandidate, saysOf } from './net/view';
import type { Role } from './net/hideGame';
import { friendChoices } from './net/friendCard';
import { ANSWERS, SAY_TIME, agrees, isQuestion, isSay, pickPhrases, repliesFor, type AnswerId, type ReplyId } from './net/says';
import type { Speech } from './render/speechBubble';
import { BUBBLE_LIFE } from './render/speechBubble';
import { noPartnerSeen, partnerNews, seenNow } from './net/partnerNews';
import { SpeechHeard } from './net/speechHeard';
import { SEND_HZ, viewOfGuest } from './net/protocol';
import { growNeighbours, neighboursAt, startFamilies } from './sim/neighbours';
import { nameOf, pondName } from './sim/names';
import { WALK_IN, departsAt, settleFamily, settledId, visitorsAt } from './sim/scent';
import { DIG_REACH, DIG_TIME, HEAR_RANGE, escortBeaver, nearestStuck, rescue, startEscort, stepEscort, stuckBeaver, stuckNow, whereTo, digging } from './sim/escort';
import { answerNews, type Surroundings } from './sim/news';
import { CALL_SLOT, deedsFor, giftThanks, greetingFor, overheard, partnerRemark } from './sim/chatter';
import { BYE_SECONDS, TALK_END, LINE_SECONDS, choicesFor, factsFor, greeting, nearestSpeaker, noteTalk, replyLine, roleOf, speakersOf, type Reply, type Speaker, type TalkFacts } from './sim/talk';
import { REPLY_LABEL } from './sim/talkLines';
import { createTalkBubble } from './ui/talkBubble';
import { createHideCount, hideLine } from './ui/hideCount';
import { giftFamilies, giveFamily, greetedBy, homeLearned, isOwnFamily, takerNear, familyMood, familyTrust, reactFamilies, spreadWord, startleFamilies, type HomeSpot } from './sim/familyMoods';
import { FEED_TRUST, banishFox, atStore, boltingDeer, feedAnimals, foxesAtStore, react, startle } from './sim/moods';
import { lead, leaderAnimal } from './sim/guides';
import { pondGuests, trackPonds } from './sim/pondGuests';
import { isPredator, meetPredators, threatened, predatorAnimals, type PredatorEvent } from './sim/predators';
import { CUE_EVERY, HEARD_DISTANCE, follower, mateOf } from './sim/partners';
import { loneBeaverWay, loneNewsLine, pointerDots, pointerTarget, startPointer, type WayPointer } from './sim/wayToPartner';
import { createLifeHud } from './ui/lifeHud';
import { step } from './sim/step';
import { CHOP_TIME, noTrees, type TreeSource } from './sim/trees';
import { flatTerrain } from './sim/terrain';
import { loadTileStore } from './terrain/loader';
import { createBreathMeter } from './ui/breathMeter';
import { createCarryHud, foodInfoOf } from './ui/carryHud';
import { ACHIEVEMENT_TEXT, achievementLines, achievementRows, visitPlaces, noteFed, noteHomes, seeGuests } from './sim/achievements';
import { createToast, type Toast } from './ui/toast';
import { createClockHud } from './ui/clockHud';
import { createStashPanel } from './ui/stashPanel';
import { filledBut, storeCapacity, storeCondition } from './sim/food';
import { installNarrowHud } from './ui/narrowHud';
import { createTouchControls, wantsTouchControls } from './ui/touchControls';
import { createKeyHints } from './ui/keyHints';
import { WELCOME_KEY, createHelpPanel, manualUrl, wantsWelcome } from './ui/helpPanel';
import { COACH_KEY, createCoach, wantsCoach } from './ui/coach';
import { askSlot, type SlotChoice } from './ui/slotCard';
import { AUTOSAVE_EVERY, ago, clearSave, loadSave, parseSlot, readSlots, renameSave, wantsSave, writeSave, cleanName, type SaveStorage, type SavedCoach } from './persist/save';
import { createSleepPrompt } from './ui/sleepPrompt';
import { GuestIntent } from './net/guestIntent';
import { GuestDream } from './net/guestDream';
import { askedOf, GuestLying } from './net/sleepNews';
import { createSleepAsk } from './ui/sleepAsk';
import { createDreamScreen, type DreamLink } from './ui/dreamScreen';
import { viewFrom, type DreamTheme } from './sim/dream';
import { createTestMenu, type TestMenu } from './ui/testMenu';
import { NO_TEST_MENU, gameQuery } from './devTools';
import { STREAM_HEARD } from './audio/mix';
import { createWebAudio } from './audio/webAudio';
import { watchBeaver, watchWorld } from './audio/effects';
import { babbleCue, dreamCues } from './audio/talkDream';
import { LAYERS, createSound, wireBrowser } from './audio/sound';
import { createMuteButton } from './ui/muteButton';
import { createOsmCredit } from './ui/osmCredit';
import { getLang, resolveLang, setLang, t, text, type LangChoice } from './i18n';
import { loadPrefs, savePrefs } from './ui/prefs';
import { startScreenAwake } from './ui/screenAwake';
import { FRAME_CAP_FPS, createFrameCap } from './frameCap';
import { createAchievementsPanel, createSettingsPanel } from './ui/settingsPanel';
import { createFlyButtons } from './ui/flyButtons';
import { createMinimap, minimapMode, nextMode, type MinimapMode } from './ui/minimap';
import { loadDamSites } from './render/damSites';
import { LEVEL_COST, placed, spotAt } from './sim/dam';
import { lodgeGround, pondsAt, pondsOf, withPonds } from './sim/pond';
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
  const query = gameQuery(location.search, __DEV_TOOLS__);
  const rings = query.get('rings')?.split(',').map(Number);
  const fineRing = query.get('fine');
  const streamOptions = {
    ...defaultStreamerOptions,
    ...(rings?.length === 2 && rings.every((r) => r > 0) ? { rings: [rings[0]!, rings[1]!] as [number, number] } : {}),
    ...(fineRing !== null && Number.isFinite(Number(fineRing)) ? { fineRing: Number(fineRing) } : {}),
  };
  const treeScale = Number(query.get('trees'));
  if (treeScale > 0) treeTuning.densityScale = treeScale;

  // The language is set first, since every panel below builds its words when it is made.
  // The browser's storage (blocked in some modes, then null) holds the saved game, the sound settings and the Settings choices.
  const storage: SaveStorage | null = (() => {
    try {
      return localStorage;
    } catch {
      return null;
    }
  })();
  // The session's storage holds the host to join (src/net/pending.ts); it ends with the app run.
  const sessionStorageOrNull = (): Storage | null => {
    try {
      return sessionStorage;
    } catch {
      return null;
    }
  };
  // The Settings panel's choices (src/ui/prefs.ts). A dev URL parameter wins over them; the shadows are fixed at the start, so
  // changing them restarts the game.
  const prefs = loadPrefs(storage);
  // The words follow the Settings choice, or the device language (docs/design/36_languages.md); a new choice restarts the game.
  setLang(resolveLang(prefs.lang, navigator.languages ?? navigator.language));
  // Changing the language starts the game again, so the page language is set once here.
  document.documentElement.lang = getLang();
  let langChoice: LangChoice = prefs.lang;
  // The screen stays on while the game is in front, the start screen too (#771); the Settings choice turns it off.
  let keepAwake = prefs.keepAwake;
  const screenAwake = startScreenAwake(keepAwake);

  installNarrowHud();

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
    createOsmCredit(document.body);
    const help = createHelpPanel(document.body, {
      manualUrl: () => manualUrl(import.meta.env.BASE_URL),
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
  let lastHost = prefs.lastHost;
  const keptPrefs = (shadows: boolean) => ({ minimap: minimap.mode(), shadows, lang: langChoice, lastHost, keepAwake });
  const shadowsAtStart = (query.has('shadows') ? query.get('shadows') === '1' : prefs.shadows) && !free;
  const renderer = createRenderer(document.body, store && streamer ? { store, streamer } : null, {
    shadows: shadowsAtStart,
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
  // Where the player looks, in the heading convention: the camera looks at the beaver from `yaw`. It is here, not further down,
  // because continuing a saved game redraws the coach text, which asks for it before the rest of the setup has run.
  const facing = (): number => rig.view.yaw + Math.PI;
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
      // Four more families live close by (note 42, #660). Automated browsers leave them out unless ?families=1, so the tests keep their quiet valley.
      if (!navigator.webdriver || query.get('families') === '1') world = { ...world, neighbours: startFamilies(terrain, site) };
    }
  }
  // ?stage=baby|teenager|adult starts the beaver at the start of that life stage. A baby starts in the lodge. A game starts as a
  // baby (the brief: you grow up in the lodge), except in an automated browser, where the tests and playtests expect an adult.
  const stageParam = query.get('stage');
  // ?host=1 listens for friends (the app only), ?join=IP joins a host's valley as a guest (ADR 0014, #678). The guest shows the host's
  // world, so it starts a grown beaver and never saves.
  const netHost = __DEV_TOOLS__ && query.get('host') === '1';
  // The Join button of Settings keeps the address for the next run (src/net/pending.ts); ?join=IP does the same in a dev build.
  const pending = pendingJoin(sessionStorageOrNull());
  const netJoin = (__DEV_TOOLS__ ? query.get('join') : null) ?? pending?.address ?? null;
  // The guest dresses as it did in its own game: the Join button kept the coat and the look.
  if (netJoin && pending?.me) world = chooseLook(world, pending.me.coat, pending.me.look);
  const startAs = netJoin ? 'adult' : STAGES.includes(stageParam as Stage) ? (stageParam as Stage) : navigator.webdriver ? 'adult' : 'baby';
  if (startAs !== 'adult') world = startStage(world, startAs);
  // The saved game (docs/design/26_saving.md): eight slots. With a saved game the player picks a slot on the start screen; ?slot=N
  // goes straight to that slot (the Settings shadows restart uses it), and with no saved game at all the game starts in slot 1.
  let startNote: string | null = null;
  let slot = 1;
  let slotName = '';
  let freshGame = false;
  // Chosen on the start screen: host this game for friends (ADR 0014). Joining reloads as a guest, below.
  let hostFromStart = false;
  const saving = storage !== null && !free && !netJoin && wantsSave(query, navigator.webdriver);
  // The look card (#659) opens on a new game, and again when each kit is born. An automated browser skips it unless ?look=1.
  const asksLook = navigator.webdriver ? query.get('look') === '1' : !free;
  let lookOpen = false;
  let lookPicked = false;
  const chooseNewLook = async () => {
    lookOpen = true;
    const picked = await askLook(document.body, { coat: world.coat, look: world.look }, createLookPreview);
    world = chooseLook(world, picked.coat, picked.look);
    lookOpen = false;
    return picked;
  };
  if (saving) {
    const wanted = parseSlot(query.get('slot'));
    const slots = readSlots(storage, world);
    let choice: SlotChoice;
    if (wanted) choice = { slot: wanted, action: slots[wanted - 1]!.kind === 'used' ? 'continue' : 'new', name: '' };
    else if (slots.every((i) => i.kind !== 'used')) choice = { slot: 1, action: 'new', name: '' };
    else {
      for (;;) {
        choice = await askSlot(document.body, {
          slots: () => readSlots(storage, world),
          rename: (n, name) => void renameSave(storage, n, name),
          remove: (n) => clearSave(storage, n),
          ago: (at) => ago(at, Date.now()),
          together: canPlayTogether() ? { canHost: hostPlugin() !== null, lastHost } : null,
        });
        if (choice.join || choice.action !== 'new' || !asksLook) break;
        // A new game goes on to the look card, which can go back to the slots (#775).
        lookOpen = true;
        const picked = await askLook(document.body, { coat: world.coat, look: world.look }, createLookPreview, { back: true });
        lookOpen = false;
        if (picked) {
          world = chooseLook(world, picked.coat, picked.look);
          lookPicked = true;
          break;
        }
      }
    }
    if (choice.join) {
      // A guest plays a fresh world of the host's, so the game starts again as one (it picks its look on the way in).
      // The minimap does not exist yet, so the choices are saved as they were read, with the address added.
      lastHost = choice.join;
      savePrefs(storage, { ...prefs, lastHost });
      setPendingJoin(sessionStorageOrNull(), { address: choice.join });
      location.reload();
      await new Promise(() => {});
    }
    hostFromStart = !!choice.host;
    slot = choice.slot;
    if (choice.action === 'continue') {
      const found = loadSave(storage, world, slot);
      if (found.kind === 'ok') {
        world = found.save.world;
        slotName = found.save.name ?? '';
        // The coach goes on where it was, or stays off if it was closed.
        coachPending = false;
        coachOn = found.save.coach.on;
        coachStage = found.save.coach.stage;
        if (coachOn && found.save.coach.state) coach?.resume(world, found.save.coach.state);
      }
    } else {
      slotName = cleanName(choice.name);
      freshGame = true;
    }
    if (!wanted && slots.some((i) => i.kind === 'unreadable')) startNote = t('toast.unreadable');
  }
  let sleepUp = false;
  // A guest has no store of its own to count (the host's holds the food), so its line would read "store 0 of 0".
  const guestFood = <F extends { store: unknown } | null>(food: F): F => (food && link ? { ...food, store: null } : food);
  if (freshGame && asksLook) {
    // A look already picked on the way from the start screen is not asked again.
    if (!lookPicked) await chooseNewLook();
    // The beaver's name names the game too, unless the player named the game already.
    if (!slotName) slotName = cleanName(world.look.name);
  } else if (netJoin && !pending?.me && asksLook) {
    // A guest who joined from the start screen has no beaver of its own yet.
    await chooseNewLook();
  }
  const savedCoach = (): SavedCoach => ({ on: coachOn, stage: coachStage, state: coach?.state() ?? null });
  let savedAt = performance.now();
  const saveNow = (): void => {
    if (!saving || !storage) return;
    savedAt = performance.now();
    writeSave(storage, world, savedCoach(), Date.now(), slot, slotName);
  };
  // A tablet may close the game without a word when it is put away: save when the page is hidden.
  if (saving) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveNow();
    });
    window.addEventListener('pagehide', saveNow);
  }
  // The shared valley (ADR 0014): a host holds a room of guests, a guest holds a link to its host.
  let room: Room | null = null;
  // A jump of the clock by a test tool leaves every age as it is, the guests' too.
  const moveClock = (to: number): void => {
    room?.shiftAges(to - world.clock);
    world = setClock(world, to);
  };
  let hostLine = '';
  let hostToast: Toast | null = null;
  // Starts listening for guests; ?host=1 does it at once, the Host button of Settings later. Only the app can (a browser has no plugin).
  const beginHosting = (): void => {
    if (room || netJoin) return;
    const mine = new Room(hostSender());
    mine.restorePairs(world.pairLodges);
    hostLine = t('together.hostStarting');
    startHosting(mine, { hostAt: () => world.beaver, terrain, homes: () => world.neighbours.filter((n) => n.id.startsWith('family:start:')).map((n) => ({ x: n.lodge.x, z: n.lodge.z, id: n.id, lodge: n.lodge, parents: [...n.parents] as [Coat, Coat] })), bornAt: () => world.bornAt }, (s) => menu.setStatus(s)).then(
      (a) => {
        room = mine;
        hostLine = t('together.hosting', { ip: `${a.ip}` });
        hostToast?.show(hostLine);
        menu.setStatus(`Hosting at ${a.ip}:${a.port}`);
      },
      (e) => {
        hostLine = t('together.hostFailed');
        menu.setStatus(String(e));
      },
    );
  };
  let link: GuestLink | null = null;
  let wasLinked = false;
  let lostShown = false;
  let quietShown = false;
  let guestSnap: ReturnType<typeof othersOf> = [];
  let lastSnap: Parameters<typeof othersOf>[0] = null;
  // The last question put to this player and the last answer to its own that were shown, by the host's counter (#667).
  let sayShown = 0;
  // Friends who speak (#802): the says already heard, and the bubbles over heads now, with the real second each began.
  const heardSays = new SpeechHeard(BUBBLE_LIFE);
  let speeches: Speech[] = [];
  let answerShown = 0;
  // The game of hide and seek this tablet has shown: its key, the phase, and how many hiders were found (#664).
  const hideRoles = () => [{ id: 'hide', label: t('hide.iHide') }, { id: 'seek', label: t('hide.iSeek') }];
  let hideInviteShown = '';
  let hideSeen: { key: string; phase: string; found: number } | null = null;
  let netSentAt = 0;
  const guestIntent = new GuestIntent();
  let partnerSeen = noPartnerSeen();
  if (netHost || hostFromStart) beginHosting();
  if (netJoin) link = joinHost(netJoin, { t: 'hello', coat: world.coat, look: world.look, key: guestKey(storage) });
  let last = performance.now();

  // A jump holds the beaver while the streamer loads the target, then moves it.
  // The frame loop is the only caller of streamer.update, so two focus points never fight.
  let jump: { x: number; z: number; deadline: number; spawn: { x: number; z: number } | null } | null = null;
  // Locations first, then the named markers (the lake, the bog, the inflows) as test jump points.
  const anchors = store?.index.anchors ?? [];
  // The minimap trial (docs/design/31_minimap.md): on, turning with the camera; ?minimap=north keeps north up, ?minimap=0 or the test menu turns it off, and an automated browser needs ?minimap=1.
  const minimap = createMinimap(free ? document.createElement('div') : document.body, query.has('minimap') || !prefs.minimap ? minimapMode(query.get('minimap'), navigator.webdriver) : prefs.minimap);
  const MAP_LABEL: Record<MinimapMode, string> = { north: t('map.north'), turn: t('map.turn'), off: t('map.off') };
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
  // Settings and the achievements: the two buttons a player has next to the speaker (the free fly view has no screens).
  if (!free) {
    createSettingsPanel(document.body, {
      startScreen: saving ? () => {
        saveNow();
        const next = new URLSearchParams(location.search);
        next.delete('slot');
        const qs = next.toString();
        location.assign(location.pathname + (qs ? `?${qs}` : ''));
      } : null,
      sounds: { value: () => sound.settings().effects, onChange: sound.setEffects },
      music: { value: () => sound.settings().music, onChange: sound.setMusic },
      map: {
        label: () => MAP_LABEL[minimap.mode()],
        onNext() {
          minimap.setMode(nextMode(minimap.mode()));
          savePrefs(storage, keptPrefs(shadowsAtStart));
          return MAP_LABEL[minimap.mode()];
        },
      },
      keepAwake: {
        on: () => keepAwake,
        onToggle(on) {
          keepAwake = on;
          screenAwake.setEnabled(on);
          savePrefs(storage, keptPrefs(shadowsAtStart));
        },
      },
      shadows: {
        on: () => shadowsAtStart,
        onToggle(on) {
          savePrefs(storage, keptPrefs(on));
          saveNow();
          // The shadows are made when the renderer starts, so the game starts again, with the saved game to continue.
          const next = new URLSearchParams(location.search);
          next.delete('shadows');
          if (saving) next.set('slot', String(slot));
          const qs = next.toString();
          location.assign(location.pathname + (qs ? `?${qs}` : ''));
        },
      },
      together: netJoin || netHost || hostFromStart ? {
        isGuest: !!netJoin,
        line() {
          if (!netJoin) return hostLine;
          if (!link) return '';
          if (link.id) return t('together.joined', { ip: netJoin });
          const st = link.status();
          return st === 'failed' ? t('together.failed', { ip: netJoin }) : st === 'closed' ? t('together.lost') : t('together.joining', { ip: netJoin });
        },
        onLeave() {
          setPendingJoin(sessionStorageOrNull(), null);
          link?.close();
          location.reload();
        },
      } : null,
      language: {
        value: () => langChoice,
        onChange(choice) {
          langChoice = choice;
          savePrefs(storage, keptPrefs(shadowsAtStart));
          saveNow();
          // The words are read when the panels are made, so the game starts again, with the saved game to continue.
          const next = new URLSearchParams(location.search);
          if (saving) next.set('slot', String(slot));
          const qs = next.toString();
          location.assign(location.pathname + (qs ? `?${qs}` : ''));
        },
      },
    });
    createAchievementsPanel(document.body, () => achievementRows(world));
  }
  // The test menu is left out of the release build (ADR 0013); the frame loop keeps calling the stand-in.
  const menu: TestMenu = !__DEV_TOOLS__ ? NO_TEST_MENU : createTestMenu(document.body, {
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
      moveClock(withTimeOfDay(world.clock, t));
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
      moveClock(withSeason(world.clock, season, SEASON_FULL_DAY));
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
    shadowsAvailable: shadowsAtStart,
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
      world = sleep(world, threatened(world, lastAmbient));
    },
    onDream(theme) {
      startDream(undefined, theme);
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
  hostToast = toast;
  if (room) toast.show(hostLine);
  if (startNote) toast.show(startNote);
  let wasCalled = false;
  let lastStage: Stage | null = null;
  let lastFollower: string | null = null;
  let lastGeneration = world.generation;
  let lastSeason = dateAt(world.clock).season;
  const heardBefore = new Set<string>();
  let cueIn = 0; // seconds until the next word on where a lone beaver is
  let wayPointer: WayPointer | null = null; // the sparkles toward a lone beaver after a hint, not saved
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
      // With friends the room moves the clock once they agree (#661); a guest's clock is the host's. Alone, the wake does.
      if (!goal || room || link) return;
      world = goal === 'night' ? sleep(world, threatened(world, lastAmbient)) : sleepUntil(world, goal);
    },
    onLie(goal) {
      if (room) room.lie('host', goal, false, performance.now() / 1000);
      else if (link?.id) {
        link.send({ t: 'sleep', g: goal === 'season' ? 'season' : 'night' });
        guestLying.lie(performance.now() / 1000);
      }
      return !!room || !!link?.id;
    },
    onGiveUp() {
      if (room) room.wake('host', performance.now() / 1000);
      else link?.send({ t: 'sleep', a: 'wake' });
      guestLying.clear();
    },
    onDream: (theme) => (link ? guestDream(theme) : startDream(undefined, theme)),
  });
  // A guest's dream (#665): the host runs it; the guest asks with a message and opens its screen when the first frame comes back.
  const guestDreamer = new GuestDream();
  const guestDream = (theme: DreamTheme): void => {
    world = { ...world, dreamed: true };
    link?.send({ t: 'sleep', g: 'night', dream: true, theme });
    guestDreamer.ask(performance.now() / 1000);
  };
  // A friend's bed waits for the host to settle it: set when the guest sent its wish, until the host lists it asleep and then does not.
  const guestLying = new GuestLying();
  const sleepAsk = createSleepAsk(hud, {
    onAnswer(yes) {
      if (room) room.answerSkip('host', yes, performance.now() / 1000);
      else link?.send({ t: 'sleep', a: yes ? 'yes' : 'no' });
    },
  });
  // The dream (docs/design/29_dream_candy_land.md): candy land over the game, made new each night from the day and the
  // generation. While it is open the frame loop gives it the input and neither steps nor draws the waking game. Waking goes
  // through the sleep prompt, which moves the clock to dawn (when the beaver could sleep) and fades the game back in.
  const dreamScreen = createDreamScreen(document.body, {
    touch: wantsTouchControls(navigator, query),
    onWake: () => {
      if (room) room.wake('host', performance.now() / 1000);
      else if (link?.id) link.send({ t: 'sleep', a: 'wake' });
      sleepPrompt.wakeFromDream();
    },
    // The room runs the dream whenever there is one: for a host in its room, and for a guest in the host's.
    link: () => (room ? hostDreamLink : link?.id ? guestDreamLink : null),
    onKeep: (builds) => {
      world = { ...world, dreamKept: builds.map((b) => ({ ...b })) };
    },
    onEvents: (events) => {
      if (!silent) sound.cue(dreamCues(events), performance.now() / 1000);
    },
  });
  const hostDreamLink: DreamLink = {
    keeps: true,
    send: (input) => room?.steer('host', input),
    view() {
      const state = room?.dreamState();
      const info = room?.dreamInfo();
      if (!room || !state || !info) return null;
      return { state: viewFrom(state, 'host', info.owner), mine: info.owner === 'host', events: room.takeDreamEvents() };
    },
  };
  const guestDreamLink: DreamLink = {
    keeps: false,
    send: (input) => {
      guestDreamer.steer(input);
    },
    view() {
      const wire = lastSnap?.dream;
      if (!wire || !link?.id) return null;
      // A new snapshot: its news is told once, and the picture glides from the last one to it over one snapshot interval.
      const { state, fresh } = guestDreamer.glide(wire, performance.now(), 1000 / SEND_HZ);
      return { state: viewFrom(state, link.id, wire.owner), mine: wire.owner === link.id, events: fresh ? wire.events ?? [] : [] };
    },
  };
  // What the room decided for the host's own bed (#661): a plain sleep wakes with the clock moved or not, a dream goes on until the host wakes.
  const hostSleepNews = (): void => {
    const news = room?.sleepNews('host');
    if (!news) return;
    if (news === 'stop') toast.show(t('toast.skipStopped'));
    if (!dreamScreen.active()) sleepPrompt.release(news === 'go');
  };
  const startDream = (seed = Math.floor(world.clock / DAY_SECONDS) * 7919 + world.generation, theme: DreamTheme = 'candy'): void => {
    world = { ...world, dreamed: true };
    // A dream a friend already opened is joined: its land is the first sleeper's.
    const open = room?.dreamInfo();
    room?.lie('host', canSleep(world) ? 'night' : 'dream', true, performance.now() / 1000, { theme, seed });
    dreamScreen.start(open?.seed ?? seed, world.dreamKept, open?.theme ?? theme);
  };
  let fps = 60;
  let lastReadout = 0;
  let animalsAt = 0;
  // Other families are found as the player comes near their ponds (note 24); cells already looked at are kept here.
  let familiesAt = 0;
  const familiesTried = new Set<string>();
  const settleTried = new Set<string>();
  const animalField = new AnimalField();
  let readBolt = false;
  const sniffed = new Set<string>();
  const talkBubble = createTalkBubble(hud);
  const hideCount = createHideCount(hud);
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
      if (world.escort) toast.show(t('toast.escortAlready', { name: world.escort.name }));
      else if (!to) toast.show(t('toast.escortNowhere', { name: who.name }));
      else {
        world = { ...world, escort: startEscort({ id: who.id, name: who.name, family: who.family ?? '', x: who.x, z: who.z }, to) };
        toast.show(t('toast.escortStart', { name: who.name }));
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
    const lone = loneBeaverWay(world, facing());
    if (lone && text === loneNewsLine(lone.words)) wayPointer = startPointer(lone.partner.id, world.time);
  };
  // A family's pond is named for where it lies from the home, as in the call for help in the snow.
  const placeOf = (family: string): string | null => {
    const fam = world.neighbours.find((f) => f.id === family);
    return fam ? pondName(fam.lodge, world.formerHomes.at(-1) ?? world.lodge ?? world.beaver) : null;
  };
  let ownHome: HomeSpot | null = null; // the family lodge a guest was housed in, whose family needs no greeting
  const greeted = new Set<string>(); // families that have greeted the beaver this visit (#342)
  const gave = new Set<string>(); // families given a gift this visit, and startled by a slap, for what they say of the player
  const slapped = new Set<string>();
  // Word of a gift or a rescue gets around: the other families the player knows trust it a little more too.
  const spread = (from: string): void => {
    const before = world;
    world = spreadWord(world, from, FEED_TRUST, greeted);
    const homeAt = world.formerHomes.at(-1) ?? world.lodge ?? world.beaver;
    const warmer = world.neighbours.find((n) => n.id !== from && familyMood(before, n.id) !== familyMood(world, n.id));
    if (warmer) toast.show(t('toast.wordGetsAround', { pond: pondName(warmer.lodge, homeAt) }));
  };

  // The draw loop runs at most FRAME_CAP_FPS frames a second, however fast the screen is (#605); ?fps=N changes it and 0 lifts it (dev builds).
  const fpsParam = query.get('fps');
  const frameCap = createFrameCap(fpsParam !== null && fpsParam !== '' && Number.isFinite(Number(fpsParam)) ? Number(fpsParam) : FRAME_CAP_FPS);

  // One bad frame must not freeze the game: log the error and schedule the next frame anyway.
  function frame(now: number): void {
    if (!frameCap.due(now)) {
      requestAnimationFrame(frame);
      return;
    }
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
    // The look card stops the game, but a host with guests keeps its clock and room going, so the guests do not freeze behind it.
    // A guest's own look card does not stop its frame either: its beaver stands still behind the card, and the host's frames keep coming.
    if (lookOpen && !room && !link) return;
    // A friend's "Come along?" card is not set while a dream runs (#794): it waits under the dream screen and the host sees it after waking,
    // for what is left of ASK_TIME. If the 30 s are over, the room has already told the asker no. That is meant, so nothing is queued or kept.
    if (dreamScreen.active()) {
      dreamScreen.frame(dt, mergeActions(readKeyboard(), touch.read()));
      if (link) {
        // A guest in a dream: its beaver stands still, the dream input goes to the host, and the host's frames come back.
        if (now - netSentAt > 1000 / SEND_HZ && link.id) {
          netSentAt = now;
          link.send({ t: 'intent', x: 0, z: 0, dive: false, gnaw: false });
          const steer = guestDreamer.take();
          if (steer) link.send({ t: 'dream', input: steer });
        }
        const snap = link.take();
        if (snap) lastSnap = snap;
        // The room ended the dream (the host left, or it let it go): wake too.
        if (guestDreamer.ended(!!lastSnap?.dream, now)) dreamScreen.stop();
        if (!silent) sound.music('dream', fps, now / 1000);
        return;
      }
      if (!silent) sound.music('dream', fps, now / 1000);
      // The guests keep playing while the host dreams, and are told (#665).
      if (room) {
        world = room.step(world, dt, now / 1000, terrain, trees);
        hostSleepNews();
        if (now - netSentAt > 1000 / SEND_HZ) {
          netSentAt = now;
          room.broadcast(world, now / 1000);
        }
        streamer?.update(world.beaver.x, world.beaver.z, room.guests().map((g) => g.beaver));
      }
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
        // The drone follows a jump the way it starts: high over the new spot and a little south of it, looking north.
        if (free) {
          const fz = world.beaver.z + FREE_START_BACK;
          rig.view.yaw = 0;
          rig.view.pitch = FREE_START_PITCH;
          rig.view.free = { x: world.beaver.x, y: surface(world.beaver.x, fz) + FREE_START_HEIGHT, z: fz };
        }
        jump = null;
        menu.setStatus('');
      }
    } else {
      const actions = { ...(lookOpen ? noActions() : mergeActions(readKeyboard(), touch.read())), stashTap, stashClose };
      stashTap = undefined;
      stashClose = false;
      movingNow = actions.move.x !== 0 || actions.move.z !== 0;
      const move = relativeToView(actions.move, rig.view.yaw);
      // What Do and Take mean here (#341): the words on the buttons, and what a press of each does this frame.
      const doNow = doHere(world, terrain, trees, nearby);
      const takeNow = takeHere(world, withPonds(terrain, world.ponds), terrain);
      touch.setLabel('do', doNow ? DO_LABEL[doNow] : t('btn.do'));
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
        if (link) {
          // A guest: the host steps its beaver. Here the wish goes out SEND_HZ times a second and the state comes back.
          guestIntent.press(doPressed, actions.take ? takeNow : null, !!actions.diveTap);
          if (now - netSentAt > 1000 / SEND_HZ && link.id) {
            netSentAt = now;
            link.send(guestIntent.send(move, !!actions.dive));
          }
          const snap = link.take();
          if (snap) {
            // A friend who falls asleep into a dream is told to the others (#665).
            for (const id of snap.dreaming ?? []) {
              if (id !== link.id && !(lastSnap?.dreaming ?? []).includes(id)) {
                const name = snap.beavers.find((v) => v.id === id)?.look.name;
                toast.show(name ? t('toast.dreaming', { name }) : t('toast.dreamingFriend'));
              }
            }
            lastSnap = snap;
          }
          // The dream a guest asked for: open it with the first frame the host sends, or give up and wake when none comes.
          if (!dreamScreen.active()) {
            const wire = lastSnap?.dream;
            const next = guestDreamer.waiting(!!wire, now / 1000);
            if (next === 'open' && wire) dreamScreen.start(wire.seed, [], wire.theme);
            else if (next === 'giveUp') {
              link.send({ t: 'sleep', a: 'wake' });
              sleepPrompt.wakeFromDream();
            }
          }
          if (snap && link.id) {
            world = applySnapshot(world, snap, link.id);
            // The host's dams make the ponds here too, worked out from the dams as the host does.
            const set = pondsAt({ ponds: world.ponds, crests: world.pondCrests }, world.dams, world.spots, terrain, world.clock);
            world = { ...world, ponds: set.ponds, pondCrests: set.crests };
          }
          world = { ...world, time: world.time + dt };
          guestSnap = link.id ? othersOf(lastSnap, link.id) : [];
          const linked = !!link.id;
          if (linked !== wasLinked) {
            if (!linked && link.status() === 'closed') toast.show(t('toast.hostLost'));
            else if (linked && lostShown) toast.show(t('toast.hostBack'));
            lostShown = lostShown || (!linked && link.status() === 'closed');
            if (linked) lostShown = false;
            wasLinked = linked;
          }
          // A host that stopped without closing the link (its page closed, its app asleep) leaves the guest standing still.
          const quiet = linked && link.quietFor() > HOST_QUIET_S;
          if (quiet !== quietShown) {
            toast.show(t(quiet ? 'toast.hostQuiet' : 'toast.hostBack'));
            quietShown = quiet;
          }
          menu.setStatus(link.id ? `Joined ${netJoin} as ${link.id}` : `Joining ${netJoin}: ${link.status()}`);
        } else {
          world = step(world, { move: room?.hostFrozen() ? { x: 0, z: 0 } : move, dive: actions.dive, diveTap: actions.diveTap, slap: actions.slap, do: doPressed, take: actions.take ? takeNow : null, stashTap: actions.stashTap, stashClose: actions.stashClose }, dt, terrain, trees);
          if (room) {
            world = room.step(world, dt, now / 1000, terrain, trees);
            hostSleepNews();
            if (now - netSentAt > 1000 / SEND_HZ) {
              netSentAt = now;
              room.broadcast(world, now / 1000);
            }
          }
        }
        streamer?.update(world.beaver.x, world.beaver.z, room ? room.guests().map((g) => g.beaver) : undefined);
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
    carryHud.set(world.felled.length, world.drag !== null, world.chop ? world.chop.progress / CHOP_TIME : null, world.lodge ? lodgeProgress(world.lodge) : null, site?.problem ?? (site ? 'ok' : null), spot, guestFood(foodInfoOf(world, withPonds(terrain, world.ponds), terrain)), world.achievements.includes('wood'));
    // A young beaver at the edge of its range hears its parents call it back.
    const home = world.lodge && !world.inLodge ? Math.hypot(world.beaver.x - world.lodge.x, world.beaver.z - world.lodge.z) : 0;
    const called = isCalledBack(home, STAGE_RULES[lifeAt(world.clock, world.bornAt).stage].range);
    if (called && !wasCalled) toast.show(t('toast.mamaCalls'));
    wasCalled = called;
    // Growing up from a teenager: Mama and Papa say it is time to start a family of one's own (Q8, Q50).
    const nowStage = lifeAt(world.clock, world.bornAt).stage;
    if (lastStage === 'teenager' && nowStage === 'adult') {
      // A lone beaver lives at a dam spot that can hold a lodge pond, so the player can lead it home and build there.
      world = withPartners(leaveHome(world));
      toast.show(t('toast.startFamily'));
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
    if (following && following !== lastFollower) toast.show(t('toast.partnerFollows'));
    lastFollower = following;
    // Nudges toward a partner: a tail slap in the distance, and a word at the start of winter that kits come in spring.
    for (const p of world.partners) {
      if (p.state === 'alone' && !heardBefore.has(p.id) && Math.hypot(p.x - world.beaver.x, p.z - world.beaver.z) <= HEARD_DISTANCE) {
        heardBefore.add(p.id);
        toast.show(t('toast.tailSlapFar'));
        wayPointer = startPointer(p.id, world.time);
      }
    }
    // Out of earshot, now and then a word on which way the nearest lone beaver is (#254).
    cueIn -= dt;
    if (cueIn <= 0 && world.partners.length > 0) {
      const lone = loneBeaverWay(world, facing());
      if (lone && lone.d > HEARD_DISTANCE) {
        cueIn = CUE_EVERY;
        toast.show(t('toast.loneWay', { words: lone.words }));
        wayPointer = startPointer(lone.partner.id, world.time);
      }
    }
    const season = dateAt(world.clock).season;
    if (season === 'winter' && lastSeason !== 'winter' && world.partners.length > 0 && !mateOf(world.partners)) toast.show(t('toast.kitsInSpring'));
    if (season !== lastSeason) saveNow();
    lastSeason = season;
    if (world.generation > lastGeneration) {
      toast.show(t('toast.kitBorn'));
      if (asksLook) void chooseNewLook().then(saveNow);
    }
    if (world.generation !== lastGeneration) saveNow();
    lastGeneration = world.generation;
    // A toast for each achievement won since the last frame.
    // A meal gives a lift for a while: a pad for swimming, a branch for felling. A loaded game gives no toast.
    if (world.padAt !== padSeen && padSeen !== undefined && world.padAt !== null) toast.show(t('toast.padEaten'));
    if (world.branchAt !== branchSeen && branchSeen !== undefined && world.branchAt !== null) toast.show(t('toast.branchEaten'));
    padSeen = world.padAt;
    branchSeen = world.branchAt;
    if (wonShown < 0) wonShown = world.achievements.length;
    for (const id of world.achievements.slice(wonShown)) toast.show(ACHIEVEMENT_TEXT[id]);
    wonShown = world.achievements.length;
    stashPanel.set(world.stashOpen, world.store, world.carry, storeCapacity(storeCondition(world.storeWear, world.clock)));
    const rest = canRest(world);
    const stage = lifeAt(world.clock, world.bornAt).stage;
    // Out in the open (#661) the panel offers the night only, and only to a beaver standing still, so it does not flicker while walking.
    const outside = !rest && !movingNow && canSleepOut(world, threatened(world, lastAmbient));
    sleepUp = canSleep(world) || rest || outside;
    sleepPrompt.set({ night: canSleep(world) || outside, rest, grow: !link && rest && stage !== 'adult' ? (stage === 'baby' ? 'teenager' : 'adult') : null, dream: !outside });
    const ponded = withPonds(terrain, world.ponds);
    if (now - animalsAt > 100) {
      animalsAt = now;
      animalField.trim(world.beaver.x, world.beaver.z);
    }
    if (now - familiesAt > 3000) {
      familiesAt = now;
      const grown = growNeighbours(world.neighbours, terrain, world.beaver, world.formerHomes.at(-1) ?? world.lodge ?? world.beaver, familiesTried);
      if (grown !== world.neighbours) world = { ...world, neighbours: [...grown] };
      // A welcomed visitor that has walked off founds a family on a pond nearby, once (note 35). With no pond, it just leaves.
      const leftBy = world.scents.filter((m) => world.welcomed.includes(m.id) && world.clock > departsAt(m) + WALK_IN && !settleTried.has(m.id));
      for (const m of leftBy) {
        settleTried.add(m.id);
        const family = settleFamily(m, terrain, world.lodge ?? world.beaver, world.neighbours);
        world = { ...world, neighbours: family && !world.neighbours.some((n) => n.id === settledId(m)) ? [...world.neighbours, family] : world.neighbours, scents: world.scents.filter((o) => o.id !== m.id) };
      }
    }
    world = trackPonds(world);
    const visited = visitPlaces(world.visited, world.beaver.x, world.beaver.z, anchors.filter((a) => a.kind === 'location'));
    if (visited !== world.visited) world = { ...world, visited };
    const homesIn = noteHomes(world.homesIn, world, anchors.filter((a) => a.kind === 'location'));
    if (homesIn !== world.homesIn) world = { ...world, homesIn };
    // The animals as they stand for their mood: deer bolt from a predator, wary ones keep away, curious ones come to look, a fox sniffs at the store at night (note 24, "Interaction with animals").
    const slappedNow = world.lastSlap !== null && world.lastSlap.time === world.time;
    const guests = pondGuests(world, world.beaver.x, world.beaver.z);
    const guestKinds = seeGuests(world.guestKinds, guests, world.beaver.x, world.beaver.z, world.journey.inherited);
    if (guestKinds !== world.guestKinds) world = { ...world, guestKinds };
    const around = [...animalField.near(ponded, world.beaver.x, world.beaver.z, world.clock, capFor(fps)), ...guests];
    // The families: shy, calm or curious by trust, thanking a gift, hurt by a slap, and greeting the beaver once each (#342).
    const stuckList = stuckNow(world, ponded);
    const away = new Set([...stuckList.map((st) => st.member), ...(world.escort ? [world.escort.id] : [])]);
    const familyBeavers = reactFamilies(neighboursAt(world.neighbours, world.clock, ponded, new Set(room ? room.played() : lastSnap?.played)), world, ponded).filter((n) => !away.has(n.id));
    if (slappedNow) {
      const before = world;
      world = startleFamilies(world, familyBeavers);
      for (const n of world.neighbours) if (familyTrust(world, n.id) < familyTrust(before, n.id)) slapped.add(n.id);
    }
    const gifts = giftFamilies(world, familyBeavers);
    world = gifts.world;
    // Food handed over by a press of Do when it reads Give (#663): thanked and passed on like a gift put down.
    if (doPressed === 'give') {
      const given = giveFamily(world, familyBeavers);
      if (given) {
        world = given.world;
        gifts.gifts.push({ family: given.family, kind: given.kind });
      } else if (room && world.carry) {
        // No family beaver close: a friend with an empty mouth takes it (#663).
        const friend = room.guestTaker(world.beaver, world.inLodge);
        if (friend) world = room.hand(world, friend);
      }
    }
    // Partners between players (#666): a press of Do asks the friend close by, or says yes; each tablet hears of it once.
    if (room || link?.id) {
      const me = room ? 'host' : link!.id!;
      if (room && (doPressed === 'partner' || doPressed === 'part')) {
        const to = room.partnerNear('host', world.beaver, world.beaver, lifeAt(world.clock, world.bornAt).stage === 'adult', world.inLodge, world.inLodge);
        if (to) room.ask('host', to, now / 1000);
      }
      const snap = room ? room.snapshot(world, undefined, now / 1000) : lastSnap;
      const pairing = pairingOf(snap, me);
      // The question of a friend's bed (#661), and a guest's own bed waiting for the host to settle it.
      const asked = askedOf(snap, me);
      sleepAsk.set(asked);
      if (link?.id) {
        const settled = guestLying.settle(snap, me, now / 1000);
        if (settled) sleepPrompt.release(settled.slept);
      }
      const nameOf = (id: string | null) => snap?.beavers.find((b) => b.id === id)?.look.name || t('together.friend');
      // A say or a reply heard for the first time plays a babble and shows a picture over the speaker's head for a few seconds (#802).
      const real = now / 1000;
      for (const h of heardSays.hear(snap ? snap.says ?? [] : undefined, real)) {
        if (!silent) sound.cue([babbleCue('partner', h.who, t(h.kind === 'q' ? `friend.q.${h.id}` as const : `friend.a.${h.id}` as const))], real);
      }
      speeches = heardSays.visible(real, (who) => (who === me ? { x: world.beaver.x, y: world.beaver.y, z: world.beaver.z, inside: world.inLodge } : snap?.beavers.find((v) => v.id === who)));
      const born = room ? world.bornAt : snap?.beavers.find((v) => v.id === me)?.bornAt ?? null;
      const news = partnerNews(pairing, partnerSeen, born);
      if (news) {
        toast.show(t(news.key, { name: news.about ? nameOf(news.about) : partnerSeen.name }), news.urgent);
        // A guest reborn as a kit picks its look too; the host keeps the choice and sends it back with the snapshot. The pick is sent as
        // it was made: every snapshot sets the guest's coat back to the host's until the host has heard this.
        if (link && asksLook && news.kits) void chooseNewLook().then((picked) => link?.send({ t: 'look', coat: picked.coat, look: picked.look }));
      }
      // A question for this player opens a card with the answers; an answer to its own question is a toast (#667).
      const says = saysOf(snap, me);
      const question = says.asked.at(-1);
      if (question && question.n !== sayShown && !talkBubble.talking()) {
        sayShown = question.n;
        talkingTo = null;
        talkBubble.say(nameOf(question.from), t(`friend.q.${question.q}`), SAY_TIME * 0.8, repliesFor(question.q).map((a) => ({ id: a, label: t(`friend.a.${a}`) })), (pick) => {
          talkBubble.hush();
          const a = pick as ReplyId;
          if (room) room.answer('host', a, performance.now() / 1000);
          else link?.send({ t: 'say', a });
        }, nameOf(question.from) === t('together.friend') ? undefined : t('friend.role'));
      }
      for (const a of says.answers) {
        if (a.n <= answerShown) continue;
        answerShown = a.n;
        toast.show(t('toast.friendReply', { name: nameOf(a.to), text: t(`friend.a.${a.a!}`) }));
        // A Yes to "Want to play?" starts a game of hide and seek for the two (#664): the asker chooses.
        if (a.q === 'play' && agrees(a.a)) talkBubble.say(nameOf(a.to), t('hide.pick'), LINE_SECONDS * 3, hideRoles(), (pick) => {
          talkBubble.hush();
          sendHide(pick as Role, a.to);
        }, undefined);
      }
      // Hide and seek (#664): an invitation opens a card, and each change of the game is a toast.
      const game = hideOf(snap, me);
      const sendHide = (r: Role, to?: string) => {
        if (room) room.startHide('host', r, now / 1000, world.beaver, to);
        else link?.send({ t: 'hide', r, ...(to ? { to } : {}) });
      };
      if (game?.invitedMe && game.key !== hideInviteShown && !talkBubble.talking()) {
        hideInviteShown = game.key;
        const asker = nameOf(game.asker);
        const askerRole = snap?.hide?.role;
        talkBubble.say(asker, t(askerRole === 'hide' ? 'hide.askHide' : 'hide.askSeek', { name: asker }), SAY_TIME * 0.8, ANSWERS.map((a) => ({ id: a, label: t(`friend.a.${a}`) })), (pick) => {
          talkBubble.hush();
          const a = pick as AnswerId;
          if (room) room.answerHide('host', a);
          else link?.send({ t: 'hide', a });
        }, asker === t('together.friend') ? undefined : t('friend.role'));
      }
      if (game && game.key !== hideSeen?.key && game.phase === 'invite' && game.asker === me) toast.show(t('toast.hideNote'));
      if (game?.role && (game.key !== hideSeen?.key || game.phase !== hideSeen.phase)) {
        if (game.phase === 'count') toast.show(t(game.role === 'hide' ? 'toast.hideHide' : 'toast.hideSeek'));
        else if (game.phase === 'seek' && game.role === 'seek') toast.show(t('toast.hideGo'));
        else if (game.phase === 'cheer') {
          toast.show(t('toast.hideEnd'));
          if (!silent) sound.cue([{ effect: 'cheer', gain: 0.8 }], performance.now() / 1000);
          hideCount.heart();
        }
      }
      if (game?.role && hideSeen?.key === game.key && game.found.length > hideSeen.found) {
        if (!silent) sound.cue([{ effect: 'chimeStar', gain: 0.8 }], performance.now() / 1000);
        hideCount.heart();
        for (const id of game.found.slice(hideSeen.found)) toast.show(id === me ? t('toast.hideFoundYou') : t('toast.hideFound', { name: nameOf(id) }));
      }
      hideCount.set(hideLine(game));
      hideSeen = game ? { key: game.key, phase: game.phase, found: game.found.length } : null;
      partnerSeen = seenNow(pairing, partnerSeen, pairing.partner ? nameOf(pairing.partner) : null, born);
    }
    // Each gift is thanked for what it is, and word of it gets around (chatter.ts, familyMoods.ts).
    for (const g of gifts.gifts) {
      gave.add(g.family);
      toast.show(giftThanks(g.kind, familyBeavers.filter((n) => n.family === g.family), dateAt(world.clock).day + gave.size));
      spread(g.family);
    }
    const visit = { gifts: gave, slaps: slapped, greeted };
    const hello = greetedBy(familyBeavers, world);
    const mineView = link?.id ? lastSnap?.beavers.find((b) => b.id === link.id) : undefined;
    ownHome = homeLearned(ownHome, mineView);
    if (hello && !greeted.has(hello)) {
      const fam = world.neighbours.find((f) => f.id === hello);
      // A guest's own family is no new family to meet, so it gets no hint to put a branch down.
      if (isOwnFamily(fam, ownHome)) greeted.add(hello);
      else {
        const pond = fam ? pondName(fam.lodge, world.formerHomes.at(-1) ?? world.lodge ?? world.beaver) : 'pond';
        // The deeds are read before the family counts as greeted, so a first meeting is a first meeting.
        toast.show(greetingFor(deedsFor(world, hello, visit), familyBeavers.filter((n) => n.family === hello), pond, dateAt(world.clock).day));
        greeted.add(hello);
      }
    }
    if (slappedNow) world = startle(world, around);
    // Talking: a press of Do when it reads Talk starts a talk with the nearest beaver in reach (#344, buttons.ts says when).
    const parents = [...parentsAt(world.lodge, world.bornAt, world.clock, world.inLodge, ponded, world.parentCoats, homeDam(world.lodge, world.spots, world.dams)), ...formerParentsAt(world.formerHomes, world.clock, ponded)];
    // A baby cannot work, but it talks to its own people from day 1 (Mama and Papa; siblings are not in the game yet).
    const grown = STAGE_RULES[lifeAt(world.clock, world.bornAt).stage].works;
    const visitors = visitorsAt(world.scents, world.welcomed, world.clock, ponded);
    const near = !world.stashOpen ? nearestSpeaker(speakersOf(grown ? [...familyBeavers, ...visitors] : [], parents, grown ? world.partners : [], nameOf, placeOf), world.beaver) : null;
    if (talkingTo && Math.hypot(talkingTo.x - world.beaver.x, talkingTo.z - world.beaver.z) > TALK_END) {
      talkBubble.hush();
      talkingTo = null;
    }
    // A press while already talking to this beaver does not start over. The greeting reads what the beaver remembers before this talk.
    // By a friend who is a player Do opens a card with questions, and partners when both can (#667).
    const friendTalk = nearby.mate === true && doPressed === 'talk' && (room || link?.id);
    if (friendTalk) {
      const me = room ? 'host' : link!.id!;
      const snap = room ? room.snapshot(world, undefined, now / 1000) : lastSnap;
      const id = room ? room.friendNear('host', world.beaver, world.beaver, world.inLodge, world.inLodge) : friendNearby(snap, me, world.beaver)?.id ?? null;
      if (id) {
        const name = snap?.beavers.find((b) => b.id === id)?.look.name || t('together.friend');
        talkingTo = null;
        talkBubble.say(name, t('friend.hello'), LINE_SECONDS * 2, friendChoices(id, pairingOf(snap, me), nearby.friend === true, pickPhrases(Math.random)), (pick) => {
          talkBubble.hush();
          if (pick === 'partner') {
            if (room) {
              const to = room.partnerNear('host', world.beaver, world.beaver, lifeAt(world.clock, world.bornAt).stage === 'adult', world.inLodge, world.inLodge);
              if (to) room.ask('host', to, performance.now() / 1000);
            } else guestIntent.partner();
          } else if (pick === 'hide') {
            // The note goes to every friend close by, not only the one in front (#664).
            talkBubble.say(name, t('hide.pick'), LINE_SECONDS * 3, hideRoles(), (r) => {
              talkBubble.hush();
              if (room) room.startHide('host', r as Role, performance.now() / 1000, world.beaver);
              else link?.send({ t: 'hide', r: r as Role });
            }, undefined);
          } else if (isSay(pick)) {
            if (room) room.say('host', id, pick, performance.now() / 1000);
            else link?.send({ t: 'say', q: pick });
            toast.show(t(isQuestion(pick) ? 'toast.friendAsk' : 'toast.friendSay', { name, text: t(`friend.q.${pick}`) }));
          }
        }, name === t('together.friend') ? undefined : t('friend.role'));
      }
    }
    if (near && !friendTalk && doPressed === 'talk' && !(talkBubble.talking() && talkingTo?.id === near.id)) {
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
        toast.show(t('toast.said', { who: said.call.who, text: said.call.text }));
        toast.show(t('toast.said', { who: said.reply.who, text: said.reply.text }));
      } else if (!talkBubble.talking()) {
        const remark = partnerRemark(world, surroundings().pad, facing());
        if (remark) toast.show(t('toast.said', { who: remark.who, text: remark.text }));
      }
    }
    // The sleep buttons take the bottom of the screen, so the talk prompt waits (the newborn kit of a pair sees both).
    const mateName = nearby.mate === true && doShown === 'talk' && !near ? (room ? ((id) => room.guests().find((g) => g.id === id)?.look.name)(room.friendNear('host', world.beaver, world.beaver, world.inLodge, world.inLodge)) : link?.id ? friendNearby(lastSnap, link.id, world.beaver)?.look.name : undefined) || t('together.friend') : null;
    talkBubble.prompt(near && doShown === 'talk' && !sleepUp ? near.name : sleepUp ? null : mateName, touchOn ? DO_LABEL.talk : 'E');
    talkBubble.tick(dt);
    // Winter: a beaver stuck in a drift calls for help, the player digs it out by gnawing beside it, and it becomes a guide (#346).
    const homeAt = world.formerHomes.at(-1) ?? world.lodge ?? world.beaver;
    for (const st of stuckList) {
      if (heardStuck.has(st.id) || Math.hypot(st.x - world.beaver.x, st.z - world.beaver.z) > HEAR_RANGE) continue;
      heardStuck.add(st.id);
      const fam = world.neighbours.find((f) => f.id === st.family);
      toast.show(fam ? t('toast.helpInSnowAt', { pond: pondName(fam.lodge, homeAt) }) : t('toast.helpInSnow'));
    }
    const drift = nearestStuck(stuckList, world.beaver, DIG_REACH);
    dug = STAGE_RULES[lifeAt(world.clock, world.bornAt).stage].works ? digging(dug, drift, world.beaver, doPressed === 'dig', movingNow, dt) : 0;
    nearby = { mate: room ? room.friendNear('host', world.beaver, world.beaver, world.inLodge, world.inLodge) !== null : link?.id ? friendNearby(lastSnap, link.id, world.beaver) !== null : false, taker: takerNear(familyBeavers, world.beaver) !== null || (room ? room.guestTaker(world.beaver, world.inLodge) !== null : link?.id ? friendTaker(lastSnap, link.id, world.beaver) !== null : false), friend: (room ? room.partnerNear('host', world.beaver, world.beaver, lifeAt(world.clock, world.bornAt).stage === 'adult', world.inLodge, world.inLodge) !== null : link?.id ? partnerCandidate(lastSnap, link.id, world.beaver) !== null : false), parting: room ? room.partner('host') !== null : link?.id ? pairingOf(lastSnap, link.id).partner !== null : false, speaker: near !== null, following: near?.kind === 'partner' && near.id === follower(world.partners)?.id, drift: drift !== null };
    doPressed = null;
    if (drift && dug >= DIG_TIME) {
      world = rescue(world, drift);
      dug = 0;
      toast.show(t('toast.dugOut', { name: drift.name }));
      spread(drift.family);
    } else if (drift && dug > 0) talkBubble.note(t('talk.digging', { percent: Math.min(99, Math.floor((dug / DIG_TIME) * 100)) }));
    if (world.escort) {
      const led = stepEscort(world, dt);
      world = led.world;
      for (const e of led.events) toast.show(e.what === 'arrived' ? t('toast.escortArrived', { name: e.name }) : t('toast.escortLost', { name: e.name }));
    }
    const ambient = foxesAtStore(react(around, world, ponded), world, ponded);
    lastAmbient = ambient;
    const led = lead(world, ambient, dt, ponded);
    world = led.world;
    for (const e of led.events) toast.show(text(`guide.${e.what}.${e.kind}`));
    const fed = feedAnimals(world, ambient);
    world = fed.world;
    const fedKinds = noteFed(world.fedKinds, fed.fed.map((a) => a.kind));
    if (fedKinds !== world.fedKinds) world = { ...world, fedKinds };
    for (const a of fed.fed) toast.show(a.kind === 'duck' ? t('toast.duckFed') : t('toast.deerFed'));
    if (!readBolt && boltingDeer(ambient, world)) {
      readBolt = true;
      toast.show(t('toast.deerBolt'));
    }
    for (const a of ambient) {
      if (a.kind === 'fox' && !sniffed.has(a.id) && atStore(world, a) && Math.hypot(a.x - world.beaver.x, a.z - world.beaver.z) < 50) {
        sniffed.add(a.id);
        toast.show(t('toast.foxAtStore'));
      }
    }
    // A fox or owl that notices the beaver on land becomes a predator and is drawn from its own state (note 24, slice 3).
    const atTheStore = new Set(world.predators.filter((p) => p.kind === 'fox' && atStore(world, p)).map((p) => p.id));
    const met = meetPredators(world, ambient, slappedNow, dt, ponded);
    world = met.world;
    for (const e of met.events) {
      toast.show(e.what === 'scared' && e.kind === 'fox' && atTheStore.has(e.id) ? t('toast.foxChased') : predatorText(e));
      if (e.what === 'scared' && e.kind === 'fox' && atTheStore.has(e.id)) world = banishFox(world, e.id);
    }
    const engaged = new Set(world.predators.map((p) => p.id));
    if (world.leader) engaged.add(world.leader.id);
    const animals = [...ambient.filter((a) => !engaged.has(a.id)), ...predatorAnimals(world.predators, ponded), ...(world.leader ? [leaderAnimal(world.leader, ponded, world)] : [])];
    const drawnFamily = [...familyBeavers, ...stuckList.flatMap((st) => stuckBeaver(world, st, ponded) ?? []), ...(world.escort ? [escortBeaver(world, world.escort, ponded) ?? []].flat() : []), ...visitors, ...(room ? ((hidden) => room.guests().filter((g) => !hidden.includes(g.id)))(room.hiddenFromHost()).map((g) => friendBeaver(viewOfGuest(g))) : guestSnap)];
    // The sparkles toward a lone beaver, until time is up or the player is close.
    const wayTo = pointerTarget(wayPointer, world);
    if (!wayTo) wayPointer = null;
    renderer.setWayDots(wayTo && !world.inLodge ? pointerDots(world.beaver, wayTo, ponded) : [], world.time);
    renderer.setSpeech(room || link ? speeches : []);
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
  // ?dream=1 opens a dream at once, to look at it on a tablet and for the browser test; ?seed=N picks the night, ?kind=veggie the garden.
  if (query.get('dream') === '1') {
    const seed = Number(query.get('seed'));
    startDream(query.has('seed') && Number.isFinite(seed) ? Math.floor(seed) : undefined, query.get('kind') === 'veggie' ? 'veggie' : 'candy');
  }
  // Read only view for tests and the coming test menu. Not in the release build.
  if (__DEV_TOOLS__) (window as unknown as { __game: unknown }).__game = {
    world: () => world,
    // Jump to a dam spot by id, as the test menu's "To nearest spot" does for the nearest (a playtest wants the nearest spot that
    // holds a level 2 dam, which may be far off).
    goToSpot: (id: string) => {
      const spot = world.spots.find((s) => s.id === id);
      if (!spot || !streamer) return false;
      jump = { x: spot.bed.x, z: spot.bed.z, deadline: performance.now() + 8000, spawn: null };
      return true;
    },
    view: () => rig.view,
    stats: () => renderer.terrain?.stats() ?? null,
    // GPU object counts and the bytes of ground held, for the soak measurement (docs/design/38_memory.md).
    // Moves the clock on by this many game years (age stays as it is), for the memory soak: a kit's id carries the year.
    skipYears: (years: number) => {
      moveClock(world.clock + years * DAYS_PER_YEAR * DAY_SECONDS);
    },
    memory: () => ({ ...renderer.memory(), tileBytes: store?.bytesByLevel() ?? [] }),
    // Per part tile build times since the last call, for the tablet bench.
    buildTimes: drainBuildTimes,
    // Where a playtest can find things to work on: the nearest standing tree, and the nearest spot a lodge could start.
    // With `dry`, the nearest whose foot is not under water (the lake or a pond), so the beaver can gnaw it from the land; `skip`
    // leaves out trees a playtest gave up on.
    nearestTree: (x: number, z: number, reach: number, dry = false, skipIds: readonly string[] = []) => {
      const skip = new Set([...world.felled, ...skipIds]);
      const water = withPonds(terrain, world.ponds);
      for (let i = 0; i < 64; i++) {
        const tree = trees.nearest(x, z, reach, skip);
        if (!tree || !dry || water.waterDepth(tree.x, tree.z) <= 0) return tree;
        skip.add(tree.id);
      }
      return null;
    },
    lilyPadsNear: (radius: number) => lilyPadsNear(terrain, world.beaver.x, world.beaver.z, radius, world.clock, world.picked),
    // The rocks still lying within `radius` metres of the beaver, and the bare ground height at a point (to see a log climbed).
    rocksNear: (radius: number) => rocksNear(withPonds(terrain, world.ponds), world.beaver.x, world.beaver.z, radius, world.rocksTaken),
    groundAt: (x: number, z: number) => terrain.heightAt(x, z),
    // Mama and Papa as drawn now: of the player's lodge while young, and of every lodge the family has left.
    parents: () => [...parentsAt(world.lodge, world.bornAt, world.clock, world.inLodge, withPonds(terrain, world.ponds), world.parentCoats, homeDam(world.lodge, world.spots, world.dams)), ...formerParentsAt(world.formerHomes, world.clock, withPonds(terrain, world.ponds))],
    formerParents: () => formerParentsAt(world.formerHomes, world.clock, withPonds(terrain, world.ponds)),
    // The beavers of the other families as drawn now, without the baby kit a guest plays.
    neighbours: () => neighboursAt(world.neighbours, world.clock, withPonds(terrain, world.ponds), new Set(room ? room.played() : lastSnap?.played)),
    // The ambient animals around the beaver now.
    animals: () => animalField.near(withPonds(terrain, world.ponds), world.beaver.x, world.beaver.z, world.clock, capFor(fps)),
    // The predators in their meeting with the beaver, and when it was hurt.
    predators: () => world.predators,
    hurtAt: () => world.hurtAt,
    lodgeSite: (radius: number) => findSite(lodgeGround(terrain, world.ponds), world.beaver.x, world.beaver.z, radius),
    // Why a lodge cannot start at exactly (x, z), or null when it can; and the same for the spot ahead of the beaver, as the carry line shows it.
    siteProblem: (x: number, z: number) => checkSpot(lodgeGround(terrain, world.ponds), x, z).problem,
    siteAhead: () => checkSite(lodgeGround(terrain, world.ponds), world.beaver.x, world.beaver.z, world.beaver.heading),
    // The dream's state while one is open, else null.
    dream: () => dreamScreen.state(),
  };
}

function predatorText(e: PredatorEvent): string {
  if (e.what === 'caught') return text(`predator.caught.${e.kind}`);
  if (e.what === 'scared') return text(`predator.scared.${e.kind}`);
  return text(`predator.noticed.${e.kind}`);
}

void start();
