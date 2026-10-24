// Lets a laptop browser host for tablets on the WLAN (ADR 0014, amended). The tablets open ws://<laptop-ip>:8765 as they do
// to a tablet host; the game page opens ws://localhost:8766 (?hostbridge=1 on the dev server) and gets what the HostServer
// plugin of the app would give it. Dev tool, no discovery, one host page at a time.
import { networkInterfaces } from 'node:os';
import { WebSocketServer } from 'ws';

const GUEST_PORT = Number(process.env.GUEST_PORT ?? 8765);
const HOST_PORT = Number(process.env.HOST_PORT ?? 8766);

function lanIp() {
  for (const list of Object.values(networkInterfaces()))
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) return a.address;
  return '127.0.0.1';
}

let page = null;
let nextId = 1;
const guests = new Map();
const toPage = (m) => {
  if (page && page.readyState === 1) page.send(JSON.stringify(m));
};

const guestServer = new WebSocketServer({ port: GUEST_PORT });
guestServer.on('connection', (ws) => {
  const id = `g${nextId++}`;
  guests.set(id, ws);
  toPage({ t: 'open', id });
  console.log(`${id} connected`);
  ws.on('message', (data) => toPage({ t: 'message', id, text: data.toString() }));
  ws.on('close', () => {
    guests.delete(id);
    toPage({ t: 'close', id });
    console.log(`${id} left`);
  });
  ws.on('error', () => {});
});

// Only this machine may be the host page.
const hostServer = new WebSocketServer({ port: HOST_PORT, host: '127.0.0.1' });
hostServer.on('connection', (ws) => {
  if (page) page.close();
  page = ws;
  ws.send(JSON.stringify({ t: 'ip', ip: lanIp(), port: GUEST_PORT }));
  // The new page has no guests yet, so seat the ones already connected; their hello comes again on a reconnect.
  for (const [id, g] of guests) g.close();
  console.log('host page connected');
  ws.on('message', (data) => {
    let m;
    try {
      m = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (m.t !== 'send' || typeof m.text !== 'string') return;
    if (m.to) guests.get(m.to)?.send(m.text);
    else for (const g of guests.values()) g.send(m.text);
  });
  ws.on('close', () => {
    if (page === ws) page = null;
    console.log('host page left');
  });
  ws.on('error', () => {});
});

console.log(`Tablets join ws://${lanIp()}:${GUEST_PORT}; the host page is ?hostbridge=1 on the dev server. Allow port ${GUEST_PORT} in the firewall.`);
