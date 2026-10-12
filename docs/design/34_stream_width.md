# Stream width by kind

Part of #174. Every stream was a ribbon 2.5 m wide, so the Alm river looked like a brook.

## Rule

The tile tool gives each stream line a drawn width `w` in metres, and the renderer draws the ribbon that wide
(2.5 m when a tile has no `w`, as in tiles cut before this change).

| OSM line | Width |
| --- | --- |
| `width` tag, 0.5 to 40 m | the tag |
| a name in `NAMED_WIDTH_M` | Alm 10 m, Steyr and Salza 12 m, Steyrling 6 m, Aagbach 5 m; Straneggbach, Ostrawitzbach, Schwarzgraben and Grimming 3 m (OSM tags them `river` but they are brooks) |
| other `waterway=river` | 8 m |
| `waterway=stream`, `intermittent=yes` (most small streams) | 1.8 m |
| other `waterway=stream` | 2.5 m |

Only 12 lines carry a `width` tag. The numbers are a first guess, seen from above in a desktop render of the Alm, Aagbach, Straneggbach and two small streams (they looked right against a beaver); still to be judged on the tablet.

## Delta at a lake mouth

A stream whose last point lies within 1.5 m of its tile's lake level braids (`buildStreamGeometry`). Where the main channel is
60 m from the lake, up to three arms split off it. Each is a straight run, half as wide as the channel, to the nearest lake
land cover within 120 m, at least 0.35 radians from the main channel and from the other arms. An arm that finds no water is not
drawn. Renderer only, so no tile rebuild. At the Aagbach it gives four channels fanning into the two bays of the Almsee.
Seen from above in a desktop render, not yet on the tablet. The arms are straight, with no banks or islands.

## Not done

- Colour, banks and flow stay as they are until they are judged on the tablet (#174). The dark East-Oedseen water could not be reproduced on the desktop.
- The Aagbach delta: OSM has no delta shape, only thin lines. The delta above is made by rule, so it shows at every lake
  mouth and not only at the Aagbach.
- Wading and dam rules still use their own width (`STREAM_HALF_WIDTH` in `src/sim/haul.ts`).
