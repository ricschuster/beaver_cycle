// The host's side of a shared valley, without the socket (ADR 0014, #678): who is in, what each guest wants, and the state to send.
// The plugin or a test feeds it messages and gives it a way to send text; it never touches the network itself.
import type { Intent } from '../sim/buttons';
import { guestStage, housed, newGuest, roomOf, outside, reborn, stepGuest, type Guest } from '../sim/guests';
import type { Dam } from '../sim/dam';
import type { Dropped } from '../sim/haul';
import type { Picked } from '../sim/lily';
import type { Log } from '../sim/logs';
import { GIVE_REACH } from '../sim/familyMoods';
import { withPonds } from '../sim/pond';
import type { Terrain } from '../sim/terrain';
import type { TreeSource } from '../sim/trees';
import type { WorldState } from '../sim/state';
import { asked, askersOf, dropAsks, expire, noPairing, partnerOf, press, restore, unpair, type Pairing } from './pairs';
import { stageAt } from '../sim/life';
import { atStore, storeCapacity, storeCondition, tapped } from '../sim/food';
import { leaveHome, pairBirth, skipTo } from '../sim/state';
import { INTERIOR_RADIUS, atNest, lodgeComplete, lodgeSolid, type Lodge } from '../sim/lodge';
import { DAY_SECONDS, isNight, nextSpringStart } from '../sim/clock';
import { pairLodgeOf, type PairLodge } from '../sim/pairLodge';
import type { Coat } from '../sim/family';
import { answer, ask as askSay, drop as dropSays, expire as expireSays, noSays, type AnswerId, type QuestionId, type Says } from './says';
import { accept, decline, drop as dropHide, frozen, hiddenFrom, invite, noteTo, step as stepHide, timeLeft, type Blocker, type HideGame, type Role, type Spot } from './hideGame';
import { answer as answerSleep, ASK_TIME, isAsleep, leave as leaveSleep, lie, noSleep, tick as tickSleep, wake as wakeSleep, waitingFor, type Goal, type SleepCheck, type Step } from './sleepCheck';
import { mergeInput, wireOf } from './dreamWire';
import { handOver, joinDream, leaveDream, newDream, stepDream, type DreamEvent, type DreamInput, type DreamLook, type DreamState, type DreamTheme } from '../sim/dream';
import { intentOf, readToHost, viewOfGuest, type BeaverView, type Snapshot, type ToGuest } from './protocol';

/** The most friends in one valley besides the host (note 42: up to four players at once). */
export const MAX_GUESTS = 3;

/** A starting family's lodge a guest may take as its home: where it is, whose it is, and the coats of Mama and Papa. */
export interface HomeSite {
  x: number;
  z: number;
  id?: string;
  lodge?: Lodge;
  parents?: [Coat, Coat];
}

/** Where a new guest stands, in metres from the host beaver, until the five lodges give each a home of its own. */
const SPAWN_OFFSET = 4;
/** A guest whose last message is older than this many seconds stops its beaver. */
const SILENT_AFTER = 3;
/** A connection that has not said hello within this many seconds is forgotten (a hello is sent the moment a link opens). */
export const HELLO_WITHIN = 30;
/** At most this many connections wait for a hello; a newer one pushes out the oldest. */
export const MAX_STRANGERS = 8;
/** How far from the middle of a free lodge a guest appears, outside its walls. */
const HOME_OFFSET = 6;

interface Seat {
  guest: Guest;
  intent: Intent;
  heard: number;
  /** The index in `homes` of the free lodge this guest took, or null when it stands by the host. */
  home: number | null;
  /** The family of that lodge, whose baby this guest plays. */
  family: string | null;
  /** A question this guest wants to put to the friend close by, until the next step finds who that is (#667). */
  say?: QuestionId;
  /** A wish to lie down that the next step checks against where this guest stands (#661). */
  lie?: { g: Goal; dream: boolean; theme?: DreamTheme };
}

const STILL: DreamInput = { move: { x: 0, z: 0 }, hop: false, slap: false, play: false };

type Solid = { x: number; z: number; radius: number };

/** The solids with a guest's own family lodge solid only as far as its dome, so the guest reaches the door and goes back in (as for a pair lodge). */
function withDome(solids: readonly Solid[], home: Lodge | null): readonly Solid[] {
  return home ? solids.map((k) => (k.x === home.x && k.z === home.z ? lodgeSolid(home) : k)) : solids;
}

/** What a sleeper is told once its sleep is settled: the clock moved, or its skip was refused and it wakes. */
export type SleepNews = 'go' | 'stop';

