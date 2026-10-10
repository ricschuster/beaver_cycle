// Milliseconds spent on each part of a tile build, kept for the tablet bench (#109).
// The log is small and bounded, and nothing in the game reads it.

export interface BuildTime {
  part: 'decode' | 'frame' | 'ground' | 'lake' | 'streams' | 'shrubs' | 'trees';
  level: number;
  ms: number;
}

const MAX = 2000;
let log: BuildTime[] = [];

export function recordBuildTime(part: BuildTime['part'], level: number, ms: number): void {
  if (log.length < MAX) log.push({ part, level, ms: +ms.toFixed(2) });
}

/** Returns what was recorded since the last call and starts a new log. */
export function drainBuildTimes(): BuildTime[] {
  const out = log;
  log = [];
  return out;
}

/** Runs `fn` and records how long it took. */
export function timed<T>(part: BuildTime['part'], level: number, fn: () => T): T {
  const t0 = performance.now();
  const r = fn();
  recordBuildTime(part, level, performance.now() - t0);
  return r;
}
