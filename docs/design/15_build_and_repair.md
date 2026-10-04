# Building and repairing

Draft. It settles how things are built, so that repair (Q57) follows from it.
Parts marked "author" come from the answers. Parts marked "proposal" are mine
and need the author's yes. It is for M5 (`13_milestone_plan.md`).

## What the author said

- A dam needs wood, mud, and rocks (Q28). Mud comes from the bottom of the pond
  and the side (Q29).
- The lodge sits in the middle of the pond and uses the same things as the dam
  (Q31).
- Scent mounds tell other beavers that beavers already live here (Q30).
- The dam wears out first, then the food store (Q54). A worn dam looks broken.
- A glowing circle marks what needs repair (Q55). Ignored, it breaks and has to
  be rebuilt (Q56). It is a chore, never a loss.
- The beavers repair the broken thing, or build it again (Q57). Teenagers help
  repair the lodge, dams, and food cache (Q48). Papa shows how to repair the
  lodge (Q49).
- The dam and lodge from before stay and get old across generations (Q63).

## Proposal: repair is building again

One system, not two. Building and repair are the same action on the same
thing, so the game needs no repair button.

- A **structure** is a dam, a lodge, or a food store. Each is made of
  **pieces** (a stretch of dam, a section of lodge wall, the store).
- Each piece has a **condition** from 0 to 1 that falls as game days pass.
- The player **carries** material (wood, mud, rock) and **places** it at a
  piece. Placing is one context action, shown only when the beaver stands at a
  build site or a glowing piece with material in its paws. It is not a menu
  and not a separate "repair" button.
- A **new piece** needs the full materials. A **worn piece** only needs a
  top up, so repair costs less than building. A **broken piece** has to be
  rebuilt with the full materials, which is Q56.
- Material rules follow the author: mud from the pond floor and bank, wood
  from felled trees (some trees give more, Q16), rocks from the shore. How many
  of each is a tuning number, not a design question.

This answers Q57: the beaver does the work with the same carry and place
actions it already uses to build. Nothing is a button except that one context
action.

## Proposal: condition stages

| Stage | Condition | Looks like | Effect |
| --- | --- | --- | --- |
| Good | above 0.5 | Whole | Works |
| Worn | 0.5 down to 0.15 | Gaps, sticks sticking out, a glowing circle | Works a little worse |
| Broken | below 0.15 | Visibly broken, circle stays on | Does not work until rebuilt |

Effects that are annoying and not scary, so the no losing rule holds:

- **Dam:** a worn dam lets the pond level sag, a broken one lets it drain to
  the stream. Fish for food, lily pads, and the lodge entrance all get harder
  to reach until it is fixed.
- **Food store:** a worn store holds less. A broken one holds nothing, so food
  has to be stored again before winter (Q44, Q45).
- **Lodge:** a worn lodge lets in cold and wet and the family rests less well.
  The lodge never fails the family. It is the slowest to wear.

Nothing here kills or harms a beaver.

## Proposal: how fast things wear

Starting values, to tune on a tablet. A season is ten days (Q46).

| Structure | Worn after | Why |
| --- | --- | --- |
| Dam | about 1 season | Author: first to wear out |
| Food store | about 2 seasons | Author: second |
| Lodge | about 1 year | Not named by the author, so slowest |

Wear runs on the game day clock. The lodge clock at half speed
(`09_game_length_and_speed.md`) only slows the beaver's own life inside, not
the buildings, so a quiet year does not freeze them.

## Proposal: who repairs

- **The player** repairs anything, any time. This is the main route.
- **Teenagers** repair the lodge, dams, and food store on their own, slowly
  (Q48). A family with teenagers needs less chore time from the player.
- **Papa** shows the first lodge repair as a guided moment for a new player
  (Q49). It teaches carry and place.
- **Other beavers** are free to help later (Q62), not needed for the first
  version.

Because teenagers help, a growing family trades chore time for risk of wear,
which is the variety the author wanted.

## Across generations

- A structure saves its pieces and their conditions, so it ages while another
  generation plays elsewhere (Q63).
- Each generation starts in a different pond (Q64). The old pond's buildings
  keep aging on the game clock. They are simulated as numbers only when the
  player is away, and only drawn when the old pond is streamed in. This keeps
  the cost low.
- An old pond a player comes back to may have worn or broken pieces. That is a
  reason to visit, and the glow shows what to fix.

## What this means for the code

The sim layer owns structures and pieces. It needs no three.js and no input:

```ts
type Material = 'wood' | 'mud' | 'rock';
interface Piece {
  id: string;
  kind: 'dam' | 'lodge' | 'store';
  at: { x: number; z: number };
  condition: number; // 0 broken, 1 new
  need: Record<Material, number>; // still missing, while built or mended
}
```

- A `place` action (plain data, in `actions/`) adds carried material to a
  piece. The sim raises condition as the need falls to zero.
- A day tick lowers condition by a per kind rate.
- Render draws each stage and the glow from `condition`. It never changes it.
- Tests: wear over days, stage thresholds, place until mended, a broken piece
  needs the full set, and saves keep condition.

## Open questions

- Is the dam placed freely along the stream, or on set spots? Free is more fun
  and harder to build. Set spots are the safer first version.
- How does a dam change the water the terrain streamer draws? The pond level
  is a tile concern (ADR 0006) and needs a small design of its own.
- Do rocks exist everywhere in the valley, or only near some banks?
- Do the author's friends play on a shared pond later? Pieces would then be
  shared state, so keep them plain data (ADR 0007).
- Is the lodge allowed to be rebuilt in a new spot, or is the first spot kept
  for the generation?