export class Room {
  private seats = new Map<string, Seat>();
  /** Connections that have not yet said hello, with the real second each opened. */
  private strangers = new Map<string, number>();
  /** Who asked whom to be partners, and who said yes (#666). */
  private pairing: Pairing = noPairing();
  /** The questions put to friends and their answers (#667). */
  private says: Says = noSays();
  /** The game of hide and seek that runs, if any (#664). */
  private hide: HideGame | null = null;
  /** Who sleeps or dreams and the skip that waits for the friends' yes (#661, #665). */
  private sleep: SleepCheck = noSleep();
  /** Where the clock goes once the step runs, when a skip was agreed. */
  private skip: Goal | null = null;
  /** The dream the host runs for the guests who dream (#665): whose it is, and what each dreamer wants this frame. */
  private dream: { state: DreamState; owner: string; theme: DreamTheme; seed: number } | null = null;
  private dreamIn = new Map<string, DreamInput>();
  /** What the sleepers who have not opened a dream yet chose: the theme and the seed (the first sleeper's choice is the night's). */
  private dreamWish = new Map<string, { theme: DreamTheme; seed?: number }>();
  /** What happened in the last step of the dream, until a screen takes it (sparkles, sounds, lines). */
  private dreamEvents: DreamEvent[] = [];
  /** What happened in the dream since the last snapshot each guest who dreams was sent. */
  private dreamNews = new Map<string, DreamEvent[]>();
  /** What each sleeper is told, until it takes it (`sleepNews`). */
  private news = new Map<string, SleepNews>();
  constructor(private readonly send: (to: string, text: string) => void) {}

  /** A connection opened at real second `now`: it waits for its hello, but not forever and not in any number. */
  open(id: string, now = 0): void {
    this.forget(now);
    this.strangers.set(id, now);
    for (const old of this.strangers.keys()) {
      if (this.strangers.size <= MAX_STRANGERS) break;
      this.strangers.delete(old);
    }
  }

  /** Forgets the connections that waited longer than `HELLO_WITHIN` for a hello. A late hello is then ignored. */
  private forget(now: number): void {
    for (const [id, at] of this.strangers) if (now - at > HELLO_WITHIN) this.strangers.delete(id);
  }

  leave(id: string): void {
    this.strangers.delete(id);
    const seat = this.seats.get(id);
    this.seats.delete(id);
    if (seat) {
      this.settle(leaveSleep(this.sleep, seat.guest.id, this.players(), 0));
      this.pairing = dropAsks(this.pairing, seat.guest.id);
      this.says = dropSays(this.says, seat.guest.id);
      if (this.hide) this.hide = dropHide(this.hide, seat.guest.id);
    }
  }

  /** Everyone in the room: the host and each guest. */
  private players(): string[] {
    return ['host', ...this.guests().map((g) => g.id)];
  }

  /** Takes a step of the sleep check: the new state, and the news a verdict sends to the sleepers. */
  private settle(r: Step): void {
    this.sleep = r.check;
    const v = r.verdict;
    if (v?.t === 'go') {
      this.skip = v.goal;
      for (const id of v.woke) this.news.set(id, 'go');
    } else if (v?.t === 'stop') this.news.set(v.from, 'stop');
  }

  /**
   * A player lies down to sleep or dream until `goal` (#661, #665). The others are told in the next snapshot, and asked when the
   * skip is not only theirs. The host calls this for itself; a guest asks with a message and the next step checks its bed.
   */
  lie(id: string, goal: Goal, dream: boolean, now: number, wish?: { theme: DreamTheme; seed?: number }): void {
    this.news.delete(id);
    if (dream && wish) this.dreamWish.set(id, wish);
    else this.dreamWish.delete(id);
    this.settle(lie(this.sleep, id, goal, dream, this.players(), now));
  }

  /** One step of the dream the host runs: it opens with the first player to dream, takes later ones as friends, and ends with the last. */
  private stepDream(world: WorldState, dt: number): void {
    const dreamers = this.dreamers();
    for (const id of this.dreamIn.keys()) if (!dreamers.includes(id)) this.dreamIn.delete(id);
    for (const id of this.dreamWish.keys()) if (!this.sleep.asleep.some((s) => s.id === id)) this.dreamWish.delete(id);
    if (!dreamers.length) {
      this.dream = null;
      return;
    }
    const first = dreamers[0]!;
    const wish = this.dreamWish.get(first);
    const seed = this.dream?.seed ?? wish?.seed ?? Math.floor(world.clock / DAY_SECONDS) * 7919 + world.generation;
    const theme = this.dream?.theme ?? wish?.theme ?? 'candy';
    let state = this.dream?.state ?? { ...newDream(seed, world.dreamKept, theme), look: this.lookOf(first, world) };
    let owner = this.dream?.owner ?? first;
    // The one whose dream it was woke: a friend takes it over.
    if (!dreamers.includes(owner)) {
      owner = first;
      state = handOver(state, owner);
    }
    for (const id of state.friends?.map((f) => f.id) ?? []) if (!dreamers.includes(id)) state = leaveDream(state, id);
    for (const id of dreamers) if (id !== owner) state = joinDream(state, id, this.lookOf(id, world));
    const mine = this.dreamIn.get(owner) ?? STILL;
    const friends: Record<string, DreamInput> = {};
    for (const id of dreamers) if (id !== owner && this.dreamIn.has(id)) friends[id] = this.dreamIn.get(id)!;
    const stepped = stepDream(state, mine, dt, friends);
    // Only the host's screen reads them (a guest gets none on the wire yet).
    if (dreamers.includes('host')) this.dreamEvents.push(...stepped.events);
    else this.dreamEvents = [];
    for (const id of dreamers) {
      if (id === 'host') continue;
      const news = [...(this.dreamNews.get(id) ?? []), ...stepped.events];
      this.dreamNews.set(id, news.length > 100 ? news.slice(news.length - 100) : news);
    }
    for (const id of this.dreamNews.keys()) if (!dreamers.includes(id)) this.dreamNews.delete(id);
    if (this.dreamEvents.length > 200) this.dreamEvents.splice(0, this.dreamEvents.length - 200);
    // Presses are used up; the stick stays as the player last sent it.
    for (const [id, i] of this.dreamIn) this.dreamIn.set(id, { move: i.move, hop: false, slap: false, play: false });
    this.dream = { state: stepped.state, owner, theme, seed };
  }

