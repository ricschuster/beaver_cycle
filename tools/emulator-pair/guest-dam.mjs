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
const spot = JSON.parse(await ev('JSON.stringify(__game.world().spots.map(s=>({id:s.id,x:s.bed.x,z:s.bed.z})).sort((a,b)=>Math.hypot(a.x-__game.world().beaver.x,a.z-__game.world().beaver.z)-Math.hypot(b.x-__game.world().beaver.x,b.z-__game.world().beaver.z))[0])'));
log('spot', spot, 'me', await W());
const tree = JSON.parse(await ev(`JSON.stringify(__game.nearestTree(${spot.x},${spot.z},80,true,[]))`));
log('tree', tree);
await walk(tree.x, tree.z, 2.0); log('at tree', await W());
for (let i = 0; i < 4; i++) {
  if ((await W()).chop) break; await tap('KeyE');
  const t0 = Date.now(); while (Date.now() - t0 < 15000) { if (await ev(`__game.world().felled.includes('${tree.id}')`)) break; await sleep(200); }
  if (await ev(`__game.world().felled.includes('${tree.id}')`)) break;
  log('gnaw retry', await W());
}
log('felled?', await ev(`__game.world().felled.includes('${tree.id}')`), await W());
await sleep(1500);
const lg = JSON.parse(await ev(`JSON.stringify(__game.world().logs.find(l=>l.id==='${tree.id}')||null)`));
log('log', lg);
if (lg) {
  for (let i = 0; i < 4; i++) {
    await walk(lg.x, lg.z, 1.8 + i * 0.3); await tap('KeyG'); await sleep(1200);
    const w = await W(); log('grab try', i, w.drag, w.carry); if (w.drag === tree.id) break;
  }
}
const before = await W(); log('dragging', before.drag);
await walk(spot.x, spot.z, 2.5, 150000);
log('at spot', await W()); await tap('KeyE'); await sleep(3000); log('after Do', await W());
ws.close();
