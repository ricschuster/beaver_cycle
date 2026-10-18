# Battery use and heat

Status: first measurements and the frame cap (session 150, #605). More levers are listed at the end and not built.

## The report

The author's phone got quite warm after 15 minutes of play. Other apps do not do that.

## What was measured

Pixel 9 Pro (120 Hz screen), the standalone release build, on battery, screen on, the beaver standing still in the open. Ten
minutes each, sampled every 30 s over Wi-Fi adb (`dumpsys battery`, `batterystats`, `gfxinfo`). One run per setting.

| | 120 Hz (no cap) | 60 Hz |
| --- | --- | --- |
| Battery temperature | 28.2 to 40.8 C (+12.6) | 32.3 to 35.7 C (+3.4) |
| Thermal status at the end | 1 (light) | 0 |
| Battery level | 72 to 67 % | 58 to 55 % |
| Frames presented | 69,305 (116 fps) | 35,866 (60 fps) |
| Game power (Android's model) | 105 mAh | 54.5 mAh |
| of which CPU, GPU, screen | 63, 26, 16 | 32, 11, 11 |
| Janky frames | 1.35 % | 0.05 % |

The cap build (`src/frameCap.ts`, a fresh save, the screen still at 120 Hz) gave 36,060 frames (60 fps), 35.3 to 36.2 C (+0.9),
thermal status 0, 44 mAh for the game (CPU 20, GPU 12, screen 12) and 2.5 % janky frames. The scene was a new game, not the
author's save, so the saving against the uncapped run (58 %) is probably a little high; the forced 60 Hz run on the real save gave
48 %. The author played it and the motion felt fine.

The 60 Hz run started 4 C warmer and still heated a quarter as much. The game drew at the screen rate with no idle mode, so a
120 Hz phone drew twice the frames of a 60 Hz one. The CPU share is the largest, which matches the desktop profile below.

## Where a frame goes (desktop, Almsee, shadows off)

- About 990,000 triangles in 456 draw calls per frame. `TerrainView.stats()` reports 2.5 million, which counts every loaded tile
  mesh, not only those in view.
- Trees and shrubs 38 % (near conifers 19 %, near broadleaf 13 %). Ground 62 %: three 2 m fine tiles of 53,760 triangles
  (16 %), 208 separate 20 m tiles of 768 each (16 %), merged far chunks (19 %), the 5 m and 10 m rings (9 %).
- Standing, walking and an open Settings panel cost the same. A desktop CPU is busy 20 % of the time at 60 fps, mostly three.js
  walking about 600 meshes (`projectObject`, `updateMatrixWorld`); the game's own logic is small.
- Pixel ratio 2 against 1 barely changed the GPU load, so a pixel ratio cap is a weak lever. Cutting triangles by 60 % did not
  change the uncapped fps on a desktop, which is limited by draw calls and the scene walk there.

## Decision: a frame cap of 60 fps

`src/frameCap.ts` skips the `requestAnimationFrame` calls that come early. 60 fps on a 120 Hz screen; every frame of a 60 Hz
screen; about 60 fps on a 90 Hz tablet, unevenly spaced (the tablet drew 43 to 48 fps with shadows anyway). `?fps=N` sets the cap
in dev builds and `?fps=0` lifts it, to compare.

## Not built yet, in order of value

1. Check the cap on the tablets (90 Hz spacing by eye). The phone is done.
2. Slower redraws when nothing moves (standing still, a panel open), and a Battery saver choice at 30 fps in Settings.
3. `matrixAutoUpdate = false` on the static tile meshes.
4. Fewer draw calls: merge the 208 coarse tile meshes the way the far chunks are.
5. Fewer near triangles: a shorter near tree range, 4 m cells for the fine tiles (ADR 0008; changes the look).
6. Measure a 30 Hz run, and a tablet, the same way.