  /** The hat and scarf a player takes into the dream. */
  private lookOf(id: string, world: WorldState): DreamLook | undefined {
    const look = id === 'host' ? world.look : this.guests().find((g) => g.id === id)?.look;
    return look ? { hat: look.hat, scarf: look.scarf } : undefined;
  }

  /** What a player wants in the dream: a press is kept until a step has used it. The host calls this for itself. */
  steer(id: string, input: DreamInput): void {
    if (this.sleep.asleep.some((s) => s.id === id && s.dreaming)) this.dreamIn.set(id, mergeInput(this.dreamIn.get(id) ?? null, input));
  }

  /** The dream as it stands, for a test or a screen (null when nobody dreams). */
  dreamState(): DreamState | null {
    return this.dream?.state ?? null;
  }

  /** Whose dream it is, and the seed and theme of its land, so a screen that joins builds the same one. */
  dreamInfo(): { owner: string; seed: number; theme: DreamTheme } | null {
    return this.dream ? { owner: this.dream.owner, seed: this.dream.seed, theme: this.dream.theme } : null;
  }

  /** What happened in the dream since the last call, once. */
  takeDreamEvents(): DreamEvent[] {
    const e = this.dreamEvents;
    this.dreamEvents = [];
    return e;
  }

  /** A player wakes by itself: a dream ends for it alone, and the skip it asked for ends with it. */
  wake(id: string, now: number): void {
    this.settle(wakeSleep(this.sleep, id, this.players(), now));
  }

  /** A friend says yes or no to the skip that waits for them. */
  answerSkip(id: string, yes: boolean, now: number): void {
    this.settle(answerSleep(this.sleep, id, yes, this.players(), now));
  }

  /** The verdict for a sleeper, once, or null while it is still waiting. */
  sleepNews(id: string): SleepNews | null {
    const n = this.news.get(id) ?? null;
    this.news.delete(id);
    return n;
  }

  /** True while the player sleeps or dreams. */
  asleep(id: string): boolean {
    return isAsleep(this.sleep, id);
  }

  /** The players who dream now. */
  private dreamers(): string[] {
    return this.sleep.asleep.filter((s) => s.dreaming).map((s) => s.id);
  }

  /** A host that starts again takes its pairs from the lodges already built (#666). */
  restorePairs(lodges: readonly PairLodge[]): void {
    this.pairing = restore(lodges);
  }

  /** The clock jumped by `delta` seconds (a test tool): the guests who were born as kits keep their age, as the host's beaver does (`setClock`). */
  shiftAges(delta: number): void {
    for (const seat of this.seats.values()) if (seat.guest.bornAt !== null) seat.guest = { ...seat.guest, bornAt: seat.guest.bornAt + delta };
  }

  /** The families whose baby a guest plays. */
  played(): string[] {
    return [...this.seats.values()].flatMap((s) => (s.family ? [s.family] : []));
  }

  guests(): Guest[] {
    return [...this.seats.values()].map((s) => s.guest);
  }

