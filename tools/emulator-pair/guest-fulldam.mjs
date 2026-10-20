const port = process.argv[2] ?? '9302';
const list = await (await fetch(`http://localhost:${port}/json`)).json();
const ws = new WebSocket(list[0].webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); pend.get(m.id)?.(m); };
const send = (method, params) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async x => (await send('Runtime.evaluate', { expression: x, returnByValue: true })).result.result.value;
const KEYS = { KeyW: ['w', 87], KeyE: ['e', 69], KeyG: ['g', 71] };
const key = (type, code) => send('Input.dispatchKeyEvent', { type, key: KEYS[code][0], code, windowsVirtualKeyCode: KEYS[code][1] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const W = () => ev('(()=>{const w=__game.world();const b=w.beaver;return {x:b.x,z:b.z,mode:b.mode,carry:w.carry,drag:w.drag,haul:w.haul,chop:w.chop,dams:w.dams.map(d=>({spot:d.spot,wood:d.wood,mud:d.mud,rock:d.rock})),felled:w.felled.length,logs:w.logs.length}})()');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const tap = async code => { await key('keyDown', code); await sleep(150); await key('keyUp', code); await sleep(200); };
const A0 = -2.98;
async function walk(tx, tz, stop, maxMs = 120000) {
  await key('keyDown', 'KeyW'); const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const p = await W(); const dx = tx - p.x, dz = tz - p.z; const d = Math.hypot(dx, dz);
    if (d < stop) break;
    await ev(`__game.view().yaw=${Math.atan2(dx, dz) - A0}`); await sleep(80);
  }
  await key('keyUp', 'KeyW'); await sleep(400); return W();
}

const spot = { x: -771.6, z: 1106.9 };
const haul = () => ev('JSON.stringify(__game.world().haul)');
const dam = () => ev('JSON.stringify(__game.world().dams.map(d=>[d.wood,d.mud,d.rock]))');
const doLabel = () => ev("document.querySelector('#touch-do').textContent+'/'+document.querySelector('#touch-take').textContent");
async function deliver(what) {
  await walk(spot.x, spot.z, 2.5, 60000); log(what, 'at spot', await doLabel(), 'haul', await haul()); await tap('KeyE'); await sleep(2500);
  log(what, 'delivered; dam', await dam(), 'haul', await haul());
}

const need = async () => { const t = await ev("document.querySelector('#carry-hud')?.innerText||''"); const g = k => +(t.match(new RegExp('(\\d+) ' + k))?.[1] ?? 0); return { wood: g('wood'), mud: g('mud'), rock: g('rock'), t }; };
const ponds = () => ev('__game.world().ponds.length');
async function wood() {
  const tree = JSON.parse(await ev(`JSON.stringify(__game.nearestTree(${spot.x},${spot.z},90,true,[]))`));
  await walk(tree.x, tree.z, 1.6);
  for (let i = 0; i < 3; i++) {
    await tap('KeyE'); const t0 = Date.now();
    while (Date.now() - t0 < 12000 && !(await ev(`__game.world().felled.includes('${tree.id}')`))) await sleep(300);
    if (await ev(`__game.world().felled.includes('${tree.id}')`)) break;
  }
  await sleep(1200);
  const lg = JSON.parse(await ev(`JSON.stringify(__game.world().logs.find(l=>l.id==='${tree.id}')||null)`));
  if (!lg) return log('no log for', tree.id);
  for (let i = 0; i < 4; i++) { await walk(lg.x, lg.z, 1.8 + i * 0.3); await tap('KeyG'); await sleep(1000); if ((await W()).drag === tree.id) break; }
  await deliver('log');
}
async function rock() {
  const rs = JSON.parse(await ev(`JSON.stringify(__game.rocksNear(60).map(r=>({...r,d:Math.hypot(r.x-(${spot.x}),r.z-(${spot.z}))})).sort((a,b)=>a.d-b.d).slice(0,4))`));
  for (const r of rs) { await walk(r.x, r.z, 1.0, 40000); await tap('KeyG'); await sleep(1000); if ((await haul()) !== 'null') break; }
  if ((await haul()) !== 'null') await deliver('rock');
}
async function mud() {
  for (let i = 0; i < 12 && (await haul()) === 'null'; i++) {
    const a = i / 12 * Math.PI * 2;
    await walk(spot.x + Math.cos(a) * 4.5, spot.z + Math.sin(a) * 4.5, 1.0, 20000); await walk(spot.x, spot.z, 3.4, 5000);
    if (!(await ev('(()=>{const b=__game.world().beaver;return __game.nearestTree(b.x,b.z,3.2)===null})()'))) continue;
    await tap('KeyG'); await sleep(900);
  }
  if ((await haul()) !== 'null') await deliver('mud');
}
for (let n = 0; n < 60; n++) {
  const d = await need(); if (!d.t.includes("needs")) { log("complete", d.t); break; } log('need', d.wood, d.mud, d.rock, '| dam', await dam());
  if (d.wood > 0) await wood(); else if (d.mud > 0) await mud(); else if (d.rock > 0) await rock(); else { log("hud", d.t); break; }
}
log('done; ponds', await ponds(), 'dam', await dam());
ws.close();
