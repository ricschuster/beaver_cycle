// Autopilot and frame statistics for the tablet test. Injected into the camera
// demo copy in www/. It walks the beaver in a loop and logs a BENCH line every
// 5 s (read with adb logcat). Throwaway.
while (!window.__demo) await new Promise(r => setTimeout(r, 200));
const D = window.__demo;
const hud = document.createElement('div');
hud.style.cssText = 'position:fixed;right:8px;top:8px;background:#000a;color:#fff;font:12px monospace;padding:6px 8px;border-radius:6px;z-index:9;white-space:pre';
document.body.appendChild(hud);
const times = [];
const modes = [1, 2, 4, 3];
let last = performance.now(), t0 = last, lastLog = last, posAt = [D.st.x, D.st.z], turnUntil = 0, turnKey = 'a';
function tick(now) {
  times.push(now - last); last = now;
  const m = modes[Math.floor((now - t0) / 30000) % modes.length];
  if (D.cam.mode !== m) D.setMode(m);
  D.keys.add('w');
  if (now > turnUntil && Math.random() < 0.01) { turnKey = Math.random() < 0.5 ? 'a' : 'd'; turnUntil = now + 400 + Math.random() * 600; }
  if (now < turnUntil) { D.keys.add(turnKey); D.keys.delete(turnKey === 'a' ? 'd' : 'a'); } else { D.keys.delete('a'); D.keys.delete('d'); }
  if (now - lastLog > 5000) {
    const s = times.slice().sort((a, b) => a - b);
    const avg = s.reduce((a, b) => a + b, 0) / s.length;
    const r = {
      t: Math.round((now - t0) / 1000), mode: D.cam.mode, fps: +(1000 / avg).toFixed(1), p50: +s[Math.floor(s.length * 0.5)].toFixed(1),
      p95: +s[Math.floor(s.length * 0.95)].toFixed(1), max: +s[s.length - 1].toFixed(1),
      heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1,
      x: Math.round(D.st.x), z: Math.round(D.st.z), dpr: devicePixelRatio, w: innerWidth, h: innerHeight,
    };
    hud.textContent = `fps ${r.fps}  p95 ${r.p95} ms\nheap ${r.heapMB} MB\n${r.w}x${r.h} @${r.dpr}`;
    console.log('BENCH ' + JSON.stringify(r));
    if (Math.hypot(D.st.x - posAt[0], D.st.z - posAt[1]) < 10) { D.keys.add('r'); D.teleport(D.start[0], D.start[1]); }
    posAt = [D.st.x, D.st.z]; times.length = 0; lastLog = now;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
