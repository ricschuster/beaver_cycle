# Shadow cost on the tablet

Status: measured. **Decided for now (session 73): shadows are off by default**, `?shadows=1` turns them on; a plain
sun light keeps the shading following the sun. The question of a better look at a good cost stays open (below). Written in session 21 after the first
tablet run of the cascaded shadows (M4, #117), when the default was two
cascades (#120, closed).

## What was measured

Samsung Tab A9+ (90 Hz screen), `tools/tablet-live/bench.mjs`, the `scenarios`
and `lakes` modes. Frames per second, rounded. Nothing else changed between
columns, and the seasonal ground tint was in all of them.

| Place | Default (2 cascades) | `?cascades=1` | `?shadows=0` |
| --- | --- | --- | --- |
| Start, idle | 43 | 59 | 86 |
| Jump core | 48 | 58 | 90 |
| Walk x1 in core | 48 | 57 | 90 |
| Lake: almsee | 40 | 54 | 90 |
| Lake: alm-river-outflow | 48 | 63 | 90 |
| Lake: south-shore-bog | 49 | 63 | 90 |

- Worst frames: 45 to 56 ms by default, 33 to 45 ms with one cascade, 11 ms
  without shadows. The worst by default is almsee, the main lake.
- Shadow map size does not help: `?shadowmap=1024` gave 44 fps for the walk in
  core with two cascades (48 at 2048) and 57 with one (also 57 at 2048).
- Without shadows every lake place is at the 90 Hz cap, so the spikes in #110
  are not coming from the world alone.

## Why it costs this much

Each cascade is a shadow map, and drawing a map draws the casters again from
the sun. About 1.9 million triangles are in view in core, mostly ground tiles
and trees, so each extra cascade costs roughly 15 fps. The tablet is limited by
how much geometry goes into the maps, not by the size of the maps.

## Options

These are alternatives, not steps. They trade look against cost.

1. **One cascade as the default** (`?cascades=1` already does this). About 55
   to 65 fps, one line to change, and the near shadow stays sharp. Gives up the
   shadows that far hills and far trees throw over the valley. Measured.
2. **Both cascades, with less casting into the far one.** Only trees and the
   beaver would cast in the far cascade, and the ground would not. Cheaper,
   but the hill shadows come from the ground casting, so this loses them too
   and keeps only far tree shadows. Not simple: three.js sets `castShadow`
   for all of a light's passes at once, so a per cascade choice needs a hook or
   a filter. Not tried. A cost close to option 1 is a guess, not a result.
3. **Cast from a coarser copy of the ground.** Keeps the hill shadows with far
   fewer triangles in the maps. Needs a second mesh per tile, built and stored,
   so it is the most work. Not tried.
4. **Shadows off by default**, with a setting. Full speed, flat light. Mostly
   useful as the lowest tier of a quality setting, if there is one. This is the
   one chosen in session 73 (#336), with a plain sun light so the light is not flat.

## Later

The author expects to weigh tradeoffs over a range of things, not shadows
alone. The same kind of choice (look against frames on the tablet) shows up in
the tree count, the tile rings, the fine tile ring (ADR 0008), the water, and
the seasons. Rather than decide each in turn, collect them in one budget:
what the tablet can carry, what each feature costs, and what is worth it. Then
decide whether shadows come back on by default, and whether to try options 2
and 3, with that table in front of us.

Until then shadows stay off by default, and the switches in the M4 note
(`?shadows=1`, `?cascades=1`, `?shadowmap=`) are the way to compare. Repeat the
`scenarios` and `lakes` benchmarks when the scene gets heavier, for example
with seasonal trees (#105 art pass) or a lodge (M5).

Tracked in #120, and related to #110 (frame spikes) and #114
(tuning).
