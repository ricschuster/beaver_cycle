import { expect, test, type Page } from '@playwright/test';
// A playtest of the family cycle (docs/design/23_leaving_and_next_baby.md) in the real game, driven by the keys and the test menu.
// Run it with PLAYTEST_SHOTS=dir to keep screenshots of the key moments.

const SHOTS = process.env.PLAYTEST_SHOTS;
const shot = async (page: Page, name: string): Promise<void> => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};
const world = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).__game.world())));

/** Hold the keys that head best toward a point on the ground until the beaver is near it, as a player would. */
async function walkTo(page: Page, target: () => Promise<{ x: number; z: number }>, near: number, maxMs: number): Promise<boolean> {
  const keys = [
    { codes: ['KeyW'], m: { x: 0, z: 1 } }, { codes: ['KeyW', 'KeyA'], m: { x: 1, z: 1 } }, { codes: ['KeyA'], m: { x: 1, z: 0 } },
    { codes: ['KeyS', 'KeyA'], m: { x: 1, z: -1 } }, { codes: ['KeyS'], m: { x: 0, z: -1 } }, { codes: ['KeyS', 'KeyD'], m: { x: -1, z: -1 } },
    { codes: ['KeyD'], m: { x: -1, z: 0 } }, { codes: ['KeyW', 'KeyD'], m: { x: -1, z: 1 } },
  ];
  let held: string[] = [];
  const deadline = Date.now() + maxMs;
  try {
    while (Date.now() < deadline) {
      const s = await page.evaluate(() => {
        const g = (window as any).__game;
        return { b: g.world().beaver, yaw: g.view().yaw as number };
      });
      const t = await target();
      const dx = t.x - s.b.x;
      const dz = t.z - s.b.z;
      const d = Math.hypot(dx, dz);
      if (d <= near) return true;
      // relativeToView in src/actions/actions.ts, written out.
      const a = s.yaw - Math.PI;
      const best = keys
        .map((k) => ({ k, w: { x: k.m.x * Math.cos(a) + k.m.z * Math.sin(a), z: -k.m.x * Math.sin(a) + k.m.z * Math.cos(a) } }))
        .sort((p, q) => q.w.x * dx + q.w.z * dz - (p.w.x * dx + p.w.z * dz))[0]!.k;
      for (const c of held) if (!best.codes.includes(c)) await page.keyboard.up(c);
      for (const c of best.codes) if (!held.includes(c)) await page.keyboard.down(c);
      held = best.codes;
      await page.waitForTimeout(100);
    }
    return false;
  } finally {
    for (const c of held) await page.keyboard.up(c);
  }
}

test('the family cycle: leave home, hear and find a partner', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?shadows=0&stage=teenager');
  await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
  // The real valley is needed (the lone beavers sit at its dam spots); the CI build has only the flat fallback.
  test.skip(await page.evaluate(() => (window as any).__game.stats() === null), 'needs the tiles built locally');
  await page.waitForTimeout(1500);
  let w = await world(page);
  console.log('start', JSON.stringify({ lodge: w.lodge, beaver: w.beaver, spots: w.spots.length }));
  await shot(page, '01-teenager-at-home');

  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator('button[data-stage="adult"]').click();
  await page.waitForTimeout(800);
  w = await world(page);
  console.log('left', JSON.stringify({ lodge: w.lodge, formerHomes: w.formerHomes.length, partners: w.partners.map((p: any) => [p.id, Math.round(p.x), Math.round(p.z)]) }));
  await shot(page, '02-left-home');
  expect(w.partners).toHaveLength(3);
  expect(w.lodge).toBeNull();
  expect(w.formerHomes).toHaveLength(1);
  const home = w.formerHomes[0];
  const dist = w.partners.map((p: any) => Math.round(Math.hypot(p.x - home.x, p.z - home.z)));
  console.log('partner distances from home (m)', dist);

  // Walk to the nearest lone beaver at x20, the way a player would, and see it follow.
  await page.locator('button[data-speed="20"]').click();
  await page.getByRole('button', { name: 'Test menu' }).click();
  const nearest = w.partners.reduce((a: any, b: any) => (Math.hypot(a.x - home.x, a.z - home.z) < Math.hypot(b.x - home.x, b.z - home.z) ? a : b));
  // The walk ends when it is met, which makes the beaver follow (it then trails the player, so it never gets close again).
  const met = async (): Promise<boolean> => (await world(page)).partners.some((p: any) => p.state === 'following');
  const target = async () => (await world(page)).partners.find((p: any) => p.id === nearest.id);
  let reached = false;
  for (let i = 0; i < 60 && !reached; i++) reached = (await walkTo(page, target, 6, 3000)) || (await met());
  w = await world(page);
  console.log('reached', reached, JSON.stringify({ beaver: w.beaver, partners: w.partners.map((p: any) => [p.id, p.state, Math.round(p.x), Math.round(p.z)]) }));
  await page.waitForTimeout(300);
  await shot(page, '03-met-partner');
  expect(w.partners.find((p: any) => p.id === nearest.id).state).toBe('following');
  await expect(page.locator('#toast')).toContainText('slaps its tail and follows');
  expect(errors).toEqual([]);
});
