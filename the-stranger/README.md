# The Stranger

A single-file, offline classroom demo of **why prompts work**. A student's question sits on
the screen with three toggleable blocks of text beside it, and the "AI" answers. Flip a lever,
ask again, and the answer changes in exactly one dimension.

Open `index.html`. No install, no accounts, **no network of any kind at runtime** — every
response is hand-authored and baked into the file, so it behaves identically on a projector,
on a phone with airplane mode on, and off a thumb drive in a room with no wifi.

**Companion:** `presenter-sheet.html` / `The-Stranger-Presenter-Sheet.pdf` — the live roleplay
script in three acts, house rules, a running order under 12 minutes, discussion questions, and
a second page of eight target cards to print and cut out.

---

## The three levers

| lever | what it adds to the prompt | what it fixes |
|---|---|---|
| **1 — Context** | who I am, what class, what I'm working with | an answer aimed at everybody, which is an answer aimed at nobody |
| **2 — Success spec** | what a finished answer looks like: format, length, audience, what to include | a right answer you cannot use tonight |
| **3 — Expert keywords** | the domain's vocabulary | "the bottom gets stretched" when you needed *tension* and *neutral axis* |

The assembled prompt is on screen the whole time, colour-coded to match the levers, so a room
watches the prompt grow as the toggles flip.

## Four questions, sixty-four hand-written answers

| scenario | the question | why it's here |
|---|---|---|
| The test | *Help me get ready for my test.* | the classroom thread — sophomore biology, two hours, a Friday test |
| The bridge | *Why do bridges stay up?* | the keyword showcase — load path, bending moment, neutral axis |
| The email | *Write an email to my boss.* | workplace relevance — asking a short-staffed manager for two days off |
| The essay | *Here's my essay. Is it any good?* | a real draft is attached in all eight states; only the success spec ever says "don't rewrite it for me" |

Eight lever states per scenario. The four states where the success spec is off get **three**
alternate answers each, one per target card — 16 authored responses per scenario, **64 in
total, ~25,700 words**, written from a blank page each. No templating: an automated gate fails
the build if any two of the 64 share more than 5% of their sentences (current worst: **0.00%**).

### The no-strawman rule

The all-levers-off answer is **competent but aimed at nobody** — general, hedged, covering
every case because it cannot tell which one you are, and ending by asking for the thing the
context lever would have supplied. It is not stupid and it is not broken. The demo collapses
the moment a room decides the bad answer was rigged, so the bland answers were written to
survive being read aloud to a colleague.

Each single-lever state improves in exactly that lever's dimension, and nothing else: context
alone is personal but shapeless; success spec alone is the right shape filled with generic
content; keywords alone is expert register aimed at the wrong person. The isolation notes are
in a comment block at the top of the built `index.html`, one sentence per state.

## Two stage mechanics

**The target deck** (lever 2). Somebody has to decide what a good answer looks like. If the
asker doesn't, the model does — silently. With lever 2 off, pressing Ask deals a card
(*Length: exhaustive*, *Audience: someone who missed the whole semester*, *Format: dense
paragraphs*…) and the answer is written to that card. The deck lives **inside the lever 2
panel**, and turning the lever on strikes the card names through and shoves the deck aside:
you took the decision back. Eight cards ship as a printable cut-out sheet so the presenter can
run the same beat live with paper.

**The jargon meter** (lever 3). Every response has its domain vocabulary pre-tagged. A counter
under the answer tallies the terms as they stream, and a toggle lights them up in the text.
Keyword-off answers carry 0–4. Keyword-on answers carry 15–20, of which **13–20 are words the
student never typed** — handed over for free because the prompt signalled a register.

## Classroom features

- **How to use it, on screen.** A how-to sheet opens on every load: the three levers, what
  every control does, and the shape of the twelve minutes. Dismiss it with `Esc`, a tap
  outside it, or *Got it*. The **?** at the top right brings it back at any point, at any
  screen width — it is the one control that never goes away.
