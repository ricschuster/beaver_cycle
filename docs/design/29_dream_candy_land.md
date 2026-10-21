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
  the dream, past lollipop trees, cotton candy trees, gumdrop bushes, candy canes, cupcake hills, ice cream cones, and
  marshmallow rocks, down to the river bank. Every night the river, the path, the props, and the sweets are laid out new from
  a seed. The cotton candy trees (the author, session 81) are a paper stick with a soft cloud of pink, sky blue, or lilac
  spun sugar, and a big one hides a marshmallow beaver, as a big lollipop does.
- **The beaver** is a marshmallow beaver too, in the colours of the rainbow from nose to tail (the author, session 81), so
  it stands out among the pastel ones. It walks on land and swims in the chocolate (no diving under, no breath). The Dive control makes it hop on land
  and leap out of the chocolate like a dolphin. The tail slap splashes chocolate.
- **Sweets** lie along the path and float in the river: candy drops, swirls, and now and then a golden star. Touching one
  collects it. A star gives a sugar rush, a few seconds of extra speed. The count shows on screen while the beaver dreams. A golden beaver statue (the author's wish 10, #651) stands 4 to 9 m off the
  later part of the path, in a new place each night; touching it gives a rush of 20 s, once a dream (`makeStatue`, `touchStatue`).
  The wish list asked "rare find or always there" (Q4); it is always there until touched, to tune.
- **Lily pads and ponds** (the author's wishes 7 and 8, #650). Two or three round chocolate ponds, 5 to 8 m across the surface,
  lie beside the river a strip of dry land away from it and from the path (`makePonds`, bowls cut into `landRise`, about 0.9 m
  deep). Each has four white chocolate lily pads and one marshmallow beaver, and the beavers amble between ponds too. More pads
  float on the river. A pad is a sweet of its own kind (`lily`): swimming up to it eats it, for two. The wish list said the pads
  float near the dream lodge; here they are in the water everywhere, as the issue reads.
- **Chop and build** (the author's wish 6, #649). Do with no marshmallow beaver near does work. Next to a lollipop or cotton candy
  tree it chops: the tree is gone for the night and the beaver carries a candy log (one at a time). With a log, Do by the
  chocolate (within 2.5 m of its edge) lays it on a candy dam across the river, three logs make it whole. Do on dry land a step
  ahead, 3 m or more from the chocolate and clear of props, lays it on a candy lodge, four logs make it whole. One dam and one
  lodge at most. Nothing wears and nothing is saved, as the wish list proposed. They do not stay for other dreams by default (Q81). When the player presses Wake up after building or adding a log, a card asks
  "Keep your candy dam and lodge for your next dreams?" with Keep and Let go (#708). Keep stores them in the world (`dreamKept`,
  saved, it stays across generations); Let go leaves what was kept before as it was. A later dream starts with them set into its
  new land (`keptInLand`): a dam across the new river at the point nearest where it stood, a lodge where it stood or on the nearest
  dry clear ground. A kept part dam or lodge takes more logs, a whole one takes none. Kept ones in the dream land only, not the
  valley (the author, session 174). Eating sweets stays as it is: touching one takes it. `chopped` trees leave `land.props`
  through `withProps`, so hiding and bumping never see them.
- **Marshmallow beavers**, seven or eight, in pastel colours (pink, mint, lemon, sky, lilac, peach, white), each with a name.
  They wander along the path and the river, hop when happy, and come to say hello the first time the beaver is near.
- **Play** is the Do control, as for talking in the waking game. Near a marshmallow beaver it starts a game: in the
  chocolate it is tag, on land it is hide and seek. The prompt says which ("Play tag with Puff"). For hide and seek it asks
  first (the author, session 81, #394): "Do you hide or seek?", with two big buttons, I hide and I seek, and the keys 1 and
  2. The marshmallow beaver waits, looking at the player. Walking off drops the question.
- **Tag** is in the river. The marshmallow beavers near the player join. One of them is "it" first and chases the player,
  a little slower than the player can swim. Whoever is caught is it, and the player tags back by touching. A marshmallow
  beaver that is it chases, the others flee and dodge. Nobody loses: each catch is a giggle, and the round ends after a minute
  with a cheer and a shower of sweets.
- **Hide and seek, I seek** is on land. The player counts to ten while the marshmallow beavers run off to hide behind props
  within about 40 m. Hidden ones giggle now and then, shown as a little "hee hee" above their hiding place when the player is
  near enough to hear it. Walking up to one finds it, and it pops out and follows the player. When all are found there is a
  cheer and a shower of sweets.
- **Hide and seek, I hide.** The one asked and the nearest others within 35 m, four at most, gather where the player pressed
  Play and count to ten while the player runs off to hide. Then they look: each goes from one hiding prop to the next within
  about 50 m, looks from beside it for a moment, and now and then goes straight to the prop nearest the player. They walk a
  little slower than the player (3.2 m/s to 4), so a player who sees one coming can sneak round to the other side. Near the
  player (10 m) they giggle, so the player hears them coming. A seeker finds the player within 7 m when no hiding prop is in
  between, and right next to them anyway. Being found is fun, not losing: the finder giggles, cheers with a hop, and goes
  back to where they counted. The round ends when all have found the player, or after a minute, with a shower of sweets
  either way. The issue's "when all have looked" is read as "when all have found you"; a player that stays well hidden
  plays the whole minute. A first try puts the first find at about 5 s when hiding 12 m off, 10 to 15 s at 30 m, and at
  45 m most of the minute goes by. Numbers to tune on a tablet.
- **Waking** is only by the Wake up button. The waking game's clock stands still while the beaver dreams, and waking moves it
  to dawn as a plain sleep does.

## Controls

| Control | Keys | Touch | In the dream |
| --- | --- | --- | --- |
| Move | WASD or arrows | stick | walk and swim |
| Dive | Space | Dive | hop, leap |
| Slap | T | Slap | splash |
| Do | E | Do (shown as Play) | start tag or hide and seek |
| Hide or seek | 1 or 2 | I hide, I seek | pick, when hide and seek asks |

## How it is built

The dream is its own small world with its own rules, scene, and screen, so it never touches the waking game's state.

- `src/sim/dream.ts`: the dream's state and rules, pure and seeded (the land, the beaver, the sweets, the marshmallow
  beavers, tag, hide and seek both ways), with unit tests.
- `src/render/dreamView.ts`: the candy land scene in three.js with its own canvas, made when a dream starts and thrown away on
  waking. Marshmallow beavers are the game's beaver model in pastel colours, and the player's is the same model painted
  with a rainbow (`dreamPlayer` in `src/render/dreamBeavers.ts`).
- `src/ui/dreamScreen.ts`: the dream screen over the game, with the sweet count, the prompt, the hide or seek buttons, game
  lines, the touch buttons, and Wake up. `main.ts` stops the waking game's step and drawing while the dream screen is open.

## Open questions

- Should the waking game ever hear about the dream, such as a line from Mama in the morning?
- A sound for the giggles and the cheer waits for #340.
- The frame rate on the tablet with the dream's own canvas.
