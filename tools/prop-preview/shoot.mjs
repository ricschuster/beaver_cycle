// Screenshots the prop preview and prints the draw calls and triangles of each prop.
// Usage: start `npx vite --port 5202 --strictPort`, then `node tools/prop-preview/shoot.mjs out.png`.
import { chromium } from '@playwright/test';

const out = process.argv[2] ?? 'props.png';
const port = process.env.PREVIEW_PORT ?? '5202';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1600 } });
page.on('console', (m) => console.log('page:', m.text()));
page.on('pageerror', (e) => console.log('page error:', e.message));
await page.goto(`http://localhost:${port}/tools/prop-preview/index.html`);
await page.waitForFunction(() => 'propStats' in window, null, { timeout: 60000 });
console.log(JSON.stringify(await page.evaluate(() => window.propStats), null, 1));
await page.screenshot({ path: out });
await browser.close();