- **Settings (⚙).** The menu beside the **?**. **Presentation mode** is the projector build of
  the app — big type, the 1–10 class score strip, pin-to-compare, and the card picker inside
  lever 2; switch it off and you are in student mode. The **presenter's notes** sit inside it:
  the three acts as stage notes — what to say, what to do with the printed deck, the line each
  act lands on — plus the house rules, the running order and the discussion questions. It is
  the presenter sheet's script cut down to what you can read at a glance with a room watching.
  Below that, the expert-term highlighter and a way back to the how-to sheet or the closing
  slide. On a phone the mode switch and the closing slide move into this menu, so the toolbar
  stays a thumb wide.
- **Scoreboard.** Score each answer 1–10 from the room; the chart plots score against levers
  pulled and the curve climbs across the session on its own.
- **Compare.** Pin any answer beside the next one for A/B.
- **Presenter mode** — projector-sized type, class scoring, compare, and a card picker for
  rehearsal. **Student mode** — self-paced, smaller type, an eight-step guided walkthrough
  through the levers ending in three *"which lever would fix this?"* questions with written
  feedback on every option, right and wrong. Both modes announce what they change in a banner,
  and either can be reached from the mode switch on the toolbar, from Settings, or with `M`.
- **Closing slide:** *When AI gives you a bad answer, ask which lever you left unpulled.*

Keys: `1` `2` `3` levers · `Enter` ask · `Space` skip typing · `H` highlight · `R` replay card ·
`P` pin · `S` scoreboard · `M` mode · `N` presenter's notes · `?` the how-to sheet · `Esc` close
anything.

## Theme

Murray State. MSU Blue `#002144` is the surface family, MSU Gold `#ECAC00` the accent and
lever 1, Lite Blue `#00A4E3` lever 2. Red Orange `#FF4500` is reserved for a genuine failure
state — this app has exactly one, a wrong answer on a walkthrough quiz — so it never shows up
as decoration. Lever 3 keeps its violet: it is the third leg of a colour code that is also
printed on the presenter sheet and on the cut-out target cards, and the paper has no fourth
ink to give it.

## Build

`index.html` is generated; do not edit it directly.

```
node build.js            # src/ -> index.html (refuses to emit any network or storage call)
node build.js --check    # parity check, writes nothing
```

The authoring pipeline is Python, and is only needed if you change a response:

```
python tools/validate.py    # merges src/content/*.json -> src/content.json, enforces the gates
node   build.js
python tools/companion.py   # presenter-sheet.html + the PDF
python tools/playtest.py    # drives all 64 states in headless Chromium
```

`tools/validate.py` enforces seven content gates: every tagged term occurs verbatim on a word
boundary, no term is a substring of another in its list, keyword-on states carry ≥10 terms
absent from their own prompt, keyword-off states carry ≤4, no pair of variants shares >5% of
its sentences, the card shapes hold (dense = no headings or bullets anywhere; listicle = exactly
ten items), and the markdown stays inside the renderer's subset.

`tools/playtest.py` drives the built file in headless Chromium with the network hard-blocked
and checks all 64 states render their authored text, the jargon counter equals the tag list
exactly, every tagged term actually got marked in the DOM, the typewriter is progressive and
skippable, the card draw replays, and the layout survives a 390×844 phone and a 1920×1080
projector.

> Note on convention: every other demo here builds with `node build.js` alone, and this one
> does too. The Python tools are additive — content validation and browser acceptance tests
> that have no JS equivalent in the repo yet. If that split is unwelcome, the validator is the
> piece worth porting; the build itself is already Node.

## Source layout

```
index.html                     built, self-contained, 281 KB
build.js                       src/ -> index.html, with the offline guard
presenter-sheet.html           the printable companion
The-Stranger-Presenter-Sheet.pdf
src/app.template.html          all markup, CSS and app code; one __DATA__ placeholder
src/content/<scenario>_on.json the four success-spec-on responses per scenario
src/content/<scenario>_off.json the twelve success-spec-off responses (4 states x 3 cards)
src/content.json               merged + gate-checked bundle (generated by tools/validate.py)
src/scenarios.json             the four questions, their three lever blocks, the 8-card deck
src/learn.json                 student walkthrough steps, quizzes, the attached essay, closing line
src/AUTHORING.md               the rules the responses were written to — read this before editing one
src/essay-draft.md             the student essay attached in all eight states of scenario 4
tools/                         validate.py, companion.py, playtest.py
```
