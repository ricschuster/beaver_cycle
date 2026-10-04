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

## Game time

Decided by the author:

- A game year is 40 game days, 10 days per season, with day and night.
- One sitting on a tablet is about one hour.
- The first generation is not the whole game. It repeats with each baby, and
  every generation starts its own achievement journey (Q40).

Not yet decided: how long a game day is in real minutes. Proposed starting
value, to tune by playing: **4 real minutes per game day**.

| Minutes per day | Season | Year | Days per hour | Core crossing, in days |
| --- | --- | --- | --- | --- |
| 3 | 30 min | 2.0 h | 20 | 4.3 |
| 4 | 40 min | 2.7 h | 15 | 3.2 |
| 5 | 50 min | 3.3 h | 12 | 2.6 |
| 6 | 60 min | 4.0 h | 10 | 2.2 |

The core crossing is 13 minutes on land at 6 m/s. A generation of three game
years (baby, teenager, own family) is 8 hours at 4 minutes per day before any
skipping.

Why 4:

- A season fits inside one sitting with room to spare, so the end of a season
  is a natural place to stop.
- Autumn has to be long enough to store food for winter, and the 30 tree wood
  achievement fits comfortably in one season.
- The day is a setting in the code, so changing it after playtests is cheap.

Consequences to design for:

- Travel between locations takes a few game days, so it is something the
  player does now and then, not every day.
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
- Full speed time during travel means a trip across the core costs about three
  game days, which is part of why a season matters (autumn food storage).

## Game length: the rest

Round 1 Q3 only says a long time and concentration. Round 2 gives the shape of
one life: a baby takes a year to become a teenager, the teenager stays a year
and then starts a family, and the babies are played next (Q8, Q34, Q47, Q50).
Seasons change slowly (Q46).

Open questions:

- How the player speed-up works: held button, toggle, or limited by something
  such as breath or hunger.
- How much variety is enough. See `10_variety.md`.
