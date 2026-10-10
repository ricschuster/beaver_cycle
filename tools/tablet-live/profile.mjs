// Profile what a walking frame spends on the tablet (#110), over the WebView debug socket.
//
//   node tools/tablet-live/profile.mjs cpu     JS self time inside the frames over 30 ms (a Chrome trace with the V8 CPU profiler)
//   node tools/tablet-live/profile.mjs heap    what allocates, in MB, over the walk (V8 heap sampling), the source of garbage collection
//   PLACE=almsee Q=shadows=1 SECONDS=12 node ...   the place (a test menu location id), URL options, and how long to walk at x5
//
// Same needs as bench.mjs: dev server on 5199, `adb reverse tcp:5199 tcp:5199`, the app running, the tablet awake.
// Session 73 found streamDistance (33 ms of a 55 ms frame) and 1.3 GB of allocation in 12 s with it.
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const adb = `${process.env.ANDROID_HOME ?? `${process.env.HOME}/Android/Sdk`}/platform-tools/adb`;
const pid = execSync(`${adb} shell pidof com.beavercycle.live`, { encoding: 'utf8' }).trim();
if (!pid) throw new Error('com.beavercycle.live is not running');
execSync(`${adb} forward tcp:9223 localabstract:webview_devtools_remote_${pid}`);
const mode = process.argv[2] ?? 'cpu';
const place = process.env.PLACE ?? 'south-shore-bog';
const seconds = Number(process.env.SECONDS ?? 12);
const browser = await chromium.connectOverCDP('http://localhost:9223');
const page = browser.contexts()[0].pages()[0];

await page.goto('http://localhost:5199/?' + (process.env.Q ?? 'shadows=0'));
const cont = page.getByRole('button', { name: 'Continue' });
await Promise.race([cont.waitFor({ timeout: 8000 }).then(() => cont.click()), page.waitForFunction(() => '__game' in window, null, { timeout: 8000 })]).catch(() => {});
await page.waitForFunction(() => '__game' in window, null, { polling: 200, timeout: 60000 });
await page.getByRole('button', { name: 'Test menu' }).click();
await page.getByRole('button', { name: 'Noon', exact: true }).click();
const lodge = page.getByRole('button', { name: /^In lodge/ });
if (await lodge.count()) await lodge.click();
await page.locator(`button[data-location="${place}"]`).click();
await page.waitForTimeout(500);
while (await page.evaluate(() => document.querySelector('#test-menu')?.textContent?.includes('Loading'))) await page.waitForTimeout(100);
if (await lodge.count()) await lodge.click();
await page.waitForTimeout(8000);
await page.locator('button[data-speed="5"]').click();

const cdp = await browser.contexts()[0].newCDPSession(page);
const events = [];
let done;
if (mode === 'heap') {
  await cdp.send('HeapProfiler.startSampling', { samplingInterval: 4096, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
} else {
  cdp.on('Tracing.dataCollected', (d) => events.push(...d.value));
  done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.start', {
    transferMode: 'ReportEvents',
    traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-v8.cpu_profiler', 'v8'] },
  });
}
await page.keyboard.down('KeyW');
const dts = await page.evaluate(
  (ms) =>
    new Promise((resolve) => {
      const d = [];
      let last = performance.now();
      const t0 = last;
      const f = (n) => {
        d.push(n - last);
        last = n;
        n - t0 < ms ? requestAnimationFrame(f) : resolve(d);
      };
      requestAnimationFrame(f);
    }),
  seconds * 1000,
);
await page.keyboard.up('KeyW');
console.log(`frames ${dts.length}, over 35 ms: ${dts.filter((d) => d > 35).length}, worst ${Math.max(...dts).toFixed(1)} ms`);

if (mode === 'heap') {
  const { profile } = await cdp.send('HeapProfiler.stopSampling');
  const bySite = new Map();
  (function walk(n) {
    const cf = n.callFrame;
    const k = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop().split('?')[0]}:${cf.lineNumber}`;
    bySite.set(k, (bySite.get(k) ?? 0) + n.selfSize);
    n.children.forEach(walk);
  })(profile.head);
  const total = [...bySite.values()].reduce((a, c) => a + c, 0);
  console.log(`allocated ${(total / 1048576).toFixed(0)} MB over ${seconds} s (line numbers are of the transformed source)`);
  for (const [k, v] of [...bySite].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log((v / 1048576).toFixed(1).padStart(7), 'MB', k);
} else {
  await cdp.send('Tracing.end');
  await done;
  const main = events.find((e) => e.name === 'thread_name' && e.args.name === 'CrRendererMain');
  const long = events.filter((e) => e.ph === 'X' && e.name === 'FireAnimationFrame' && e.pid === main.pid && e.tid === main.tid && e.dur > 30000);
  let start = 0;
  const nodes = new Map();
  const samples = [];
  const deltas = [];
  for (const e of events) {
    if (e.name === 'Profile') start = e.args.data.startTime;
    if (e.name === 'ProfileChunk') {
      const c = e.args.data.cpuProfile ?? {};
      for (const n of c.nodes ?? []) nodes.set(n.id, n);
      samples.push(...(c.samples ?? []));
      deltas.push(...(e.args.data.timeDeltas ?? []));
    }
  }
  const self = new Map();
  let t = start;
  samples.forEach((id, i) => {
    t += deltas[i];
    if (!long.some((f) => f.ts <= t && t <= f.ts + f.dur)) return;
    const cf = nodes.get(id).callFrame;
    const k = `${cf.functionName || '(anon)'} ${(cf.url ?? '').split('/').pop().split('?')[0]}:${cf.lineNumber}`;
    self.set(k, (self.get(k) ?? 0) + (deltas[i + 1] ?? 0));
  });
  console.log(`${long.length} frames over 30 ms; JS self time per such frame:`);
  for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log((v / 1000 / Math.max(1, long.length)).toFixed(2).padStart(7), 'ms', k);
}
await browser.close();
