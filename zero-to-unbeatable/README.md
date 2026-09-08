# Zero to Unbeatable

A single-file, phone-first demo of the three different things people call AI, played out on one
tic-tac-toe board. First an opponent whose whole skill is eight if/else rules a person wrote down.
Then one that starts knowing nothing and gets to the same place on its own — you beat it easily,
train it in bursts, play it again, until you cannot beat it. Then that same learner in ULTIMATE tic-tac-toe, one
extra rule bigger, where the shortcut a person chose for it stops describing the game.

Steps 1 and 2 arrive at identical unbeatable play from opposite directions, and the app proves both
with the same exhaustive search. That contrast is the demo.

Open `index.html`. No install, no accounts, no network, no AI service. Everything, including
all of the learning, happens on the device in front of you.

**It tells you how to play.** A short instructions sheet opens on every load — one line on what you
are up against, then the three steps and what each one is for. Escape, a tap outside, the × or
**Play the rules** all dismiss it, and the **?** beside the gear in the brand bar brings it back at
any point (so does
Settings → How to play). It is shown every time rather than once per browser: this thing gets handed
to a new person constantly, and nothing about the app is remembered between loads anyway.

**Presenter notes are inside the app** — Settings → Presentation mode → **Open the presenter notes**
opens a one-screen stage cue card, the full session plan below it, and a print button. They are
embedded rather than linked, so they work from the single file with nothing to download. The cue card
is distilled from the guide directly beneath it and is screen-only; Print still produces the guide's
own printable guide, unchanged. The same guide also ships standalone as `demo-guide.html` /
`Zero-to-Unbeatable-Demo-Guide.pdf`: a timed twenty-minute script across the three steps, discussion
questions and misconceptions to draw out. `build.js` lifts the guide's own stylesheet and markup into
the app, so the two cannot drift.

---

## Step 1 — Rules

A hand-written opponent: an if/else ladder, checked top to bottom, first match wins. It is Newell
and Simon's classic list from their 1972 tic-tac-toe program, and versions of it have been retyped
into introductory programming courses ever since. Most people would call this AI, and for decades
that is what the word meant.

| | rule | fires when |
|---|---|---|
| 1 | Win | a line holds two of mine and an empty third |
| 2 | Block | a line holds two of yours and an empty third |
| 3 | Fork | a square that leaves two winning threats at once |
| 4 | Block the fork | take your forking square, or if you have two of them, make a threat you must answer first |
| 5 | Centre | the only square on four lines |
| 6 | Opposite corner | you are in a corner; take the one diagonally across |
| 7 | Empty corner | three lines each, against two for a side |
| 8 | Empty side | whatever is left |

Every move it makes comes back with **the rule that fired and the squares that set it off**, and the
app prints both — "Rule 2 · Block — you had two in the top row" — with those squares outlined on the
board. The eight rules are listed beside it, and the one that just fired is highlighted. That is the
whole request this step answers: the logic is on the screen.

**A depth dial** switches the lower rules off. `First 2` is win-and-block, which is what most people
write first; `First 4` adds the forks; `All 8` is the ladder. When rules are switched off the panel
greys them out and the app plays a free square instead, which is what a program with no rule for the
situation actually does.

### It is proven too, by the same search

`engine.js` searches every game that can still be played against the learned agent. That search
takes a **policy**, not an agent — `OG.verifyPolicy(movesFor)` — precisely so the rule ladder can be
held to the same standard and reported in the same words. A demo that proves one side and asserts
the other is not making the comparison it claims to.

| rules on | complete game lines | verdict | best play beats it, you moving first / it moving first |
|---|---|---|---|
| 2 | 86,624 | losing lines exist, both roles | 93% / 47% |
| 4 | 26,240 | losing lines exist, both roles | 88% / 38% |
| 8 | 1,384 | **no losing line exists, both roles** | 0% / 0% |

Those percentages are exact, not sampled: a single pass over the position graph in which the ladder
averages over its own coin flips and the challenger takes its best square everywhere. "A losing line
exists" is true of a bot that loses once in a thousand games, so the figure is what separates
*beatable in principle* from *the room will beat it*.

For the beatable ladders the app draws **the game it loses**, move by move, picked as the
representative way it goes wrong rather than whichever losing leaf the search reached first. In
every case the killing move is a fork — which is rule 3, the first rule that got switched off.

Two things worth knowing about the ladder as built:

