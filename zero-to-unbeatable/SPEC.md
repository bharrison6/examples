# Zero to Unbeatable — original design brief

This is the brief the demo was built against, recorded verbatim. Notes on where the
implementation interpreted or deliberately departed from it follow at the end.

---

Build me "Zero to Unbeatable" — a single-file, phone-first web app that teaches how AI
learns by letting a student repeatedly play tic-tac-toe against an AI BETWEEN
its training runs, so they personally experience it going from pushover to
unbeatable. No AI API calls — all learning happens live on the device.

CORE LEARNING ENGINE (non-negotiable — real reinforcement learning, no faking):
- Tabular Q-learning (or afterstate value learning — your choice, but tabular
  and inspectable). The agent starts with ZERO knowledge and learns ONLY from
  win/lose/draw rewards through played games. Absolutely no hard-coded
  strategy, no heuristics, no minimax anywhere in the agent itself. A fresh
  agent must play uniformly at random.
- Epsilon-greedy exploration with decay across training, visible in the UI.
- Training opponent mix: self-play PLUS a meaningful fraction of games against
  a random-moving opponent, so the agent explores the full state space and has
  no blind spots against weird human openings. This matters — pure self-play
  agents can converge while still being beatable by unusual human lines, and
  a student finding such a line mid-demo destroys the entire lesson.
- Train in both roles (moving first and second); the human can play either.
- Optional seeded RNG mode so a rehearsal run reproduces exactly.

THE CORE LOOP (this is the whole product — get the pacing right):
- PLAY MODE: a clean touch tic-tac-toe board. Student plays the AI's current
  self, alternating who goes first. Running scoreboard.
- TRAIN BUTTON: runs a burst of self-play games (selectable: 500 / 2,000 /
  5,000) with a visible training montage — game counter blurring upward,
  mini-boards flickering through games, epsilon decaying, a live win-rate-vs-
  random stat climbing. The montage should take 2–3 seconds and feel like
  watching something practice at superhuman speed.
- ERAS: each training burst creates a new era (Era 0: newborn, Era 1, Era 2…).
  The student's record is tracked PER ERA ("You vs Era 0: 3–0. You vs Era 4:
  0 wins, 1 loss, 4 draws."). A dropdown lets them replay any frozen past era
  — losing to Era 4 and then going back to stomp Era 0 again is a key beat.
- PACING REQUIREMENT: tune hyperparameters and default burst size so the arc
  takes 3–5 training bursts, not one. After the first burst the AI should be
  noticeably better but still clearly beatable; unbeatable play should arrive
  around burst 3–5. If one burst jumps from random to perfect, the student
  never experiences the middle, and the middle is the lesson. Tune this
  deliberately and document the chosen hyperparameters.

MAKE THE LEARNING VISIBLE:
- "WHAT IT LEARNED" CARD after each burst: move-value heatmaps for 2–3
  landmark positions (empty board; opponent threatening three-in-a-row; a
  fork setup), with deltas from the previous era highlighted — e.g. "blocking
  your open row: was 0.0, now +0.9."
- BRAIN INSPECTOR: during play, a toggle overlays the AI's learned value for
  every legal move as a heatmap on the live board, and shows brain size
  ("positions it has seen: 4,812"). The point: its entire mind is a table
  you can read.
- THE ENDING IS A FEATURE: when the agent reaches verified-unbeatable
  strength, show a banner: "You can no longer beat this. Neither can anyone.
  Best case for a human is a tie." followed by a short bridge: tic-tac-toe is
  small enough to tabulate; chess and language are not, which is why big AI
  replaces the table with a neural network — different brain, same idea:
  improve from feedback.

PHONE-FIRST:
- ONE self-contained HTML file, fully offline, no accounts, no install.
  Portrait-first responsive layout, big touch targets, works on any modern
  iPhone/Android and any laptop browser. A 5,000-game training burst must
  complete in about 3 seconds on mid-range phone hardware.