  /** A text message from a connection. `now` is real seconds, `host` is where the host beaver stands. */
  receive(id: string, text: string, now: number, host: { x: number; z: number }, terrain: Terrain, homes: readonly HomeSite[] = [], hostBornAt: number | null = null): void {
    const m = readToHost(text);
    if (!m) return;
    if (m.t === 'ping') return this.reply(id, { t: 'pong', ts: m.ts });
    if (m.t === 'hello') {
      if (this.seats.has(id) || !this.strangers.has(id)) return;
      if (this.seats.size >= MAX_GUESTS) return;
      this.strangers.delete(id);
      // The first free lodge of the five is the guest's home (note 42); with none left it stands by the host.
      const taken = new Set([...this.seats.values()].map((s) => s.home));
      const idx = homes.findIndex((_, i) => !taken.has(i));
      const home = idx >= 0 ? idx : null;
      const n = this.seats.size + 1;
      // A guest with a key of its own is the same player after a break (a pair and its lodge wait for it); else the connection is its id.
      const pid = m.key && ![...this.seats.values()].some((s) => s.guest.id === `g-${m.key}`) ? `g-${m.key}` : id;
      const at = home !== null ? { x: homes[home]!.x + HOME_OFFSET, z: homes[home]!.z } : { x: host.x + SPAWN_OFFSET * n, z: host.z + SPAWN_OFFSET };
      // In its family's lodge, on its nest and as old as the host (note 42); with no lodge left it stands by the host as a grown beaver.
      const guest = newGuest(pid, at, terrain, m.coat, m.look);
      const site = home !== null ? homes[home]! : null;
      this.seats.set(id, { guest: site?.lodge ? housed(guest, site.lodge, hostBornAt, site.parents ?? null) : guest, intent: { move: { x: 0, z: 0 } }, heard: now, home, family: home !== null ? homes[home]!.id ?? null : null });
      return this.reply(id, { t: 'welcome', id: pid });
    }
    const seat = this.seats.get(id);
    // A guest's look card, after it is reborn as a kit (#666): the new coat and look.
    if (seat && m.t === 'look') {
      seat.guest = { ...seat.guest, coat: m.coat, look: m.look };
      seat.heard = now;
    } else if (seat && m.t === 'sleep') {
      seat.heard = now;
      if ('g' in m) seat.lie = { g: m.g, dream: m.dream === true, ...(m.theme ? { theme: m.theme } : {}) };
      else if (m.a === 'wake') this.wake(seat.guest.id, now);
      else this.answerSkip(seat.guest.id, m.a === 'yes', now);
    } else if (seat && m.t === 'dream') {
      seat.heard = now;
      // Only a guest that dreams steers in the dream; a press is kept until a step has used it.
      this.steer(seat.guest.id, m.input);
    } else if (seat && m.t === 'say') {
      if (m.q) seat.say = m.q;
      else if (m.a) this.says = answer(this.says, seat.guest.id, m.a, now);
      seat.heard = now;
    } else if (seat && m.t === 'hide') {
      seat.heard = now;
      if (m.r) this.startHide(seat.guest.id, m.r, now, host, m.to);
      else if (m.a) this.answerHide(seat.guest.id, m.a);
    } else if (seat && m.t === 'intent') {
      seat.intent = intentOf(m);
      seat.heard = now;
    }
  }

