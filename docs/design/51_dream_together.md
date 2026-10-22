# Dream together

Design note, session 177. Status: the author answered the questions (last section). A proposal for [#665](https://github.com/ricschuster/beaver_cycle/issues/665); the popup and the shared sleep (step 1) are built. The author said (Q103 in [44](44_round6_answers.md)): play in the dreams together. Q113
in [45](45_game_questions_round7.md) (do all have to be asleep, can you walk into a running dream, can some wake while others
go on) is answered at the end.

## What there is today

- The dream is one player's and lives on that tablet. `createDreamScreen` in `src/ui/dreamScreen.ts` holds a `DreamState`
  (`src/sim/dream.ts`), steps it with `stepDream` from the local keys, and draws it. The seed is the day and the generation, so
  the same night gives the same land. Candy land and the veggie garden are the two themes ([29](29_dream_candy_land.md),
  [50](50_veggie_garden_dream.md)).
- The dream has marshmallow beavers, boats, hide and seek, tag, the statue game and the plant race, all run by `stepDream`
  with one `DreamBeaver` for the player.
- A guest is a thin client ([42](42_multiplayer.md)): the host steps the world, a guest sends intents and draws snapshots.
- Sleep with friends is still only on paper. Note 42 says night passes fast only when everybody sleeps and a skip needs a yes
  from all (Q91, Q92). `Room` has no sleep state yet: a guest that sleeps gets no ready check, and `canSleep` in
  `src/sim/state.ts` is read for the host's own beaver only. So dream together needs a small shared sleep first.

## The proposal

**Who is in.** A dream is for the players who are asleep. Proposal for Q113: you do not all have to sleep at once, and a
dream can be walked into.

1. The first player to fall asleep opens the dream, on its own tablet as today, with the seed of the night.
2. A popup on the tablets of the others says "Pip is dreaming" (Q103). It stays as a toast and in the friend list.
3. When another player falls asleep (at their own time, in their own lodge) they dream into the same room, next to the
   friends already there. Their bed spot is a free one of the `DreamBed`s.
4. A player wakes alone with the wake button, as today. The dream goes on for the rest and ends when the last one wakes.
   A friend who comes late sees what the others built that night.
   The new sleeper takes its own look's hat and scarf into the room (answer 6).

**Who runs it.** The host, for all. `stepDream` runs on the host with one `DreamInput` per sleeper, and the snapshot carries
the dream (`Snapshot.dream`: beavers, mallows, boats, plants, builds, game state) next to the world, as `Snapshot.game` carries
hide and seek. A guest draws it with the same `dreamView`. A host that is awake itself still steps the dream for the sleepers
on its tablet in the background. A host that sleeps while a guest dreams is one more dreamer.

**What is shared and what is not.** Shared: the land, the beavers of the dreamers, the marshmallows, boats, sweets, kept builds
and the games. Not shared: nothing a dreamer does touches the waking world (as today, the dream changes nothing but what the
dream keeps, `dreamKept`). Kept builds are the host's, one set for all.

**Games with friends.** Tag, hide and seek and the statue game already have a `DreamBeaver` for the player and marshmallows for
the rest. With friends a dreamer takes the place of a marshmallow: the first step lets friends play as hiders, seekers and
runners only when the game is started with "Play" near a friend; the marshmallows fill the other roles. No score, no winner.

**Boats.** A boat takes one beaver, as now. Two dreamers can have a boat each. A boat is made new each night and kept by the
host while the dream runs.

**Night skip.** Dreaming counts as asleep for the ready check (note 42). The skip needs a yes from everybody who is awake and
runs when all are asleep or said yes. A dreamer who wakes ends the skip like any no.

## Not in this first step

- A dream for a guest whose tablet is offline (it wakes, as a guest that leaves the game).
- Voice or the talk card inside the dream (the dream has its own babble, `talkDream`).
- More than four dreamers, and a dream for the friend's family beaver.
- Kept builds from several players: the host's set only.

## Questions for the author

1. **Walk into a dream (Q113).** Proposal: yes, a late sleeper joins the running dream, a wake is for one player only, and the
   dream ends with the last one. Alternative: the dream starts only when everybody who can sleep is asleep (simpler, but one
   awake player blocks it for all).
2. **The popup.** "Pip is dreaming. Go to sleep too?" with a button that walks your beaver to a lodge, or only the news? Proposal:
   only the news, and a button in the popup that is the sleep button when you are in a lodge.
3. **Lodges.** A guest sleeps in its own lodge, as the host does. Can a friend who is in the host's lodge dream? Proposal: yes,
   any player on a nest in a lodge. Sleep outside a lodge is separate (#661).
4. **Who is the marshmallow.** In tag and hide and seek, do the marshmallows play on when friends are in (proposal: yes, so one
   friend alone still has a game), or only the friends?
5. **One theme per night.** The candy land or the veggie garden is chosen at bedtime ([50](50_veggie_garden_dream.md)). With
   two sleepers who choose? Proposal: the first sleeper's choice, the late ones go to the same theme.
6. **Seeing each other.** Do the dreamers see their friend's real look (colour and coat, Q93) or the candy look? Proposal: their
   real look, as in the waking game.

## Built so far

- The popup (session 177): a player who goes into a dream is in `Snapshot.dreaming` (`Room.setDreaming`), and every other tablet
  shows "Pip is dreaming" (or "A friend is dreaming" without a name). Only the host can sleep today, so only the host's dream
  shows. The host's room keeps stepping and broadcasting while its dream is open, so the guests no longer freeze behind it (they
  did before: the dream frame returned before `Room.step`). Checked on the emulator pair.

- The shared sleep (session 178, step 1): `src/net/sleepCheck.ts` is the pure rule and `Room` holds it (`lie`, `wake`, `answerSkip`,
  `sleepNews`), with the `sleep` message of a guest (a bed, a yes or no, a wake) and `Snapshot.asleep` and `Snapshot.skip`. A
  skip of the clock needs a yes from every friend who is awake and runs when all are asleep or said yes (Q91). One no stops it
  (Q92) and no answer in 30 s is a no. A plain sleeper that is refused wakes with the clock where it was; a dreamer stays in its
  dream, which ends only when it wakes, so a dream never ends because of a friend. A card asks the friend ("Pip wants to sleep
  until morning. Come along?") on the host and on a guest. The host's own bed waits in the dark with a wake button. A guest lies
  down on a nest of its own pair lodge (night for the night) and its tablet has no dream button yet. The room moves the clock,
  so a host that sleeps alone still skips at once. Not yet checked on the emulator pair.

- The dream run by the host for guests (session 178, step 2, no screen yet): `DreamState.friends` with `joinDream`, `leaveDream`
  and `handOver` in `src/sim/dream.ts` (a friend walks, swims, hops and slaps by its own `DreamInput`; boats, building, sweets and
  the games stay with the player whose dream it is). `Room` opens the dream with the first guest who dreams, takes later guests as
  friends, hands the dream to a friend when its owner wakes (the games it was in end), and closes it with the last. A guest sends
  `{ t: 'dream', input }`; a dreamer gets `Snapshot.dream` (`src/net/dreamWire.ts`: the seed, the beavers, the marshmallows, the sweets
  taken, the games; the land is made again from the seed, so it is not sent). Only candy land so far, and the host's own dream is
  still its own screen's: the next step puts the host in the same run and draws it on a guest.

- The dream drawn on a guest and the host in the same run (session 179, step 3): with a room the host's own dream is the room's too
  (`Room.lie` takes the theme and seed, `steer`, `dreamInfo`, `takeDreamEvents`), so a host that sleeps while a guest dreams joins as
  a friend, and a guest that sleeps while the host dreams joins the host's dream with the host's land. `viewFrom` (`src/sim/dream.ts`)
  swaps the viewer in as `beaver`, so `dreamView` and the camera need no "me" id; the owner is drawn as a friend. `DreamState.look` and
  `DreamFriend.look` carry hat and scarf (answer 6) and `dreamView` draws each friend as a pastel candy beaver by its id. `DreamLink`
  in `dreamScreen.ts` lets a screen send its input and draw what the room gives back (the host reads the room, a guest its snapshot).
  A guest has the Dream button and the theme choice; it sends `{ t: 'sleep', dream: true, theme }`, opens its screen with the first
  `Snapshot.dream` and wakes with a message. A friend sees no games, prompts or lines of the owner (step 4). Events are not on the wire,
  so a guest has no sparkles from the host's sweets, and it draws at the 20 Hz of the snapshots, with no smoothing yet.

- Sweets and boats for friends (session 179, step 4): `stepFriends` in `src/sim/dream.ts` steps each friend as the beaver of a view in
  which the owner is a friend, so a friend takes sweets (one count and one sugar rush for all) and boards or leaves a boat of its own
  (`DreamFriend.aboard`; a boat takes one beaver, and `handOver` keeps the boat).

- Friends in the games, smoothing and news (session 180, step 4 done): the owner starts a game, and the friends near start with it, as
  people next to the owner (`whoAt`, `isHuman`, `people` in `src/sim/dream.ts`). Tag: friends within 25 m are players; a marshmallow
  beaver that is it may chase a friend, a friend it tags is it (the answer to "who is it when a friend is caught": whoever is caught is
  it, a friend or the owner, and only the one who is it tags); a friend who is it tags by touching a player, the owner too, and a
  friend who wakes while it hands "it" back to the owner. Hide and seek: anyone who walks up to a hider or touches its prop finds it,
  and a seeker that sees the owner or any friend has found someone. The plant race: friends within 35 m each get a bed and a can
  (`DreamGame.cans`), Do tends the friend's own plant, and the veggie beavers fill the beds that are left. Friends touch the golden
  statue too (a rush for all). A friend's `viewFrom` swaps ids in the game so its own plant, can and "you are it" read as the
  player's, and drops the owner's question; `friendPrompt` is its Do prompt (tend, or a boat). Friends are named "Friend" in lines.
  The guest gets the dream's events with its snapshot (`DreamWire.events`, once per guest) and draws between two snapshots
  (`blendDream`). Not on the emulator pair or a tablet yet.

## The author's answers

Session 177. The proposals above stand, with these changes.

1. **Walk into a dream.** Yes, as proposed.
2. **The popup.** Only the news.
3. **Lodges.** Any player if possible, but the author thought only owners can enter a lodge. That is how it is: the inside of a
   lodge is for its own pair and its kits, and a guest cannot go into the host's lodge ([48](48_partner_lodge_and_kits.md), item 9).
   So a player can dream when it can sleep, which is on the nest of its own lodge. A guest with no lodge of its own cannot
   dream until it has a pair lodge or sleeps outside (#661). Nothing changes in who may enter.
4. **The marshmallows.** They play on when friends are in.
5. **One theme per night.** The first sleeper chooses.
6. **Seeing each other.** The candy look, but each dreamer keeps its hat and scarf (the `Look`: no coat colour, the dress stays).

## Steps

1. A shared sleep state in `Room`: who sleeps, who dreams, the popup, the ready check for a skip (this is also what #661 needs). Built, see above.
2. Move the dream step to the host for guests: `Snapshot.dream`, an intent for the dreamer's input, tests with fake rooms. Built, see above.
3. Draw the dream on a guest, the late join, the wake of one player. Built, see above.
4. Friends in the games, the manual (both languages), notes 29 and 42, and the emulator pair for the real run. Built, see above; the emulator run is open.
