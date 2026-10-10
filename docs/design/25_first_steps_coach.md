# First steps coach

A small card in the game that walks a new player through the first dam, one step at a time. It is for kids from 8 and up,
who read a little but should not need the manual to get started. The manual (`public/manual.html`) is the long form; the
coach is the short one, and its steps and the manual's quick start say the same things.

## What it does

- A card at the top left, under the status line, shows the step's title, "3 of 9", one or two short sentences, and a **Skip the tips** button.
- On touch it also pulses the real button to press (a yellow ring on `#touch-chop` and so on). On a keyboard the line names
  the key.
- Steps move on by themselves when the world shows the step is done (`coachNext` reads `WorldState`). A step the player
  already did is skipped. There is no "next" button.
- The steps: walk, swim, dive, gnaw a tree, take the log, find a white ring, start the dam, finish the dam (mud and rocks),
  watch the pond. While the player looks for a ring the line adds the way and the distance of the nearest one.
- At the end a closing card points on to the lodge and the `?` button, with **Got it** and **Show me the lodge**.

## Second run: your home

The design call (session 68): the second round is a separate run of five or six steps, not more steps on the first run. Seven
steps is already a lot for a child, and a long list reads as a chore. A child who wants more taps **Show me the lodge** on the
closing card; one who does not taps **Got it** and never sees it. Skip ends it for good, as in the first run.

- The steps: start a lodge, finish it (ten pieces of wood), go inside (dive at the underwater door), have a snack (carry food
  in and eat), sleep on the nest, fill the food store. "3 of 6" counts within the run.
- Steps already done are skipped. The game starts the adult beside a ready-made lodge, so that player begins at going inside.
- Going in and sleeping are not kept in the world, so the coach remembers them (`entered`, `slept`). A sleep shows as the game
  clock jumping more than 20 s in one frame.
- It ends with a plain closing card (mend the buildings, find a lone beaver), then **Got it**, which remembers the coach as done.
- Only reachable from the first run's closing card, and by `?coach=1` plus finishing the dam. Not yet a manual button of its own.

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
- Not covered: partners, growing up and the next generation, animals. The second run ends at the food store.
- Never played on a tablet. Wording and the order of the home steps need a child.
