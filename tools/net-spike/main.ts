// Throwaway spike for #662: a host tablet runs a tiny world, a guest sends where it wants to go and sees both dots move.
// The host is the Capacitor app (HostServer plugin, tools/host-server); a guest is any browser or the same app.
// Measures the round trip of a ping and how often state arrives.

interface HostPlugin {
  start(o: { port: number }): Promise<{ ip: string; port: number }>;
  send(o: { text: string; to?: string }): Promise<void>;
  addListener(name: 'open' | 'close' | 'message' | 'error', fn: (e: { id?: string; text?: string; error?: string }) => void): Promise<unknown>;
}
const plugin = (window as unknown as { Capacitor?: { Plugins?: { HostServer?: HostPlugin } } }).Capacitor?.Plugins?.HostServer;
const PORT = 8765;
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const logEl = $('log');
const log = (s: string): void => {
  logEl.textContent = (s + '\n' + logEl.textContent).slice(0, 1500);
};
const canvas = $<HTMLCanvasElement>('c');
const g = canvas.getContext('2d')!;

interface Dot { x: number; y: number; vx: number; vy: number }
type World = Record<string, Dot>;
let world: World = {};
let me = '';

function draw(): void {
  g.clearRect(0, 0, canvas.width, canvas.height);
  for (const [id, d] of Object.entries(world)) {
    g.fillStyle = id === me ? '#ffd24a' : id === 'host' ? '#fff' : '#6cf';
    g.beginPath();
    g.arc(d.x, d.y, 14, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#000';
    g.fillText(id, d.x - 6, d.y + 4);
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// The player's wish, from dragging on the canvas: a direction -1..1.
let wish = { x: 0, y: 0 };
canvas.addEventListener('pointermove', (e) => {
  if (!e.buttons && e.pointerType === 'mouse') return;
  const r = canvas.getBoundingClientRect();
  const px = ((e.clientX - r.left) / r.width) * canvas.width;
  const py = ((e.clientY - r.top) / r.height) * canvas.height;
  const d = world[me];
  if (!d) return;
  const dx = px - d.x;
  const dy = py - d.y;
  const l = Math.hypot(dx, dy) || 1;
  wish = l < 10 ? { x: 0, y: 0 } : { x: dx / l, y: dy / l };
});
canvas.addEventListener('pointerup', () => (wish = { x: 0, y: 0 }));

function stepWorld(w: World, wishes: Record<string, { x: number; y: number }>, dt: number): void {
  for (const [id, d] of Object.entries(w)) {
    const s = wishes[id] ?? { x: 0, y: 0 };
    d.x = Math.max(14, Math.min(canvas.width - 14, d.x + s.x * 120 * dt));
    d.y = Math.max(14, Math.min(canvas.height - 14, d.y + s.y * 120 * dt));
  }
}

function host(): void {
  if (!plugin) return log('No HostServer plugin here: a browser cannot host.');
  const wishes: Record<string, { x: number; y: number }> = { host: { x: 0, y: 0 } };
  world = { host: { x: 100, y: 100, vx: 0, vy: 0 } };
  me = 'host';
  let received = 0;
  void plugin.addListener('open', (e) => {
    world[e.id!] = { x: 200, y: 200, vx: 0, vy: 0 };
    wishes[e.id!] = { x: 0, y: 0 };
    log(`guest ${e.id} joined`);
    void plugin.send({ to: e.id!, text: JSON.stringify({ t: 'hello', id: e.id }) });
  });
  void plugin.addListener('close', (e) => {
    delete world[e.id!];
    delete wishes[e.id!];
    log(`guest ${e.id} left`);
  });
  void plugin.addListener('error', (e) => log('error ' + e.error));
  void plugin.addListener('message', (e) => {
    received++;
    const m = JSON.parse(e.text!) as { t: string; x?: number; y?: number; n?: number };
    if (m.t === 'wish') wishes[e.id!] = { x: m.x!, y: m.y! };
    else if (m.t === 'ping') void plugin.send({ to: e.id!, text: e.text! });
  });
  void plugin.start({ port: PORT }).then((r) => {
    log(`hosting at ${r.ip}:${r.port}`);
    $('menu').textContent = `Hosting at ws://${r.ip}:${r.port}`;
  }, (err) => log('start failed ' + err));
  // The host's own dot follows the host's drag.
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    wishes.host = wish;
    stepWorld(world, wishes, (now - last) / 1000);
    last = now;
  }, 33);
  setInterval(() => void plugin.send({ text: JSON.stringify({ t: 'state', world }) }), 50);
  setInterval(() => {
    log(`messages in per second: ${received}`);
    received = 0;
  }, 1000);
}

function join(ip: string): void {
  let ws: WebSocket;
  try {
    ws = new WebSocket(`ws://${ip}:${PORT}`);
  } catch (err) {
    return log(`cannot open the socket from ${location.origin}: ${err}`);
  }
  let states = 0;
  const rtts: number[] = [];
  ws.onopen = () => log('connected');
  ws.onerror = () => log('connection error');
  ws.onclose = () => log('closed');
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data as string) as { t: string; id?: string; world?: World; ts?: number };
    if (m.t === 'hello') me = m.id!;
    else if (m.t === 'state') {
      world = m.world!;
      states++;
    } else if (m.t === 'ping') rtts.push(performance.now() - m.ts!);
  };
  setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ t: 'wish', ...wish })), 33);
  setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ t: 'ping', ts: performance.now() })), 500);
  setInterval(() => {
    const sorted = [...rtts].sort((a, b) => a - b);
    log(`states/s ${states}, rtt median ${sorted[sorted.length >> 1]?.toFixed(1)} ms, max ${sorted.at(-1)?.toFixed(1)} ms`);
    states = 0;
    rtts.length = 0;
  }, 2000);
}

$('host').onclick = host;
$('join').onclick = () => join($<HTMLInputElement>('ip').value.trim());
const q = new URLSearchParams(location.search);
if (q.get('join')) join(q.get('join')!);
if (q.get('host') === '1') host();
