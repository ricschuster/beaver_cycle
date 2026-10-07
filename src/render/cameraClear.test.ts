import { describe, expect, it } from 'vitest';
import { SURFACE_BAND, clearDistance, clearSurface, easeReach } from './cameraClear';
import { TreeGrid } from '../terrain/trees';

const open = { insideTree: () => false };
const from = { x: 0, y: 1, z: 0 };
const to = { x: 0, y: 1, z: 10 };

describe('camera clearance', () => {
  it('keeps the full distance in the open', () => {
    expect(clearDistance(from, to, 10, open)).toBe(10);
  });

  it('stops short of a tree on the way', () => {
    const wall = { insideTree: (_x: number, _y: number, z: number) => z > 6 };
    const d = clearDistance(from, to, 10, wall);
    expect(d).toBeLessThan(6.5);
    expect(d).toBeGreaterThan(4);
  });

  it('never comes closer than the minimum', () => {
    expect(clearDistance(from, to, 10, { insideTree: () => true })).toBeGreaterThan(1);
  });

  it('moves out of the surface band toward the nearer side', () => {
    expect(clearSurface(5.1, 5)).toBe(5 + SURFACE_BAND);
    expect(clearSurface(4.9, 5)).toBe(5 - SURFACE_BAND);
    expect(clearSurface(8, 5)).toBe(8);
    expect(clearSurface(5.1, null)).toBe(5.1);
  });

  it('shortens at once and lengthens slowly', () => {
    expect(easeReach(8, 3, 0.016)).toBe(3);
    expect(easeReach(3, 8, 0.1)).toBeCloseTo(3.8);
    expect(easeReach(3, 3.2, 1)).toBe(3.2);
  });
});

describe('tree grid', () => {
  // one tree at (20, 100, 20), scale 1, level 0: radius 1.8 at the base, height 9
  const grid = new TreeGrid(Float32Array.from([20, 100, 20, 1, 0]), 0);

  it('hits inside the cone and misses outside it', () => {
    expect(grid.hit(20.5, 103, 20, 0)).toBe(true);
    expect(grid.hit(23, 103, 20, 0)).toBe(false);
    expect(grid.hit(23, 103, 20, 2)).toBe(true);
  });

  it('lets the camera pass the low part of a conifer', () => {
    expect(grid.hit(20.5, 101, 20, 0)).toBe(false);
    expect(grid.hit(20, 100.2, 20, 0.5)).toBe(false);
  });

  it('narrows toward the top and ends above it', () => {
    expect(grid.hit(21, 102.6, 20, 0)).toBe(true);
    expect(grid.hit(21.5, 107, 20, 0)).toBe(false);
    expect(grid.hit(20, 120, 20, 0.5)).toBe(false);
  });

  it('hits a broadleaf tree in its crown and not beside its trunk', () => {
    const broad = new TreeGrid(Float32Array.from([20, 100, 20, 1, 1]), 0);
    expect(broad.hit(20, 106, 20, 0)).toBe(true);
    expect(broad.hit(22.5, 106, 20, 0)).toBe(true);
    expect(broad.hit(22.5, 101, 20, 0)).toBe(false);
  });

  it('lists the broadleaf trees near a point', () => {
    const mixed = new TreeGrid(Float32Array.from([20, 100, 20, 1, 1, 25, 101, 20, 1.2, 0, 90, 100, 20, 1, 1]), 0);
    const out: number[] = [];
    mixed.broadleafNear(20, 20, 30, out);
    expect(out).toEqual([20, 100, 20, 1]);
  });

  it('finds a tree in a neighbouring bucket', () => {
    // the tree is in bucket 2 (x 32 to 48), the point in bucket 1
    const edge = new TreeGrid(Float32Array.from([33, 100, 20, 1, 0]), 0);
    expect(edge.hit(31.9, 102.6, 20, 0)).toBe(true);
  });
});
