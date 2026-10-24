# Beaver game: round 5 answers

Transcribed from the answered round 5 handout (`41_game_questions_round5.docx`, dated 2026-10-20, Q77 to Q90). Spelling is tidied
and the meaning is kept. The handout stays the source. The questions come from the author's two pages "beaver game fix up #1 and #2".

| Q | Question | Answer |
| --- | --- | --- |
| 77 | The dam that disappears when mended | Pressed build. Then the dam (that looked broken) disappeared and started new. |
| 78 | Cost of mending a broken dam | Mending a dam should cost less wood, rocks and mud. (Keeping its size is not answered; session 163 keeps the level, #646.) |
| 79 | The lodge door under water when the pond is low | The beaver should be able to go into the lodge any time, except when building the lodge. |
| 80 | Cotton candy boats | Press a button to go in and out. Steer with the stick like swimming. |
| 81 | Dam and lodge built in a dream | They do not stay for other dreams, except if you want to. At the end of the dream you can select to keep them. |
| 82 | Chopping a candy tree | You get candy logs and can peel bark off of them. The peeled bark is sugar and can be eaten. |
| 83 | Other ponds in the dream | Three ponds and a river to play in. Lily pads grow in them, and marshmallow beavers. Also lodges. |
| 84 | The golden beaver statue | It is in the veggie dream and kind of easy to find. There is no statue in candy land. The player picks how long the speed boost lasts. |
| 85 | Choosing the veggie garden dream | You can choose the veggie dream for the first night and any night. |
| 86 | The vegetable beavers | Peas, carrots, tomatoes, radishes and pumpkins. Their names are Veggie, Spice, Planty, Cabbagey, Kale and Lettuce. Start from the beginning of the list and fill until full: the vegetables and names are given out in order, from the first, until the dream has all its beavers. |
| 87 | The player's beaver in the veggie dream | The nose is a pea, the tail is a pumpkin, the body is a tomato, two feet are tomatoes and two are carrots. |
| 88 | What to do in the garden | See who can grow the biggest plant fastest with watering cans. |
| 89 | Bigger than candy land | A bigger carrot juice river and more to find. |
| 90 | More ideas | "I have more ideas for the game. I will fill out the page." |

## Open points

- Q78: whether a mended dam keeps its size is not stated. The code keeps the level and, since #706, charges half the units: about
  5 wood units from 0 to new (`DAM_MEND_FACTOR`). Half is a first guess to tune on a tablet.
- Q79: needs a rule for a lodge door under water (the beaver may enter at any pond level, but not while the lodge is being built).
- Q84: "the player picks the length" is read as a setting (for example short, medium, long) rather than a number to type. Check.
- Q86: read as giving out the five vegetables and six names in order, going round again from the start, until the garden is full.
  Check that this is what was meant.

## Audit of the open points (session 191, #790)

The handoffs from sessions 157 to 162 listed Q77, Q78, Q80 to Q89 and Q116 as "answers still wanted". Every one of Q77 to Q89
has an answer in the table above and a build behind it, so the list was out of date. What is really still open:

| Q | State | Still to ask or check |
| --- | --- | --- |
| 77 | Answered and built (mending, #646). | Nothing. |
| 78 | Built, half the units since #706, the level kept. | Settled: the author said yes to a mended dam keeping its size (session 191). The half is still a first guess to tune on a tablet. |
| 79 | Built (#707). The door is reachable at any pond level, pinned by a test in `lodge.test.ts`. | Nothing. The "not while building the lodge" part needs no rule, as the beaver is outside while it builds. |
| 80 to 83, 85, 87, 88, 89 | Answered and built (#648 to #652, #708). | Tuning only (#762). |
| 84 | Built with a fixed rush (`STATUE_RUSH_TIME`, 20 s). | Settled: the author said a fixed rush is good (session 191). |
| 86 | Built as read: five vegetables and six names in order, the garden full at six. | Settled: the author said it is good (session 191). |
| 116 | Built as three questions and Bye with Yes! and Not now (`src/net/says.ts`, note 42). | The answer was "not sure". Ask what friends most want to say, and whether a babble sound or a heart should go with it. |

Q80 to Q89 can stop appearing in the handoffs. Only Q116 is left, to talk through with the author.
