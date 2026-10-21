# The veggie garden dream

Design note, session 175. The second dream (wishes 9 and 11 of [note 40](40_kid_wishlist_1.md), issue #652). The author
answered the questions in round 5 ([note 47](47_round5_answers.md), Q85 to Q89). Status: built and looked at in the dream
preview and in unit tests; not played on a tablet. The numbers are first guesses to tune there.

## What the author decided

| Q | Answer | Built as |
| --- | --- | --- |
| 85 | The veggie dream can be chosen the first night and any night. | The bedtime panel's Dream button turns into two: Candy land, Veggie garden. Nothing to unlock. |
| 86 | Peas, carrots, tomatoes, radishes, pumpkins. Names Veggie, Spice, Planty, Cabbagey, Kale, Lettuce, given out in order from the start until the garden is full. | Six beavers, one per name. The vegetables go round in order, so Lettuce is a second pea. |
| 87 | The player: pea nose, pumpkin tail, tomato body, two tomato and two carrot feet. | `veggiePlayer` in `src/render/dreamBeavers.ts`, painted over the grey marshmallow beaver by where each part is: tomato front feet, carrot hind feet. |
| 88 | See who can grow the biggest plant fastest with watering cans. | The plant race below. |
| 89 | A bigger carrot juice river and more to find. | Land 240 m across (candy land 160 m), a river 1.4 times as wide, four or five ponds (two or three), 2.25 times the props and sweets. |

Round 5 read Q86 as going round again until the garden is full. Names are the limit here, so the garden is full at six
beavers. More beavers would need more names.

## The land

One generator makes both lands (`makeLand(seed, theme)` in `src/sim/dreamLand.ts`); `land.theme` is `'veggie'` for the
garden and missing for candy land, so candy land's seeds make the lands they always made. The half size, the river and path
lengths and the prop counts scale with the land. The props are lettuce trees, broccoli trees, leeks, bean poles, cabbages,
pumpkins and radishes (`src/render/gardenProps.ts`); cabbages, pumpkins and radishes of size 1.1 and up, and the two trees
from 1.2, can hide a beaver, so tag and hide and seek play as in candy land. The look (haze, sky, light, river, hills) is in
`src/render/dreamLook.ts`, one record per theme. The ground is meadow green with soil banks and hills in cabbage green and
wheat gold. The sweets are a pea pod, a carrot, a sunflower (the star, a sugar rush) and a lettuce leaf (the lily pad).

There is no chopping and no building in the garden, and the Keep card never shows: the garden has plants to grow instead of
trees to chop, and nothing from candy land's dam and lodge is kept into it.

## The plant race

Four garden beds stand in a row on dry ground a few steps from where the path meets the river. Walking into a bed (2.4 m)
and pressing Play starts a race. The player gets that bed, and the nearest three veggie beavers get one each. Every plant
has six stages, from a sprout to full size, and grows a stage each time it is watered.

- The player fills the can at the river's edge (Play within 2.5 m of the bank), carries it to their bed (a gold star hangs
  over it), and presses Play there. The can shows in the paws while full.
- A veggie beaver does the same by itself: to the bank, a short pause to fill, back to the bed, a pause, and again. Each goes
  at its own pace (1.8 to 2.4 m/s, pauses of 1.2 to 2.7 s), so a whole plant takes them 65 to 85 s. A player who walks a
  steady round trip takes about 50 s.
- The race ends when a plant is full size, or after 150 s, when the biggest wins. The player wins a tie. The winner's line is
  shown, the beavers cheer and go back to wandering, and the plants stay in the beds. Another race starts the plants over.

The state is `DreamGame` kind `grow` and `DreamState.plants` in `src/sim/dream.ts`; the beavers' plants take their stage from
how many times each has watered (`Mallow.watered`).

## Open questions for the author

1. Is the race too easy or too hard? The beavers' pace and the 150 s limit are the numbers to tune.
2. Should the winning plant do something, such as a shower of veggies as tag does?
3. Six beavers fill the garden. Should there be more, with more names?
4. Should the garden's prop trees be chopped for something, as candy trees are?

## Not done

- Not played on a tablet. The frame rate in the garden (about 200 000 triangles in the preview, candy land about 160 000) is to
  check with `npm run stress` (#603).
- The sounds are the dream's existing effects (splash for filling, a chime for watering, a cheer for the winner), no new clips.
