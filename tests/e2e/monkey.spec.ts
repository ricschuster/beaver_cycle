import { expect, test, type Page } from '@playwright/test';
import { hasTiles, startGame, world } from './helpers';
// Stability: random key presses and menu clicks, the test menu's location jumps, and the drone views. The game must throw
// nothing, log no console errors, and keep the beaver on finite ground. The random numbers are seeded, so a run repeats.

/** A small seeded random generator (mulberry32), so a failing run can be played again. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console error: ${m.text()}`);
  });
  return problems;
}

/** The world is sound: every number finite, and the beaver not under the ground. Returns the readout fps for the log. */
async function checkSound(page: Page, label: string): Promise<number> {
  const w = await world(page);
  const b = w.beaver;
  for (const k of ['x', 'y', 'z', 'heading', 'breath']) expect(Number.isFinite(b[k]), `${label}: beaver.${k} is finite`).toBe(true);
  expect(Number.isFinite(w.clock) && Number.isFinite(w.time), `${label}: the clocks are finite`).toBe(true);
  expect(b.breath).toBeGreaterThanOrEqual(0);
  expect(b.breath).toBeLessThanOrEqual(1);
  const text = (await page.locator('#test-menu').innerText().catch(() => '')) || '';
  const ground = /ground (-?[\d.]+) m/.exec(text);
  if (ground) expect(b.y, `${label}: the beaver is not under the ground`).toBeGreaterThanOrEqual(Number(ground[1]) - 0.3);
  return Number(/(\d+) fps/.exec(text)?.[1] ?? NaN);
}

const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyG', 'KeyB', 'KeyT'];
const SAFE_MENU = ['button[data-speed="1"]', 'button[data-speed="2"]', 'button[data-speed="5"]', 'button[data-time="dawn"]', 'button[data-time="noon"]', 'button[data-time="night"]', 'button[data-season="spring"]', 'button[data-season="summer"]', 'button[data-season="autumn"]', 'button[data-season="winter"]', 'button[data-stage="baby"]', 'button[data-stage="teenager"]', 'button[data-stage="adult"]', 'button[data-action="new-life"]', 'button[data-action="lodge"]', 'button[data-action="sleep"]', 'button[data-action="dam-fill"]', 'button[data-action="achievements"]'];

test('random keys and menu clicks for a few minutes throw nothing and keep the beaver on the ground', async ({ page }) => {
  test.setTimeout(420_000);
  const problems = watch(page);
  await startGame(page);
  const tiles = await hasTiles(page);
  test.skip(!tiles, 'needs the tiles built locally (the flat fallback run is not checked)');
  await page.getByRole('button', { name: 'Test menu' }).click();
  const rand = rng(20261008);
  const fps: number[] = [];
  const end = Date.now() + (tiles ? 150_000 : 25_000);
  let round = 0;
  while (Date.now() < end) {
    round++;
    const held = KEYS.filter(() => rand() < 0.3);
    for (const k of held) await page.keyboard.down(k);
    await page.waitForTimeout(150 + Math.floor(rand() * 500));
    for (const k of held) await page.keyboard.up(k);
    if (rand() < 0.35) {
      const sel = SAFE_MENU[Math.floor(rand() * SAFE_MENU.length)]!;
      const button = page.locator(sel);
      if (await button.isVisible()) await button.click({ timeout: 2000 }).catch(() => {});
    }
    if (round % 10 === 0) fps.push(await checkSound(page, `round ${round}`));
  }
  await checkSound(page, 'end');
  console.log('monkey', JSON.stringify({ rounds: round, tiles, fps }));
  expect(problems).toEqual([]);
});

test('every location the test menu can jump to loads and stands on finite ground', async ({ page }) => {
  test.setTimeout(420_000);
  const problems = watch(page);
  await startGame(page);
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  await page.getByRole('button', { name: 'Test menu' }).click();
  const ids = await page.locator('button[data-location]').evaluateAll((els) => els.filter((e) => !(e as HTMLButtonElement).disabled).map((e) => (e as HTMLElement).dataset.location!));
  expect(ids.length).toBeGreaterThan(1);
  const seen: Record<string, { x: number; z: number; y: number }> = {};
  for (const id of ids) {
    const before = await world(page);
    await page.locator(`button[data-location="${id}"]`).click();
    // The jump holds the beaver while the tiles load, then moves it. Some jumps land near where it already is, so wait for a settled state.
    await page.waitForFunction((b) => { const w = (window as any).__game.world().beaver; return Math.hypot(w.x - b.x, w.z - b.z) > 20; }, before.beaver, { polling: 200, timeout: 40_000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await checkSound(page, id);
    const b = (await world(page)).beaver;
    seen[id] = { x: Math.round(b.x), z: Math.round(b.z), y: Math.round(b.y) };
    // Walk about a little at each: a short random wander.
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(800);
    await page.keyboard.up('KeyW');
    await checkSound(page, `${id} after a step`);
  }
  console.log('locations', JSON.stringify(seen));
  expect(problems).toEqual([]);
});

for (const mode of ['1', 'free']) {
  test(`the ${mode === '1' ? 'map' : 'drone'} view runs with its keys and throws nothing`, async ({ page }) => {
    const problems = watch(page);
    await page.goto(`/?shadows=0&fly=${mode}`);
    await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
      await page.keyboard.down(k);
      await page.waitForTimeout(400);
      await page.keyboard.up(k);
    }
    if (mode === 'free') for (const k of ['Space', 'ShiftLeft', 'KeyE', 'KeyQ']) { await page.keyboard.down(k); await page.waitForTimeout(300); await page.keyboard.up(k); }
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(500);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(500);
    const view = await page.evaluate(() => JSON.parse(JSON.stringify((window as any).__game.view())));
    expect(Number.isFinite(view.yaw) && Number.isFinite(view.dist ?? 0)).toBe(true);
    await checkSound(page, `fly ${mode}`);
    expect(problems).toEqual([]);
  });
}
