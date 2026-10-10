# NPCs and animals

Status: draft. Slice 3 (predators, #274) is built for the fox and the owl: `src/sim/predators.ts`. An ambient fox, or an owl at night in the forest, that is within its notice range (fox 22 m, owl 30 m) of a beaver on land gives a sign (a toast; the owl hoots for 2.5 s, the fox freezes for 0.8 s), then chases (fox 10 m/s, up to 10 s; owl swoops at 20 m/s from 7 m up, up to 5 s). A beaver in deep water or in its lodge is out of reach and the chase ends. A tail slap within 30 m scares either off. If caught, the beaver drops what it carries or drags, is *hurt* (60% speed, `world.hurtAt`), and the predator walks off and does not come again. Eating a lily pad in the lodge heals; with none, the hurt ends by itself after one game day (my safety valve, so a beaver with no lodge is not slow for ever). Seen on screen in session 61: the fox and the owl both warn, chase, catch, and go off as written; the owl is drawn at twice life size, as at its true size it was a speck in the dark forest, and it climbs to its swooping height during its call. Predator toasts show at once over the one on screen, as the queue made a warning arrive after the chase was over. Not built: lynx, wolf, bear, the owl's shadow, a sound, and predators stealing food. Slice 2 (one other family, #273) is built: `src/sim/neighbours.ts`. Families live in whole lodges on ponds and shores of the valley, found as the player comes near (far tiles are not loaded, and dam spots are on streams with no lake, so they are placed from a 400 m grid of cells, one cell in two hosting a family), with a mama, a papa, and the kits of the last two springs, who grow on the clock and leave when grown. By day they swim the pond, at night they sleep in the lodge and are not drawn. Tasks beyond swim, rest, and sleep (eat, carry, repair, wander ashore) are not built. Slice 1 (ambient animals, #272) is built: `src/sim/animals.ts` and `src/render/animalView.ts`. The author agreed the order of work (open question 6), the cap of 40 to start, simple shapes, and deer, duck, heron, and fox. The author chose the direction (below); everything marked **Proposal** is mine and waits for the author.
This is milestone M7 (#279). Today the only NPCs are the lone beavers in `src/sim/partners.ts`.

## What the author has said

- Predators are wolves, bears, owls, fox, and lynx. No coyotes (Q9, `05_round1_answers.md`).
- The beaver can hide, swim, or slap its tail, as a warning or to fight (Q10).
- A predator can hurt the beaver, and lily pads heal it (Q12). The beaver cannot die and you cannot lose (Q2).
- A pond is a safe place from predators (Q69, `20_dams_and_ponds.md`).
- Stuck beavers come from other families, are stuck in snow or swarmed by predators, and become guides once rescued
  (Q20 to Q22, Q51, Q53).
- Animals other than predators live in the valley too, and **the player can interact with them**. How is decided later.
- Other beaver families live in the valley, **all of them act and can be interacted with**. How is decided later.
- The species list is fine as it is: the Q9 predators plus the common animals of the valley.

## Constraints

- **No death, no losing.** A predator can cost time, comfort, or something carried. It never ends a life or a run.
- **Tablets.** Animals must be cheap: a few dozen meshes at most, simple movement, no pathfinding across the whole
  valley.
- **Streamed world** (ADR 0006). The valley loads in tiles around the player. Nothing far away is simulated.
- **Sim and render are split.** Animal state and rules go in `src/sim/` with no three.js, and `src/render/` only draws it.
- **Source gap.** Only the lynx is confirmed for the Almtal (`03_location.md`). Wolf and bear are kept because the
  author chose them. The game is stylized and not a beaver simulation, so this is a design choice and not a claim.

## Proposal: one rule for all animals, state from the clock

Wear is a function of the clock (`src/sim/wear.ts`), so a sleep or a long skip needs no catch-up. Animals can follow
the same idea.

- **Each tile has a seed.** The animals of a tile, their kind and home spot, follow from the seed, the tile, and the
  season. The same tile gives the same animals every time.
- **Only near tiles run.** Animals in the loaded ring around the player get positions and moves. A tile that unloads
  forgets them and a tile that loads again makes them anew from the seed and the clock.
- **Position is a function of the clock where it can be.** A deer grazing in a meadow, or a heron on a shore, can be
  placed at any clock time from its seed, with no stored path. Only an animal in a chase or in an interaction holds state.
- **A budget.** A fixed cap on live animals (proposal: 40), nearest first, and a lower cap when the frame rate falls.

## Animals by role

Species are the Q9 predators plus common animals of an alpine lake valley. The non-predator list is from general
knowledge and has not been checked against Almtal sources. That is fine for a stylized game.

### Predators (threat)

| Animal | Where | Behaviour (proposal) |
| --- | --- | --- |
| Lynx | Forest edge, dusk and night | Stalks, then a short rush. The most real one for the area. |
| Fox | Meadows, shore, any time | Small, quick, steals food from the bank and a store left in shallows. A nuisance more than a danger. |
| Owl | Forest, night | Swoops at a beaver on the bank at night. Gives a sound and a shadow before it comes. |
| Wolf | Forest, upper slopes, winter | Chases in a pair. Shows up more in winter. |
| Bear | Forest, spring to autumn | Slow and big. Walks off when slapped at, never chases far. A reason to keep a lodge door in the water. |

### Ambient land animals

Red and roe deer, chamois, hare, red squirrel, capercaillie. They graze, walk, and flee. Deer and chamois flee a
predator, so the player can read danger from them.

### Water and shore animals

Otter, kingfisher, heron, dipper, ducks, trout and char, frogs. A pond with fish and frogs is a healthy pond. The
otter and the heron can compete for fish.

### Seasonal

Migrating birds in spring and autumn, and animals that are quiet in winter. They mark the turn of the seasons
beyond the colour of the leaves (`10_variety.md`).

## Proposal: what a predator does to the player

The author liked this one when asked in session 55.

- **Notice.** A predator only notices a beaver on land, within a distance that depends on the animal. A beaver in
  water deeper than the swim threshold is safe. This is the pond rule (Q69) as a rule of the sim.
- **Chase.** The predator runs at the beaver. The player can swim to safety, slap the tail to scare it, or hide
  (under a bank, in the lodge).
- **Caught.** If it reaches the beaver, the beaver drops what it carries and is *hurt*. The predator then loses
  interest and walks off, so there is no loop of being caught again.
- **Hurt.** A hurt beaver is slower. Eating a lily pad heals it (Q12). Nothing else changes, and nothing is lost for
  good.
- **Tail slap.** A slap scares small predators (fox, owl) off and makes big ones (bear) back away. Wolf and lynx
  need a slap from the water or from a pond edge. This keeps the slap useful without making the beaver a fighter.
- **Not in the first slice.** The first version has no predators (doc 20). The pond rule is kept, and predators come
  after ambient animals.

## Interaction with animals (open)

The author wants the player to interact with animals and will decide how later. Ideas to choose from:

- **Follow** a kingfisher or an otter to a good fishing spot.
- **Feed** a deer or a duck, with a branch or a lily pad, and be trusted by it over time.
- **Scare** a fox off the store with a slap.
- **Read** the animals: deer that bolt mean a predator is near.
- **Share a pond** with ducks and frogs, which only come once the pond is mature.

The sim should leave room for this: an animal has a *mood* toward the player (wary, calm, curious) and the
interaction sets it. That is a small piece of state, and no kind of interaction is fixed yet.

## NPC beavers

### Who they are

| Beaver | Where | Today |
| --- | --- | --- |
| Family: mama, papa, siblings | In the home lodge | Mama and papa exist in the lodge (`22_life_stages.md`) |
| Partner | A lone beaver, then in your lodge | Built: `partners.ts`, `upkeep.ts` |
| Stuck guide | Snow or predators, any family | Not built (Q20 to Q22) |
| **Other families** | Their own lodge and dam on a pond of the valley | Not built, new in this note |

### Other families (the author's new direction)

The author wants other families that all act and can be interacted with. The shape is open. A first proposal that
reuses what exists:

- **They live at dam spots.** The lone beavers already sit at dam spots. A family is a lone beaver whose lodge
  stands, with a mama, a papa, and kits, so a family is a house plus a few beavers.
- **They go through the same cycle, slowly.** The clock moves their kits to teenagers and out, so a pond feels
  alive and a family changes (Q57 to Q61), with no per-frame sim far away. Only the beavers near the player move.
- **They keep their home up**, like the parents of a former home (note 23), so nothing of theirs wears and breaks.
- **Interaction is open.** Candidates: visit and be greeted, trade a branch, share a dam, be helped to rescue a
  stuck kit, or have a partner picked from their teenagers (which would replace the lone beaver as the only way).

### Stuck guides

Stuck beavers come from these families (Q53). A stuck beaver is a family member stuck in snow or by predators.
Rescue turns it into a guide (Q51). With other families in the game, the stuck one can be a *named* member of a
family the player knows, which gives the rescue more weight.

### Proposal: NPC beavers use the same state as the player

- A beaver NPC has a position, heading, mode (walk, swim, dive), and an age stage.
- Its moves are a small set of **tasks** it picks by time of day and season: sleep, eat, carry a branch, repair, wander,
  follow. The task is a plain value, so a test can step it.
- It reuses the player's collision and swim rules, so nothing walks through water it cannot swim.

## Open questions

1. How should the player interact with animals (see the list above)? The author said later.
2. How do the player and the other families interact (see above)? The author said later.
3. Is the budget of 40 live animals right, and what is the real cost on the tablet? Measure with the first animals.
4. Should wolf and bear stay, given no source for them in the Almtal? The author chose them, so yes, but it is worth
   keeping them rare.
5. Do predators change what a pond is worth, so a safe pond matters more than just a good lily pond?
6. Order of work. Proposal: (a) ambient animals in the loaded tiles with the seed rule, (b) NPC beaver tasks and
   one other family, (c) predators with the chase rule, (d) the interactions the author picks.

## Proposal: milestone slices

1. **Ambient animals.** The seed rule, a cap, and four kinds (deer, duck, heron, fox). Sim in `src/sim/`, drawing in
   `src/render/`. No threat, no interaction.
2. **Other families.** One family at one pond, with tasks and the clock. Reuse `partners.ts` for the placement.
3. **Predators.** The notice, chase, caught, and hurt rules, starting with the fox and the owl.
4. **Interactions.** Whatever the author picks.

Each slice gets its own issue once the author agrees, and the note is updated as the author decides.
