import { expect, test } from '@playwright/test';

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
    expect(stats.meshes).toBeGreaterThan(0);
    const y = await page.evaluate(() => (window as any).__game.world().beaver.y);
    expect(y).toBeGreaterThan(500); // standing on the real ground, not at 0
  }
  expect(errors).toEqual([]);
});

test('the test menu sets the speed and jumps to a location', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
  const hasTiles = await page.evaluate(() => (window as any).__game.stats() !== null);
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
    // the far locations stand on real ground, well above the valley floor
    await page.locator('button[data-location="east-oedseen"]').click();
    await page.waitForFunction(() => (window as any).__game.world().beaver.x > 4800, null, { polling: 100 });
    expect(await page.evaluate(() => (window as any).__game.world().beaver.y)).toBeGreaterThan(650);
    await page.locator('button[data-location="hinterer-springbach"]').click();
    await page.waitForFunction(() => Math.abs((window as any).__game.world().beaver.x - 3207) < 50, null, { polling: 100 });
    expect(await page.evaluate(() => (window as any).__game.world().beaver.y)).toBeGreaterThan(750);
  }
  expect(errors).toEqual([]);
});

test('dragging turns the camera and forward still walks away from it', async ({ page }) => {
  await page.goto('/');
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
    await page.goto('/');
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
