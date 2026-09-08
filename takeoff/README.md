# Takeoff

*Formerly "Undershoot" — renamed for presentation; internal module names keep the old word.*

**Draw the curve, then see it.** A single-file, offline demo about what has
happened to machine capability since ChatGPT — built around the fact that almost
nobody draws the curve steeply enough, and that the one time they finally do, it
turns out to be the wrong curve.

Open `index.html` in any browser. No install, no build step, no network.

---

## What it is

Three acts, in the order that makes them land.

It assumes the audience knows nothing — not what a benchmark is, not what any
of these models are called, not that any of this is measured at all.

**Act I — Draw it.** An opening screen explains the exercise in plain words.
Then five tests. Each one first explains what it actually measures, shows a
concrete example of a single task from it, and gives a human reference point —
*then* shows the real scores up to a cutoff and asks you to drag a forecast
across the rest. The truth animates over your line and you find out how far out
you were, as a multiple rather than a difference, because that is how people are
wrong about this. Both axes are labelled on every chart, and the time axis picks
a month step from the span so it always carries enough marks to read a scale
off — a year-only axis left the sixteen-month round with a single tick. Time
values are drawn from a ladder of round durations, so the task-length chart
reads 1 min · 5 min · 30 min · 2 hr · 8 hr · 2 days rather than 1.7 hr and
33.3 hr.

| Test | What it measures | Shown | Revealed |
|---|---|---|---|
| 1 | Fixing real bugs in real software | 33.4% → 49.0% | **80.8%** — a plateau, then the exam was retired as contaminated |
| 2 | Science questions PhDs get wrong | GPT-4 at 39% | **94.1%**, past the 69.7% PhD line since Sept 2024 |
| 3 | How long a job it finishes alone | 3.5 min → 60 min | **11.3 hours**, doubling every 89 days lately |
| 4 | What a fixed ability costs | $37.50 → $7.50 per million | **$0.18** — 208× cheaper in 23 months |
| 5 | Grid puzzles a child can solve | five years near zero | **87.5%** in one announcement… |

Test 5 ships the puzzle itself, playable, so the room can solve it in two
seconds before finding out that machines could not.

Round five then turns. Three months after that 87.5%, the same model scored 4%
on ARC-AGI-2. Then ARC-AGI-3 — 135 interactive games with no rules and no stated
goal — where the honest picture is stranger than a single number: an average
human tester scores 48%, GPT-5.6 Sol scored **13.3%** through the standard
harness and **38.3%** with two settings changed so it could keep its own
reasoning between turns, and bare models on ARC Prize's own private run scored
**0.51%**. Same month, same systems, beating PhDs on science questions. Rounds
one to four teach the room to guess high; round five is why that is not the
lesson, and why a startling share of any headline number is decided by how
somebody wired the system up.

Every chart's time axis runs to August 2026. Where a series genuinely stops
earlier — SWE-bench Verified was retired in February 2026, and Epoch
stopped publishing the cost curve in February 2025 — the line ends there and the
chart says which of those happened.

**Act II — The cadence.** 123 model releases since ChatGPT on a scrubbable
timeline, filterable by openness and by region. The height axis is labelled
*roughly how capable — a generation band, not a score*, which is the most it can
honestly claim. Hollow rings are models anyone
can download and run; solid dots you can only rent. Press play and watch the
gaps shrink from months to weeks. Covers Gemma and MedGemma, Phi, OLMo,
Nemotron, Granite, Falcon, Mistral and Devstral, EuroLLM and Poro, the Cursor
and Windsurf coding models, gpt-oss — and the full Chinese field: DeepSeek,
Qwen, Kimi, GLM, Hunyuan, MiniMax, Ernie, Yi, InternLM, Seed, LongCat, MiMo and
more. Capability-unlock cards fire at their dates, including the ones later
walked back.

**Act III — What it can actually do.** Six domains, not one, plus a short *Elsewhere* round-up:

- **Proteins** — AlphaFold and the 2024 Nobel Prize; a fluorescent protein evolution never made; a whole fruit-fly brain wired, after 33 person-years of human proofreading.
- **Medicine** — an AI-discovered drug through a randomised Phase 2a trial; an AI reading mammograms with fewer false negatives than six radiologists; and, on real patient records rather than exam questions, models scoring 16–25 points *worse* than clinicians.
- **Weather** — beating the European Centre's own forecast on 97.2% of targets, in eight minutes, now running operationally.
- **Materials** — 2.2 million candidate crystals, and a flagship "new" compound that was first reported in 1972 and sat in the model's own training data.
- **Mathematics** — where the potential showed earliest, because a proof is checkable. Erdős #1196, the unit distance conjecture disproved after eighty years, AlphaEvolve beating a 1969 record — and the month someone announced ten solved open problems that were ten literature citations.
- **Software** — 30-hour autonomous sessions, and the randomised trial that found experienced developers **19% slower** with AI tools while believing they were 20% faster.

Every entry separates **what the machine did** from **what the humans did**,
because that distinction is where nearly all the overclaiming lives.

---

## Sourcing

Every number on screen resolves to a source in `src/data.js`, and each carries a
verification status. The sources are the labs' own model cards, the benchmark
maintainers' own leaderboards, the papers, and the mathematicians' own blogs —
checked against those primaries while this was built, not taken from aggregators.

Seven widely-repeated claims were **cut** for failing that bar, and the app
displays them, with reasons, under *Cut from this demo*:

