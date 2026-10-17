# Scent mounds and visitors (#583)

The author's answers say that scent mounds tell other beavers that beavers already live here (Q30), and that a visitor
notices the scent mounds, and then a new beaver lives nearby (Q62). Until now the game had neither. This is the small slice
the author chose in session 138: the beaver can make a mound, a visitor comes, and welcoming it wins an achievement. Mounds do
not keep other families away, and no new family moves in.

## What the player does

- With mud in the mouth, on the bank within 30 m of a whole lodge, Do reads **Mark**. A press pats the mud into a scent mound
  where the beaver stands and uses the mud up. At a dam spot, Build still comes first.
- A lodge has at most 3 mounds, at least 6 m apart.
- The morning after a mound was made, a little after dawn (10 to 30 per cent into the day), a beaver walks in from 20 m
  away, over 12 s, and stands by the mound, sniffing it. It stays by day and sleeps at night, and does not leave.
- Standing within 7 m of it, once it has stopped, welcomes it. It then grooms. This wins the **Welcome** achievement.

## How it works

`src/sim/scent.ts`. The world keeps the mounds (`scents`: id, place, clock made at) and the ids of those welcomed (`welcomed`).
The visitor is not saved: where it is, its coat, name and sex follow from its mound and the clock, like the beavers of
the other families (note 28). It comes from the first of eight bearings (picked by the mound's place) where the ground is
dry, and just appears at the mound when none is. It is drawn as a beaver of a family of its own (`visitor:<mound id>`) with the
same model and poses as the others. It cannot be talked to yet.

A mound is drawn as a pile of mud, the same as mud put down, but it never dries. `newLife` and `leaveHome` clear the mounds, and
`newLife` the welcomed list, so each life makes its own and the kit does not win Welcome for free.

## Numbers (first guesses)

Three mounds, 6 m apart, 30 m from the lodge, the visitor the next morning, 7 m to welcome. All to tune on a tablet.

## Played (session 139)

The author played it in the dev server: the visitor walks in, the Welcome toast comes, and the mud pile is fine but should look
more distinctive. To try it with the test menu: make a mound, press Night, go into the lodge and sleep (the Time of day buttons
stay in the same day, so they cannot bring the next morning), then press Morning.

## Left open

- A mound of its own look, not a mud pile (the author wants it more distinctive).
- Talking to the visitor, and a new family that settles for good.
- Mounds that keep other families away (Q30).
