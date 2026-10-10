// Tablet benchmark: drives the game in the live shell (com.beavercycle.live)
// through the test menu, over the WebView debug socket, and prints fps, worst
// frame, triangles, trees, tiles, and memory. Used for the M2 budgets (#53)
// and meant to be repeated when a milestone adds detail.
//
//   node tools/tablet-live/bench.mjs scenarios      each location, walking, x100
//   node tools/tablet-live/bench.mjs stress         ring and tree density sweep
//   node tools/tablet-live/bench.mjs soak [minutes] walk and report every ~90 s
//   node tools/tablet-live/bench.mjs lakes         jump to each fine tile region, still and walking, with per part tile build times (#109)
//   BENCH_QUERY=cascades=1 node ...                 add URL options to every load
//   node tools/tablet-live/bench.mjs fine          fine tile ring sweep at the shore and the bog (ADR 0008)
//
// Needs the dev server on port 5199, `adb reverse tcp:5199 tcp:5199`, the app
// running and the tablet unlocked (see README.md). The screen caps fps (90 Hz on
// the Tab A9+), so a run at the cap shows headroom only if the stress sweep drops.
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const URL = 'http://localhost:5199/';
const PORT = 9223;
const adb = `${process.env.ANDROID_HOME ?? `${process.env.HOME}/Android/Sdk`}/platform-tools/adb`;
const sh = (c) => execSync(`${adb} ${c}`, { encoding: 'utf8' });

const pid = sh('shell pidof com.beavercycle.live').trim();
if (!pid) throw new Error('com.beavercycle.live is not running');
sh(`forward tcp:${PORT} localabstract:webview_devtools_remote_${pid}`);
const browser = await chromium.connectOverCDP(`http://localhost:${PORT}`);
const page = browser.contexts()[0].pages()[0];

// BENCH_QUERY adds URL options to every load, such as `cascades=1` or `shadows=0`.
const EXTRA = process.env.BENCH_QUERY ?? '';

async function load(query = '') {
  const q = [query, EXTRA].filter(Boolean).join('&');
  await page.goto(URL + (q ? `?${q}` : ''));
  // A save from an earlier run brings up Welcome back; continue it.
  const cont = page.getByRole('button', { name: 'Continue' });
  await Promise.race([cont.waitFor({ timeout: 8000 }).then(() => cont.click()), page.waitForFunction(() => '__game' in window, null, { timeout: 8000 })]).catch(() => {});
  await page.waitForFunction(() => '__game' in window, null, { polling: 200, timeout: 60000 });
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.getByRole('button', { name: 'Noon', exact: true }).click(); // the same light every run
  await outside();
}

/** Frame statistics over ms milliseconds, plus the game's own counters. */
const sample = (ms) =>
  page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const dts = [];
        let last = performance.now();
        const t0 = last;
        function f(now) {
          dts.push(now - last);
          last = now;
          if (now - t0 < ms) return requestAnimationFrame(f);
          dts.shift();
          const sorted = [...dts].sort((a, b) => a - b);
          const g = window.__game;
          const st = g.stats();
          const b = g.world().beaver;
          resolve({
            fps: +(1000 / (dts.reduce((a, c) => a + c, 0) / dts.length)).toFixed(1),
            p99ms: +sorted[Math.floor(sorted.length * 0.99)].toFixed(1),
            worstMs: +sorted[sorted.length - 1].toFixed(1),
            tris: st && st.triangles,
            trees: st && st.trees,
            tiles: st && st.tilesByLevel,
            heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(0) : null,
            pos: [Math.round(b.x), Math.round(b.z), +b.y.toFixed(0)],
          });
        }
        requestAnimationFrame(f);
      }),
    ms,
  );

const speed = (m) => page.locator(`button[data-speed="${m}"]`).click();

async function jump(id) {
  await page.locator(`button[data-location="${id}"]`).click();
  await page.waitForTimeout(500);
  const t0 = Date.now();
  while (await page.evaluate(() => document.querySelector('#test-menu')?.textContent?.includes('Loading'))) {
    await page.waitForTimeout(100);
  }
  await outside();
  return Date.now() - t0 + 500;
}

/** The beaver starts in the lodge (a saved game, or a baby), where walking goes nowhere and the camera sees the inside. */
async function outside() {
  const btn = page.getByRole('button', { name: /^In lodge/ });
  if (await btn.count()) await btn.click();
  await page.waitForTimeout(300);
}

/** Wait until the number of tiles held stops changing. */
async function stable() {
  let prev = '';
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1500);
    const cur = await page.evaluate(() => JSON.stringify(window.__game.stats().tilesByLevel));
    if (cur === prev) return;
    prev = cur;
  }
}

const print = (name, r) => console.log(name.padEnd(24), JSON.stringify(r));

async function scenarios() {
  await load();
  print('start x1 idle', await sample(8000));
  for (const id of ['north', 'south', 'vorderer-springbach', 'core']) {
    const jumpMs = await jump(id);
    await page.waitForTimeout(2500);
    print(`jump ${id}`, { ...(await sample(6000)), jumpMs });
  }
  await page.keyboard.down('KeyW');
  print('walk x1', await sample(6000));
  await page.keyboard.up('KeyW');
  await speed(100);
  await page.keyboard.down('KeyW');
  print('x100 forward', await sample(8000));
  await page.keyboard.up('KeyW');
}