- **Rules 7 and 8 do the same work.** Once the centre and every corner are taken, "empty side" is the
  only thing left to play, so a seven-rule ladder and an eight-rule ladder are the same opponent.
  Rule 8 is the list being tidy.
- **It is unbeatable in a game, but not correct in every position.** Graded against minimax across
  all 4,520 legal positions, the ladder picks a losing square in **12** of them — and none of the 12
  can be reached in a game against it, because they all have the centre unclaimed and rule 5 takes
  the centre. The learned agent of step 2 practises from positions dealt at random and is right in
  all 4,520. That costs neither of them a game; it is just the shape of the difference. Written
  knowledge covers what the author thought of, experience covers what was met.

Both of those are pinned by checks in `src/playtest.test.js`, so the prose cannot quietly rot.

### Which one is actually better here

The rules. It would be easy to run this demo as "learning beat the hand-written rules" and it would
be wrong. For a board with 5,478 positions the ladder wins on nearly every engineering measure that
matters: a couple of hundred lines against a table of 19,683 numbers, an instant answer with no
training run, and a program a person can read and check. It was finished before the learner had
played its first game.

What rules cannot do is exist for a problem nobody can write down. Change the board to 4×4 and the
eight rules are worthless until somebody works out the new ones. Chess has more positions than there
are atoms on Earth and language has no fixed number at all; nobody has written the ladder for either,
and not for want of trying. Learning is what you reach for when the rules *cannot* be written — which
is the point of steps 2 and 3, and the reason this page says so in its own explainer rather than
letting the demo imply that learning is simply superior.

---

## Step 2 — Learning

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

Over 12 seeds: unbeatable at burst **3 to 5**, mean **4.08**, never earlier than 3.

## Step 3 — Ultimate tic-tac-toe

The third segment at the top. Nine small boards in a 3×3 meta-grid, and **one extra rule**:

> **The cell you play in decides which board your opponent must play in next.**
> Play the centre cell of a board and your opponent is sent to the centre board. If they are sent to
> a board that is already finished — won or full — they may play anywhere. Win a small board by
> three in a row inside it. Win the **match** by winning three small boards in a row on the
> meta-grid.

A small board that fills up with nobody winning it is **a draw, and counts for neither side** on the
meta-grid — the usual convention, and the one the literature uses. If all 81 squares fill with no
meta-line, the match is drawn. The page states all of this on screen; nobody has to arrive knowing
it.

One sentence of extra rule, and everything that made this act comfortable stops being true.

### 1. The shortcut a person chose stops describing the game

Step 3 inherits step 2's method plus one addition a *person* made: score **one board at a time** and
add up. That was defensible when nine boards were genuinely independent. Under ultimate rules it is
the wrong description of the game, in two specific places — and the app measures both after every
burst rather than asserting them, each against a control that has to come out the other way.

**The meta-grid is invisible.** A board's worth depends on where it sits: the centre board is on
four lines of three, an edge board on two. The agent scores a board by the picture inside it, and
those pictures are identical. Over 1,000 measured matches against a hand-written opponent:

| | taken | rate |
|---|---|---|
| a free win inside a board — **the control** | 3,021 of 3,737 | 81% |
| **a move that wins the match** | 489 of 622 | 79% |
| …when it is the only board win on offer | 449 of 547 | 82% |
| …when another board win ties with it | 40 of 75 | 53% |

The control is the point of the first row: board wins are exactly what a per-board table *can* see,
so 81% is the probe proving it has eyes. Against that, a move that ends the **match** is taken no
more often — 79%. When the match-winning move is the only board win going it is taken at the control
rate, because it is just taking a board win and this one happens to end the game. When another board
win ties with it, it flips a coin. There is nowhere in a table indexed by the picture inside a board
to keep "and this board completes a line".

**Where the move sends the opponent is invisible.** Two moves can leave a board looking identical
and send the opponent somewhere they win instantly, or somewhere they have nothing. Counted over the
turns where some legal moves handed over an immediate win and some did not:

```
it handed over an immediate win                     3,110 of 8,627 turns    36%
blind choosing would have                                                   41%
of those, an equally top-scoring move that
would not have was sitting right beside it          1,389                   45%
```

It gives the game away at about the rate you get by not looking, because it is not looking. The
small margin *under* chance is not foresight, and the page says so: taking the square an opponent
needs is a **block**, which is visible one board at a time, and a blocked board is no longer a gift.
It gets that much free and nothing else.

**So it stops improving.** Two hand-written opponents, identical except that one has three extra
clauses — win the match if you can, do not send them somewhere they win, weigh a board by how many
lines of three it sits on. Matches lost of 200, after each burst of 600:

