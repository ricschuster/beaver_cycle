# Hide and seek between friends

Design note, session 173. Status: the author answered the questions (last section), step 1 is built. A proposal for [#664](https://github.com/ricschuster/beaver_cycle/issues/664), with questions for
the author at the end. Nothing is built. The author said (Q103, Q114 in [46](46_round7_answers.md)): hide behind trees, with the
mechanics of the dream; a note can go to friends who are not too far away, asking if they want to join; the game starts when they
have walked over to the beavers who want to play.

## What there is today

- The dream plays hide and seek with marshmallow beavers ([29](29_dream_candy_land.md)): count to ten, hide behind props, a find
  within 7 m with no prop in between, a minute at most, a cheer either way. It is single player and its rules live in
  `src/sim/dream.ts` on the dream land, not on the real valley.
- Talk (#667, [42](42_multiplayer.md)) can ask "Want to play?" and the friend answers Yes! or Not now. A Yes changes nothing yet.
  This is where a game starts.
- The host is the only one that changes the world, and it sees every beaver (`Room`, `Snapshot`). A guest's tablet shows what the
  snapshot says. So the host can referee a game, and a guest can be told to see less than the host knows.

## The proposal

**Starting.** Two ways in, both end in the same lobby:

1. A Yes to "Want to play?" starts a game for the two of them.
2. A new fourth question on the card, "Anyone want to play hide and seek?", goes to every friend within 60 m (a "note", Q114). Each
   gets the Yes! / Not now card. Those who say Yes walk to the asker. The game starts when every Yes is within 8 m of the asker, or
   after 30 s with whoever has come. Friends who said no or are far off are not part of it.

**Roles.** The asker picks "I hide" or "I seek" on the card, as in the dream (2 big buttons). The others take the other role. One
seeker and several hiders, or one hider and several seekers. With two players the pick decides who is who.

**Play.**

1. The seekers count to ten. Their beaver cannot move for the count and their screen shows the count; the hiders run off, up to
   60 m from where they stood.
2. Seekers look. The host checks every tick: a seeker finds a hider within 7 m when no standing tree, lodge or rock stands in the
   straight line between them, and always within 2 m (the dream numbers). A felled tree is not a hiding place.
3. Found hider: heart over their head, a chime on both tablets, and they walk back to the start. In a game with more hiders the
   others go on hiding.
4. The round ends when all are found or after 90 s (dream: 60 s; real ground is bigger). Everyone gets a cheer, a hop, and hearts.
   There is no score, no winner and no loser. Nothing in the waking game changes: no food, no wear, no clock. The clock keeps
   running, so a round does not stop a night skip.
5. Walking away more than 80 m from the start, sleeping, or closing the tablet drops that player from the game. If no seeker or
   no hider is left, the round ends with the cheer.

**Seeing.** The tablets are often in the same room, so a seeker could look at a hider's screen; that is part of the fun and cannot
be stopped. On the seeker's own screen the host leaves the hiders out of the snapshot during the hide time and the minimap hides
them, so the seeker has to look with the beaver. After the round they are back.

**Where it lives.** A plain `HideGame` in `src/net/` (like `pairs.ts` and `says.ts`): pure data and functions
(`start`, `step`, `drop`), held by `Room`, carried in `Snapshot.game`, no socket. The line of sight uses the trees and rocks the host
already knows (`world.trees`, felled set). Intents: `{t:'say', q:'hide'}` for the note, the roles go with the answer, and
`{t:'role', r}` from the asker. Automated test with fake rooms, then the emulator pair (`tools/emulator-pair/`) for the real run.

## Not in this first step

- Hide and seek with the families' beavers or a marshmallow stand-in. Only players play.
- Tag, swimming games, a score board.
- A bigger game than four players.

## Questions for the author

1. **The note to friends.** One fourth question that goes to all friends within 60 m, or only the one friend in front of you (what
   Talk does now)? Proposal: both, as above.
2. **Who hides.** The asker chooses "I hide" or "I seek". Alternative: the game picks the seeker by turn and the roles swap after
   each round. Proposal: the asker chooses, and a button "Again, swap" after the round.
3. **Seekers cannot move during the count.** Fair, but a guest might think the tablet froze. Proposal: freeze them, show the count
   big, and keep the camera moving. OK?
4. **How big is the playground?** The hider may go 60 m away and the round is 90 s. Too big for the valley's trees? To tune on a
   tablet once there are tablets.
5. **Hiding places.** Standing trees, lodges and rocks. Dams too? A dam is a low wall, so proposal: no, it hides nothing.
6. **Does the family beaver join?** The families nearby do not play (proposal). They only watch.

## Steps

1. `HideGame` rules and tests (pure).
2. Room, snapshot and intents, the note question and the role buttons, English and German text.
3. Seeker view (count, hidden hiders), cheer, hearts, chime.
4. Manual, notes 29 and 42, emulator playtest, and tune on the tablets when they are there.

## The author's answers

1. All: the note goes to every friend within 60 m, and a Yes to "Want to play?" starts a game for two.
2. The asker chooses.
3. Seekers stand still during the count.
4. The playground (60 m for hiders, 80 m for the game, 90 s) is fine for a first try.
5. A dam hides nothing.
6. Families do not join.

## Built so far

Step 1 (`src/net/hideGame.ts`, tested): `invite`, `accept`, `decline`, `step`, `drop`, `frozen`, `hiddenFrom`, `timeLeft`. The
numbers are constants at the top (`NOTE_REACH` 60, `GATHER_REACH` 8, `INVITE_TIME` 30, `COUNT_TIME` 10, `SEEK_TIME` 90, `FIND_REACH` 7,
`FIND_CLOSE` 2, `PLAY_RADIUS` 80). A seeker does not see the hiders it has not found, from the start of the count to the end of the round (the
dream's giggle hint is left out, since a find at 7 m is the only clue). Only the asker's chosen role differs from the others; the others all
take the other role.
