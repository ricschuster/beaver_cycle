import { expect, test, type Locator, type Page } from '@playwright/test';
import { shot } from './helpers';
// The touch layout on tablet sized screens, in both orientations. Layout and function only: this is a desktop browser drawing in
// software, so it says nothing about how the game runs on the tablet. It does not need the valley tiles.

const SIZES = [
  { name: 'landscape', width: 1280, height: 800 },
  { name: 'portrait', width: 800, height: 1280 },
];
const CONTROLS = ['#touch-stick', '#touch-dive', '#touch-slap', '#touch-take', '#touch-do'];

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const box = async (l: Locator): Promise<Box> => (await l.boundingBox())!;

async function open(page: Page): Promise<void> {
  await page.goto('/?shadows=0&touch=1');
  await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
}

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ hasTouch: true, viewport: { width: size.width, height: size.height } });

    test('the touch controls are all there, on screen, and clear of each other and of the HUD', async ({ page }) => {
      await open(page);
      const boxes: Record<string, Box> = {};
      for (const id of CONTROLS) {
        await expect(page.locator(id)).toBeVisible();
        boxes[id] = await box(page.locator(id));
        const b = boxes[id]!;
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(size.width);
        expect(b.y + b.height).toBeLessThanOrEqual(size.height);
        // Big enough to hit with a thumb.
        expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
      }
      for (const a of CONTROLS) for (const b of CONTROLS) if (a < b) expect(overlaps(boxes[a]!, boxes[b]!), `${a} overlaps ${b}`).toBe(false);
      for (const hud of ['#clock-hud', '#life-hud']) {
        const h = await box(page.locator(hud));
        for (const id of CONTROLS) expect(overlaps(h, boxes[id]!), `${hud} overlaps ${id}`).toBe(false);
      }
      await shot(page, `tablet-${size.name}-controls`);
    });

    test('the page does not scroll sideways, and the test menu fits the screen', async ({ page }) => {
      await open(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.getByRole('button', { name: 'Test menu' }).click();
      const panel = page.locator('button[data-speed="1"]').locator('xpath=ancestor::div[contains(@style,"overflow-y")][1]');
      const b = await box(panel);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(size.width);
      // It scrolls inside itself when it is taller than the screen.
      expect(await panel.evaluate((e) => getComputedStyle(e).overflowY)).toBe('auto');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await shot(page, `tablet-${size.name}-menu`);
    });

    test('the test menu panel ends inside the screen', async ({ page }) => {
      await open(page);
      await page.getByRole('button', { name: 'Test menu' }).click();
      const panel = page.locator('button[data-speed="1"]').locator('xpath=ancestor::div[contains(@style,"overflow-y")][1]');
      const b = await box(panel);
      expect(b.y + b.height).toBeLessThanOrEqual(size.height);
    });

    test('a toast is readable: on screen, big text, and clear of the buttons', async ({ page }) => {
      await open(page);
      await page.evaluate(() => {
        // The longest message the game shows, put in the game's own toast element.
        const el = document.getElementById('toast')!;
        el.textContent = 'Kits are born on the first day of spring. Find a partner and a lodge';
        el.style.opacity = '1';
      });
      const t = page.locator('#toast');
      const b = await box(t);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(size.width);
      expect(await t.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(14);
      for (const id of CONTROLS) expect(overlaps(b, await box(page.locator(id))), `toast overlaps ${id}`).toBe(false);
      await shot(page, `tablet-${size.name}-toast`);
    });

    test('the stick walks the beaver and a button answers a tap, and the readout shows the frame rate', async ({ page }) => {
      await open(page);
      await page.evaluate(() => {
        HTMLElement.prototype.setPointerCapture = () => {};
      });
      const s = await box(page.locator('#touch-stick'));
      const cx = s.x + s.width / 2;
      const cy = s.y + s.height / 2;
      const fire = (type: string, x: number, y: number): Promise<void> =>
        page.evaluate(([t, px, py]) => {
          document.getElementById('touch-stick')!.dispatchEvent(new PointerEvent(t as string, { pointerId: 9, clientX: px as number, clientY: py as number, bubbles: true }));
        }, [type, x, y]);
      const start = await page.evaluate(() => ({ ...(window as any).__game.world().beaver }));
      await fire('pointerdown', cx, cy);
      await fire('pointermove', cx, cy - 60);
      await page.waitForTimeout(600);
      await fire('pointerup', cx, cy - 60);
      const end = await page.evaluate(() => ({ ...(window as any).__game.world().beaver }));
      expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeGreaterThan(0.2);
      await page.locator('#touch-slap').tap();
      await page.waitForFunction(() => (window as any).__game.world().lastSlap !== null, null, { polling: 50 });
      // The readout holds the frame rate, which a desktop software browser makes low: only note it.
      await page.getByRole('button', { name: 'Test menu' }).click();
      await page.waitForTimeout(800);
      const text = await page.locator('pre').last().innerText();
      const fps = /(\d+(?:\.\d+)?)\s*fps/i.exec(text);
      console.log(`${size.name} readout:`, fps ? `${fps[1]} fps` : text.split('\n')[0]);
      expect(text).toMatch(/fps/i);
    });
  });
}