TEACHING EXTRAS:
- A collapsible plain-language "how is it learning?" panel: rewards,
  exploration vs. exploitation, why it plays "dumb" moves early, and the
  honesty note that this brain is a lookup table, not a neural network.
  Include a one-paragraph nod to MENACE (Michie, 1961) — the matchbox-and-
  beads machine that did exactly this — as a historical hook.
- Presenter mode: extra-large UI for projection.

DELIVERABLE:
- The app, plus a one-page printable demo guide: a 15-minute demo script
  built around the arc (stomp it → train → struggle → lose → draws forever →
  the closing line), discussion questions, and misconceptions to address (it
  was secretly programmed with strategy; it "understands" tic-tac-toe; more
  training always keeps producing visible improvement).
- Playtest before finishing and verify ALL of these:
  1. A fresh Era 0 agent's move choices are statistically uniform random
     (chi-squared over a few thousand moves), proving no baked-in strategy.
  2. UNBEATABILITY IS PROVEN, NOT SAMPLED: verify the fully trained agent
     against an exhaustive minimax adversary over EVERY reachable game line,
     as both first and second player: zero losses allowed. Print the
     verification result in the console.
  3. Blind-spot check: zero losses across 10,000 games vs. a uniform random
     opponent: 5,000 moving first and 5,000 moving second.
  4. Pacing check: scripted play-through confirms Era 1 is still beatable by
     a simple naive policy and unbeatable status lands between bursts 3–5
     with default settings.
  5. Performance check: the 5,000-game burst meets the ~3-second budget with
     CPU throttling that approximates a mid-range phone.
  6. The whole app remains a single file that opens from local storage with
     no network access.

---

## Implementation notes and departures

**Where the six verifications live.** 1–4 are in `src/playtest.test.js` (`node
src/playtest.test.js`, 45 checks). 5 and 6 need a real browser and are in
`tools/integration.mjs`, which drives the built `index.html` under Playwright with
`Emulation.setCPUThrottlingRate` at 4×. A subset — the chi-squared test, the exhaustive
search and the 10,000-game blind-spot check — also runs **inside the app**, on demand,
from Settings → Run the full self-test, so the proof can be produced live in front of a
sceptical room. Verification results print to the browser console after every burst.

**Afterstate value learning rather than Q(s,a).** Both were offered; afterstates were
chosen because one number per *position* is the thing the demo is about. The brain
inspector shows a value per square, which is exactly a Q-value, but the table behind it is
indexed by resulting position, so a single table serves both players and both roles and
"its whole mind is 5,478 numbers" is literally true. Boards are stored as base-3 integers,
so the table is a `Float32Array(19683)` and a lookup is an array index.

**The adversary in verification 2 is stronger than minimax.** The brief asks for an
exhaustive minimax adversary. The verifier branches on *every* legal opponent move rather
than only optimal ones, so minimax lines are a subset of what is searched. It also branches
on every move in the agent's argmax set, because ties are broken by coin flip at play time —
so the proof covers every coin flip the agent could make, not one arbitrary tie-break
ordering. About 15,000 complete game lines, both roles, in ~20 ms.

**Three things had to be got right before a provably perfect agent was reachable inside a
few thousand games**, and all three are documented in the engine because each was a real
failure first:

1. *Reverse-order updates.* Forward-order TD(0) was written first. It leaves seven-mark
   endgames with two or three visits and values still near zero after 16,000 games, and the
   agent plateaus a hair short of perfect indefinitely.
2. *Exploring starts, dealt round-robin.* Games that all start from an empty board pile
   practice onto the nine openings while endgames starve. Starts are dealt from a shuffled
   deck of all 4,520 open positions rather than drawn at random, because random draws leave
   a third of the deck untouched per cycle and it is exactly those unpractised positions
   that keep the agent one blunder short.
