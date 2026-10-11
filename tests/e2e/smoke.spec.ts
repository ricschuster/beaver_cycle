import { expect, test } from '@playwright/test';
// Tests that click or walk load the page with ?shadows=0: the CI browser draws in software, where the cascaded shadows make frames too slow to click through. The first tests keep shadows on, so a shader error still shows.

test('the game page renders a canvas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('tiles stream in when they have been built', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
  const stats = await page.evaluate(() => (window as any).__game.stats());
  // Tiles are built locally and absent in CI, where the flat fallback is used.
  if (stats) {
    // The streamer builds the first meshes over the next frames, so wait for them rather than read them at once.
    await page.waitForFunction(() => (window as any).__game.stats().meshes > 0, null, { polling: 200, timeout: 30_000 });
    const y = await page.evaluate(() => (window as any).__game.world().beaver.y);
    expect(y).toBeGreaterThan(500); // standing on the real ground, not at 0
  }
  expect(errors).toEqual([]);
});

test('the test menu sets the speed and jumps to a location', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?shadows=0');
  await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
  const hasTiles = await page.evaluate(() => (window as any).__game.stats() !== null);
  // Each jump loads real tiles, several seconds apiece.
  if (hasTiles) test.setTimeout(90_000);
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator('button[data-speed="100"]').click();
  expect(await page.evaluate(() => (window as any).__game.world().speedMultiplier)).toBe(100);
  // Locations exist only with tiles (absent in CI).
  if (hasTiles) {
    for (const id of ['east-oedseen', 'hinterer-springbach', 'totes-gebirge']) {
      await expect(page.locator(`button[data-location="${id}"]`)).toBeEnabled();
    }
    await page.locator('button[data-location="north"]').click();
    await page.waitForFunction(() => (window as any).__game.world().beaver.z < -1900, null, { polling: 100 });
    expect(await page.evaluate(() => (window as any).__game.world().beaver.y)).toBeGreaterThan(500);
    // the far locations stand on real ground, well above the valley floor; a jump lands near a dam spot, which for the
    // east extension lies about a kilometre west of its anchor (x 4909, z 519)
    await page.locator('button[data-location="east-oedseen"]').click();
    await page.waitForFunction(() => (window as any).__game.world().beaver.x > 3500, null, { polling: 100 });
    expect(await page.evaluate(() => (window as any).__game.world().beaver.y)).toBeGreaterThan(600);
    await page.locator('button[data-location="hinterer-springbach"]').click();
    await page.waitForFunction(() => Math.abs((window as any).__game.world().beaver.x - 3207) < 50, null, { polling: 100 });
    expect(await page.evaluate(() => (window as any).__game.world().beaver.y)).toBeGreaterThan(750);
  }
  expect(errors).toEqual([]);
});

test('the test menu moves the clock and the season, and sleep needs the lodge', async ({ page }) => {
  await page.goto('/?shadows=0&lodge=0');
  await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator('button[data-time="night"]').click();
  await expect(page.locator('#clock-hud')).toContainText('night');
  // A season button jumps to the first day with the season's full look (SEASON_FULL_DAY): day 4.
  await page.locator('button[data-season="winter"]').click();
  await expect(page.locator('#clock-hud')).toContainText('Winter, day 4');
  await page.locator('button[data-action="sleep"]').click();
  await expect(page.locator('#clock-hud')).toContainText('Winter, day 4');
  await page.locator('button[data-action="lodge"]').click();
  await page.locator('button[data-action="sleep"]').click();
  await expect(page.locator('#clock-hud')).toContainText('Winter, day 5, morning');
  await expect(page.locator('button[data-action="shadows"]')).toBeDisabled();
});

