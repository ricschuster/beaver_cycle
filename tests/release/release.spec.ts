import { expect, test } from '@playwright/test';

// Needs the release build in dist/ (`npm run build`), served by `vite preview`.

test('the release build starts with no test menu and no game hook', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Things I did' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open the manual' })).toBeVisible();
  await page.waitForTimeout(1000);
  expect(await page.locator('#test-menu').count()).toBe(0);
  expect(await page.evaluate(() => '__game' in window)).toBe(false);
  expect(errors).toEqual([]);
});

test('dev URL parameters do nothing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?dream=1&stage=baby&day=12&damsites=1&fly=free');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(1000);
  // ?fly=free would leave the beaver's screens out; ?dream=1 would open a dream.
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  expect(await page.locator('#dream').count()).toBe(0);
  expect(errors).toEqual([]);
});

test('the volume is kept between runs', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  const music = page.locator('input[data-action="settings-music"]');
  await music.evaluate((el: HTMLInputElement) => {
    el.value = '0.2';
    el.dispatchEvent(new Event('input'));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(music).toHaveValue('0.2');
});

test('the shadows choice restarts the game with shadows on', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  const shadows = page.locator('button[data-action="settings-shadows"]');
  await expect(shadows).toHaveText('Off');
  await Promise.all([page.waitForNavigation(), shadows.click()]);
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(shadows).toHaveText('On');
  expect(errors).toEqual([]);
});
