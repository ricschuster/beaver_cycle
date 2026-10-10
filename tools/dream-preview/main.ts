// A page that shows the dream's candy land (dreamView.ts) for the art pass, not the game. Run `npm run dev` and open
// /tools/dream-preview/. Query: ?seed=N, &t=seconds (freezes the time), &yaw=degrees&pitch=degrees&dist=metres for the camera,
// &swim=1 (the beaver in the chocolate), &tag=1 (the first mallow is it, or
// &tag=player), &giggle=1 (the second mallow hides and giggles), &hop=1 (the mallows hop every second), &slap=1 (the beaver slaps its tail), &cycle=N (make and free N views first). Drag to turn the
// camera, wheel to zoom. Writes the draw calls and triangles to `window.dreamStats`.
import { createDreamView } from '../../src/render/dreamView';
import { createCameraRig } from '../../src/render/cameraRig';
import { CHOCOLATE_LEVEL, dreamHeight, newDream, type DreamEvent, type DreamLand, type DreamProp, type DreamState, type Mallow, type PropKind, type Sweet } from '../../src/sim/dream';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number): number => (q.has(k) ? Number(q.get(k)) : d);

/** A hand made dream, for when the sim cannot make one yet: a straight river, a path down to it, props, sweets and mallows. */
function fixture(seed: number): DreamState {
  const river = [];
  for (let x = -80; x <= 80; x += 2) river.push({ x, z: 12 + 4 * Math.sin(x / 15) });
  const path = [];
  for (let z = -30; z <= 6; z += 2) path.push({ x: 3 * Math.sin(z / 8), z });
  const kinds: PropKind[] = ['lollipop', 'gumdrop', 'candyCane', 'cupcake', 'iceCream', 'marshmallowRock'];
  const props: DreamProp[] = [];
  kinds.forEach((kind, k) => {
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      props.push({ id: `${kind}${i}`, kind, x: side * (5 + k * 3 + (i % 3)), z: -34 + i * 5 + k, size: 0.7 + ((i * 37) % 9) / 10, yaw: i * 1.3, colour: (i + k) % 7, hide: kind === 'cupcake' });
    }
  });
  const land: DreamLand = { seed, half: 80, path, river, riverWidth: 9, start: { x: 0, z: -30, heading: 0 }, props };
  const sweets: Sweet[] = [];
  path.forEach((p, i) => {
    if (i % 3 === 0) sweets.push({ id: `s${i}`, kind: i % 9 === 0 ? 'star' : i % 2 === 0 ? 'drop' : 'swirl', x: p.x, z: p.z, colour: i % 7, floating: false, taken: false });
  });
  for (let x = -20; x <= 20; x += 5) sweets.push({ id: `f${x}`, kind: x % 10 === 0 ? 'swirl' : 'drop', x, z: 12 + 4 * Math.sin(x / 15), colour: (x + 40) % 7, floating: true, taken: false });
  const names = ['Puff', 'Minty', 'Lemon', 'Sky', 'Lilac', 'Peachy', 'Snow', 'Fluff'];
  const mallows: Mallow[] = names.map((name, i) => ({
    id: `m${i}`,
    name,
    colour: i % 7,
    x: Math.cos(i) * (3 + i * 1.5),
    y: 1,
    z: -26 + Math.sin(i) * (3 + i),
    heading: i * 0.8,
    speed: 0,
    mode: 'walk',
    hopAt: null,
    slapAt: null,
    state: 'wander',
    giggleAt: null,
    met: false,
  }));
  return {
    land,
    time: 0,
    beaver: { x: 0, y: 1, z: -30, heading: 0, speed: 0, mode: 'walk', hopAt: null, slapAt: null },
    mallows,
    sweets,
    count: 0,
    rushUntil: 0,
    game: { kind: 'none' },
  };
}

const seed = num('seed', 1);
let state: DreamState;
try {
  state = newDream(seed);
} catch (err) {
  console.log('dream preview: newDream failed, using the fixture:', err instanceof Error ? err.message : err);
  state = fixture(seed);
}

