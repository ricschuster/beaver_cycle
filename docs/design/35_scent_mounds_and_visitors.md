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

## Session 139: a look, talk, settling, and days

The author asked for these after playing it.

- **Look.** A scent mound is a steep cone of patted mud with four sticks stuck in it and a tuft of grass on top (`scentGeometry`
  in `src/render/rockView.ts`), no longer the mud pile. It goes paler and sinks a little as it dries.
- **Days.** The visitor stays `VISIT_DAYS` (3) after it came and then walks off over 12 s, the way it came. A mound dries and is
  gone `MOUND_DAYS` (4) after it was made, which frees its place (`keepMounds`). A welcomed visitor's mound is kept until its
  family has settled, or until it is known that none can.
- **Talk.** Welcoming a visitor sets its trust, and that of the family it founds, to `WELCOME_TRUST` (0.7, curious). The visitor
  is a speaker like a neighbour, so Talk, its greeting and its replies work (note 27). It has no pond name.
- **Settling.** When a welcomed visitor has walked off, `settleFamily` looks for a whole lodge on a pond with at least 4 parts within
  80 m of the mound, 50 m from the beaver's lodge and 100 m from other families (`settled:<mound id>`, with the visitor as mama or
  papa and a mate of another coat). It joins `world.neighbours`, so it is saved and then lives as any other family. With no
  such pond the visitor only leaves. A visitor nobody welcomed leaves and founds nothing.
- Dropped for good: mounds keeping other families away (Q30).

## Left open

- Settling is untested on the real valley; the 80 m radius and the distances are first guesses.
- A pond name for the settled family comes from `pondName` as for others; the visitor before it has none.
