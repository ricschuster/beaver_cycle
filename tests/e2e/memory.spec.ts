import { expect, test } from '@playwright/test';
import { hasTiles, startGame, toggleMenu } from './helpers';
// Memory soak (#604, docs/design/38_memory.md): jump around the six locations again and again, so tiles stream in and out, and
// read the JS heap (after a forced collection), the GPU object counts of three.js, and the bytes of ground held. After the first
// lap everything is loaded once, so later laps must not grow. MEMORY_LAPS=n sets the laps (default 3); MEMORY_REPORT=file keeps
// the table as JSON. Skips without the local tiles.

const LOCATIONS = ['core', 'north', 'south', 'east-oedseen', 'vorderer-springbach', 'hinterer-springbach'];
const LAPS = Number(process.env.MEMORY_LAPS ?? 3);
/** Growth allowed between the first lap's end and the last, as a share of the heap after the first lap. */
const HEAP_GROWTH = 0.15;

test('a long tour of the locations does not grow the memory', async ({ page }) => {
  test.setTimeout(30 * 60_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page, 'lodge=0');
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.enable');
  const sample = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const m = await cdp.send('Performance.getMetrics');
    const heap = m.metrics.find((x) => x.name === 'JSHeapUsedSize')?.value ?? 0;
    const mem = await page.evaluate(() => (window as any).__game.memory());
    return { heapMB: +(heap / 1e6).toFixed(1), ...mem, tileMB: +(mem.tileBytes.reduce((a: number, b: number) => a + (b ?? 0), 0) / 1e6).toFixed(1) };
  };
  await cdp.send('Performance.enable');
  const laps: Awaited<ReturnType<typeof sample>>[] = [];
  let peak = 0;
  for (let lap = 0; lap < LAPS; lap++) {
    for (const id of LOCATIONS) {
      await toggleMenu(page);
      const before = await page.evaluate(() => (window as any).__game.world().beaver);
      await page.locator(`button[data-location="${id}"]`).click();
      await toggleMenu(page);
      if (lap > 0 || id !== 'core') {
        await page.waitForFunction((b) => { const w = (window as any).__game.world().beaver; return Math.hypot(w.x - b.x, w.z - b.z) > 100; }, before, { polling: 200, timeout: 60_000 }).catch(() => {});
      }
      await page.waitForTimeout(6000);
      peak = Math.max(peak, (await sample()).heapMB);
    }
    laps.push(await sample());
    console.log(`lap ${lap + 1}`, JSON.stringify({ ...laps[lap], groups: undefined }));
    if (process.env.MEMORY_GROUPS) console.log('groups', JSON.stringify(laps[lap]!.groups));
  }
  if (process.env.MEMORY_REPORT) await import('node:fs').then((fs) => fs.writeFileSync(process.env.MEMORY_REPORT!, JSON.stringify({ peakHeapMB: peak, laps }, null, 2)));
  const first = laps[0]!;
  const last = laps[laps.length - 1]!;
  // Geometries reach the GPU when a mesh is first seen, so that count climbs for a while; the scene's own count is the bound.
  expect(last.geometries, 'geometries on the GPU stay within what the scene holds').toBeLessThanOrEqual(last.inScene);
  expect(last.inScene, 'geometries in the scene (pools of models grow to a high water mark, then stop)').toBeLessThanOrEqual(first.inScene + 150);
  expect(last.textures, 'textures').toBeLessThanOrEqual(first.textures + 5);
  expect(last.programs, 'shader programs').toBeLessThanOrEqual(first.programs + 3);
  expect(last.heapMB, 'JS heap').toBeLessThanOrEqual(first.heapMB * (1 + HEAP_GROWTH));
  expect(errors).toEqual([]);
});
