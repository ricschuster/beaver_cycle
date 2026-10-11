# The buttons: Take and Do

Design note, session 79, for #341. The author said in session 74 that not all buttons make sense, and that a button could
change with the circumstances. Status: the author's answers (below), with the order of what a button does first a guess to
tune on a tablet.

## What was there

Five fixed buttons, Dive, Slap, Gnaw, Drag, and Build, whose labels never changed. Three did many things:

- **Gnaw** felled a tree, picked up what lay on the ground, picked a lily pad, stripped a branch off a log, picked up a rock,
  scooped mud, ate in the lodge, and dug out a stuck beaver.
- **Drag** took a log or let it go, and put down food, mud, or a rock.
- **Build** put wood, mud, or a rock on a dam, started or built the lodge, mended, opened the store, left the lodge, and
  talked when nothing else wanted it.

So "pick up" sat on Gnaw, "put down" on Drag, and "talk" and "go out" on Build. Only the line at the top left said what a
press would do.

## The author's answers

- **Shape: Take and Do.** Four buttons. Dive and Slap stay. **Take** picks up or puts down anything: a log, mud, a rock, a lily
  pad, a branch. **Do** says on the button what it does here: Gnaw, Build, Mend, Store, Eat, Talk, Dig.
- **A button that can do nothing here is greyed out**, in its place, so the layout never moves.
- **The lodge door: swim in, Dive out.** In, as before, dive and swim into the door. Out, press Dive at the water hole inside.

## Take

One press. Its label is **Take**, or **Drop** while something is in the mouth.

1. Dragging a log: let it go.
2. Food, mud, or a rock in the mouth: put it down in front of the beaver.
3. Under water, in the lodge, or a baby: nothing.
4. Otherwise the first of these in reach: something put down earlier (on land), a log (2.5 m), a lily pad, a rock (on land),
   mud from the wet ground ahead (on land).

## Do

One press. The label is the word for what it does; greyed, it reads **Do**. The first that fits wins.

1. In the lodge: **Eat** the piece in the mouth, else **Talk** to Mama, Papa, or the partner near by.
2. Dragging a log: **Build** it into a dam at a dam spot, into the lodge (a new one starts on a good spot ahead), or **Mend**
   a worn dam, lodge, or store in reach. Nothing else while dragging.
3. Mud or a rock in the mouth: **Build** or **Mend** at a dam spot. Nothing else.
4. At the store of a whole lodge: **Store** opens the stash screen.
5. Next to a snowdrift with a beaver stuck in it: **Dig**. One press starts it; keep still until it is free.
6. A beaver to talk to within reach: **Talk**.
7. On land by a standing tree: **Gnaw**. One press starts it; keep still until the tree falls.
8. By a log: **Gnaw** strips a branch off it into the mouth.

Not under water, except Talk and Eat. A baby only eats and talks. Talk comes before Gnaw so a beaver by the trees can still be
talked to; walk a step away to gnaw. The exception is a partner who follows: it is always close, so Gnaw (and Strip) come
first while a tree or log is in reach, and Talk otherwise.

## Dive and Slap

Dive is held, as before. In the lodge it is greyed out except at the water hole, where a press dives out. It is also greyed
out on land. Slap is greyed out under water and in the lodge.

## Keys

E is Do and G is Take; Space, T, and the rest stay. B is gone. The key hints at the bottom left show the word Do and Take
have now, such as "E talk".

## The code

- `src/sim/buttons.ts` holds `doHere` and `takeHere`: what each button means for the world as it is, as one word or null. The
  game reads them each frame for the labels, and turns a press into that word for `step`, so what a button says is what it
  does. `step` takes the words (`do`, `take`), not the presses.
- Talk and the dig are not in `step`: the frame loop passes whether a speaker or a drift is near, and acts on `talk` and
  `dig` itself.
- The dream has its own Hop, Splash, and Play; Play sits where Do is, and Take is left out.

## Open

- Tune the order on the tablet, mainly Talk against Gnaw and Store.
- The manual pictures show the old buttons; retake them (`tests/e2e/manual-shots.spec.ts`).
