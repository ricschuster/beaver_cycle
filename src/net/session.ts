// The two ends of a connection on the WLAN (ADR 0014, #678): the host listens through the HostServer plugin of the app, a guest
// opens a WebSocket to the host's IP. Both pass plain text; `room.ts` and `protocol.ts` decide what it means.
import { PORT, readToGuest, type Snapshot, type ToHost } from './protocol';
import type { HomeSite, Room } from './room';
import type { Terrain } from '../sim/terrain';

interface HostPlugin {
  start(o: { port: number }): Promise<{ ip: string; port: number }>;
  send(o: { text: string; to?: string }): Promise<void>;
  stop(): Promise<void>;
  addListener(name: 'open' | 'close' | 'message' | 'error', fn: (e: { id?: string; text?: string; error?: string }) => void): Promise<unknown>;
}

/** The HostServer plugin, when this is the app that has it; a browser cannot host. */
export function hostPlugin(): HostPlugin | null {
  return (window as unknown as { Capacitor?: { Plugins?: { HostServer?: HostPlugin } } }).Capacitor?.Plugins?.HostServer ?? null;
}

/** True in a browser and in the app that hosts; false in the Play bundle, an app with no networking, where Join could only fail. */
export function canPlayTogether(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return hostPlugin() !== null || !cap?.isNativePlatform?.();
}

/** What the host session needs from the game each time a message comes in. */
export interface HostGame {
  hostAt(): { x: number; z: number };
  terrain: Terrain;
  /** The lodges of the starting families, which a guest may take as its home (the host's own lodge is not one). */
  homes?(): HomeSite[];
  /** The clock the host beaver was born at, so a guest starts as old as the host. */
  bornAt?(): number;
}

/** Starts listening and feeds the room. Resolves with the address to show, or rejects when this app cannot host. */
export async function startHosting(room: Room, game: HostGame, log: (s: string) => void): Promise<{ ip: string; port: number }> {
  const plugin = hostPlugin();
  if (!plugin) throw new Error('This app cannot host: no HostServer plugin (a browser can only join).');
  await plugin.addListener('open', (e) => {
    room.open(e.id!, performance.now() / 1000);
    log(`${e.id} connected`);
  });
  await plugin.addListener('close', (e) => {
    room.leave(e.id!);
    log(`${e.id} left`);
  });
  await plugin.addListener('message', (e) => room.receive(e.id!, e.text!, performance.now() / 1000, game.hostAt(), game.terrain, game.homes?.(), game.bornAt?.()));
  await plugin.addListener('error', (e) => log(`server error ${e.error}`));
  return plugin.start({ port: PORT });
}

/** Sends text to one guest or, without `to`, to all. The room's way out. */
export function hostSender(): (to: string, text: string) => void {
  const plugin = hostPlugin();
  return (to, text) => void plugin?.send({ to, text });
}

/** A guest's connection: the id the host gave, the latest state, and a way to send what the player wants. */
export interface GuestLink {
  /** Null until the host welcomes this guest. */
  id: string | null;
  /** The newest state, taken once by `take`. */
  take(): Snapshot | null;
  send(m: ToHost): void;
  status(): 'connecting' | 'open' | 'closed' | 'failed';
  close(): void;
}

/** How long a guest waits before it tries the host again after the link closed (a sleep, a Wi-Fi gap). */
export const RECONNECT_MS = 2000;

export function joinHost(ip: string, hello: ToHost): GuestLink {
  let id: string | null = null;
  let latest: Snapshot | null = null;
  let state: 'connecting' | 'open' | 'closed' | 'failed' = 'connecting';
  let ws: WebSocket | null = null;
  let everOpen = false;
  let leaving = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const connect = () => {
    timer = null;
    let w: WebSocket;
    try {
      w = new WebSocket(`ws://${ip}:${PORT}`);
    } catch {
      state = 'failed';
      return;
    }
    ws = w;
    w.onopen = () => {
      everOpen = true;
      state = 'open';
      w.send(JSON.stringify(hello));
    };
    w.onerror = () => {
      if (state === 'connecting' && !everOpen) state = 'failed';
    };
    w.onclose = () => {
      if (w !== ws || leaving) return;
      if (state === 'failed') return;
      // Never reached the host: the address is wrong. After a good link, the host seats the same hello again, so try again.
      if (!everOpen) {
        state = 'failed';
        return;
      }
      state = 'closed';
      id = null;
      timer = setTimeout(connect, RECONNECT_MS);
    };
    w.onmessage = (ev) => {
      const m = readToGuest(String(ev.data));
      if (m?.t === 'welcome') id = m.id;
      else if (m?.t === 'state') latest = m.snapshot;
    };
  };
  connect();
  return {
    get id() {
      return id;
    },
    take() {
      const s = latest;
      latest = null;
      return s;
    },
    send(m) {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
    },
    status: () => state,
    close() {
      leaving = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    },
  };
}
