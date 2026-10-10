# First steps coach

A small card in the game that walks a new player through the first dam, one step at a time. It is for kids from 8 and up,
who read a little but should not need the manual to get started. The manual (`public/manual.html`) is the long form; the
coach is the short one, and its steps and the manual's quick start say the same things.

## What it does

- A card at the bottom centre shows the step's title, "3 of 9", one or two short sentences, and a **Skip the tips** button.
- On touch it also pulses the real button to press (a yellow ring on `#touch-chop` and so on). On a keyboard the line names
  the key.
- Steps move on by themselves when the world shows the step is done (`coachNext` reads `WorldState`). A step the player
  already did is skipped. There is no "next" button.
- The steps: walk, swim, dive, gnaw a tree, take the log, find a white ring, start the dam, finish the dam (mud and rocks),
  watch the pond. While the player looks for a ring the line adds the way and the distance of the nearest one.
- At the end a closing card points on to the lodge and the `?` button, with **Got it**.

## When it starts

- The first start, after the welcome card is closed, and only for an adult beaver (a baby cannot do the steps).
- `?coach=1` forces it, `?coach=0` turns it off, and it stays away in an automated browser, as the welcome card does.
- Skip or the last step remembers it in `localStorage` (`beaver-cycle.coached`). The manual bar has **Show the first steps**
  to run it again.

## Where it lives

`src/ui/coachSteps.ts` is the data and the rules (no DOM, tested). `src/ui/coach.ts` is the card. `main.ts` starts it
and calls `update(world)` every frame. Nothing in `sim/` knows about it.

## Not done

- No spoken hints, no pictures in the card. The manual will get pictures (screenshots) next.
- Not covered: lodge building, food, sleep and the life stages. The coach ends at the first pond.