async function stress() {
  const configs = [
    ['base', ''],
    ['rings x1.6', 'rings=1000,2000'],
    ['rings x2.5', 'rings=1600,3200'],
    ['rings x4', 'rings=2500,5000'],
    ['trees x2', 'trees=2'],
    ['trees x4', 'trees=4'],
    ['trees x8', 'trees=8'],
    ['trees x16', 'trees=16'],
    ['rings x1.6 trees x4', 'rings=1000,2000&trees=4'],
  ];
  for (const [name, query] of configs) {
    await load(query);
    await jump('vorderer-springbach'); // the densest forest
    await stable();
    const still = await sample(6000);
    await speed(20);
    await page.keyboard.down('KeyW');
    const moving = await sample(6000);
    await page.keyboard.up('KeyW');
    print(name, { still, moving20: { fps: moving.fps, p99ms: moving.p99ms, worstMs: moving.worstMs, tris: moving.tris } });
  }
}

/** Per part build times (ms) for fine tiles (level 3) and the rest, since the last drain. */
const buildSummary = () =>
  page.evaluate(() => {
    const out = {};
    for (const t of window.__game.buildTimes()) {
      const k = `${t.level === 3 ? 'fine' : 'L' + t.level} ${t.part}`;
      (out[k] ??= []).push(t.ms);
    }
    for (const [k, v] of Object.entries(out)) {
      v.sort((a, b) => a - b);
      out[k] = { n: v.length, mean: +(v.reduce((a, c) => a + c, 0) / v.length).toFixed(1), p90: v[Math.floor(v.length * 0.9)], max: v[v.length - 1] };
    }
    return out;
  });

async function lakes() {
  await load();
  const places = (process.env.BENCH_PLACES ?? 'alm-river-outflow,almsee,south-shore-bog,aagbach-inflow,east-oedseen').split(',');
  for (const id of places) {
    await buildSummary(); // empty the log
    const jumpMs = await jump(id);
    await stable();
    print(`lakes ${id} jump builds`, await buildSummary());
    const still = await sample(5000);
    await speed(5);
    await page.keyboard.down('KeyW');
    const moving = await sample(8000);
    await page.keyboard.up('KeyW');
    await speed(1);
    print(`lakes ${id}`, { ...still, jumpMs, moving5: { fps: moving.fps, p99ms: moving.p99ms, worstMs: moving.worstMs, tris: moving.tris, tiles: moving.tiles } });
    print(`lakes ${id} walk builds`, await buildSummary());
  }
}

async function fine() {
  for (const ring of (process.env.RINGS ?? "0,150,200,300,450").split(",").map(Number)) {
    await load(`fine=${ring}`);
    for (const id of ['south-shore-bog', 'almsee']) {
      const jumpMs = await jump(id);
      await stable();
      const still = await sample(5000);
      await speed(5);
      await page.keyboard.down('KeyW');
      const moving = await sample(6000);
      await page.keyboard.up('KeyW');
      await speed(1);
      print(`fine=${ring} ${id}`, { ...still, jumpMs, moving5: { fps: moving.fps, p99ms: moving.p99ms, worstMs: moving.worstMs, tris: moving.tris } });
    }
  }
}

async function soak(minutes) {
  await load();
  await speed(5);
  const t0 = Date.now();
  for (let k = 1; Date.now() - t0 < minutes * 60000; k++) {
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyA'); // turn left for a moment
    await page.waitForTimeout(700);
    await page.keyboard.up('KeyA');
    if (k % 7 === 0) {
      await page.mouse.move(600, 500); // swing the camera
      await page.mouse.down();
      await page.mouse.move(800, 500, { steps: 8 });
      await page.mouse.up();
    }
    const r = await sample(5000);
    if (k % 4 !== 0) continue;
    const temps = {};
    for (const m of sh('shell dumpsys thermalservice').matchAll(/Temperature\{mValue=([\d.]+), mType=\d+, mName=(\w+)/g)) {
      temps[m[2]] = +m[1]; // the last reading of each sensor is the current one
    }
    const pss = sh('shell dumpsys meminfo com.beavercycle.live').match(/TOTAL PSS:\s+(\d+)/)?.[1];
    print(`${Math.round((Date.now() - t0) / 1000)}s`, { fps: r.fps, worstMs: r.worstMs, tris: r.tris, heapMB: r.heapMB, pssMB: Math.round(pss / 1024), temps });
  }
  await page.keyboard.up('KeyW');
}

const [mode, arg] = process.argv.slice(2);
try {
  if (mode === 'scenarios') await scenarios();
  else if (mode === 'stress') await stress();
  else if (mode === 'lakes') await lakes();
  else if (mode === 'fine') await fine();
  else if (mode === 'soak') await soak(Number(arg) || 10);
  else console.log('usage: node tools/tablet-live/bench.mjs scenarios | stress | lakes | fine | soak [minutes]');
} finally {
  await browser.close();
}