3. *A tie-break rule about confidence.* An unplayed square and a square known to draw both
   read 0.00. Between them the agent takes the one it has evidence for. This is the only
   tie-break in the agent and it contains no tic-tac-toe knowledge — it does not know what a
   row is. Without it a fully trained agent still throws away roughly one game in a thousand
   by coin-flipping onto a square it has never seen, which is enough to fail verification 2.
   Ties among *tried* squares are still coin flips, so it varies its play, and a newborn —
   every count zero — is still uniformly random over all nine squares.

**Default burst is 5,000, not 2,000.** The brief fixes the three burst sizes and asks that
the default produce a 3–5 burst arc; 5,000 is the size that does, and it is also the size
the brief's own performance budget is written against. 500 and 2,000 remain selectable and
are useful for showing the early wobble in slow motion, but they need many more presses.
Measured over 12 seeds: unbeatable at burst 3–5, mean 3.8, never earlier than 3.

**A fourth landmark position.** The brief asks for 2–3 and names three. All three are there.
A fourth was added — "finish it", where the agent can win immediately — because it is the
*first* lesson learned and without it the era-1 card has no positive delta to show, only
squares falling to −0.95. The four now tell the story in the order the lessons arrive:
take the win, block the row, then the corner trap, which lands a whole burst later.

**The empty-board landmark converges to flat, and that is kept deliberately.** At
convergence every opening square scores 0.00, because with correct play every opening
draws. It looks like a card where nothing was learned. The card says so and explains why,
and it became discussion question 5 in the guide.

**The montage is honestly labelled.** 5,000 games of learning takes 93 ms with the CPU
throttled 4×. The montage is paced to ~2.4 s so there is something to watch; the counter,
the ε reading and the win rate are real numbers from the run in progress, and the app's own
explainer panel says the pacing is for the audience's benefit.

**No link to the printable guide from inside the app.** Other demos in this repo link their
teacher guide from the UI. Zero to Unbeatable does not, because "one self-contained HTML file, fully
offline" is a headline claim, and a link that dead-ends when someone mails just the HTML
would undercut it. The guide is a separate `demo-guide.html` and PDF.

**Murray State theming and the mobile layout, added after the first build.** The brief asked for
phone-first and said nothing about branding; both were revisited on request. The palette is the
university's own (navy #002144, gold #ECAC00, accents #00A4E3 and #FF4500) taken from the Murray
State brand guide, which asks that the accents be used sparingly — so red-orange appears only on
things going wrong, and the value heatmaps run red-orange → navy → gold rather than the
conventional red → green. Two warm hues at the ends of a scale are a colour-blindness risk, so
every heat square also carries its signed number and flips its ink colour to stay legible.

The layout rule that came out of that pass is worth stating plainly: **the TRAIN button is never
below the fold.** The board yields instead — `min(100%, 100dvh − 26u)` — and under 660px of
viewport height the whole interface scales down one notch rather than letting the board win. The
two-column layout is keyed on width *and* aspect ratio, so a phone held sideways gets it and a
portrait tablet does not. Two bugs were found and fixed by measuring rather than looking: grid
auto-placement was starting the right-hand column four rows down (fixed with explicit column
wrappers, which also give the correct single-column stacking order for free), and
`body.presenter #app` out-specified the two-column width cap, so a projector collapsed to one
column with an enormous board. `tools/integration.mjs` now asserts the fold, horizontal overflow,
board squareness and 40px tap targets at eight viewports from 320×568 up, plus presenter mode on
720p and 1080p projectors.

**Act II: nine boards at once, added on request.** Nine independent boards, a mark per turn on any
unfinished board, finished boards lock, first to five boards wins. It became a second act rather than
a second game, because it is the smallest thing that breaks everything Act I relies on, and because
the brief's own closing line ("tic-tac-toe is small enough to tabulate; chess and language are not")
needed something between the two.

Four findings, each measured before it was written down, each fixed only after the measurement said
what was wrong:

