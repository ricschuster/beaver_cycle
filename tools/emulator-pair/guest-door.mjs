// usage: node guest-door.mjs PORT LODGEX LODGEZ DOOR   (a guest standing a few metres out from the door of its pair lodge)
// Steers toward the lodge centre with W and holds Space (dive) until the guest is inside, then prints where it ended. The door of a
// lodge is dived into (guests.ts), so a swimmer on the surface only circles the dome.
const [port, tx, tz, door] = process.argv.slice(2).map((v, i) => (i === 0 ? v : +v));
const list = await (await fetch(`http://localhost:${port}/json`)).json();
const ws = new WebSocket(list[0].webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); pend.get(m.id)?.(m); };
const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true })).result.result.value;
const key = (type, code, vk) => send('Input.dispatchKeyEvent', { type, key: code === 'Space' ? ' ' : 'w', code: code === 'Space' ? 'Space' : 'KeyW', windowsVirtualKeyCode: vk });
const pos = () => ev('(()=>{const b=__game.world().beaver;return [b.x,b.z]})()');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const setYaw = (y) => ev(`__game.view().yaw=${y}`);
async function probe(yaw) { await setYaw(yaw); const a = await pos(); await key('keyDown', 'W', 87); await sleep(1500); await key('keyUp', 'W', 87); await sleep(300); const b = await pos(); return Math.atan2(b[0] - a[0], b[1] - a[1]); }
const a0 = await probe(0), a1 = await probe(0.8);
let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
const sign = d > 0 ? 1 : -1;
const inside = () => ev('__game.world().inLodge');
// The probe moved the guest, so first swim to a point 5 m out along the door, then dive in toward the centre.
const stage = [tx + 5 * Math.sin(door), tz + 5 * Math.cos(door)];
await key('keyDown', 'W', 87);
for (let i = 0; i < 80; i++) {
  const p = await pos();
  if (Math.hypot(stage[0] - p[0], stage[1] - p[1]) < 0.8) break;
  await setYaw((Math.atan2(stage[0] - p[0], stage[1] - p[1]) - a0) * sign);
  await sleep(250);
}
await key('keyUp', 'W', 87);
await sleep(500);
await key('keyDown', 'W', 87);
await key('keyDown', 'Space', 32);
for (let i = 0; i < 160 && !(await inside()); i++) {
  const p = await pos();
  // Aim at the door point first (the dome is solid around it), and at the centre once at the door.
  const at = [tx + 2.9 * Math.sin(door), tz + 2.9 * Math.cos(door)];
  const near = Math.hypot(at[0] - p[0], at[1] - p[1]) < 1.2;
  const aim = near ? [tx, tz] : at;
  await setYaw((Math.atan2(aim[0] - p[0], aim[1] - p[1]) - a0) * sign);
  if (i % 8 === 0) console.log(i, 'door', Math.hypot(at[0] - p[0], at[1] - p[1]).toFixed(1), p.map((v) => +v.toFixed(1)), await ev('__game.world().beaver.mode'));
  await sleep(100);
}
await key('keyUp', 'Space', 32); await key('keyUp', 'W', 87);
console.log('inside', await inside(), await pos());
ws.close();