- A claimed counterexample to the Jacobian conjecture — traced only to a hobbyist
  site, no arXiv listing, and the attribution contradicted itself between sources.
- Erdős Problem #793 — a tweet from a credible mathematician, but no paper.
- Perfect 42/42 AI scores at IMO 2026 — one secondary source, no corroboration.
- "Claude Fable 5 scores 95% on SWE-bench" and "Claude Opus 5 scores 64.7% on
  Humanity's Last Exam" — neither appears on the benchmarks' own leaderboards;
  the actual HLE leader is Gemini 3.1 Pro at 46.44%.
- A 2026 point on the cost-of-capability curve — Epoch has not published one
  since March 2025, so the line stops where the data stops.
- A widely-repeated critique that a robotic lab's 41 "new" materials were
  already known — could not be located or verified, so it was replaced with two
  things that could be: a peer-reviewed critique in *Chemistry of Materials*,
  and the fact that the original paper's abstract and main text disagree with
  each other.
- Gemma 4 and MiniMax M3 — both appeared in a first research pass; neither
  exists. Removed before shipping.

Settings → **Run the self-test** proves the dataset's integrity live, in front
of whoever is asking: that every plotted point resolves to a declared source,
that no source is cited and never used, that the hidden data genuinely postdates
the shown data, that the scoring is monotone and scores a perfect guess at 1.0×,
and that the doubling time stated in Act III matches the points plotted in Act I.

---

## Running it

```
open index.html                 # that is the whole thing

node build.js                   # rebuild index.html from src/
node build.js --check           # verify generated index.html without writing
node src/playtest.test.js       # 112 dataset and engine checks
node src/playtest.test.js -v    # ...listing every one
node tools/integration.mjs      # 192 browser checks, headless
node tools/integration.mjs --headed   # watch it play itself
node tools/pdf.mjs              # re-render the presenter guide PDF
node tools/pdf.mjs --check      # verify the canonical guide/PDF without writing
```

The integration suite drives the built file in Chromium (or an installed Chrome or
Edge when managed Chromium is unavailable): it dismisses the how-to panel and the
intro, drags a forecast, reveals it, plays all five tests, opens every worked
example, solves the grid puzzle, triggers the twist, exercises both timeline
filters across all four regions, walks the three acts, opens and closes all three
sheets by button, backdrop and <kbd>Esc</kbd>, checks the presenter's notes still
carry the guide's figures, and asserts no horizontal overflow, 40px tap targets,
a how-to sheet whose dismiss button is on screen, and the Reveal button above the
fold at eight viewports from 320×568 up — plus presenter mode at 720p and 1080p.
It also asserts the page makes zero network requests and never touches
`localStorage`.

**Five of those 192 currently fail, and have since the suite was committed.** They
assert an accessibility revision that was never built: a keyboard-and-screenreader
forecast control (`#forecast-end`), roving-focus act tabs (`#act-tab-1`), a
release list beside the timeline canvas (`#tl-list`), and `aria-pressed` on the
timeline filters. The suite records them as failures rather than crashing on them,
so the other 187 still report. They are a real gap, left visible on purpose.

The node suite checks the data rather than the pixels: that every plotted point
resolves to a source, that no plain-language explanation leans on jargon, that
the grid puzzle's examples and its answer obey one consistent rule, that Act III
spans at least five domains with mathematics as a minority of them, that every
open model declares a licence, and that every family the brief called out is
actually on the timeline.

---

## Files

```
index.html                        the demo — one file, everything inlined
presenter-guide.html              printable 25-minute session plan
Takeoff-Presenter-Guide.pdf    the same, as a PDF
build.js                          concatenates src/ into index.html
SPEC.md                           the original brief, and where this departed from it
src/
  data.js         every number, every source, every verification status
  engine.js       scales, the guess curve, scoring, the doubling-time fit
  chart.js        the canvas: draws the data, takes the drag, animates the reveal
  timeline.js     Act II
  app.js          the three acts, the self-test
  styles.css      Murray State palette; the fold rule
  template.html   the shell build.js fills
  playtest.test.js
tools/
  integration.mjs browser checks
  pdf.mjs         guide → PDF
```

---

## Presenting it

`presenter-guide.html` (and the PDF) is a 25-minute session plan: what to say at
each round, where to pause, the questions you will get and how to answer them,
the misconceptions to head off, and a twelve-minute cut if that is all you have.

Settings (⚙, top right) → **Presenter mode** scales the interface for a
projector, and **Presenter's notes** opens that same session plan on screen —
distilled from the printable guide, laid out for reading standing up, with the
beats flat and the reference material folded. It is the guide's content, not a
second version of it: change the guide, re-distil the panel.

Every load opens a **How this works** panel explaining the drawing exercise and
the controls. It is dismissed by tapping outside it, by <kbd>Esc</kbd>, or by
its own button, and the **?** beside the settings cog reopens it at any point.
Nothing is remembered between loads, because the app stores nothing at all.

The single most important instruction in the guide: **let people actually draw.**
The demo dies if the presenter drives it and narrates. Hand the laptop round, or
put it on a screen and have the room follow on their phones — it is built
phone-first for exactly that.

---

## A note on shelf life

This is a dataset about a fast-moving field, verified against primary sources in
August 2026. Several figures are already moving, and the app says so. Editing
`src/data.js` and re-running both suites is the maintenance path; the tests check
internal consistency, so a number updated in one place and not another fails
rather than ships.
