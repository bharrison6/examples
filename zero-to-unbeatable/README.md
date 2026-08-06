# Zero to Unbeatable

A single-file, phone-first demo of how a machine actually learns. You play tic-tac-toe
against an opponent that has never played a game, beat it easily, then train it in bursts and
play it again — until you cannot beat it, and the app proves you never will.

Open `index.html`. No install, no accounts, no network, no AI service. Everything, including
all of the learning, happens on the device in front of you.

**Presenter notes are inside the app** — Settings → Presenter notes opens the full session plan, with
a print button. They are embedded rather than linked, so they work from the single file with nothing
to download. The same guide also ships standalone as `demo-guide.html` /
`Zero-to-Unbeatable-Demo-Guide.pdf`: a timed 15-minute script plus a 5-minute second act, discussion
questions and misconceptions to draw out. `build.js` lifts the guide's own stylesheet and markup into
the app, so the two cannot drift.

---

## The arc

| | |
|---|---|
| **Era 0** | Has played zero games. Every value in its table is zero, so every move ties and it flips a coin. A child beats it. |
| **Era 1** | 5,000 games. Takes a free win, blocks your row. Still loses about one game in six to a casual player. |
| **Era 2** | 10,000 games. Wins dry up. Draws start. This is where the room goes quiet. |
| **Era 3–5** | Somewhere in here the exhaustive search stops finding a line where it loses, and the banner appears. Every game is a draw from now on. |

The key beat is the dropdown: after drawing forever against the newest era, go back and stomp
Era 0 again. Same program, same code — the only thing that changed is a list of numbers, and
the only thing that changed the numbers was playing games and being told won, lost or drew.

## What is actually running

Tabular **afterstate value learning**. One number per board position, meaning *how did this
turn out for whoever just moved*. A board is a base-3 integer, so the entire mind of the agent
is a `Float32Array(19683)` and every lookup is an array index.

```
if the move just made won         target = +1
else if the board is full         target =  0
else                              target = -γ · max over the opponent's replies of V[reply]

V[position] += α · (target − V[position])
```

That is the whole learning rule. `WINNER[]` is consulted only to decide whether a game has
*ended* and what the reward is — that is the reward signal, not strategy. There is no minimax,
no heuristic, no opening book and no rule about rows anywhere in the agent. A newborn is
uniformly random because all its numbers tie.

Using `max` over the opponent's replies rather than the reply the opponent actually played
makes the update off-policy, so heavy random exploration during training does not poison the
values it converges to.

### Chosen hyperparameters

Picked by `tools/tune.mjs`, which scores settings on the **shape of the arc**, not on final
strength — a setting that reaches perfect play in one burst scores badly, because a student
who never sees the clumsy middle never sees the lesson.

| | | |
|---|---|---|
| learning rate | `max(0.80, 1/(1+visits))` | high because tic-tac-toe is deterministic: the TD target carries no noise, so averaging it down only slows things. The first sight of a position moves its value most of the way. |
| discount γ | `0.95` | prefer winning sooner and losing later |
| exploration ε | `1.00 → 0.25`, τ = 14,000 games | long on purpose — exploration is what fills in the odd corners a student might wander into. ε is 0 when it plays you. |
| opponent mix | 60% self-play, 40% versus random | split evenly between moving first and second |
| exploring starts | 20% of games | dealt round-robin from a shuffled deck of all 4,520 open positions |
| default burst | 5,000 games | 500 and 2,000 also offered |

Three implementation choices matter more than the numbers do — reverse-order updates,
round-robin exploring starts, and one tie-break rule about confidence. Each fixed a real
failure and each is explained where it lives in `src/engine.js`, and in `SPEC.md`.

### Measured arc, seed `demo`

```
era  games   seen   eps    wins-vs-random  casual player beats it  verified
 1    5000   5286   0.78           87%             181 of 1000  -
 2   10000   5466   0.62           87%               4 of 1000  -
 3   15000   5476   0.51           87%               2 of 1000  -
 4   20000   5476   0.43           87%               0 of 1000  UNBEATABLE
```

Over 12 seeds: unbeatable at burst **3 to 5**, mean **3.8**, never earlier than 3.

## Act II — nine boards at once

A second mode, reached from the toggle at the top: nine independent boards, a turn is one mark on
any unfinished board, finished boards lock, and the first to win five boards takes the match. It
exists to show what happens to this whole approach when the world gets one step bigger, and three
things break in instructive ways.

**Nothing repeats.** A table can only learn if the same situation comes round again. Measured live
after each burst, at the same budget each act actually trains on:

```
             positions met   different   times each came round
one board           37,141       3,622                   10.3×
nine at once        60,883      57,239                    1.06×
```

A table over whole nine-board positions could never learn anything at all. This one works only
because it looks at **one board at a time** and adds up what it finds — a decomposition a person
chose. Finding such a shortcut by itself is what a neural network is for.

**Most of Act I does not transfer.** You can play twice in the same board while your opponent works
elsewhere, so a board can hold three of yours and one of theirs — a picture ordinary tic-tac-toe can
never produce. 54% of the board pictures met in a match are of that kind. Act I's table hands over
exactly 5,477 entries of the 39,366 this game needs — **14%, free and exact** — and the rest has to
be learned. Turn the inspector on and it tells you what fraction of the squares it is weighing right
now sit on a picture it has never seen.

