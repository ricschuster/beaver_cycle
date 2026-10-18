// Stress run (#603): plays the game by script for a set time and writes one JSON report, on a desktop browser or on a tablet.
//
//   npm run dev -- --port 5173 --strictPort         the dev server (the run needs the test menu and window.__game)
//   node tools/stress/stress.mjs                    desktop: launches Chromium (GPU, as the playtests do)
//   STRESS_TARGET=tablet node tools/stress/stress.mjs
//                                                    tablet: over the WebView debug socket, as tools/tablet-live/bench.mjs
//                                                    (live shell open and unlocked, adb reverse, see tools/tablet-live/README.md)
//
// STRESS_MINUTES (default 10) is the time to fill: laps of a tour through the six locations (jumps, a walk at x5, a season and a
// year, a night's sleep, a dream), with a save and reload and a background and resume at the end of every other lap.
// STRESS_PACKAGE (default com.beavercycle.live) names the tablet app, so a copy under another app id keeps the live shell's save untouched.
// STRESS_URL (default http://localhost:5173/, tablet 5199 as the bench), STRESS_REPORT (default stress-report.json),
// STRESS_BASELINE=file compares with an earlier report. Budgets are in docs/design/39_stress_test.md. Exit code 1 on a failure.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const TABLET = process.env.STRESS_TARGET === 'tablet';
const MINUTES = Number(process.env.STRESS_MINUTES ?? 10);
const URL = process.env.STRESS_URL ?? `http://localhost:${TABLET ? 5199 : 5173}/`;
const PACKAGE = process.env.STRESS_PACKAGE ?? 'com.beavercycle.live';
// STRESS_SLOT (default 4) is the game slot of the picker the run plays in and wipes.
const SLOT = process.env.STRESS_SLOT ?? '4';
const REPORT = process.env.STRESS_REPORT ?? 'stress-report.json';
const LOCATIONS = ['core', 'north', 'south', 'east-oedseen', 'vorderer-springbach', 'hinterer-springbach'];
// Budgets. The tablet's screen caps fps at its refresh rate, so frame times are judged against 60 Hz play.
const BUDGET = TABLET
  ? { p95Ms: 40, longPerMin: 30, heapSlopeMBPerMin: 0.5 }
  : { p95Ms: 25, longPerMin: 10, heapSlopeMBPerMin: 0.5 };

async function connect() {
  if (!TABLET) {
    const browser = await chromium.launch({ args: ['--use-angle=gl', '--use-gl=angle', '--ignore-gpu-blocklist'] });
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' })).newPage();
    return { browser, page };
  }
  const adb = `${process.env.ANDROID_HOME ?? `${process.env.HOME}/Android/Sdk`}/platform-tools/adb`;
  const pid = execSync(`${adb} shell pidof ${PACKAGE}`, { encoding: 'utf8' }).trim();
  if (!pid) throw new Error(`${PACKAGE} is not running`);
  execSync(`${adb} forward tcp:9223 localabstract:webview_devtools_remote_${pid}`);
  const browser = await chromium.connectOverCDP('http://localhost:9223');
  return { browser, page: browser.contexts()[0].pages()[0] };
}

