import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createDamView, damAt, shownShare, wallSpan } from './damView';
import { POND_CELL, floodPond } from '../sim/pond';
import type { Dam } from '../sim/dam';
import type { DamSpot } from '../sim/damSpots';

describe('shownShare', () => {
  it('shows every piece while the dam is good and a third when it is gone', () => {
    expect(shownShare(1)).toBe(1);
    expect(shownShare(0.5)).toBe(1);
    expect(shownShare(0)).toBeCloseTo(1 / 3);
    expect(shownShare(0.25)).toBeCloseTo(2 / 3);
  });
});

describe('damAt', () => {
  const spot: DamSpot = { id: 's', bed: { x: 0, z: 0 }, channel: { x: 6, z: 6 }, bedY: 10, flow: { x: 0, z: 1 }, maxCrest: 2, pondM2: 0 };

  it('stands on the stream line when the ground there is near the bed', () => {
    expect(damAt(spot, () => 10.5)).toEqual(spot.bed);
  });

  it('stands across the channel when the stream line lies on a bank (the Oedsee east spot, 3 m up)', () => {
    expect(damAt(spot, () => 13.2)).toEqual(spot.channel);
  });

  it('stands on the stream line when the scan found no channel', () => {
    const { channel: _c, ...plain } = spot;
    expect(damAt(plain, () => 13.2)).toEqual(plain.bed);
  });
});

describe('wallSpan', () => {
  // A valley along z, flowing to +z, a stream bed at 0 and banks that rise 0.2 m per metre from x = +-6, closed upstream at z = -30, with a 3 m wide bump on the dam line at x = 4.
  const ground = { heightAt: (x: number, z: number): number => (Math.abs(x) > 6 ? (Math.abs(x) - 6) * 0.2 : 0) + (z < -30 ? (-30 - z) * 0.3 : 0) + (Math.abs(x - 4) < 1.5 && Math.abs(z) < 1 ? 3 : 0) };
  const spot: DamSpot = { id: 's', bed: { x: 0, z: 0 }, bedY: 0, flow: { x: 0, z: 1 }, maxCrest: 2, pondM2: 0 };

  it('spans the pond front even where a bump on the dam line would stop a walk along it', () => {
    const pond = floodPond(ground as never, spot, 1.0)!;
    const span = wallSpan(pond, spot, 1.0)!;
    // Water at 1.0 m reaches x = +-11.
    expect(span.left).toBeGreaterThanOrEqual(11);
    expect(span.right).toBeGreaterThanOrEqual(11);
    expect(span.left).toBeLessThan(11 + 2 * POND_CELL);
  });

  it('is narrower for a lower row', () => {
    const pond = floodPond(ground as never, spot, 1.0)!;
    expect(wallSpan(pond, spot, 0.3)!.left).toBeLessThan(wallSpan(pond, spot, 1.0)!.left);
  });
});

describe('createDamView', () => {
  const ground = (x: number, z: number): number => (Math.abs(x) > 6 ? (Math.abs(x) - 6) * 0.2 : 0) + (z < -30 ? (-30 - z) * 0.3 : 0);
  const spot: DamSpot = { id: 's', bed: { x: 0, z: 0 }, bedY: 0, flow: { x: 0, z: 1 }, maxCrest: 2, pondM2: 0 };
  const drawn = (dam: Dam): THREE.Mesh[] => {
    const scene = new THREE.Scene();
    createDamView(scene, false, () => {}).update([dam], [spot], ground);
    const found: THREE.Mesh[] = [];
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh && o.geometry.getAttribute('color')) found.push(o);
    });
    return found;
  };
  const vertices = (dam: Dam): number => drawn(dam)[0]!.geometry.getAttribute('position').count;

  it('draws a dam as one mesh, the same each time it is built', () => {
    const dam: Dam = { spot: 's', wood: 8, mud: 4, rock: 2 };
    const meshes = drawn(dam);
    expect(meshes).toHaveLength(1);
    expect(Array.from(drawn(dam)[0]!.geometry.getAttribute('position').array)).toEqual(Array.from(meshes[0]!.geometry.getAttribute('position').array));
  });

  it('draws fewer pieces for a dam half built or worn', () => {
    const whole = vertices({ spot: 's', wood: 8, mud: 4, rock: 2 });
    expect(vertices({ spot: 's', wood: 4, mud: 1, rock: 0 })).toBeLessThan(whole);
    expect(vertices({ spot: 's', wood: 8, mud: 4, rock: 2, wear: { level: 0.1, since: 0, mend: 0 } })).toBeLessThan(whole);
  });
});