  /** Every guest advanced by `dt`. Returns the world with what they changed: trees felled, the logs, the dams they built, the rocks taken. */
  step(world: WorldState, dt: number, now: number, ground: Terrain, trees: TreeSource): WorldState {
    let { felled, logs, dams, rocksTaken, dropped, picked, stripped }: { felled: readonly string[]; logs: readonly Log[]; dams: readonly Dam[]; rocksTaken: readonly string[]; dropped: readonly Dropped[]; picked: Picked; stripped: Readonly<Record<string, number>> } = world;
    this.forget(now);
    const terrain = withPonds(ground, world.ponds);
    const solids = [
      // The host's lodge is the lodge of its pair once it has one, and that one is solid only as far as its dome (below), so a guest reaches the door.
      ...[world.lodge, ...world.formerHomes, ...world.neighbours.map((n) => n.lodge)].flatMap((l) => (l && !world.pairLodges.some((p) => p.x === l.x && p.z === l.z) ? [{ x: l.x, z: l.z, radius: 4 }] : [])),
      // A pair's lodge is solid to the dome, so the entrance is outside it (`lodgeSolid`).
      ...world.pairLodges.map(lodgeSolid),
    ];
    let hostCarry = world.carry;
    this.pairing = expire(this.pairing, now);
    this.says = expireSays(this.says, now);
    // A guest lies down only on a nest of its own pair lodge, at night for the night (#661).
    for (const seat of this.seats.values()) {
      const wish = seat.lie;
      if (!wish) continue;
      seat.lie = undefined;
      const lodge = seat.guest.inside ? roomOf(seat.guest, world.pairLodges) : undefined;
      if (lodge && atNest(lodge, seat.guest.beaver.x, seat.guest.beaver.z) && (wish.g !== 'night' || isNight(world.clock))) this.lie(seat.guest.id, wish.g, wish.dream, now, wish.dream ? { theme: wish.theme ?? 'candy' } : undefined);
    }
    this.settle(tickSleep(this.sleep, this.players(), now));
    this.stepDream(world, dt);
    if (this.skip && this.skip !== 'dream') {
      world = skipTo(world, this.skip);
      this.skip = null;
    }
    if (this.hide) {
      const r = stepHide(this.hide, this.spots(world), (a, b) => this.blockers(a, b, world, trees, solids), now);
      this.hide = r.game;
    }
    // The host paired: its own lodge becomes a former home (Q110, note 48), and its logs now go to the lodge of the pair.
    const hostPartner = partnerOf(this.pairing, 'host');
    if (hostPartner && !world.pairWith) world = leaveHome(world);
    if (hostPartner !== world.pairWith) world = { ...world, pairWith: hostPartner };
    world = this.endPairs(world, ground);
    world = this.kits(world);
    let pairLodges: readonly PairLodge[] = world.pairLodges;
    const hostAdult = stageAt(world.clock, world.bornAt) === 'adult';
    const hostInside = world.inLodge;
    for (const seat of this.seats.values()) {
      if (seat.say) {
        const to = this.friendNear(seat.guest.id, seat.guest.beaver, world.beaver, seat.guest.inside, hostInside);
        if (to) this.says = askSay(this.says, seat.guest.id, to, seat.say, now);
        seat.say = undefined;
      }
      const still = now - seat.heard > SILENT_AFTER || frozen(this.hide, seat.guest.id);
      const intent = still ? { move: { x: 0, z: 0 } } : seat.intent;
      if (intent.do === 'give' && seat.guest.carry) {
        // Food handed to the host or another guest whose mouth is empty (#663).
        const to = this.taker(seat.guest.id, seat.guest.beaver, world.beaver, hostCarry === null && world.haul === null && world.drag === null, seat.guest.inside, hostInside);
        if (to === 'host') hostCarry = seat.guest.carry;
        else if (to) to.carry = seat.guest.carry;
        if (to) seat.guest = { ...seat.guest, carry: null };
      }
      if (intent.do === 'eat' && seat.guest.inside && seat.guest.carry) {
        // The piece in the mouth is eaten in the room, as the host's is (`step.ts`).
        seat.guest = { ...seat.guest, carry: null };
        world = { ...world, eaten: world.eaten + 1 };
      }
      if (intent.do === 'store' && !seat.guest.inside && !seat.guest.haul && !seat.guest.drag && atStore(world.lodge, seat.guest.beaver.x, seat.guest.beaver.z)) {
        // No stash screen on a guest's tablet: a piece in the mouth goes into the first free place, an empty mouth takes the first piece.
        const capacity = storeCapacity(storeCondition(world.storeWear, world.clock));
        const slot = seat.guest.carry ? world.store.findIndex((f, i) => i < capacity && f === null) : world.store.findIndex((f, i) => i < capacity && f !== null);
        if (slot >= 0) {
          const r = tapped(world.store, seat.guest.carry, slot, capacity);
          world = { ...world, store: r.stock };
          seat.guest = { ...seat.guest, carry: r.carry };
        }
      }
      if (intent.do === 'partner') {
        const to = this.partnerNear(seat.guest.id, seat.guest.beaver, world.beaver, hostAdult, seat.guest.inside, hostInside, world.clock);
        if (to) this.ask(seat.guest.id, to, now);
      }
      const r = stepGuest(seat.guest, intent, dt, { felled, logs, clock: world.clock, dams, spots: world.spots, rocksTaken, dropped, ground, picked, stripped, pairLodges, ponds: world.ponds, partner: partnerOf(this.pairing, seat.guest.id) }, terrain, trees, withDome(solids, seat.guest.homeLodge));
      seat.guest = r.guest;
      // A press arrives once: the next step must not repeat it.
      seat.intent = { ...seat.intent, do: seat.intent.do === 'gnaw' ? 'gnaw' : null, take: null, diveTap: false };
      ({ felled, logs, dams, rocksTaken, dropped, picked, stripped, pairLodges } = r);
    }
    const same = felled === world.felled && logs === world.logs && dams === world.dams && rocksTaken === world.rocksTaken && dropped === world.dropped && picked === world.picked && stripped === world.stripped && pairLodges === world.pairLodges;
    if (hostCarry !== world.carry) world = { ...world, carry: hostCarry };
    return same ? world : { ...world, felled: [...felled], logs: [...logs], dams: [...dams], rocksTaken: [...rocksTaken], dropped: [...dropped], picked, stripped: { ...stripped }, pairLodges: [...pairLodges] };
  }

  /**
   * Who can be handed food by the one at `from`: the host when its mouth is empty, else the nearest guest within `GIVE_REACH` with an
   * empty mouth (not `except`). Only a beaver in the same place can: all in the valley, or all in the round room of a lodge. Null when there is none.
   */
  private taker(except: string, from: { x: number; z: number }, host: { x: number; z: number }, hostEmpty: boolean, fromInside = false, hostInside = false): 'host' | Guest | null {
    let best: 'host' | Guest | null = hostEmpty && hostInside === fromInside && Math.hypot(host.x - from.x, host.z - from.z) <= GIVE_REACH ? 'host' : null;
    let bestD = best ? Math.hypot(host.x - from.x, host.z - from.z) : GIVE_REACH;
    for (const s of this.seats.values()) {
      const g = s.guest;
      const d = Math.hypot(g.beaver.x - from.x, g.beaver.z - from.z);
      if (g.id !== except && g.inside === fromInside && !g.carry && !g.haul && d <= bestD) {
        best = g;
        bestD = d;
      }
    }
    return best;
  }