```
burst                    0    1    2    3    4    5
lost to board-local    122   96   81   62   59   54
lost to send-aware     167  139  145  138  124  137
```

Against the opponent that shares its blind spot it learns, and losses more than halve. Against the
one that does not, it improves once and then flatlines. Those three clauses are an afternoon's work
for a person — the send-aware player beats the board-local one **200 matches to nothing** — and all
three are things this memory has no slot for, so no amount of experience puts them in. Finding a
representation that *does* have room for them, without being told, is the next rung and a separate
build.

**Nothing repeats, either**, which is why the obvious fix — a table over whole positions — is not
available. Measured live after each burst, at the budget each step actually trains on. A position
here includes which board you were sent to, because the same 81 marks with the opponent pointed
somewhere else is a different position:

| | positions met | different | times each came round |
|---|---|---|---|
| one board | 37,415 | 3,543 | 10.6× |
| ultimate | 24,424 | 22,653 | 1.08× |

Over 41-move matches. And **most of step 2 does not transfer**: you can play twice in the same board
while your opponent is busy elsewhere, so a board can hold three of yours and one of theirs, a
picture ordinary tic-tac-toe cannot produce. 51% of the board pictures met in a match are of that
kind. Step 2 hands over **5,477 of 37,506** usable entries — **15%**, free and exact — and the rest
starts at zero. Turn the inspector on mid-match and it tells you what share of the squares it is
weighing sit on a picture it has never seen.

### 2. The search space stops being reducible

Ordinary tic-tac-toe has **255,168** complete games, which is why steps 1 and 2 can end in a proof:
the app walks every one of them. Ultimate cannot be walked, and the two reductions people reach for
are both gone.

You cannot treat the boards as interchangeable, because you win three *in a row* and where a board
sits is the whole question. You cannot rotate one board on its own either — that would move its
cells, and its cells are what name the next board. Exactly one symmetry survives: turn or reflect
the whole 9×9 at once, eight ways.

Counting what is left. All of it is recomputed in `src/ultimate.js` and pinned in the test suite:

```
small-board pictures this game can actually produce    18,753  of 19,683
                                     up to symmetry     2,694
table entries the learner can therefore use            37,506

upper bound on whole positions   18,753⁹ × 10 ÷ 8  =  3.6 × 10³⁸
```

The ten is which board you were sent to, or "anywhere" — and it is needed, because in ultimate the
picture is no longer the position. The eight is the one surviving symmetry, and dividing by it is
the *most* symmetry can ever buy, since a symmetric position has fewer than eight images. **Whose
turn it is needs no factor of its own**: marks strictly alternate across the whole grid, so the
counts already say. The result is still an over-count — it includes nine-picture combinations no
single game could reach.

The point of that arithmetic is what it buys, which is nothing. Ignore the rules entirely and you
get 3⁸¹ = **4.4 × 10³⁸**. Do all of the above and you land at **0.81** of it. Counting a billion
positions a second, starting at the big bang, you would still be about **820 billion** times short.

### 3. And the game is solved anyway

Bertholon, Géraud-Stewart, Kugelmann, Lenoir and Naccache, *"At Most 43 Moves, At Least 29: Optimal
Strategies and Bounds for Ultimate Tic-Tac-Toe"*, **arXiv:2006.02353** (2020): the first player has
a forced win, **at most 43 moves**, with the second player able to hold out **at least 29**. Nobody
visited 3.6 × 10³⁸ positions to establish that. They wrote down a strategy and proved it always
works.

That is the three-layer lesson, and the third layer is the interesting one: *a proof does not
require checking every case*. "Too big to search" and "unknowable" are not the same sentence.

**One honest caveat, which the app prints too.** The paper's rules free your choice only when the
board you are sent to is **full**; a board that has been *won* but still has empty squares must be
played in anyway, to no effect. This demo uses the commoner convention, where a won board frees you
as well — and the published strategy leans on sending the second player back into a board the first
has already won, which this page would not allow. Near neighbours, not the same game. The result is
quoted, not claimed for the squares on screen.

### And our learner still has no proof

Steps 1 and 2 end in a banner because the app searched every game. This one cannot, and the app says
so where the banner would be — better motivated now, not worse. The thing you are playing is not
running the published strategy, has never been shown it, and cannot have its tree searched here. It
is only ever *good*, measured. That is the ordinary situation for every serious AI system: chess
engines, self-driving cars, language models. Somebody may have proved something about the
**problem**. Nobody has proved anything about the **program**.

