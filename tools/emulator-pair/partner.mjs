// usage: node partner.mjs HOSTPORT GUESTPORT   (host an adult, guest within 4 m of it, no food in either mouth)
// The host asks the guest to be partners with Do, the guest says yes with Do (#666). Reads the toast of each tablet. Keys: E is Do.
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
    await new Promise((r) => setTimeout(r, 600));
  };
  return { ev, tap };
}
const host = await open(hostPort);
const guest = await open(guestPort);
const say = (p) => p.ev("document.getElementById('toast')?.textContent");
const doLabel = (p) => p.ev("[...document.querySelectorAll('button')].map((b) => b.textContent).filter((t) => /Do|Partners/.test(t)).join('|')");
console.log('host Do reads', await doLabel(host), '/ guest Do reads', await doLabel(guest));
await host.tap('KeyE');
console.log('host asked: host toast', await say(host), '/ guest toast', await say(guest));
console.log('guest Do reads', await doLabel(guest));
await guest.tap('KeyE');
console.log('guest said yes: host toast', await say(host), '/ guest toast', await say(guest));
console.log('host Do reads', await doLabel(host));
process.exit(0);
