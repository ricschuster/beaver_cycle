import { describe, expect, it } from 'vitest';
import { GROW_STAGES, GROW_TIME, VEGS, VEG_NAMES, bankSpot, chocolateDepth, newDream, playPrompt, stepDream, type DreamEvent, type DreamInput, type DreamPoint, type DreamState } from './dream';
import { BED_RADIUS, VEGGIE_HALF, innerOf, lineDistance } from './dreamLand';

const DT = 1 / 30;
const still: DreamInput = { move: { x: 0, z: 0 }, hop: false, slap: false, play: false };
const SEEDS = [1, 7, 42, 1234, 99];
const veggie = (seed: number): DreamState => newDream(seed, [], 'veggie');
const place = (s: DreamState, p: DreamPoint): DreamState => ({ ...s, beaver: { ...s.beaver, x: p.x, z: p.z } });

function run(s: DreamState, seconds: number, every: (st: DreamState) => DreamInput = () => still): { state: DreamState; events: DreamEvent[] } {
  const events: DreamEvent[] = [];
  let state = s;
  for (let i = 0; i < seconds / DT; i++) {
    const r = stepDream(state, every(state), DT);
    state = r.state;
    events.push(...r.events);
    if (state.game.kind === 'none' && events.some((e) => e.what === 'growEnd')) break;
  }
  return { state, events };
}

describe('the veggie garden land', () => {
  it('is half as big again as candy land, with a wider river and more of everything', () => {
    for (const seed of SEEDS) {
      const v = veggie(seed);
      const c = newDream(seed);
      expect(v.land.theme).toBe('veggie');
      expect(c.land.theme).toBeUndefined();
      expect(v.land.half).toBe(VEGGIE_HALF);
      expect(v.land.riverWidth).toBeGreaterThan(c.land.riverWidth);
      expect(v.land.props.length).toBeGreaterThan(c.land.props.length);
      expect(v.land.ponds.length).toBeGreaterThan(c.land.ponds.length);
      expect(v.sweets.length).toBeGreaterThan(c.sweets.length);
    }
  });

  it('keeps props, sweets, the statue and the beds on dry land inside the hills, and the beds clear of props and the river', () => {
    for (const seed of SEEDS) {
      const { land, sweets } = veggie(seed);
      const inner = innerOf(land.half);
      for (const p of land.props) expect(Math.abs(p.x) <= inner && Math.abs(p.z) <= inner).toBe(true);
      expect(land.beds).toHaveLength(4);
      for (const bed of land.beds!) {
        expect(chocolateDepth(land, bed.x, bed.z)).toBe(0);
        expect(lineDistance(land.river, bed.x, bed.z)).toBeGreaterThan(land.riverWidth / 2 + BED_RADIUS);
        for (const p of land.props) expect(Math.hypot(p.x - bed.x, p.z - bed.z)).toBeGreaterThan(BED_RADIUS);
      }
      expect(sweets.some((s) => s.kind === 'star')).toBe(true);
    }
  });

  it('has only veggie props, and some of them hide a beaver', () => {
    const candy = new Set(['lollipop', 'gumdrop', 'candyCane', 'cupcake', 'iceCream', 'marshmallowRock', 'cottonCandy']);
    for (const seed of SEEDS) {
      const { props } = veggie(seed).land;
      expect(props.some((p) => candy.has(p.kind))).toBe(false);
      expect(props.filter((p) => p.hide).length).toBeGreaterThan(10);
    }
  });

  it('has no chopping or building, and keeps nothing from candy land', () => {
    const s = veggie(7);
    const tree = s.land.props.find((p) => p.kind === 'lettuceTree')!;
    const next = stepDream(place(s, { x: tree.x + 1, z: tree.z }), { ...still, play: true }, DT).state;
    expect(next.carrying).toBeFalsy();
    expect(newDream(7, [{ kind: 'lodge', x: 0, z: 0, heading: 0, logs: 4 }], 'veggie').builds).toBeUndefined();
  });
});

describe('the veggie beavers', () => {
  it('are given out in order, vegetables and names from the start, round again', () => {
    const { mallows } = veggie(7);
    expect(mallows.map((m) => m.name)).toEqual([...VEG_NAMES]);
    expect(mallows.map((m) => m.veg)).toEqual(mallows.map((_, k) => VEGS[k % VEGS.length]));
    expect(mallows[0]).toMatchObject({ name: 'Veggie', veg: 'pea' });
  });

  it('are plain marshmallow beavers in candy land', () => {
    expect(newDream(7).mallows.every((m) => m.veg === undefined)).toBe(true);
  });
});