  /**
   * The player `from` can ask to be partners, or say yes to: the nearest friend within `GIVE_REACH`, when both are adults with no
   * partner yet. `at` is where `from` stands. A player with a partner gets the partner back when it is close, for the press that
   * asks to stop being partners (note 48, Q4).
   */
  partnerNear(from: string, at: { x: number; z: number }, host: { x: number; z: number }, hostAdult: boolean, fromInside = false, hostInside = false, clock = 0): string | null {
    const dist = (p: { x: number; z: number }) => Math.hypot(p.x - at.x, p.z - at.z);
    const mine = partnerOf(this.pairing, from);
    if (mine) {
      const g = mine === 'host' ? null : [...this.seats.values()].find((k) => k.guest.id === mine)?.guest;
      const there = mine === 'host' ? (hostInside === fromInside ? dist(host) : Infinity) : g && g.inside === fromInside ? dist(g.beaver) : Infinity;
      return there <= GIVE_REACH ? mine : null;
    }
    if (from === 'host' && !hostAdult) return null;
    const adult = (g: Guest) => guestStage(g, clock) === 'adult';
    const me = [...this.seats.values()].find((s) => s.guest.id === from)?.guest;
    if (me && !adult(me)) return null;
    let best: string | null = from !== 'host' && hostAdult && hostInside === fromInside && dist(host) <= GIVE_REACH && !partnerOf(this.pairing, 'host') ? 'host' : null;
    let bestD = best ? dist(host) : GIVE_REACH;
    for (const s of this.seats.values()) {
      const d = dist(s.guest.beaver);
      if (s.guest.id !== from && s.guest.inside === fromInside && adult(s.guest) && !partnerOf(this.pairing, s.guest.id) && d <= bestD) {
        best = s.guest.id;
        bestD = d;
      }
    }
    return best;
  }

  /** The player `from` can put a question to: the nearest other player within `GIVE_REACH` in the same place (the lodge room or outside). */
  friendNear(from: string, at: { x: number; z: number }, host: { x: number; z: number }, fromInside = false, hostInside = false): string | null {
    const dist = (p: { x: number; z: number }) => Math.hypot(p.x - at.x, p.z - at.z);
    let best: string | null = from !== 'host' && hostInside === fromInside && dist(host) <= GIVE_REACH ? 'host' : null;
    let bestD = best ? dist(host) : GIVE_REACH;
    for (const s of this.seats.values()) {
      const d = dist(s.guest.beaver);
      if (s.guest.id !== from && s.guest.inside === fromInside && d <= bestD) {
        best = s.guest.id;
        bestD = d;
      }
    }
    return best;
  }

  /** Everyone who is in the valley, where they stand: the players a game of hide and seek counts. */
  private spots(world: WorldState): Spot[] {
    return [...(world.inLodge ? [] : [{ id: 'host', x: world.beaver.x, z: world.beaver.z }]), ...[...this.seats.values()].filter((s) => !s.guest.inside).map((s) => ({ id: s.guest.id, x: s.guest.beaver.x, z: s.guest.beaver.z }))];
  }

  /** What two players could hide behind: the standing trees near the line between them, and the lodges. */
  private blockers(a: Spot, b: Spot, world: WorldState, trees: TreeSource, solids: readonly { x: number; z: number; radius: number }[]): Blocker[] {
    const felled = new Set(world.felled);
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const reach = Math.hypot(a.x - b.x, a.z - b.z) / 2 + 2;
    return [...trees.trunksNear(mx, mz, reach, felled).map((k) => ({ x: k.x, z: k.z, r: k.radius })), ...solids.filter((k) => Math.hypot(k.x - mx, k.z - mz) <= reach + k.radius).map((k) => ({ x: k.x, z: k.z, r: k.radius }))];
  }

  /** `from` asks the friends close by (or only `to`, who has said yes already) to play hide and seek, and takes `role`. */
  startHide(from: string, role: Role, now: number, host: { x: number; z: number }, to?: string): void {
    if (this.hide) return;
    const at = from === 'host' ? host : this.seats.get(this.idOf(from) ?? '')?.guest.beaver;
    if (!at) return;
    const others = [...(from === 'host' ? [] : [{ id: 'host', ...host }]), ...[...this.seats.values()].map((s) => ({ id: s.guest.id, x: s.guest.beaver.x, z: s.guest.beaver.z }))];
    const asker: Spot = { id: from, x: at.x, z: at.z };
    const g = invite(asker, role, to ? [to] : noteTo(asker, others), now);
    this.hide = g && to ? accept(g, to) : g;
  }

  /** The connection id of the guest with player id `pid`. */
  private idOf(pid: string): string | undefined {
    for (const [id, s] of this.seats) if (s.guest.id === pid) return id;
    return undefined;
  }

  /** A friend who was asked answers the invitation. */
  answerHide(id: string, a: AnswerId): void {
    if (!this.hide) return;
    this.hide = a === 'yes' ? accept(this.hide, id) : decline(this.hide, id);
    if (this.hide && this.hide.phase === 'invite' && this.hide.invited.length === 0) this.hide = null;
  }

