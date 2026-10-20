// usage: node gift.mjs HOSTPORT GUESTPORT   (host standing by lily pads, adult; guest next to it)
// Host takes a pad, hands it to the guest with Do; the guest hands it back with Do (#663).
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
    await new Promise((r) => setTimeout(r, 400));
  };
  return { ev, tap };
}
const host = await open(hostPort);
const guest = await open(guestPort);
const mouth = async (p) => p.ev('JSON.stringify([__game.world().carry, __game.world().haul])');
const dist = async () => {
  const a = JSON.parse(await host.ev('JSON.stringify([__game.world().beaver.x,__game.world().beaver.z])'));
  const b = JSON.parse(await guest.ev('JSON.stringify([__game.world().beaver.x,__game.world().beaver.z])'));
  return Math.hypot(a[0] - b[0], a[1] - b[1]).toFixed(1);
};
console.log('distance', await dist());
console.log('host mouth', await mouth(host));
await host.tap('KeyG');
console.log('host after Take', await mouth(host));
await host.tap('KeyE');
console.log('host after Do (give)', await mouth(host), 'guest', await mouth(guest));
await guest.tap('KeyE');
console.log('guest Do back: host', await mouth(host), 'guest', await mouth(guest));
await host.tap('KeyG');
console.log('host drops: host', await mouth(host), 'dropped', await host.ev('__game.world().dropped.length'));
await guest.tap('KeyG');
console.log('guest takes it: guest', await mouth(guest), 'dropped', await host.ev('__game.world().dropped.length'));
process.exit(0);
