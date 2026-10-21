// usage: node pair-lodge.mjs HOSTPORT GUESTPORT   (host and guest are partners, side by side, a lodge site ahead of the host)
// Puts a log at the feet of whoever builds next (a dev build can edit the world), the host takes one and builds, the guest takes one and builds, until
// the lodge of the pair is whole (#666). Keys: G is Take, E is Do.
const [hostPort, guestPort] = process.argv.slice(2);
async function open(port) {
  const list = await (await fetch(`http://localhost:${port}/json`)).json();
  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); pend.get(m.id)?.(m); };
  const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true })).result.result.value;
  const tap = async (code) => {
    const k = { key: code.slice(3).toLowerCase(), code, windowsVirtualKeyCode: code.charCodeAt(3) };
    await send('Input.dispatchKeyEvent', { type: 'keyDown', ...k });
    await new Promise((r) => setTimeout(r, 150));
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...k });
    await new Promise((r) => setTimeout(r, 500));
  };
  return { ev, tap };
}
const host = await open(hostPort);
const guest = await open(guestPort);
const state = async () => JSON.parse(await host.ev('JSON.stringify({pair: __game.world().pairLodges.map((l) => [l.players, l.wood, !!l.wear]), logs: __game.world().logs.length, drag: __game.world().drag, lodge: __game.world().lodge, former: __game.world().formerHomes.length})'));
console.log('start', JSON.stringify(await state()));
const drop = async (n, p) => { const b = JSON.parse(await p.ev('JSON.stringify(__game.world().beaver)')); return host.ev(`(() => { const w = __game.world(); for (let i = 0; i < ${n}; i++) w.logs.push({ id: 'test:' + Date.now() + ':' + i, x: ${b.x + 1}, y: __game.groundAt(${b.x + 1}, ${b.z}), z: ${b.z}, heading: 0, length: 6, floating: false, at: 0 }); return w.logs.length; })()`); };
for (let round = 0; round < 8; round++) {
  const who = round % 2 === 0 ? host : guest;
  // Take reads Drop while the mouth is full (as for the host), so a branch in the mouth goes down first.
  if (await who.ev('__game.world().carry')) await who.tap('KeyG');
  await drop(1, who);
  await who.tap('KeyG');
  await who.tap('KeyE');
  console.log(round, round % 2 === 0 ? 'host' : 'guest', JSON.stringify(await state()));
  if ((await state()).pair[0]?.[1] >= 10) break;
}
process.exit(0);
