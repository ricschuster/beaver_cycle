# Game length and movement speed

Started after the camera and world size decisions (ADR 0005, ADR 0006). Game
length is still being worked out, so this note records what is decided and
what is open.

## Movement speed

Decided by the author after trying the camera demo, which used 4.5 m/s on
land, 7 m/s swimming, and 5.5 m/s diving: a little faster than that.

| Movement | Starting value |
| --- | --- |
| Land | 12 m/s |
| Swimming | 18 m/s |
| Diving | 14 m/s |

The first starting values were 6, 9, and 7 m/s. After the first desktop walk
the author found them a bit slow and chose twice that (2026-10-04). That
settles the scale question (issue #54): the terrain stays at real scale and the
pace is faster, with no distance compression. These are still values to tune on
a tablet, not fixed numbers. A real
beaver is much slower, roughly 1 to 2 m/s swimming and slower on land (from
memory, unchecked), so the game is deliberately faster than life. At the
current values, crossing the core (4.7 km long) takes about 6.5 minutes on
land and 4.4 minutes swimming. The longest line across all six locations (9.7
km) takes about 13.5 minutes on land.

Ideas, not decided:

- Water is faster than land, so rivers and the lake are the fast roads, and
  dams and canals change how you travel.
- A swim burst or a canal system can cover long distances without a fast
  travel button.
- The test menu with a speed multiplier and a jump to any location is a
  testing tool only (ADR 0006).

## Breath

The author wants a breath limit shorter than the real 15 minutes (Q24), and no
losing. The first value is a guess to tune: 60 seconds under water (`BREATH_TIME`
in `src/sim/state.ts`), refilled in 8 seconds at the surface or on land. When it
runs out the beaver rises by itself and cannot dive again until a fifth of the
breath is back. Nothing else happens. Breath time is real time, not scaled by the
test speed multiplier. At 14 m/s diving, a minute reaches the far side of the lake.

## Game time

Decided by the author:

- A game year is 40 game days, 10 days per season, with day and night.
- One sitting on a tablet is about one hour.
- The first generation is not the whole game. It repeats with each baby, and
  every generation starts its own achievement journey (Q40).

Not yet decided: how long a game day is in real minutes. Proposed starting
value, to tune by playing: **4 real minutes per game day**.

| Minutes per day | Season | Year | Days per hour | Core crossing on land, in days |
| --- | --- | --- | --- | --- |
| 3 | 30 min | 2.0 h | 20 | 2.2 |
| 4 | 40 min | 2.7 h | 15 | 1.6 |
| 5 | 50 min | 3.3 h | 12 | 1.3 |
| 6 | 60 min | 4.0 h | 10 | 1.1 |

The core crossing is 6.5 minutes on land at 12 m/s. A generation of three game
years (baby, teenager, own family) is 8 hours at 4 minutes per day before any
skipping.

Why 4:

- A season fits inside one sitting with room to spare, so the end of a season
  is a natural place to stop.
- Autumn has to be long enough to store food for winter, and the 30 tree wood
  achievement fits comfortably in one season.
- The day is a setting in the code, so changing it after playtests is cheap.

Consequences to design for:

- Travel between locations takes a day or two of game time, so it is something
  the player does now and then, not every day.
- Night is when the beaver is in the lodge, sleeps, and dreams (Q42), so it can
  be shorter than the day, for example 2.5 minutes of day and 1.5 of night.
- Skipping ahead exists for the baby year (Q47), and a long game needs it for
  the quiet days of winter too.

## Time rules

Decided by the author:

- Time passes while the player is in the lodge, but more slowly than outside.
- The player can sleep through the night.
- The game never ends. Generations repeat with each baby (Q40).
- Time passes at full speed while traveling between locations.
- A speed-up button is a test tool first (ADR 0006) and is meant to become an
  option for the player later. How it works for players is not designed yet.
- The lodge clock runs at half speed.
- Variety over a game that never ends comes from things that wear out and need
  repair, and from families that change over the generations. NPC beavers can
  be part of that. See `10_variety.md`.

Consequences to design for:

- A half speed clock in the lodge means a family can rest, feed the baby, and play
  dreams without losing days. The exact ratio is a setting to tune.
- Sleeping through the night skips the dark part of a day, so a day can be
  shorter in practice than 4 minutes.
- With no end, achievements and tasks need to be per generation (Q40), and a
  long run needs content that does not run out. Variation by season and by
  generation does that work.
- Full speed time during travel means a trip across the core costs about a day
  and a half of game time, which is part of why a season matters (autumn food
  storage).

## Game length: the rest

Round 1 Q3 only says a long time and concentration. Round 2 gives the shape of
one life: a baby takes a year to become a teenager, the teenager stays a year
and then starts a family, and the babies are played next (Q8, Q34, Q47, Q50).
Seasons change slowly (Q46).

Open questions:

- How the player speed-up works: held button, toggle, or limited by something
  such as breath or hunger.
- How much variety is enough. See `10_variety.md`.