1. *The Act I table does not fit, and the reason is not size.* In one-board play the mark counts tell
   you whose turn it is. Here you can move twice in the same board while your opponent works
   elsewhere, so 54% of the board pictures met in a match cannot occur in ordinary tic-tac-toe at all.
   The fix is one extra bit — the table is indexed by (picture, whose turn) — after which Act I's
   entries convert across exactly, all 5,477 of the 39,366 this game needs.
2. *A turn-agnostic value is not merely worse, it is broken.* The first version learned "how this
   board tends to end up" by Monte Carlo, with no turn in the index. Measured: it took **100%** of its
   free wins and blocked **0%** of the threats, and lost 200 matches out of 200 to the hand-written
   CPU. A board with two O's and an empty third is only dangerous if O is about to move, and a table
   that cannot say which averages the two and shrugs.
3. *Undirected exploration stops working.* With ε-greedy alone, 26% of the winning board pictures were
   still unvisited after 10,000 matches, and an unvisited picture reads 0.00 — so the agent kept
   walking past free wins in exactly those positions. It now explores toward whatever it has seen
   least. That rule contains no tic-tac-toe knowledge; it cannot tell a winning square from any other,
   only a familiar one from a strange one.
4. *Which board to play in is arithmetic, not a rule.* The match is worth the sum of its nine boards
   and a move changes one of them, so everything else cancels and the comparison is
   `U[board after, THEM] − U[board now, THEM]`. Both terms read with the opponent to move, which is
   precisely why blocking scores: leaving them on move in a board they are about to win is worth −1.

The headline measurement is recurrence, because that is what decides whether a table can work at all:
at one burst's worth of each, a position comes round 10.3× on one board and 1.06× on nine. The card
after each nine-board burst computes both, live, by playing and counting.

**No proof for nine boards, deliberately.** Act I's ending is an exhaustive search. Here the banner
slot says instead that no such check is possible and that the agent is therefore only ever *good, not
proven* — the ordinary situation for every serious AI system. A `verifyUnbeatable` for nine boards
would be a lie, and there is a test asserting the function does not exist.

**A hand-written rule-based opponent is included as a benchmark** — take any win, block any loss,
otherwise prefer the middle, written out the way a person would explain the game. The learner never
reads it. It answers the question a student will ask: is learning actually better than the rules a
person would write down? Measured across bursts, losses per 400 matches: 200 → 385 → 255 → 110 → 0.
The dip at burst 1 is real — transferred values get overwritten by half-learned ones before the new
knowledge consolidates.

**Nine boards on a phone.** 81 live cells at once would be 36px each, under any reasonable touch
target. The mode is laid out as two square panes side by side instead: the whole match on the left at
a glance, the one board you are playing in at full size on the right. Tapping a board in the overview
moves you into it. The fold, overflow and tap-target checks now run in both modes at all eight
viewports.

**The presenter notes are embedded, not linked.** Settings → Presenter notes opens the whole guide
inside the app. It is not a link to `demo-guide.html` and not an iframe pointing at it: either
dead-ends the moment somebody mails just the HTML, and "one self-contained file, fully offline" is a
headline claim this demo makes and tests. `build.js` lifts the guide's own stylesheet and markup —
both scoped to `.guide` — straight into the single file, so there is one source of truth and the
paper version cannot drift from the on-screen one. A Print button in the sheet prints the notes and
nothing else.

Two things had to be sorted out for that to work. The guide was sized in absolute points for A4,
which is unreadable on a phone, so it was rewritten in `em` off one base — print keeps 7.4pt and the
two-column page, the app scales the base up and drops to one column, and the standalone file is now
readable on a phone too. And the app declares `color-scheme: dark`, which makes the browser paint the
*page margins* #121212 even with a white `html` background; printing flips the scheme back to light.
Both are checked in `tools/integration.mjs`.

**Nothing is persisted.** No `localStorage`, no accounts, no saved eras. Reloading returns
to Era 0. Persisting a trained agent would let a presenter arrive with a pre-trained AI,
which is exactly the demo's failure mode; the guide says so in bold.
