# Game length and movement speed

Started after the camera and world size decisions (ADR 0005, ADR 0006). Game
length is still being worked out, so this note records what is decided and
what is open.

## Movement speed

Decided by the author after trying the camera demo, which used 4.5 m/s on
land, 7 m/s swimming, and 5.5 m/s diving: a little faster than that.

| Movement | Starting value |
| --- | --- |
| Land | 6 m/s |
| Swimming | 9 m/s |
| Diving | 7 m/s |

These are starting values to tune on a tablet, not fixed numbers. A real
beaver is much slower, roughly 1 to 2 m/s swimming and slower on land (from
memory, unchecked), so the game is deliberately faster than life. At the
starting values, crossing the core (4.7 km long) takes about 13 minutes on
land and 9 minutes swimming. The longest line across all six locations (9.7
km) takes about 27 minutes on land.

Ideas, not decided:

- Water is faster than land, so rivers and the lake are the fast roads, and
  dams and canals change how you travel.
- A swim burst or a canal system can cover long distances without a fast
  travel button.
- The test menu with a speed multiplier and a jump to any location is a
  testing tool only (ADR 0006).

## Game length

Round 1 Q3 only says a long time and concentration. Round 2 gives the shape of
one life: a baby takes a year to become a teenager, the teenager stays a year
and then starts a family, and the babies are played next (Q8, Q34, Q47, Q50).
Seasons change slowly (Q46), and the baby year can be skipped ahead (Q47). Each
new generation starts its own achievement journey (Q40).

Open questions:

- How long is one game year in real minutes?
- How long is one sitting on a tablet? Typical for children is 20 to 40
  minutes.
- Is the first generation the whole game, or a start that repeats?