### What carried over unchanged

The learning rule is step 2's, with the turn carried explicitly instead of read off the mark counts,
so an unbalanced board is representable at all. Exploration is count-based rather than a coin flip —
it goes where it has been least, which contains no tic-tac-toe knowledge: it cannot tell a winning
square from any other, only a familiar one from a strange one. Neither is new here; both are written
up in `src/ultimate.js` where they live.

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
down a notch (`--u: .94rem`, which still leaves every tap target over 40px). The instructions sheet
is one of the app's own sheets rather than a second modal mechanism, so Escape, the backdrop tap, the
focus trap and the inert page behind it all come from the same twenty lines that already served the
settings and the notes. Above 760px wide and
roughly landscape, the page becomes two columns: board on the left, training on the right. That
covers a phone turned sideways as well as a laptop. The integration suite asserts all of this at
eight viewports from 320×568 up — in both modes — plus presenter mode on 720p and 1080p projectors,
so the layout cannot quietly regress. Step 3's 9×9 would be 81 live cells at 36px each on a phone,
so it is laid out as two square panes instead: the meta-grid on the left, and the board you were
**sent to** at full size on the right, its squares 41px at 320×568 and never under 36px anywhere.
Ultimate rules make that split more honest than it was for nine independent boards — you do not
choose which board to play in, so the right-hand pane is not a viewport onto something you might
rather be looking at, it is the only board you are allowed to touch. Three exclusive signals carry
the rule: a gold ring that breathes on the board you were sent to, a dashed ring on every live board
when the send has freed you, and a blue ring on the destination of whichever square you are
touching. A line of prose under the panes says which and why on every single turn, and a ✦ on a
square means its board is finished, so playing there hands the opponent the whole grid.

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
node src/playtest.test.js     # 100 checks: the rule ladder, uniformity, unbeatability,
                              #             blind spots, pacing, ultimate  (~2s)
node tools/integration.mjs    # browser, including modal/RNG/self-test honesty checks
node tools/tune.mjs           # characterise the arc;  --sweep  to grid search
```

`src/playtest.test.js` covers verifications 1–4 from the brief plus the rule ladder and the
ultimate step, including a behavioural proof
that no strategy is baked in: a newborn takes a free win 42.9% of the time against a chance
rate of 43.3%, and blocks a threat 42.4% against 42.9%. For step 1 it re-derives each of the eight
rules' own definition and checks that every square the ladder picks satisfies the rule that picked
it, that all eight fire somewhere on a reachable board, that rule 4 answers the double-corner
opening on exactly the four edges the learned agent's landmark independently says are the only
survivors, and that generalising the verifier to take a policy left the learned agent's proof
byte-identical. `tools/integration.mjs` covers 5 and 6
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
src/rules.js           step 1: the eight hand-written rules, why each fired, the depth dial
src/ultimate.js        step 3: ultimate rules, the inherited table, the two blindness probes,
                       the state-space counts, and the two hand-written opponents
src/net.js             NOT BUILT IN. A working MLP and TD trainer, built against the retired
                       nine-independent-boards ruleset and kept as machinery for a later rung.
                       Nothing references it; the build and the tests run without it.
src/app.js             game, montage, eras, inspector, explainers
src/styles.css         phone-first; presenter mode scales one CSS variable
src/template.html      shell with /*__CSS__*/ and /*__JS__*/ placeholders
src/demo-guide.html    the printable session guide
src/playtest.test.js   verifications 1-4, plus the rule ladder and ultimate
tools/integration.mjs  verifications 5-6, in a real browser
tools/tune.mjs         hyperparameter sweep scored on the arc
tools/pdf.mjs          guide -> PDF
```

`src/engine.js` carries a CommonJS tail so node can require it; in the browser the guard is
inert and it is just a global.

## Historical note

Donald Michie and Roger Chambers built **MENACE** — the Matchbox Educable Noughts And
Crosses Engine — in 1961 from 304 matchboxes, one per board position it can face once
rotations and mirrors are folded together, each holding coloured beads, one colour per
square. To move you shook the box for the current position and drew a bead; if MENACE won you
added three beads of each colour it had played, if it drew you added one, and if it lost
you took one away. That is a
physical implementation of exactly what this page runs, and it took a couple of hundred games
by hand to make it unbeatable, with no computer at all. The app tells the story in its
"How is it learning?" panel.
