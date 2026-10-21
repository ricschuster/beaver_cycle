# Partners between players: the lodge and the kits

Design note, session 165. Status: the ask and the yes are built (#712, note [42](42_multiplayer.md), "Partners between players").
What is left of [#666](https://github.com/ricschuster/beaver_cycle/issues/666) is the new lodge two partners build together (Q110)
and a kit for each of them (Q111). Both need more of a guest than there is today, so this note says what is missing, proposes an
answer for each open point, and lists the questions for the author. The author's answers are in the last section.

## What a guest is today

A guest is a thin client. The host runs its beaver (`src/sim/guests.ts`) and the world is the host's. A guest has no lodge, no
store, no nest, no sleep, no age and no family. It walks, swims, gnaws, drags logs, builds and mends dams, carries and gives food.
The host has `world.lodge`, `world.store`, `bornAt`, `neighbours` and the life stages. So "build a new lodge together" cannot yet
be done: nobody but the host can place a log on a lodge, go in, eat from a store or sleep.

## The proposal, in the order it would be built

1. **A pair lodge.** The world gets a list of lodges for pairs, `pairLodges`, each with the two player ids. It is an ordinary
   `Lodge` (wood, wear, pond, door) so the dome, the store, the water door and the repair rules are reused. Either partner can
   place logs on it, mud and rocks as on a dam, and mend it, and the chime and heart go to the other one (note 42). When it is
   whole, both partners can swim in, eat from its store and sleep on their own nests (`NEST_SPOTS` has seven).
2. **Guests get a home.** A guest that goes in is on the host's inside scene of that lodge, standing on its own nest. The host
   draws the room for itself only when the host is in; a guest draws the room on its own tablet from the snapshot, as it does the
   valley. Night passes fast only when every player is asleep (note 42), so sleep becomes a per player flag.
3. **Kits.** On the first day of spring after a pair lodge is whole and both partners live in it, each partner gets its own kit
   (Q111): one baby for the host, one for the guest, born on a nest in that lodge, with the coat of one of its parents in a shade
   (Q59). Each player then plays its own baby from the next morning. The old beaver becomes Mama or Papa in the lodge.
4. **Guests age.** A guest gets `bornAt` and the stage rules of its own, so a baby guest is small, cannot gnaw, and grows up in a
   year like the host's beaver. Today every guest is grown.

Step 1 and 2 are most of the work, 3 and 4 follow. Each step is a PR of its own with a playtest on the emulators.

## Questions for the author

1. **Whose lodge, and what about the old one?** The player's first lodge stays as a former home (Q63). When two players pair, does
   each one's old lodge stay as it is, and the new one is raised beside a pond they pick together? Proposal: yes, the old lodges
   become former homes, and the new lodge is raised wherever the two of them put the first log.
2. **Who may start the lodge?** Either partner can put the first log. Both have to help to finish? Proposal: either one starts, both
   (or one alone) can finish, and it is shared the moment the first log is down, so no one can lose it.
3. **What if one partner leaves the game?** A friend closes the game or the tablet sleeps. Proposal: the pair stays and the lodge
   waits for the friend, like a family that is away. If the friend never comes back, the host's world keeps the lodge as a former
   home after a long time away. Do you want the pair to end instead, or only when the friend says so?
4. **Can a pair end?** Today a pair lasts until a player leaves. Do the partners need a way to stop being partners (a button,
   asking again), or is a pair for life, as in the single player game, where a partner stays?
5. **A kit each, or one kit for the pair?** You answered "each gets their own kit" (Q111). So a pair has two kits every spring?
   Proposal: one kit each, in the first spring only, then one kit for the pair each spring, played by the partner whose turn it is
   (they swap). Or two kits every spring. Or one kit each only, and they grow up, then the next kit.
6. **Who plays the old beaver?** When the host's kit is born, the host's old beaver turns into Mama or Papa. Does the other
   partner's old beaver turn into the second parent of both kits? Proposal: yes, each kit has the two partners as its Mama and Papa.
7. **A baby in a lodge with a grown friend.** If one player is a baby and the other still an adult, they cannot be partners (both
   have to be adults). Should a baby be able to be asked to *join* the lodge of a friend, to live with the friend's family? Proposal:
   not now.
8. **Sleep.** Night passes fast only when everybody sleeps (note 42). Is it fine that a player who cannot sleep (outside a lodge,
   no nest) holds up the night for the rest? Or does the night go when every player that has a lodge is asleep? Related to Q113.
9. **Two pairs.** With four players there can be two pairs. Do they need two lodges (yes, one each), and may a pair also use the
   other pair's lodge to sleep in? Proposal: only your own pair's lodge, and the other pair can visit the room but not sleep.

## What is not asked

The transport, the look card, the dialog and the gifts are done. Hide and seek and dreaming together (Q113, Q114) are separate
issues. A new pair after one partner left is not planned.

## The author's answers (session 165)

| Q | Answer | What it means for the build |
| --- | --- | --- |
| 1 | OK. | Old lodges become former homes, the new lodge stands where the pair puts the first log. |
| 2 | Shared, either can finish. | The pair lodge belongs to both from the first log. |
| 3 | Wait for them. | A partner who leaves keeps the pair and the lodge. The lodge waits like a family that is away. |
| 4 | A pair can stop. | A button or a second ask ends it. The lodge is then a former home of both. Not built yet, to be designed with step 1. |
| 5 | Two kits every spring. | Each partner gets a kit every spring, so a pair has two kits a year, one for each player to play. |
| 6 | "Grandparents, if I understand correctly." | Read as: the two old beavers are Mama and Papa of the two kits, and become the grandparents when those kits grow up and found a pair of their own. The sim already keeps old parents as former homes, grandparents in the family tree are for later. Open to correct. |
| 7 | Not now. | A baby cannot join a friend's family. |
| 8 | This is the sleep outside a lodge question. | It is [#661](https://github.com/ricschuster/beaver_cycle/issues/661), still open. Until it is decided the night rule is not touched by this work. |
| 9 | Visit but not sleep, family only. | A guest cannot go into a lodge today, so nothing changes: the inside of a lodge is for its own pair (and its kits). Visiting stays a thing for later, if at all. |

Build order stays as above. Step 1 (the pair lodge, built by either partner, shared from the first log) comes first.
