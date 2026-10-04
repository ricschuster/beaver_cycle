import { describe, expect, it } from 'vitest';
import { decodeTile } from './format';

function encode(n: number, qmin: number, stored: (i: number) => number, cls: number): ArrayBuffer {
  const nv = (n + 1) * (n + 1);
  const buf = new ArrayBuffer(16 + nv * 2 + n * n);
  const v = new DataView(buf);
  'BCT1'.split('').forEach((c, i) => v.setUint8(i, c.charCodeAt(0)));
  v.setUint8(4, 2);
  v.setUint16(6, n, true);
  v.setInt32(8, qmin, true);
  v.setFloat32(12, 0.05, true);
  for (let i = 0; i < nv; i++) v.setUint16(16 + i * 2, stored(i), true);
  new Uint8Array(buf, 16 + nv * 2).fill(cls);
  return buf;
}

describe('decodeTile', () => {
  it('applies offset and scale to heights', () => {
    const t = decodeTile(3, -2, encode(2, 11000, (i) => i * 10, 9));
    expect(t.level).toBe(2);
    expect(t.n).toBe(2);
    expect(t.heights[0]).toBeCloseTo(550); // 11000 * 0.05
    expect(t.heights[8]).toBeCloseTo((11000 + 80) * 0.05);
    expect(t.classes).toHaveLength(4);
    expect(t.classes[0]).toBe(9);
    expect([t.tx, t.tz]).toEqual([3, -2]);
  });

  it('rejects a bad magic and a wrong size', () => {
    const bad = encode(2, 0, () => 0, 0);
    new DataView(bad).setUint8(0, 0);
    expect(() => decodeTile(0, 0, bad)).toThrow(/magic/);
    expect(() => decodeTile(0, 0, encode(2, 0, () => 0, 0).slice(0, 30))).toThrow(/size/);
  });
});
