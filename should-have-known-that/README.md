# 🎯 Should Have Known That — Engineering Edition

Slider-based estimation trivia for engineering students: 40 verified numbers every
engineer should carry — yield strengths, ampacities, psi per foot of water — 8 questions
each across Statics & Mechanics, Materials, Electrical, Fluids & Thermo, and Everyday
Engineering.

Linear sliders are scored by percent error; logarithmic sliders (resistivity, speed of
light, lethal current...) by order-of-magnitude error, with Bullseye/Close/Warm/Cold/Way
Off bands. Every reveal animates guess-vs-truth and lands a one-line *"you should have
known that because..."* anchor for the number.

## Play

Open `index.html` in any browser. Single self-contained file, phone-first, fully
offline. Solo, or 2–4 team pass-and-play with editable team names and a running
scoreboard; the end screen calls out the sharpest guess and the most
should-have-known miss.

A **how-to popup** explains the two scoring modes and the bands on every load; dismiss
it with a tap, `Esc`, or the button, and reopen it any time with **?** in the top-right
corner. `Enter` / `Space` locks in a guess and advances the reveal.

## Present it

**⚙ Settings** (beside the **?**) holds:

- **Presentation mode** — projector-sized type for the prompt, the running value, the
  band badge and the "because..." line, with the greyed-out text lifted so the back row
  can read it. The layout does not change, so a laptop rehearsal matches the room.
- **Presenter's notes** — stage notes built into the file: pacing, where to stop the
  room before a reveal, how to read a Way Off, and the discussion hooks worth chasing.

## Teacher guide

`teacher-guide.html` is the printable two-page version — what the demo teaches, a
20-minute session plan, solo vs team mode, the scoring bands, how to edit the question
bank, and eight discussion prompts. `teacher-guide.pdf` is the rendered copy; reprint it
from the HTML if you edit the guide.

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

Meets the repo [demo contract](../CONTRACT.md) in full — required files, how-to popup
with reopen, settings + presentation mode with presenter's notes, MSU theme,
attribution, mobile, and offline with no runtime inference. Current per-item state is
tracked in `demo.json` → `compliance`.