describe('growing plants', () => {
  const atBed = (s: DreamState, i = 0): DreamState => place(s, s.land.beds![i]!);

  it('asks at a bed, and starts with the player and the nearest veggie beavers each on a bed', () => {
    const s = atBed(veggie(7));
    expect(playPrompt(s)).toBe('Grow a plant!');
    const r = stepDream(s, { ...still, play: true }, DT);
    expect(r.events).toContainEqual({ what: 'growStart', friends: 3 });
    expect(r.state.game).toMatchObject({ kind: 'grow', can: false });
    const beds = r.state.plants!.map((p) => p.bed);
    expect(new Set(beds).size).toBe(4);
    expect(r.state.plants![0]).toEqual({ bed: 0, owner: 'player', stage: 0 });
    expect(r.state.mallows.filter((m) => m.state === 'water')).toHaveLength(3);
  });

  it('is not offered in candy land', () => {
    const c = newDream(7);
    expect(c.land.beds).toBeUndefined();
    expect(stepDream(c, { ...still, play: true }, DT).state.game.kind).toBe('none');
  });

  it('fills the can on the river bank and waters the plant at the bed, one stage a time', () => {
    const s = stepDream(atBed(veggie(7)), { ...still, play: true }, DT).state;
    const bed = s.land.beds![0]!;
    // Away from the river nothing happens.
    expect(stepDream(s, { ...still, play: true }, DT).events.some((e) => e.what === 'fill' || e.what === 'water')).toBe(false);
    const bank = place(s, bankSpot(s.land, bed));
    expect(playPrompt(bank)).toBe('Fill your watering can');
    const filled = stepDream(bank, { ...still, play: true }, DT);
    expect(filled.events.some((e) => e.what === 'fill' && e.who === 'player')).toBe(true);
    expect(filled.state.game).toMatchObject({ kind: 'grow', can: true });
    const home = place(filled.state, bed);
    expect(playPrompt(home)).toBe('Water your plant');
    const watered = stepDream(home, { ...still, play: true }, DT);
    expect(watered.events).toContainEqual({ what: 'water', who: 'player', stage: 1, x: bed.x, z: bed.z });
    expect(watered.state.game).toMatchObject({ can: false });
    expect(watered.state.plants!.find((p) => p.owner === 'player')!.stage).toBe(1);
  });

  it('lets the beavers fetch and water by themselves, and the player win by carrying faster', () => {
    let s = stepDream(atBed(veggie(7)), { ...still, play: true }, DT).state;
    const bed = s.land.beds![0]!;
    const bank = bankSpot(s.land, bed);
    // A player who is quick: teleports between the bank and the bed.
    let atRiver = true;
    const play = (st: DreamState): DreamInput => {
      if (st.game.kind !== 'grow') return still;
      return { ...still, play: true };
    };
    for (let i = 0; i < 60 / DT && s.game.kind === 'grow'; i++) {
      const stage = (st: DreamState): number => st.plants!.find((p) => p.owner === 'player')!.stage;
      s = place(s, atRiver ? bank : bed);
      const before = stage(s);
      const r = stepDream(s, play(s), DT);
      s = r.state;
      if (s.game.kind === 'grow' && (r.events.some((e) => e.what === 'fill' && e.who === 'player') || stage(s) > before)) atRiver = !atRiver;
    }
    // The beavers have been at it too.
    expect(s.mallows.some((m) => (m.watered ?? 0) > 0 || m.state !== 'water')).toBe(true);
  });

  it('ends with the biggest plant when time is up, and sends the beavers back to wandering', () => {
    const s = stepDream(atBed(veggie(7)), { ...still, play: true }, DT).state;
    const { state, events } = run(s, GROW_TIME + 5);
    const end = events.find((e) => e.what === 'growEnd');
    expect(end).toBeDefined();
    expect(state.game.kind).toBe('none');
    expect(state.mallows.every((m) => m.state !== 'water')).toBe(true);
    // The beavers do reach some stages with nobody helping.
    expect(Math.max(...state.plants!.map((p) => p.stage))).toBeGreaterThan(0);
    expect(Math.max(...state.plants!.map((p) => p.stage))).toBeLessThanOrEqual(GROW_STAGES);
  });

  it('can be started again, with the plants starting over', () => {
    const first = run(stepDream(atBed(veggie(7)), { ...still, play: true }, DT).state, GROW_TIME + 5).state;
    const again = stepDream(atBed(first), { ...still, play: true }, DT).state;
    expect(again.plants!.every((p) => p.stage === 0)).toBe(true);
  });
});