test('at night in the lodge the bedtime panel offers sleep and the dream, and both wake at dawn', async ({ page }) => {
  // Two fades and a page load take about 35 s on a busy machine, over the 30 s default.
  test.setTimeout(90_000);
  await page.goto('/?shadows=0&lodge=0');
  await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator('button[data-time="night"]').click();
  await expect(page.locator('#sleep-prompt')).toBeHidden();
  await page.locator('button[data-action="lodge"]').click();
  await expect(page.locator('#sleep-prompt')).toBeVisible();
  await page.locator('button[data-action="sleep-skip"]').click();
  await expect(page.locator('#clock-hud')).toContainText('day 2, morning');
  // By day only the long sleeps are offered: to the next season, not to morning or the dream.
  await expect(page.locator('button[data-action="sleep-skip"]')).toBeHidden();
  await expect(page.locator('button[data-action="sleep-season"]')).toBeVisible();
  // The dream opens candy land over the game, and its Wake up wakes at dawn.
  await page.locator('button[data-time="night"]').click();
  await expect(page.locator('button[data-action="sleep-dream"]')).toBeVisible();
  await page.locator('button[data-action="sleep-dream"]').click();
  await expect(page.locator('#dream')).toBeVisible();
  await page.locator('button[data-action="dream-wake"]').click();
  await expect(page.locator('#dream')).toHaveCount(0);
  await expect(page.locator('#clock-hud')).toContainText('day 3, morning');
});

test('?dream=1 opens candy land, the keys walk the beaver, and Wake up goes back to the game', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?shadows=0&dream=1&seed=3');
  await page.waitForFunction(() => (window as any).__game?.dream() != null, null, { polling: 100 });
  await expect(page.locator('#dream-count')).toContainText('0');
  // The waking game stands still while the beaver dreams.
  const clock = await page.evaluate(() => (window as any).__game.world().clock);
  const start = await page.evaluate(() => ({ ...(window as any).__game.dream().beaver }));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyW');
  const end = await page.evaluate(() => ({ ...(window as any).__game.dream().beaver }));
  expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeGreaterThan(0.3);
  expect(await page.evaluate(() => (window as any).__game.world().clock)).toBe(clock);
  await page.locator('button[data-action="dream-wake"]').click();
  await page.waitForFunction(() => (window as any).__game.dream() === null, null, { polling: 100 });
  await expect(page.locator('#dream')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('dragging turns the camera and forward still walks away from it', async ({ page }) => {
  await page.goto('/?shadows=0');
  await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
  const before = await page.evaluate(() => (window as any).__game.view().yaw);
  await page.mouse.move(400, 300);
  await page.mouse.down();
  await page.mouse.move(520, 300, { steps: 5 });
  await page.mouse.up();
  const after = await page.evaluate(() => (window as any).__game.view().yaw);
  expect(Math.abs(after - before)).toBeGreaterThan(0.3);
  const start = await page.evaluate(() => ({ ...(window as any).__game.world().beaver }));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyW');
  const end = await page.evaluate(() => ({ ...(window as any).__game.world().beaver }));
  const v = await page.evaluate(() => (window as any).__game.view().yaw);
  // forward points away from the camera: opposite to (sin yaw, cos yaw)
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const len = Math.hypot(dx, dz);
  expect(len).toBeGreaterThan(0.2);
  expect(Math.sin(v) * (dx / len) + Math.cos(v) * (dz / len)).toBeLessThan(-0.9);
});

test.describe('touch controls', () => {
  test.use({ hasTouch: true, viewport: { width: 1000, height: 600 } });

  test('the stick walks the beaver, the slap button slaps, and a drag on the view turns the camera', async ({ page }) => {
    await page.goto('/?shadows=0');
    await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
    await expect(page.locator('#touch-stick')).toBeVisible();
    const box = (await page.locator('#touch-stick').boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    // Playwright has no multi touch drag, so send the pointer events the stick listens to.
    const fire = (type: string, x: number, y: number): Promise<void> =>
      page.evaluate(
        ([t, px, py]) => {
          const el = document.getElementById('touch-stick')!;
          el.dispatchEvent(new PointerEvent(t as string, { pointerId: 7, clientX: px as number, clientY: py as number, bubbles: true }));
        },
        [type, x, y],
      );
    const start = await page.evaluate(() => ({ ...(window as any).__game.world().beaver }));
    // Stub out pointer capture, which needs a real active pointer.
    await page.evaluate(() => {
      HTMLElement.prototype.setPointerCapture = () => {};
    });
    await fire('pointerdown', cx, cy);
    await fire('pointermove', cx, cy - 70);
    await page.waitForTimeout(500);
    await fire('pointerup', cx, cy - 70);
    const end = await page.evaluate(() => ({ ...(window as any).__game.world().beaver }));
    expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeGreaterThan(0.2);

    await page.locator('#touch-slap').tap();
    await page.waitForFunction(() => (window as any).__game.world().lastSlap !== null, null, { polling: 50 });

    const before = await page.evaluate(() => (window as any).__game.view().yaw);
    await page.mouse.move(500, 200);
    await page.mouse.down();
    await page.mouse.move(620, 200, { steps: 5 });
    await page.mouse.up();
    const after = await page.evaluate(() => (window as any).__game.view().yaw);
    expect(Math.abs(after - before)).toBeGreaterThan(0.3);
  });

  test('desktop browsers without touch show no stick', async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: false });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('#touch-stick')).toBeHidden();
    await ctx.close();
  });
});

