# 00 Project Brief

Built from the author's written answers (`05_round1_answers.md`,
`07_round2_answers.md`), the notes in `01_game_notes.md`, and the decisions in
ADRs 0002 to 0006. Where an answer is still open it is listed at the end.

## What this is

Beaver Cycle is a 3D, stylized game in which you play a beaver in the real
Almsee valley in Austria. You start as a baby in the lodge with your mama,
papa, and siblings, grow up, leave to build your own lodge, find a mate, raise
kits, and then play the kits. The cycle repeats with each generation and the
game never ends.

It is a game for the author and friends to play together on tablets, not a
simulation of real beaver biology. The goal is to complete each task and earn
every achievement, in a calm world where the beaver cannot die or lose.

## Who it is for

- The author, who designs the game, and friends who play with them.
- Anyone else who likes a gentle nature game on a tablet.

Assumptions to confirm: the players are young, play in sittings of about one
hour, and use touch controls without a keyboard.

## The core idea (one screen)

You are a beaver. You swim, dive, chop trees, eat lily pads, cattails, and
inner bark, and you build dams and a lodge in a valley that is a real place.
The year has four seasons of ten days each, with day and night, and winter
means you must store food ahead of time. Things you build wear out and need
repair. Other beavers live in the valley. Stuck beavers can be rescued and
become guides. While the beaver sleeps, the player can enter its dreams, which
are the side quests.

When the family grows up, the baby becomes a teenager after a year, stays one
more year to help at the pond, and then the parents tell it to start its own
family. You then play a baby again, and every generation starts its own
achievement journey.

## Scope layers

1. **One life.** A baby grows into a teenager and leaves to build a lodge, find
   a mate, and have kits. This is the first loop to make work.
2. **Seasons and repair.** Day and night, four seasons, food storage, wear and
   repair, and predators to hide from.
3. **Generations and the wider world.** Play each new baby, meet other
   families, rescue guides, and travel between the six locations.

All three share one world and one clock.

## MVP scope

Proposed, not agreed. The smallest version that tests the idea:

1. The core location (6.3 km2) as a streamed 3D world that runs on a tablet,
   with a third person beaver that walks, swims, and dives (ADRs 0005, 0006).
2. A day and night clock and the four seasons, with the lodge at half speed.
3. Chop, eat, build a dam and a lodge, and a worn dam that needs repair.
4. A baby grows into a teenager, then you start a family and play the baby.
5. A test menu with a speed multiplier and a jump to any location.

The draft order of work is in `13_milestone_plan.md`.

## Explicit non-goals (for now)

- No losing and no death. Damage is a chore, never a failure.
- Not a realistic beaver simulation. The game is faster than life and uses a
  shorter breath time.
- Not photoreal. The look is stylized 3D with a toned down cartoon feel.
- Not all six locations at once. The core comes first (ADR 0006).
- No release of data derived from OpenStreetMap until its licence is settled
  (ADR 0003).

## Design principles

1. **The author's words lead.** Design decisions come from the written
   answers. Handwriting readings are confirmed with the author.
2. **A real place, a gentle game.** The valley is real, but fun and calm come
   before accuracy.
3. **Tablet first.** Touch controls, a modest triangle budget, and tiles that
   load around the beaver.
4. **Build in stages.** Core first, then add what the game needs.
5. **Record decisions.** Big choices get an ADR. Design notes hold the
   reasoning.
6. **Look at it.** The world is judged by running it and looking, as with the
   camera demo.

## Open questions

- How multiplayer connects on the local WLAN (ADR 0007 leaves it open).
- Variety in a game that never ends. See `10_variety.md` and round 3.
- How the player speed-up works, and the breath time in seconds.
- What the tasks and achievements are beyond the wood achievement (30 trees).
- Travel between locations as a game feature (`06_locations.md`).
- Licence for the project and for OpenStreetMap derived data.