  /** True while the host's own beaver has to stand still, counting. */
  hostFrozen(): boolean {
    return frozen(this.hide, 'host');
  }

  /** The players the host's own screen must leave out: hiders it has not found. */
  hiddenFromHost(): string[] {
    return hiddenFrom(this.hide, 'host');
  }

  /** `from` puts a question to `to`. */
  say(from: string, to: string, q: QuestionId, now: number): void {
    this.says = askSay(this.says, from, to, q, now);
  }

  /** `to` answers the latest question put to it. */
  answer(to: string, a: AnswerId, now: number): void {
    this.says = answer(this.says, to, a, now);
  }

  /**
   * A pair that has come apart (Q4) leaves its lodge as a former home of both: a whole one is kept, solid, and an unfinished one
   * is gone. The kits of a lodge, grown up, leave it the same way. Whoever was in the room is put out at the entrance.
   */
  private endPairs(world: WorldState, ground: Terrain): WorldState {
    const together = (l: PairLodge): boolean => this.pairing.pairs.some(([a, b]) => l.players.includes(a) && l.players.includes(b));
    const present = (id: string): Guest | undefined => [...this.seats.values()].find((s) => s.guest.id === id)?.guest;
    // A kit's lodge is left when every kit of it that is here has grown up (the host's own leaving is `leaveHome`).
    const grownUp = (l: PairLodge): boolean => l.players.every((id) => (id === 'host' ? world.lodge?.x !== l.x || world.lodge?.z !== l.z : (present(id) ? guestStage(present(id)!, world.clock) === 'adult' : false)));
    // A guest left in a room whose lodge is gone (the host left it as a grown beaver) is put out at the entrance of the former home.
    const terrain0 = withPonds(ground, world.ponds);
    for (const seat of this.seats.values()) {
      const g = seat.guest;
      if (!g.inside || pairLodgeOf(world.pairLodges, g.id) || g.homeLodge) continue;
      const old = world.formerHomes.find((h) => Math.hypot(g.beaver.x - h.x, g.beaver.z - h.z) <= INTERIOR_RADIUS + 1);
      seat.guest = old ? outside(g, old, terrain0) : { ...g, inside: false };
    }
    // A guest grown up leaves its family's lodge: it is put out at the entrance and no longer lives there (as a kit leaves its pair lodge).
    for (const seat of this.seats.values()) {
      const g = seat.guest;
      if (g.homeLodge && guestStage(g, world.clock) === 'adult') seat.guest = { ...(g.inside ? outside(g, g.homeLodge, terrain0) : g), homeLodge: null };
    }
    const ended = world.pairLodges.filter((l) => (l.kitsAt === undefined ? !together(l) : grownUp(l)));
    if (ended.length === 0) return world;
    const terrain = withPonds(ground, world.ponds);
    for (const l of ended) {
      for (const seat of this.seats.values()) if (seat.guest.inside && l.players.includes(seat.guest.id)) seat.guest = outside(seat.guest, l, terrain);
      if (l.players.includes('host') && world.lodge && world.lodge.x === l.x && world.lodge.z === l.z) world = leaveHome(world);
    }
    const left = ended.filter((l) => lodgeComplete(l) && !world.formerHomes.some((h) => h.x === l.x && h.z === l.z));
    return { ...world, pairLodges: world.pairLodges.filter((l) => !ended.includes(l)), formerHomes: [...world.formerHomes, ...left.map((l) => ({ ...l, wear: undefined, parents: l.parents ?? world.parentCoats }))] };
  }

  /**
   * On the first day of spring after a pair lodge was made whole, a kit is born to each of the two partners (Q5, note 48): each plays
   * its own, born on a nest of the lodge, and the two old beavers are their Mama and Papa. The pair is done then, and the lodge is the
   * kits' home. It waits while a partner is away (Q3), and for both to be grown.
   */
  private kits(world: WorldState): WorldState {
    for (const l of world.pairLodges) {
      if (l.kitsAt !== undefined || l.wholeAt === undefined || !lodgeComplete(l) || world.clock < nextSpringStart(l.wholeAt)) continue;
      const [a, b] = l.players;
      const seatOf = (id: string): Guest | null => (id === 'host' ? null : [...this.seats.values()].find((s) => s.guest.id === id)?.guest ?? null);
      const grown = (id: string): boolean => (id === 'host' ? stageAt(world.clock, world.bornAt) === 'adult' : seatOf(id) !== null && guestStage(seatOf(id)!, world.clock) === 'adult');
      if (!grown(a) || !grown(b) || !this.pairing.pairs.some(([x, y]) => [x, y].includes(a) && [x, y].includes(b))) continue;
      const coatOf = (id: string) => (id === 'host' ? world.coat : seatOf(id)!.coat);
      const parents: [typeof world.coat, typeof world.coat] = [coatOf(a), coatOf(b)];
      const home: PairLodge = { ...l, kitsAt: world.clock, parents };
      for (const id of l.players) {
        const other = coatOf(id === a ? b : a);
        if (id === 'host') world = pairBirth({ ...world, pairLodges: world.pairLodges.map((k) => (k === l ? home : k)) }, home, other);
        else for (const seat of this.seats.values()) if (seat.guest.id === id) seat.guest = reborn(seat.guest, home, other, world.clock);
      }
      this.pairing = unpair(this.pairing, a, b);
      return { ...world, pairLodges: world.pairLodges.map((k) => (k === l ? home : k)), pairWith: null };
    }
    return world;
  }

