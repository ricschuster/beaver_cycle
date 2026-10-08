import { describe, expect, it } from 'vitest';
import { noActions } from '../actions/actions';
import { LEVEL1_COST, damAt, damProgress, damWhole, needs, placed, spotAt } from './dam';
import type { DamSpot } from './damSpots';
import { fallenLog } from './logs';
import { createWorld } from './state';
import { step } from './step';
import type { Terrain } from './terrain';

const dry: Terrain = { heightAt: () => 0, isWater: () => false, waterDepth: () => 0 };
const spot: DamSpot = { id: 'core:50:0', bed: { x: 50, z: 0 }, bedY: 0, flow: { x: 1, z: 0 }, maxCrest: 2, pondM2: 900 };
const build = { ...noActions(), build: true };

describe('dam materials', () => {
  it('start a dam at a spot and stop at what it needs', () => {
    let dams = placed([], spot, { wood: 2 });
    expect(damAt(dams, spot)).toEqual({ spot: spot.id, wood: 2, mud: 0, rock: 0 });
    dams = placed(dams, spot, { wood: 100, mud: 100, rock: 100 });
    expect(damAt(dams, spot)).toEqual({ spot: spot.id, ...LEVEL1_COST });
    expect(damWhole(damAt(dams, spot))).toBe(true);
    expect(placed(dams, spot, { wood: 1 })).toBe(dams);
  });

  it('count the progress over all three', () => {
    expect(damProgress(undefined)).toBe(0);
    expect(damProgress({ spot: 's', wood: 8, mud: 4, rock: 0 })).toBeCloseTo(12 / 14);
    expect(needs({ spot: 's', wood: 3, mud: 4, rock: 1 })).toEqual({ wood: 5, mud: 0, rock: 1 });
  });

  it('find the spot within reach only', () => {
    expect(spotAt([spot], 52, 1)).toBe(spot);
    expect(spotAt([spot], 60, 0)).toBeNull();
  });
});

describe('placing at a spot', () => {
  const at = { ...createWorld(dry, 52, 0), spots: [spot] };

  it('puts mud and a rock from the mouth onto the dam', () => {
    let w = step({ ...at, haul: { kind: 'mud' } }, build, 0.1, dry);
    expect(w.haul).toBeNull();
    expect(damAt(w.dams, spot)).toMatchObject({ mud: 1, rock: 0 });
    w = step({ ...w, haul: { kind: 'rock' } }, build, 0.1, dry);
    expect(damAt(w.dams, spot)).toMatchObject({ mud: 1, rock: 1 });
  });

  it('puts a dragged log on as wood, a long one counting two', () => {
    const log = fallenLog(dry, 't1', 52, 1, 0, 6);
    const w = step({ ...at, logs: [log], drag: log.id }, build, 0.1, dry);
    expect(w.logs).toEqual([]);
    expect(w.drag).toBeNull();
    expect(damAt(w.dams, spot)?.wood).toBe(2);
  });

  it('keeps what a dam no longer needs in the mouth', () => {
    const full = { ...at, dams: [{ spot: spot.id, wood: 8, mud: 4, rock: 2 }], haul: { kind: 'mud' as const } };
    const w = step(full, build, 0.1, dry);
    expect(w.haul).toEqual({ kind: 'mud' });
  });

  it('does nothing away from a spot, and a log there starts no dam', () => {
    const away = { ...createWorld(dry, 80, 0), spots: [spot], haul: { kind: 'mud' as const } };
    expect(step(away, build, 0.1, dry).dams).toEqual([]);
    expect(step(away, build, 0.1, dry).haul).toEqual({ kind: 'mud' });
  });
});
