// usage: node hide.mjs HOSTPORT GUESTPORT   (host and guest within 4 m, both in the valley, not in a lodge)
// The host presses Do (Talk), taps Hide and seek? and I seek on the card; the guest sees the invitation and says Yes!, the game
// counts, the host holds W during the count and must stay put, then the guest (within 2 m) is found: prints the card, the count and
// the toast of each tablet at each step (#664). Keys: E is Do, W is forward.
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
  const key = (type, code) => send('Input.dispatchKeyEvent', { type, key: code.slice(3).toLowerCase(), code, windowsVirtualKeyCode: code.charCodeAt(3) });
  const tap = async (code) => { await key('keyDown', code); await new Promise((r) => setTimeout(r, 150)); await key('keyUp', code); await new Promise((r) => setTimeout(r, 600)); };
  const card = () => ev("(()=>{const c=document.getElementById('talk-bubble');return c&&c.style.display!=='none'?c.innerText.replace(/\\n+/g,' / '):null})()");
  const choose = (label) => ev(`(()=>{const b=[...document.querySelectorAll('#talk-bubble button')].find((x)=>x.textContent.trim()==${JSON.stringify(label)});b?.click();return !!b})()`);
  const toast = () => ev("document.getElementById('toast')?.textContent");
  const count = () => ev("(()=>{const c=document.getElementById('hide-count');return c&&c.style.display!=='none'?c.textContent:null})()");
  const pos = () => ev('JSON.stringify([__game.world().beaver.x,__game.world().beaver.z].map((v)=>Math.round(v*10)/10))');
  return { ev, tap, key, card, choose, toast, count, pos };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const host = await open(hostPort);
const guest = await open(guestPort);
await host.tap('KeyE');
console.log('host card:', await host.card());
console.log('host picks:', await host.choose('Hide and seek?'));
await wait(500);
console.log('host card:', await host.card());
console.log('host picks:', await host.choose('I seek'));
await wait(1200);
console.log('guest card:', await guest.card());
console.log('guest answers:', await guest.choose('Yes!'));
await wait(1500);
console.log('count host:', await host.count(), '/ guest:', await guest.count(), '/ toast host:', await host.toast(), '/ guest:', await guest.toast());
const before = await host.pos();
await host.key('keyDown', 'KeyW');
await wait(3000);
await host.key('keyUp', 'KeyW');
console.log('host held W for 3 s during the count, moved from', before, 'to', await host.pos());
await wait(9000);
console.log('after the count, host:', await host.count(), '/ toast:', await host.toast(), '/ guest:', await guest.toast());
await wait(3000);
console.log('later host toast:', await host.toast(), '/ guest toast:', await guest.toast(), '/ count host:', await host.count(), '/ guest:', await guest.count());
process.exit(0);