  /** `from` asks `to` to be partners, or says yes when `to` asked first. */
  ask(from: string, to: string, now: number): void {
    this.pairing = press(this.pairing, from, to, now);
  }

  /** The partner of a player, or null. */
  partner(id: string): string | null {
    return partnerOf(this.pairing, id);
  }

  /** Whether `to` waits for a yes from `from`. */
  asking(from: string, to: string): boolean {
    return asked(this.pairing, from, to);
  }

  /** The players who asked `id` and wait for a yes. */
  askers(id: string): string[] {
    return askersOf(this.pairing, id);
  }

  /** The guest the host's food can go to, or null: the nearest friend within `GIVE_REACH` with an empty mouth. */
  guestTaker(at: { x: number; z: number }, hostInside = false): Guest | null {
    const to = this.taker('host', at, at, false, hostInside, hostInside);
    return to && to !== 'host' ? to : null;
  }

  /** The host's food goes into the mouth of `to`. Returns the world with the host's mouth empty. */
  hand(world: WorldState, to: Guest): WorldState {
    to.carry = world.carry;
    return { ...world, carry: null };
  }

  /** What every guest is sent: the shared world and every beaver in it, the host's first. */
  snapshot(world: WorldState, forPlayer?: string, now = 0): Snapshot {
    const b = world.beaver;
    const hostView: BeaverView = { id: 'host', coat: world.coat, look: world.look, x: b.x, y: b.y, z: b.z, mode: b.mode, heading: b.heading, pace: 0, chopping: world.chop !== null, carry: world.carry, haul: world.haul?.kind ?? null, grown: stageAt(world.clock, world.bornAt) === 'adult', ...(world.inLodge ? { inside: true } : {}), ...(world.generation > 0 && world.lodge && pairLodgeOf(world.pairLodges, 'host') ? { bornAt: world.bornAt, parents: world.parentCoats } : {}) };
    return { clock: world.clock, felled: world.felled, logs: world.logs, beavers: [hostView, ...this.guests().map((g) => viewOfGuest(g, world.clock))].filter((v) => !forPlayer || !hiddenFrom(this.hide, forPlayer).includes(v.id)), played: this.played(), dams: world.dams, lodge: world.lodge, rocksTaken: world.rocksTaken, dropped: world.dropped, picked: world.picked, stripped: world.stripped, pairLodges: world.pairLodges, asks: this.pairing.asks.filter((a) => !a.stop).map((a) => [a.from, a.to]), stops: this.pairing.asks.filter((a) => a.stop).map((a) => [a.from, a.to]), pairs: this.pairing.pairs.map(([a, b]) => [a, b]), says: [...this.says.list], ...(this.dreamers().length ? { dreaming: this.dreamers() } : {}), ...(this.sleep.asleep.length ? { asleep: this.sleep.asleep.map((s) => s.id) } : {}), ...(forPlayer && this.dream && this.dreamers().includes(forPlayer) ? { dream: wireOf(this.dream.state, this.dream.owner, this.dream.theme) } : {}), ...(this.sleep.ask ? { skip: { from: this.sleep.ask.from, goal: this.sleep.ask.goal, waiting: waitingFor(this.sleep, this.players()), left: Math.max(0, ASK_TIME - (now - this.sleep.ask.at)) } } : {}), ...(this.hide ? { hide: { ...this.hide, left: timeLeft(this.hide, now) } } : {}) };
  }

  /** Sends the state to every guest that has said hello. */
  broadcast(world: WorldState, now = 0): void {
    const text = JSON.stringify({ t: 'state', snapshot: this.snapshot(world, undefined, now) } satisfies ToGuest);
    for (const [id, seat] of this.seats) {
      // A seeker is not told where the hiders it has not found are (#664).
      if (hiddenFrom(this.hide, seat.guest.id).length || (this.dream && this.dreamers().includes(seat.guest.id))) {
        const snapshot = this.snapshot(world, seat.guest.id, now);
        // The dream's news goes out with this snapshot, once.
        const news = this.dreamNews.get(seat.guest.id);
        if (snapshot.dream && news?.length) {
          snapshot.dream = { ...snapshot.dream, events: news };
          this.dreamNews.delete(seat.guest.id);
        }
        this.send(id, JSON.stringify({ t: 'state', snapshot } satisfies ToGuest));
      }
      else this.send(id, text);
    }
  }

  private reply(id: string, m: ToGuest): void {
    this.send(id, JSON.stringify(m));
  }
}
