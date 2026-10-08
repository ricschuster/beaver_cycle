import { describe, expect, it } from 'vitest';
import { noActions } from '../actions/actions';
import { ROCK_REACH, canScoopMud, reachableRock, rockGround, rocksNear } from './haul';
import { createWorld } from './state';
import { step } from './step';
import type { Terrain } from './terrain';

const dry: Terrain = { heightAt: () => 0, isWater: () => false, waterDepth: () => 0 };
/** A stream: water 0.2 m deep for x > 0, dry land for x <= 0. */
const bank: Terrain = { heightAt: () => 0, isWater: (x) => x > 0, waterDepth: (x) => (x > 0 ? 0.2 : 0) };
const lake: Terrain = { heightAt: () => 0, isWater: () => true, waterDepth: () => 1.5 };
/** A steep slope rising 1 m per metre to the east. */
const steep: Terrain = { heightAt: (x) => x, isWater: () => false, waterDepth: () => 0 };

describe('rocks', () => {
  it('lie in the same places every time', () => {
    const a = rocksNear(steep, 0, 0, 100);
    expect(a.length).toBeGreaterThan(5);
    expect(rocksNear(steep, 0, 0, 100)).toEqual(a);
  });

  it('lie on stream beds, banks, and steep ground, not on flat dry land or a lake floor', () => {
    expect(rocksNear(dry, 0, 0, 200)).toEqual([]);
    expect(rocksNear(lake, 0, 0, 200)).toEqual([]);
    expect(rocksNear(steep, 0, 0, 100).length).toBeGreaterThan(0);
    const near = rocksNear(bank, 0, 0, 200);
    expect(near.length).toBeGreaterThan(0);
    for (const r of near) expect(r.x).toBeGreaterThan(-3);
    expect(rockGround(bank, 2, 0)).toBe(true);
    expect(rockGround(bank, -2, 0)).toBe(true);
    expect(rockGround(bank, -20, 0)).toBe(false);
  });

  it('are gone once taken', () => {
    const all = rocksNear(steep, 0, 0, 100);
    const rest = rocksNear(steep, 0, 0, 100, [all[0]!.id]);
    expect(rest.length).toBe(all.length - 1);
  });
});

describe('mud', () => {
  it('can be scooped in the shallows or at the water edge ahead, not inland', () => {
    expect(canScoopMud(bank, 5, 0, 0)).toBe(true);
    expect(canScoopMud(bank, -0.5, 0, Math.PI / 2)).toBe(true);
    expect(canScoopMud(bank, -0.5, 0, -Math.PI / 2)).toBe(false);
    expect(canScoopMud(dry, 0, 0, 0)).toBe(false);
  });
});

const gnaw = { ...noActions(), chop: true };
const drag = { ...noActions(), grab: true };

describe('hauling', () => {
  it('gnawing at the water edge scoops mud into the mouth, once', () => {
    let w = createWorld(bank, 5, 0);
    w = step(w, gnaw, 0.1, bank);
    expect(w.haul).toEqual({ kind: 'mud' });
    expect(step(w, gnaw, 0.1, bank).haul).toEqual({ kind: 'mud' });
  });

  it('gnawing next to a rock picks it up, and it is no longer there', () => {
    const rock = rocksNear(steep, 0, 0, 100)[0]!;
    let w = createWorld(steep, rock.x - ROCK_REACH / 2, rock.z);
    w = step(w, gnaw, 0.1, steep);
    expect(w.haul?.kind).toBe('rock');
    expect(w.rocksTaken).toEqual([rock.id]);
    expect(reachableRock(steep, rock.x, rock.z, w.rocksTaken)).toBeNull();
  });

  it('putting a rock down returns it where it was found, and mud just goes', () => {
    const rock = rocksNear(steep, 0, 0, 100)[0]!;
    let w = createWorld(steep, rock.x, rock.z);
    w = step(w, gnaw, 0.1, steep);
    w = step(w, drag, 0.1, steep);
    expect(w.haul).toBeNull();
    expect(w.rocksTaken).toEqual([]);
    let m = step(createWorld(bank, 5, 0), gnaw, 0.1, bank);
    m = step(m, drag, 0.1, bank);
    expect(m.haul).toBeNull();
  });

  it('does not take a second thing, and a full mouth cannot gnaw food or a tree', () => {
    let w = createWorld(bank, 5, 0);
    w = step(w, gnaw, 0.1, bank);
    const again = step(w, gnaw, 0.1, bank);
    expect(again.haul).toEqual({ kind: 'mud' });
    expect(again.carry).toBeNull();
    expect(again.chop).toBeNull();
  });

  it('does not scoop mud from dry ground, and not when diving', () => {
    expect(step(createWorld(dry, 0, 0), gnaw, 0.1, dry).haul).toBeNull();
    const deep = { ...lake, waterDepth: () => 1.5 };
    expect(step(createWorld(deep, 0, 0), gnaw, 0.1, deep).haul).toBeNull();
  });
});
