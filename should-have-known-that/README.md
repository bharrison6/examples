# 🎯 Engineering Trivia

**Should Have Known That** — slider-based estimation trivia for engineering students:
40 verified numbers every engineer should carry — yield strengths, ampacities, psi per
foot of water — 8 questions each across Statics & Mechanics, Materials, Electrical,
Fluids & Thermo, and Everyday Engineering.

Linear sliders are scored by percent error; logarithmic sliders (resistivity, speed of
light, lethal current...) by order-of-magnitude error, with Bullseye/Close/Warm/Cold/Way
Off bands. Every reveal animates guess-vs-truth and lands a one-line *"you should have
known that because..."* anchor for the number.

## Play

Open `index.html` in any browser. Single self-contained file, phone-first, fully
offline. Solo, or 2–4 team pass-and-play with editable team names and a running
scoreboard; the end screen calls out the sharpest guess and the most
should-have-known miss.

The **Guide** explains the two scoring modes and the bands, and opens on every load;
dismiss it with a tap, `Esc`, or the button, and reopen it any time with **?** in the
top-right corner. `Enter` / `Space` locks in a guess and advances the reveal.

## Present it

**⚙ Settings** (beside the **?**) holds exactly three things:

- **Open Presenter Notes** — the teacher guide, on screen. It is not a summary of the
  guide; it is the guide, injected from `teacher-guide.html` at author time, so the
  notes you read on the projector and the page you printed cannot disagree.
- **Presentation mode** — projector-sized type for the prompt, the running value, the
  band badge and the "because..." line, with the greyed-out text lifted so the back row
  can read it. The layout does not change, so a laptop rehearsal matches the room.
- **Reset** — back to a fresh load without reloading the page: no game in progress and
  the start screen at its defaults. It leaves Presentation mode as you set it, and does
  not reopen the Guide.

## Teacher guide

`teacher-guide.html` is the printable two-page version — what the demo teaches, a
20-minute session plan, solo vs team mode, the scoring bands, how to edit the question
bank, and eight discussion prompts. It is also the **single source for the in-app
presenter notes**.

```sh
node tools/guide-sync.js          # inject the guide into index.html's __GUIDE__ block
node tools/guide-sync.js --check  # fail (exit 2) if the two have drifted; writes nothing
node tools/pdf.mjs                # re-render teacher-guide.pdf from the same file
```

Edit `teacher-guide.html` and run both. Editing the notes inside `index.html` is a fork,
and `--check` exists to catch it. Neither script installs anything: `pdf.mjs` drives the
Chrome you already have (set `CHROME_PATH` if it is somewhere unusual).

## Editing the question bank

The question bank is a commented array at the top of `index.html` — instructors can
edit, remove, or add questions in place; each entry carries its value, units, slider
type (linear/log), and the "because..." anchor line. New categories appear on the start
screen and get a color automatically. Band thresholds live in the `SCORING` object at
the bottom of the file.

## Theme

Murray State: MSU Blue `#002144`, MSU Gold `#ECAC00`, Lite Blue `#00A4E3`. Red Orange
`#FF4500` appears in exactly one place — the **Way Off** band and the end-screen miss
card that reports it. Gold bands mean the player had the number, blue means they didn't,
red means they weren't in the neighborhood.

## Contract state

Meets the repo [demo contract](../CONTRACT.md) in full — required files, the **Guide**
button with reopen, a Settings menu of **Open Presenter Notes / Presentation mode /
Reset**, presenter notes single-sourced from the printable guide with a `--check` that
fails on drift, MSU theme, attribution, mobile, and offline with no runtime inference.
Current per-item state is tracked in `demo.json` → `compliance`.
