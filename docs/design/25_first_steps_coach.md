# First steps coach

A small card in the game that walks a new player through the first dam, one step at a time. It is for kids from 8 and up,
who read a little but should not need the manual to get started. The manual (`public/manual.html`) is the long form; the
coach is the short one, and its steps and the manual's quick start say the same things.

## What it does

- A card at the top left, under the status line, shows the step's title, "3 of 6", one or two short sentences, and three buttons:
  **Back**, **Next** and **Close**.
- On touch it also pulses the real button to press (a yellow ring on `#touch-chop` and so on). On a keyboard the line names
  the key.
- Steps move on by themselves when the world shows the step is done (`coachNext` reads `WorldState`). A step the player
  already did is skipped.
- **Next** skips a step the player cannot or will not do. **Back** goes back to read a step again. While the player has gone back,
  the coach does not jump forward by itself; it follows the world again once the player is back at the newest step.
  **Close** turns the coach off for good (remembered). At the end of a run the card says well done, with **Got it**, which
  only puts that card away.

## One run for each life stage (session 68)

The game starts as a baby (the brief: you grow up in the lodge), and the coach has one run for each stage. It starts by
itself when the stage begins, so a child is never given steps their beaver cannot do (a baby cannot gnaw, drag or build,
`STAGE_RULES`). The dam used to come right after "walk around", because the game started as an adult. Now it is the
teenager's job, after food and a bed.

| Stage | Steps |
| --- | --- |
| Baby | swim out through the water hole, swim, dive, slap the tail, go home (dive in at the door), sleep until teenager |
| Teenager | find a lily pad, eat it in the lodge, fill the food store, gnaw a tree, take the log, find a ring, start the dam, finish it, watch the pond |
| Adult | find a lone beaver, start a lodge, finish it, the partner moves in, wait for a kit |

- Steps already done are skipped, so a beaver who starts somewhere else (the test menu, `?stage=`) begins at the first step
  that is still open. The baby run starts at "swim" when the baby is already outside.
- Going back in, and sleeping, are not kept in the world, so the coach remembers them. A sleep shows as the game clock
  jumping more than 20 s in one frame.
- The adult run starts after the beaver has left home (`leaveHome`), so it sees a world with no lodge and the lodge step is open.
- The adult run ends when the kit is born: the new baby starts the baby run again.

## When it starts

- The first start, after the welcome card is closed, and then at every new life stage, until **Close** is pressed.
- `?coach=1` forces it, `?coach=0` turns it off, and it stays away in an automated browser, as the welcome card does.
- A game starts as a baby, except in an automated browser, where it starts as an adult so the playtests keep their start.
  `?stage=baby|teenager|adult` sets it.
- **Close** (or **Got it** on the adult's last card) remembers it in `localStorage` (`beaver-cycle.coached`). The manual bar
  has **Show the first steps** to run the current stage again.

## Where it lives

`src/ui/coachSteps.ts` is the data and the rules (no DOM, tested). `src/ui/coach.ts` is the card. `main.ts` starts it
and calls `update(world)` every frame. Nothing in `sim/` knows about it.

## Not done

- No spoken hints, no pictures in the card. The manual will get pictures (screenshots) next.
- Not covered: animals, repairs, the second generation's own tips.
- Never played on a tablet. Wording and the order of the home steps need a child.