**The method survives; the state had to grow.** Same rule as Act I — a position is worth the best
thing the player to move can reach from it — but the turn is carried explicitly instead of read off
the mark counts, so unbalanced boards are representable at all. Without that one bit the agent takes
100% of its free wins and blocks **0%** of the threats, which is measured in `src/nine.js`'s notes.
Which board to play in is arithmetic, not a rule: the match is the sum of its nine boards, so
everything except the board you touch cancels.

**Exploration had to change too.** Rolling a die to explore works on 5,478 positions and fails here:
26% of the *winning* board pictures were still unvisited after 10,000 matches, and an unvisited
picture reads 0.00, so the agent walked past free wins. It now explores toward whatever it has seen
least. That contains no tic-tac-toe knowledge — it cannot tell a winning square from any other, only
a familiar one from a strange one.

**And there is no banner.** Act I's ending is a proof; this one cannot have one, and the app says so
where the banner would be. Measured instead against a rule-based opponent written out by hand — take
any win, block any loss, else prefer the middle — which the learner is never shown:

```
burst        0     1     2     3     4
lost       200   385   255   110     0   of 400 matches
```

Arc: 1,000 matches per burst, four bursts, ~100 ms each.

## Look and feel

Murray State's own palette, from the university brand guide: **navy #002144** and
**gold #ECAC00**, with **#00A4E3** and **#FF4500** as the two accents. The guide says to use the
accents sparingly, so red-orange appears only where something is going wrong — a losing value, a
game you lost — and the value heatmaps run red-orange → navy → gold instead of the usual red →
green so nothing falls outside the palette. Every heat square also prints its signed number and
flips its ink to navy on the light end, so the display never depends on telling two warm hues
apart.

Phone first, and specifically: **the TRAIN button is never below the fold.** It is the whole
product, and a student who has to go looking for it stalls the demo. The board is the element
that yields — its size is `min(100%, 100dvh − 26u)` — so on a short screen the board shrinks
rather than pushing the button off the bottom, and below 660px of height the whole layout scales
down a notch (`--u: .94rem`, which still leaves every tap target over 40px). Above 760px wide and
roughly landscape, the page becomes two columns: board on the left, training on the right. That
covers a phone turned sideways as well as a laptop. The integration suite asserts all of this at
eight viewports from 320×568 up — in both modes — plus presenter mode on 720p and 1080p projectors,
so the layout cannot quietly regress. Nine boards would be 81 live cells at 36px each on a phone, so
it is laid out as two square panes instead: the whole match on the left, and the one board you are
actually playing in at full size on the right.

Presenter mode changes exactly one CSS variable.

## Unbeatable means proven, not observed

After every burst the app searches **every game that can still be played against the agent** —
as first player and as second, branching on every square the opponent could choose and on
every coin flip the agent could make between equally-valued squares. About 15,000 complete
game lines in roughly 20 ms, so it runs live and the banner only appears when zero losing
lines exist. The result prints to the browser console after every burst, and the whole battery
can be re-run in front of an audience from **Settings → Run the full self-test**.

## Tests

```
node src/playtest.test.js     # 45 checks: uniformity, unbeatability, blind spots, pacing, nine boards
node tools/integration.mjs    # browser, including modal/RNG/self-test honesty checks
node tools/tune.mjs           # characterise the arc;  --sweep  to grid search
```

`src/playtest.test.js` covers verifications 1–4 from the brief plus the nine-board act, including a behavioural proof
that no strategy is baked in: a newborn takes a free win 42.9% of the time against a chance
rate of 43.3%, and blocks a threat 42.4% against 42.9%. `tools/integration.mjs` covers 5 and 6
— it runs the 5,000-game burst with the CPU throttled 4× (93 ms), asserts the page makes no
network request of any kind, and plays ten proper games against the final era to confirm no
human win is available.

## Building

`index.html` is generated. Edit `src/`, then:

```
node build.js        # concatenates src/ into index.html, copies the guide
node build.js --check # verifies generated source parity without writing
node tools/pdf.mjs   # re-renders Zero-to-Unbeatable-Demo-Guide.pdf
```

The build refuses to emit a file containing any external `src` or `href`, so the single-file
promise cannot rot.

```
src/engine.js          one board: learning, opponents, verification — no DOM, no UI
src/nine.js            nine at once: rules, the bigger table, the ported CPU benchmark
src/app.js             game, montage, eras, inspector, explainers
src/styles.css         phone-first; presenter mode scales one CSS variable
src/template.html      shell with /*__CSS__*/ and /*__JS__*/ placeholders
src/demo-guide.html    the printable one-pager
src/playtest.test.js   verifications 1-4
tools/integration.mjs  verifications 5-6, in a real browser
tools/tune.mjs         hyperparameter sweep scored on the arc
tools/pdf.mjs          guide -> PDF
```

`src/engine.js` carries a CommonJS tail so node can require it; in the browser the guard is
inert and it is just a global.

## Historical note

Donald Michie built **MENACE** — the Matchbox Educable Noughts And Crosses Engine — in 1961
from 304 matchboxes, one per board position, each holding coloured beads, one colour per
square. To move you shook the box for the current position and drew a bead; if MENACE won you
added beads of the colours it had played, and if it lost you took them away. That is a
physical implementation of exactly what this page runs, and it took a couple of hundred games
by hand to make it unbeatable, with no computer at all. The app tells the story in its
"How is it learning?" panel.
