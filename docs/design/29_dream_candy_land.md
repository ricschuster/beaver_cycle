# The dream: candy land

Design note, session 78, for #131. At night in the lodge the bedtime panel offers "Sleep until morning" and "Dream" (Q65).
The dream was a placeholder, a dark screen with a wake button. The author wants the beaver to dream about candy land (Q43)
and the player to go into the dream (Q5, Q42). Status: the author's picture and answers, with numbers that are first guesses
to tune on a tablet.

## The author's picture

The beaver goes into candy land and walks along a little path. It finds marshmallow beavers, and it swims and plays with them
in the chocolate river.

## The author's answers (session 78)

| Question | Answer |
| --- | --- |
| What do they play? | Tag and hide and seek. |
| A goal on the path? | Collect sweets on the way. |
| How is it drawn? | 3D in three.js, with the game's beaver and the same controls. |
| How does it end? | When the player wakes. No limit. |
| Do the sweets count after waking? | No. The count is for this dream only and starts at zero each night. |
| The same land each night? | No. Candy land is made new every night. |
| How many marshmallow beavers? | A big group, six or more. |

## The dream

- **Candy land** is a square of soft pastel ground, about 160 m across, with rolling candy hills at the edges that keep the
  beaver in. A chocolate river winds across it. A little path of round candy stones leads from where the beaver wakes up in
  the dream, past lollipop trees, gumdrop bushes, candy canes, cupcake hills, ice cream cones, and marshmallow rocks, down to
  the river bank. Every night the river, the path, the props, and the sweets are laid out new from a seed.
- **The beaver** walks on land and swims in the chocolate (no diving under, no breath). The Dive control makes it hop on land
  and leap out of the chocolate like a dolphin. The tail slap splashes chocolate.
- **Sweets** lie along the path and float in the river: candy drops, swirls, and now and then a golden star. Touching one
  collects it. A star gives a sugar rush, a few seconds of extra speed. The count shows on screen while the beaver dreams.
- **Marshmallow beavers**, seven or eight, in pastel colours (pink, mint, lemon, sky, lilac, peach, white), each with a name.
  They wander along the path and the river, hop when happy, and come to say hello the first time the beaver is near.
- **Play** is the Build control, as for talking in the waking game. Near a marshmallow beaver it starts a game: in the
  chocolate it is tag, on land it is hide and seek. The prompt says which ("Play tag with Puff").
- **Tag** is in the river. The marshmallow beavers near the player join. One of them is "it" first and chases the player,
  a little slower than the player can swim. Whoever is caught is it, and the player tags back by touching. A marshmallow
  beaver that is it chases, the others flee and dodge. Nobody loses: each catch is a giggle, and the round ends after a minute
  with a cheer and a shower of sweets.
- **Hide and seek** is on land. The player counts to ten while the marshmallow beavers run off to hide behind props within
  about 40 m. Hidden ones giggle now and then, shown as a little "hee hee" above their hiding place when the player is near
  enough to hear it. Walking up to one finds it, and it pops out and follows the player. When all are found there is a cheer
  and a shower of sweets.
- **Waking** is only by the Wake up button. The waking game's clock stands still while the beaver dreams, and waking moves it
  to dawn as a plain sleep does.

## Controls

| Control | Keys | Touch | In the dream |
| --- | --- | --- | --- |
| Move | WASD or arrows | stick | walk and swim |
| Dive | Space | Dive | hop, leap |
| Slap | T | Slap | splash |
| Build | B | Build (shown as Play) | start tag or hide and seek |

## How it is built

The dream is its own small world with its own rules, scene, and screen, so it never touches the waking game's state.

- `src/sim/dream.ts`: the dream's state and rules, pure and seeded (the land, the beaver, the sweets, the marshmallow
  beavers, tag, hide and seek), with unit tests.
- `src/render/dreamView.ts`: the candy land scene in three.js with its own canvas, made when a dream starts and thrown away on
  waking. Marshmallow beavers are the game's beaver model in pastel colours.
- `src/ui/dreamScreen.ts`: the dream screen over the game, with the sweet count, the prompt, game lines, the touch buttons,
  and Wake up. `main.ts` stops the waking game's step and drawing while the dream screen is open.

## Open questions

- Should the waking game ever hear about the dream, such as a line from Mama in the morning?
- A sound for the giggles and the cheer waits for #340.
- The frame rate on the tablet with the dream's own canvas.
