// usage: node talk.mjs HOSTPORT GUESTPORT   (host and guest within 4 m, any age)
// The host presses Do (Talk) and taps a question on the card, the guest sees the question with Yes and Not now and answers, and the
// host reads the answer in its toast. Then the guest asks and the host answers (#667). Keys: E is Do.
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
  const card = () => ev("(()=>{const c=document.getElementById('talk-bubble');return c&&c.style.display!=='none'?c.innerText.replace(/\\n+/g,' / '):null})()");
  const choose = (label) => ev(`(()=>{const b=[...document.querySelectorAll('#talk-bubble button')].find((x)=>x.textContent.trim()==${JSON.stringify(label)});b?.click();return !!b})()`);
  const toast = () => ev("document.getElementById('toast')?.textContent");
  const label = () => ev("[...document.querySelectorAll('button')].map((b)=>b.textContent.trim()).filter((t)=>/^(Do|Talk)$/.test(t)).join('|')");
  return { ev, tap, card, choose, toast, label };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const host = await open(hostPort);
const guest = await open(guestPort);
console.log('host Do reads', await host.label(), '/ guest Do reads', await guest.label());
await host.tap('KeyE');
console.log('host card:', await host.card());
console.log('host asks:', await host.choose('Shall we swim together?'));
await wait(800);
console.log('guest card:', await guest.card(), '/ host toast:', await host.toast());
console.log('guest answers:', await guest.choose('Yes!'));
await wait(4500);
console.log('host toast:', await host.toast());
await guest.tap('KeyE');
console.log('guest card:', await guest.card());
console.log('guest asks:', await guest.choose('Want to play?'));
await wait(800);
console.log('host card:', await host.card());
console.log('host answers:', await host.choose('Not now'));
await wait(4500);
console.log('guest toast:', await guest.toast());
process.exit(0);