const { browser, page } = await connect();
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console error: ${m.text()}`); });
page.on('crash', () => problems.push('page crash'));

let playSlot = '1'; // with no save at all the game starts in slot 1 without the picker
/** Load the game, continue a save if one asks, and put the frame probe in. `fresh` starts over. */
async function load(fresh = false) {
  // save=1: an automated browser (the desktop run) does not save otherwise, and the save and continue would go untested.
  await page.goto(`${URL}?shadows=0&save=1`);
  // The game picker ("Your games"): the run keeps to one slot, so a save of a player is never touched. A slow tablet shows it late,
  // and a reload of a page that played may go straight back in, so wait for the game or the picker, whichever comes first.
  if (fresh) playSlot = '1';
  const slotName = fresh ? SLOT : playSlot;
  const card = page.getByText(`Game ${slotName}`, { exact: true }).locator('xpath=..');
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (await page.evaluate(() => '__game' in window)) break;
    if (await card.isVisible().catch(() => false)) {
      const del = card.getByRole('button', { name: 'Delete' });
      if (fresh && (await del.count())) {
        await del.click();
        await page.getByRole('button', { name: 'Yes, delete' }).click();
      }
      await card.getByRole('button', { name: fresh ? 'New game' : 'Continue' }).click();
      // A new game asks for a name first (it may stay empty).
      if (fresh) await card.getByRole('button', { name: 'Start' }).click();
      playSlot = slotName;
      break;
    }
    if (Date.now() > deadline) {
      await page.screenshot({ path: `${REPORT}.png` }).catch(() => {});
      console.log('page text:', (await page.evaluate(() => document.body.innerText).catch(() => '')).slice(0, 400).replace(/\n/g, ' | '));
    }
    if (Date.now() > deadline) throw new Error('neither the game nor the game picker came up in 60 s');
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => '__game' in window, null, { polling: 200, timeout: 60000 });
  const welcome = page.getByRole('button', { name: "Let's go" });
  if (await welcome.isVisible().catch(() => false)) await welcome.click();
  await page.evaluate(() => {
    const s = (window.__stress = { dts: [], lost: 0 });
    document.querySelector('canvas')?.addEventListener('webglcontextlost', () => s.lost++);
    let last = performance.now();
    const f = (now) => { s.dts.push(now - last); last = now; if (s.dts.length > 100000) s.dts.splice(0, 50000); requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  const lodge = page.getByRole('button', { name: /^In lodge/ });
  await page.getByRole('button', { name: 'Test menu' }).click();
  if (await lodge.count()) await lodge.click();
  await page.getByRole('button', { name: 'Test menu' }).click();
}

const menu = async (selector) => {
  // A dream covers the screen until the player wakes up.
  const wake = page.locator('button[data-action="dream-wake"]');
  if (await wake.isVisible().catch(() => false)) await wake.click();
  const toggle = () => page.getByRole('button', { name: 'Test menu' }).evaluate((b) => b.click());
  await toggle();
  await page.locator(selector).click();
  await toggle(); // by script: a dream that just began covers the button
};

/** Frame times since the last call, and what the game holds now. */
async function read(label, ms) {
  const dts = await page.evaluate(() => window.__stress.dts.splice(0));
  // The heap after a forced collection by the debugger: performance.memory is coarse in the WebView (it sat at 31.6 MB).
  cdp ??= await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  const heapMB = (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'JSHeapUsedSize').value / 1048576;
  const r = await page.evaluate((frameTimes) => {
    const s = window.__stress;
    const dts = frameTimes.slice(1).sort((a, b) => a - b);
    const q = (p) => dts[Math.min(dts.length - 1, Math.floor(dts.length * p))] ?? 0;
    const mem = window.__game.memory();
    return {
      frames: dts.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), worst: dts[dts.length - 1] ?? 0,
      long: dts.filter((d) => d > 50).length, lost: s.lost,
      geometries: mem.geometries, textures: mem.textures, programs: mem.programs, inScene: mem.inScene,
      tileMB: mem.tileBytes.reduce((a, b) => a + (b ?? 0), 0) / 1e6,
    };
  }, dts);
  r.heapMB = heapMB;
  const round = (n) => (n === null ? null : +n.toFixed(1));
  return { label, ms, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? round(v) : v])) };
}

let cdp = null;
let segment = 0; // counts the page loads: a reload starts the heap over
let currentLap = 0;
const runStart = Date.now();
const phases = [];
async function phase(label, ms, body) {
  await page.evaluate(() => (window.__stress.dts.length = 0));
  const t0 = Date.now();
  await body();
  const left = ms - (Date.now() - t0);
  if (left > 0) await page.waitForTimeout(left);
  const r = await read(label, Date.now() - t0);
  r.minute = +((Date.now() - runStart) / 60000).toFixed(2);
  r.segment = segment;
  r.lap = currentLap;
  phases.push(r);
  console.log(label.padEnd(30), JSON.stringify(r));
}

async function lap(n) {
  currentLap = n;
  for (const id of LOCATIONS) {
    await phase(`lap ${n} jump ${id}`, 8000, () => menu(`button[data-location="${id}"]`));
    await phase(`lap ${n} walk x5 ${id}`, 15000, async () => {
      await menu('button[data-speed="5"]');
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(12000);
      await page.keyboard.up('KeyW');
      await menu('button[data-speed="1"]');
    });
  }
  await phase(`lap ${n} season and year`, 6000, async () => {
    await menu('button[data-season="winter"]');
    await page.evaluate(() => window.__game.skipYears(1));
  });
  await phase(`lap ${n} sleep`, 8000, () => menu('button[data-action="sleep"]'));
  await phase(`lap ${n} dream`, 12000, async () => {
    await menu('button[data-action="dream"]');
    await page.waitForTimeout(8000);
    await page.locator('button[data-action="dream-wake"]').click({ timeout: 5000 }).catch(() => problems.push(`lap ${n}: no wake up button in the dream`));
  });
}

async function saveAndResume(n) {
  // The game saves on hide and on reload; coming back must continue the same world.
  const before = await page.evaluate(() => window.__game.world().clock);
  await load();
  segment++;
  const after = await page.evaluate(() => window.__game.world().clock);
  if (after < before - 1) problems.push(`lap ${n}: continue went back in time (${before} to ${after})`);
  // Background and resume: the page is frozen and woken again.
  const life = await page.context().newCDPSession(page);
  await life.send('Page.enable');
  await life.send('Page.setWebLifecycleState', { state: 'frozen' }).catch(() => {});
  await page.waitForTimeout(3000).catch(() => {});
  await life.send('Page.setWebLifecycleState', { state: 'active' }).catch(() => {});
  await phase(`lap ${n} after resume`, 5000, async () => {});
}

await load(true);
await page.getByRole('button', { name: 'Test menu' }).click();
await page.locator('button[data-time="noon"]').click();
await page.getByRole('button', { name: 'Test menu' }).click();
const start = Date.now();
let n = 0;
do {
  n++;
  await lap(n);
  if (n % 2 === 0) await saveAndResume(n);
} while (Date.now() - start < MINUTES * 60_000);
const minutes = (Date.now() - start) / 60000;

// Verdict.
const walking = phases.filter((p) => p.label.includes('walk'));
const longPerMin = phases.reduce((a, p) => a + p.long, 0) / minutes;
// Heap slope in MB a minute, from the end of each stretch between reloads (the same point of the lap, so the pools filling and the
// first load of a stretch do not count): a least squares line over those points. Needs two stretches at least.
let slope = 0;
const ends = [...new Set(phases.map((p) => p.segment))].map((seg) => phases.filter((p) => p.segment === seg && p.label.endsWith(' dream')).at(-1)).filter(Boolean);
if (ends.length >= 3) {
  const pts = ends.slice(1); // the first stretch also loads the game once
  const mx = pts.reduce((a, p) => a + p.minute, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.heapMB, 0) / pts.length;
  const sxx = pts.reduce((a, p) => a + (p.minute - mx) ** 2, 0);
  if (sxx > 0) slope = pts.reduce((a, p) => a + (p.minute - mx) * (p.heapMB - my), 0) / sxx;
}
const worstP95 = Math.max(...walking.map((p) => p.p95));
const failures = [...problems];
if (worstP95 > BUDGET.p95Ms) failures.push(`walking p95 ${worstP95} ms over budget ${BUDGET.p95Ms}`);
if (longPerMin > BUDGET.longPerMin) failures.push(`${longPerMin.toFixed(1)} frames over 50 ms a minute, budget ${BUDGET.longPerMin}`);
if (slope > BUDGET.heapSlopeMBPerMin) failures.push(`heap grows ${slope.toFixed(2)} MB a minute, budget ${BUDGET.heapSlopeMBPerMin}`);
if (phases.some((p) => p.lost > 0)) failures.push('the WebGL context was lost');

const report = { target: TABLET ? 'tablet' : 'desktop', minutes: +minutes.toFixed(1), laps: n, worstWalkP95: worstP95, longPerMin: +longPerMin.toFixed(2), heapSlopeMBPerMin: +slope.toFixed(2), worstFrameMs: Math.max(...phases.map((p) => p.worst)), budget: BUDGET, failures, phases };
writeFileSync(REPORT, JSON.stringify(report, null, 2));
if (process.env.STRESS_BASELINE) {
  const base = JSON.parse(readFileSync(process.env.STRESS_BASELINE, 'utf8'));
  console.log('against baseline:', JSON.stringify({ worstWalkP95: [base.worstWalkP95, report.worstWalkP95], longPerMin: [base.longPerMin, report.longPerMin], heapSlopeMBPerMin: [base.heapSlopeMBPerMin, report.heapSlopeMBPerMin] }));
}
console.log(failures.length ? `FAILED\n- ${failures.join('\n- ')}` : `ok, ${n} laps in ${minutes.toFixed(1)} min, report in ${REPORT}`);
await browser.close().catch(() => {});
process.exit(failures.length ? 1 : 0);
