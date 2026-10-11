import { describe, expect, it } from 'vitest';
import { arrowAngle, groundColour, mapRotation, minimapMode, nextMode, toMap } from './minimap';

const close = (a: number, b: number): void => expect(a).toBeCloseTo(b, 6);

describe('minimapMode', () => {
  it('turns with the camera by default, off with 0 or off, north up with north', () => {
    expect(minimapMode(null)).toBe('turn');
    expect(minimapMode('1')).toBe('turn');
    expect(minimapMode('0')).toBe('off');
    expect(minimapMode('off')).toBe('off');
    expect(minimapMode('north')).toBe('north');
  });

  it('is off in an automated browser unless asked for', () => {
    expect(minimapMode(null, true)).toBe('off');
    expect(minimapMode('1', true)).toBe('turn');
    expect(minimapMode('north', true)).toBe('north');
  });

  it('goes round turn, north, off for the test menu', () => {
    expect(nextMode('turn')).toBe('north');
    expect(nextMode('north')).toBe('off');
    expect(nextMode('off')).toBe('turn');
  });
});

describe('toMap', () => {
  it('puts north up and east right when north up', () => {
    const n = toMap(0, -100, 0.5, 0);
    close(n.x, 0);
    close(n.y, -50);
    const e = toMap(100, 0, 0.5, 0);
    close(e.x, 50);
    close(e.y, 0);
  });

  it('puts where the camera looks at the top when turning', () => {
    for (const yaw of [0, 0.7, Math.PI / 2, Math.PI, -2.2]) {
      // The camera sits at yaw from the beaver, so it looks along (sin(yaw + pi), cos(yaw + pi)) in x and z.
      const look = toMap(Math.sin(yaw + Math.PI) * 10, Math.cos(yaw + Math.PI) * 10, 1, mapRotation('turn', yaw));
      close(look.x, 0);
      close(look.y, -10);
    }
  });

  it('does not turn a north up map with the camera', () => {
    expect(mapRotation('north', 1.3)).toBe(0);
  });
});

describe('arrowAngle', () => {
  it('points the way the beaver faces on a north up map', () => {
    close(arrowAngle(Math.PI, 0), 0); // heading pi is north (-z): straight up
    close(Math.abs(arrowAngle(0, 0)), Math.PI); // heading 0 is south: straight down
    close(arrowAngle(Math.PI / 2, 0), Math.PI / 2); // heading pi/2 is east (+x): right
    close(arrowAngle(-Math.PI / 2, 0), -Math.PI / 2); // west: left
  });

  it('agrees with toMap for any heading and turn', () => {
    for (const heading of [0, 1, 2.5, -1.2]) {
      for (const rot of [0, 0.8, -2]) {
        const p = toMap(Math.sin(heading), Math.cos(heading), 1, rot);
        const a = arrowAngle(heading, rot);
        // An arrow drawn pointing up and turned by a clockwise points along (sin a, -cos a) on the screen.
        close(Math.sin(a), p.x);
        close(-Math.cos(a), p.y);
      }
    }
  });

  it('points up when the beaver faces where the camera looks on a turning map', () => {
    const yaw = 2.1;
    close(arrowAngle(yaw + Math.PI, mapRotation('turn', yaw)), 0);
  });
});

describe('groundColour', () => {
  it('shows water blue whatever the cover', () => {
    const [r, g, b] = groundColour(true, 2);
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  it('shows forest darker than meadow', () => {
    const sum = (c: number[]): number => c.reduce((a, b) => a + b, 0);
    expect(sum(groundColour(false, 2))).toBeLessThan(sum(groundColour(false, 1)));
  });
});
