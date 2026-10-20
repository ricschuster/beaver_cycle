// usage: node cdp.mjs PORT navigate URL | eval EXPR
const [port, cmd, arg] = process.argv.slice(2);
const list = await (await fetch(`http://localhost:${port}/json`)).json();
const ws = new WebSocket(list[0].webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const send = (method, params) => new Promise(res => { const i = ++id; const h = e => { const m = JSON.parse(e.data); if (m.id === i) { ws.removeEventListener('message', h); res(m); } }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id: i, method, params })); });
const r = cmd === 'navigate' ? await send('Page.navigate', { url: arg }) : await send('Runtime.evaluate', { expression: arg, returnByValue: true, awaitPromise: true });
console.log(JSON.stringify(r.result ?? r).slice(0, 1500));
ws.close();
