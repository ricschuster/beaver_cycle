// usage: node walk.mjs PORT tx tz [stopDist]   (guest walker via CDP)
const [port, tx, tz, stop = '12'] = process.argv.slice(2);
const list = await (await fetch(`http://localhost:${port}/json`)).json();
const ws = new WebSocket(list[0].webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); pend.get(m.id)?.(m); };
const send = (method, params) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async x => (await send('Runtime.evaluate', { expression: x, returnByValue: true })).result.result.value;
const key = (type) => send('Input.dispatchKeyEvent', { type, key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 });
const pos = () => ev('(()=>{const b=__game.world().beaver;return [b.x,b.z]})()');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const setYaw = y => ev(`__game.view().yaw=${y}`);
async function probe(yaw) { await setYaw(yaw); const a = await pos(); await key('keyDown'); await sleep(2500); await key('keyUp'); await sleep(300); const b = await pos(); return Math.atan2(b[0]-a[0], b[1]-a[1]); }
const a0 = await probe(0), a1 = await probe(0.8);
let d = a1 - a0; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI;
const sign = d > 0 ? 1 : -1;
console.log('calib', a0.toFixed(2), a1.toFixed(2), 'sign', sign);
await key('keyDown');
for (let i = 0; i < 1500; i++) {
  const p = await pos(); const dx = tx - p[0], dz = tz - p[1]; const dist = Math.hypot(dx, dz);
  if (dist < +stop) break;
  const want = Math.atan2(dx, dz); await setYaw((want - a0) * sign);
  if (i % 20 === 0) console.log(i, p.map(v => v | 0), 'dist', dist | 0);
  await sleep(300);
}
await key('keyUp'); console.log('arrived', await pos()); ws.close();
