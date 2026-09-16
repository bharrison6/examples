# 🎯 Engineering Trivia — Should Have Known That

Murray State University · Example projects

**Engineering Trivia** (folder `should-have-known-that/`) is a self-contained,
slider-based estimation game. It is **Demo 11 of 16** in the *AI: From Zero to Takeoff*
tour (Part four, Example projects). Forty numbers an engineer is expected to carry
without looking up — yield strengths, ampacities, psi per foot of water — and no typed
answers: you drag a slider, commit to a guess, and see how it scores.

Three stages appear as tabs under the header, each with the question it answers:

1. **Linear estimates** — 35 questions across five categories (pick your length,
   categories and solo/team mode), scored by percent error.
2. **Log estimates** — the bank's five order-of-magnitude questions (copper resistivity,
   the speed of light, the cardiac-fibrillation current, static-shock voltage, AA
   battery energy), scored by decades off instead of percent, because a percent-error
   scale is meaningless once guesses can span factors of ten.
3. **Debrief** — final scores, the sharpest and "should have known that" guesses of the
   whole game, and a linear-vs-log comparison computed live from that session's answers.

Stage 2 unlocks once stage 1's deck is fully answered, and stage 3 once stage 2's is —
the tabs stay visible throughout so the whole route is always in view. Each stage
carries a **Predict / Try / Takeaway** strip (the slider itself *is* the Predict),
a per-question provenance kicker with a **Details** drawer of formulas, assumptions
and sources, and a **Check yourself** card with written feedback on every option — the
stage 2 card is a refutation item aimed directly at the "100 mA is a safe/unsafe line"
misconception.

Open `index.html` in a browser. It is offline, needs no installation, and works with
mouse or touch. The Guide overlay opens on load and the `?` control reopens it. The
⚙ Settings menu offers **Open Presenter Notes**, **Presentation mode** and **Reset**
(back to stage 1's setup screen, in place — the page does not reload, and both later
stages re-lock). Open `teacher-guide.html` to print the guide; `teacher-guide.pdf` is
the copy declared in the manifest. Both are generated from `src/demo-guide.html` — the
canonical source — by `build.js` and `tools/pdf.mjs`.

The presenter notes shown in the app are not a summary of the guide — they are the
guide. `build.js` injects the body and stylesheet of `src/demo-guide.html` into
`index.html` at build time, and `node build.js --check` fails if the two have drifted.

## Accuracy: every taught value is re-sourced

This retrofit re-checked all 40 values against a primary or primary-adjacent source
this session (not memory), gave each one a resolvable link, and added an on-screen
**qualifier** to the 17 that are really a range, a specified minimum, or a
code/edition-dependent figure rather than a single fact — a bare number would otherwise
teach false precision even when the number itself is right. The highest-stakes example:
item 23's "100 mA" cardiac-fibrillation figure now carries "a rule-of-thumb anchor on a
current×duration×path curve; sustained exposure carries meaningful risk from as low as
~30 mA," and stage 2's Check-yourself item is built directly around not misreading that
number as a safety line. Full per-item sourcing lives in `src/data.js` (the `qualifier`
and `source` fields) and is rendered live into each stage's Details drawer.

## Build

`src/` + `build.js`, built against the shared lesson shell at `../tools/lesson-shell`
(frozen v2) — the token block, stage tablist, dialogs, check cards and in-place Reset
are the kit's; `src/app.js` owns the game logic and the activity's own reset handler.

```sh
node build.js           # writes index.html and teacher-guide.html
node build.js --check   # verifies both against the canonical build; writes nothing
node tools/pdf.mjs      # re-render teacher-guide.pdf from src/demo-guide.html
```

## Editing the question bank

The bank lives in `src/data.js` — each entry carries `id`, `category`, `prompt`,
`units`, `value`, `min`/`max`, `scale` (`"linear"`/`"log"`), `factoid`, and now an
optional `qualifier` plus a `source` object (`name`, `url`, `fetched`). Edit
`src/data.js`, then run `node build.js`. New categories appear on the start screen and
get a color automatically. Band thresholds live in the `SCORING` object in `src/app.js`.

## Theme

Murray State: MSU Blue `#002144`, MSU Gold `#ECAC00`, Lite Blue `#00A4E3`. Red Orange
`#FF4500` appears in exactly one place — the **Way Off** band. Gold bands mean the
player had the number, blue means they didn't, red means they weren't in the
neighborhood.

## Contract state

Meets the repo [demo contract](../CONTRACT.md) in full — required files, the **Guide**
button with reopen, a Settings menu of **Open Presenter Notes / Presentation mode /
Reset**, presenter notes single-sourced from the printable guide with a `--check` that
fails on drift, MSU theme, attribution, mobile, and offline with no runtime inference.
Current per-item state is tracked in `demo.json` → `compliance`.
