# Multiplayer: friends in one valley

Design note, session 157. Status: the author's first answers are in, the rest is open (round 6 questions,
[43_game_questions_round6.md](43_game_questions_round6.md)). Nothing is built. The transport (embedded server, Nearby
Connections, or WebRTC) gets its own spike and ADR after this note ([#41](https://github.com/ricschuster/beaver_cycle/issues/41),
[ADR 0007](../decisions/0007-web-stack.md)).

## What the author has said

- Same valley, each player with their own family and lodge.
- Players build and chop in the shared valley.
- Up to four players at once.
- Mostly in the same room, always in the same house, on one WLAN with no internet service.
- Night passes fast only when everyone sleeps.
- Friends help to mend each other's dams and lodges. Nothing is damaged by a friend (wear comes from the clock only, see
  [20_dams_and_ponds.md](20_dams_and_ponds.md), so there is nothing to take away).
- One tablet hosts, the others are guests. When the host quits, the world stays as it was, on the host's tablet. Saves must stay
  simple.
- Everyone starts in the same valley, close to each other, so they find each other.

## Model

- The host tablet runs the world: the clock, trees, logs, dams, ponds, lodges, food, animals, and other families. A guest sends
  what the player wants (the plain `Intent` data in `src/actions/`) and gets the world state back. The host is the only one that
  changes the world. The sim has no DOM, no three.js, and no input, so it can run on the host without a screen change.
- Every player is one beaver in that world, with a family. A guest's lodge, dams, and chopped trees are part of the host's world.
  A guest's own tablet keeps what is the player's alone: the family's names and stage, achievements, settings, and the dreams.
- The dream stays local to each player. It touches nothing in the waking game
  ([29_dream_candy_land.md](29_dream_candy_land.md)), so a guest can dream while the others play on.
- Terrain tiles are on every tablet already. Only state goes over the WLAN, for at most four beavers and a few hundred objects.

## Time, sleep, and skipping

The clock is the world's, so it is shared and run by the host. Wear, seasons, and the other families are functions of it
(`24_npcs_and_animals.md`).

- **Night.** It passes fast only while every player is asleep in a lodge (or in a dream). One awake player keeps it normal, and the
  others see "waiting for N". A sleeper can wake at any time.
- **Skipping to the next stage.** A stage is a year, 5.3 hours of play ([22_life_stages.md](22_life_stages.md)), so skipping decides
  whether a generation is playable. With a shared clock one player cannot skip alone. Options:
  1. **Ready check, recommended.** "Sleep until teenager" asks the others on their screens ("Pip wants to sleep until the next
     season. Come along?"). The skip runs when all say yes or are asleep. A no cancels it and the sleeper stays asleep until
     morning only. In one room this is as simple as asking each other.
  2. **Own age.** A beaver's stage follows its own age, and sleeping adds age at a fast rate while the world clock runs on. It
     never blocks anyone, but a kit born "on the first day of spring" would no longer line up with the seasons, and the lodge, the
     dams, and the other families would not move along with the sleeper's age.
  3. **Host decides.** Only the host can skip, for everyone. Simple, but the guests have no say.
  Asked in Q91.
- A baby and an adult can play at the same time. Only the skip is shared.

## Joining and leaving

- The host taps Host, a guest taps Join and picks the host from a short code or a list of tablets on the WLAN. How is a question
  for the spike, the wish is only "no typing for a child".
- A guest starts in the same valley, near the host's beaver, and walks off from there. A guest who joins a world where their
  family already has a lodge appears at that lodge.
- A guest who loses the connection (a tablet sleeps, the WLAN drops) leaves the beaver standing in its lodge or on the spot,
  where it cannot be hurt, and rejoins later where it was. The calm rule holds: no death, no losing.
- When the host quits, the world is saved on the host's tablet as it is now. Guests go back to the title screen with their own
  tablet's data intact. To go on, a guest joins that host again. The family's home lives in the world where it was built (Q97).

## What stays unchanged

The rules of the waking game stay the same for each beaver: chopping, building, food, wear, and life stages. Only what is shared
changes. Dams that hold back water already change the pond for everyone downstream, and the lodge walk-in over the mud when the
pond runs low (#647) makes that harmless.

## Open

Round 6 (Q91 to Q103) asks the author about skipping, the look of friends, joining, helping, talking, and what is shared.
