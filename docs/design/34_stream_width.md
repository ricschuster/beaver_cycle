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

## Not done

- Colour, banks and flow stay as they are until the dark East-Oedseen water is understood (#174).
- The Aagbach delta: OSM has no delta shape, only thin lines. It comes after this is seen on the tablet.
- Wading and dam rules still use their own width (`STREAM_HALF_WIDTH` in `src/sim/haul.ts`).