test('the free fly view flies with the keys, turns with a drag, and glides to a tap', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?fly=free');
  await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
  const view = (): Promise<{ yaw: number; free: { x: number; y: number; z: number } }> => page.evaluate(() => JSON.parse(JSON.stringify((window as any).__game.view())));
  const before = await view();
  expect(before.free).toBeTruthy();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyW');
  const moved = await view();
  expect(Math.hypot(moved.free.x - before.free.x, moved.free.z - before.free.z)).toBeGreaterThan(1);
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  expect((await view()).yaw).not.toBeCloseTo(moved.yaw, 2);
  // A tap on the ground below the horizon glides the camera there (the flat fallback in CI is ground too).
  const at = await view();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.9);
  await page.waitForTimeout(800);
  const after = await view();
  expect(Math.hypot(after.free.x - at.free.x, after.free.y - at.free.y, after.free.z - at.free.z)).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test('the test menu switches to the drone and the map view and back, keeping the other settings', async ({ page }) => {
  await page.goto('/?shadows=0&lodge=0');
  await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator('button[data-fly="free"]').click();
  await page.waitForURL(/fly=free/);
  expect(page.url()).toContain('shadows=0');
  await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator('button[data-fly="map"]').click();
  await page.waitForURL(/fly=1/);
  await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator('button[data-fly="off"]').click();
  await page.waitForURL((u) => !u.search.includes('fly'));
  expect(page.url()).toContain('lodge=0');
});

test('the ? button opens the manual and the welcome card shows when asked for', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?shadows=0&welcome=1');
  await expect(page.locator('#welcome')).toBeVisible();
  await page.click('[data-action=welcome-go]');
  await expect(page.locator('#welcome')).toBeHidden();
  await page.click('#help-button');
  await expect(page.locator('#manual')).toBeVisible();
  await expect(page.frameLocator('#manual iframe').locator('h1')).toContainText('how to play');
  await page.click('[data-action=manual-close]');
  await expect(page.locator('#manual')).toBeHidden();
  expect(errors).toEqual([]);
});

test('the welcome card stays away in an automated browser', async ({ page }) => {
  await page.goto('/?shadows=0');
  await expect(page.locator('#help-button')).toBeVisible();
  await expect(page.locator('#welcome')).toBeHidden();
});

test('the coach gives a baby its first step when asked for, and the buttons move and close it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?shadows=0&coach=1&stage=baby');
  // The coach starts on the first frame, which comes late where the browser draws in software (CI): wait until time has moved.
  await page.waitForFunction(() => ((window as unknown as { __game?: { world(): { time: number } } }).__game?.world().time ?? 0) > 0, undefined, { timeout: 60_000 });
  await expect(page.locator('#coach')).toBeVisible({ timeout: 30_000 });
  // Without the local tiles there is no lodge, so the baby is already outside and the first step, leaving, is done.
  const first = (await page.locator('#coach').innerText()).includes('Swim out') ? 'Swim out' : 'Go for a swim';
  await expect(page.locator('#coach')).toContainText(first);
  await page.click('[data-action=coach-next]');
  await expect(page.locator('#coach')).not.toContainText(first);
  await page.click('[data-action=coach-back]');
  await expect(page.locator('#coach')).toContainText(first);
  await page.click('[data-action=coach-close]');
  await expect(page.locator('#coach')).toBeHidden();
  expect(errors).toEqual([]);
});

test('the coach stays away in an automated browser', async ({ page }) => {
  await page.goto('/?shadows=0');
  await expect(page.locator('#coach')).toBeHidden();
});
