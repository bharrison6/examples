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

## Editing the question bank

The question bank is a commented array at the top of `index.html` — instructors can
edit, remove, or add questions in place; each entry carries its value, units, slider
type (linear/log), and the "because..." anchor line.

## Known gaps (vs the repo demo contract)

No printable guide yet, no Murray State theme, no attribution footer, no how-to
popup or settings/presentation mode. Tracked in `demo.json` → `compliance`.
