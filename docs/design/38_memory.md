# Memory use and leaks (#604)

Measured with `tests/e2e/memory.spec.ts`: the test menu jumps through the six locations again and again, so tiles stream in and
out, and after each lap it forces a garbage collection and reads the JS heap (Chrome DevTools protocol), the GPU object counts of
three.js (`renderer.memory()`), and the bytes of ground held (`TileStore.bytesByLevel()`). `MEMORY_LAPS=n` sets the laps (3),
`MEMORY_REPORT=file` keeps the table, `MEMORY_GROUPS=1` prints the size of each top level scene child, which is how a growing
object shows up. Desktop GPU Chromium, real valley tiles.

## Measured (8 laps, 6 locations each, 6 s at each)

| What | Lap 1 | Lap 8 | Reading |
| --- | --- | --- | --- |
| JS heap after GC | 34.8 MB | 37.4 MB | peak 37.4 MB; creeps about 0.2 MB a lap |
| Ground held (heights and classes) | 2.9 MB | 2.9 MB | flat; the tile store is small |
| Textures / shader programs | 6 / 18 | 6 / 19 | flat |
| Geometries on the GPU | 845 | 1099 | climbs as meshes are first seen, bounded by the scene |
| Geometries in the scene | 1429 | 1507 | three beaver sized groups more, see below |
| Draw calls / triangles per frame | 363 / 1.15 M | same | same |

The terrain tiles are not the leak: a tile mesh changes level and its old geometry is disposed (`disposeGroup`), the far chunks
are built once, and the shared tree and shrub geometries are never rebuilt.

## What grew, and what was done

- The scene gains a few model groups over many laps. The animal view keeps spare models per kind and takes one back when an animal
  leaves, so it climbs to a high water mark (most animals near at once) and stops. This is not a leak.
- The other beavers and the parents keep one model per id. A kit's id carries the year (`family:3:kit:7:0`), so every game year
  brought new ids and the old models stayed in the scene for good. They are now handed back to a spare pool and taken by the
  next new id (`recycle` in `src/render/renderer.ts`). The tour runs at normal speed, so no game year passes in it and the
  soak does not show this; it follows from reading the code.

## Budget

Until a tablet is measured: JS heap under 60 MB after a collection, ground data under 10 MB, textures under 12, shader programs
under 30, and over a long tour no growth beyond the pools' high water marks. The test holds the heap to +15 % between the first
and last lap, textures to +5, programs to +3, and the scene's geometries to +150.

## Not done

- A tablet run, and the process size (the WebView's GPU and native memory are not in the JS heap; measure with
  `dumpsys meminfo` as in `37_battery_and_heat.md`).
- A byte cap on the tile cache: the 5 m ring is level 2 and never dropped, and the whole ground is under 3 MB, so there is
  nothing to cap yet.
- Android memory pressure (`onTrimMemory`): with this little held, dropping tiles would gain almost nothing. The GPU and the
  WebView are the likely users; measure first.
- Garbage per frame in the sim and render loops.
- Years of play (a generation change, a dream ending) are not in the tour; the next soak should run at a high game speed.