const ground = (x: number, z: number): number => dreamHeight(state.land, x, z);
const b = state.beaver;
b.x = state.land.start.x;
b.z = state.land.start.z;
b.heading = state.land.start.heading;
if (q.get('swim') === '1') {
  // Into the chocolate at the end of the path, facing along the river.
  const end = state.land.path[state.land.path.length - 1]!;
  const mid = state.land.river.reduce((best, p) => (Math.hypot(p.x - end.x, p.z - end.z) < Math.hypot(best.x - end.x, best.z - end.z) ? p : best));
  b.x = mid.x;
  b.z = mid.z;
  b.mode = 'swim';
  b.speed = 1.5;
}
b.y = b.mode === 'swim' ? CHOCOLATE_LEVEL : ground(b.x, b.z);
// The mallows gather round the beaver, so a close view shows a few.
state.mallows.forEach((m, i) => {
  const a = b.heading + 0.9 + i * 0.75;
  const r = 2.2 + i * 1.1;
  m.x = b.x + Math.sin(a) * r;
  m.z = b.z + Math.cos(a) * r;
  m.heading = Math.atan2(b.x - m.x, b.z - m.z);
  const wet = dreamHeight(state.land, m.x, m.z) < CHOCOLATE_LEVEL;
  m.mode = wet ? 'swim' : 'walk';
  m.y = wet ? CHOCOLATE_LEVEL : ground(m.x, m.z);
});
if (q.has('tag')) {
  const it = q.get('tag') === 'player' ? 'player' : state.mallows[0]!.id;
  state.game = { kind: 'tag', it, players: state.mallows.map((m) => m.id), since: 0, ends: 60, catches: 0 };
}
const giggler = q.get('giggle') === '1' ? state.mallows[1] : undefined;
if (giggler) giggler.state = 'hidden';

const host = document.getElementById('view')!;
// ?cycle=N makes and throws away N views first, as N nights of dreams would, to check that nothing leaks.
for (let i = 0; i < num('cycle', 0); i++) {
  const v = createDreamView(host, state.land, { coat: i % 5, shade: 0 });
  v.draw(state, { yaw: 0, pitch: 0.3, dist: 6 }, []);
  v.dispose();
}
const view = createDreamView(host, state.land, { coat: 1, shade: 0 });
(window as unknown as { dreamView: unknown }).dreamView = view;
const rig = createCameraRig(view.canvas);
rig.view.yaw = q.has('yaw') ? (num('yaw', 0) * Math.PI) / 180 : b.heading + Math.PI;
rig.view.pitch = (num('pitch', 20) * Math.PI) / 180;
rig.view.dist = num('dist', 6.5);

const frozen = q.has('t') ? num('t', 0) : null;
const start = performance.now();
let frames = 0;
let lastSweet = 0;
function frame(): void {
  const time = frozen ?? (performance.now() - start) / 1000;
  state.time = time;
  const events: DreamEvent[] = [];
  // Every two seconds, take a sweet near the beaver, for the sparkle; and hop the mallows if asked.
  if (frozen === null && time - lastSweet > 2) {
    lastSweet = time;
    const s = state.sweets.filter((s) => !s.taken).sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z))[0];
    if (s && Math.hypot(s.x - b.x, s.z - b.z) < 25) {
      s.taken = true;
      events.push({ what: 'sweet', kind: s.kind, x: s.x, z: s.z });
    }
  }
  if (q.get('hop') === '1') for (const [i, m] of state.mallows.entries()) m.hopAt = Math.floor(time + i * 0.13) - i * 0.13;
  if (giggler) giggler.giggleAt = Math.floor(time / 1.5) * 1.5;
  if (q.get('slap') === '1') b.slapAt = Math.floor(time / 1.5) * 1.5;
  view.draw(state, rig.view, events);
  frames++;
  if (frames === 5) {
    (window as unknown as { dreamStats: unknown }).dreamStats = view.stats?.();
    const info = document.getElementById('info');
    if (info) info.textContent = `seed ${seed}: ${JSON.stringify(view.stats?.())}`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
