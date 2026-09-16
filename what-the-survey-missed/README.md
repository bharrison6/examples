# What the Survey Missed

**Can fewer sightings mean fewer occupied sites?** — Demo 16 of 16, Part four ("Example
projects"), in *AI: From Zero to Takeoff* (`tours/zero-to-takeoff.json`). The last of the
five "investigation" demos (predict, run, explain before reveal): wavelet-lab, ion-flight,
inhibitor-investigation, missing-time, and this one.

An offline, self-contained occupancy-and-detection investigation. Students survey a fixed
set of 48 synthetic sites (24 per habitat) once, interpret what a detection difference
between the two habitats can and cannot mean, decide whether to repeat the fixed survey,
then compare their evidence with the hidden synthetic model.

One HTML file. Runs offline. No AI at runtime, no network requests, nothing stored on the
device.

---

## The one thing the room should leave with

A detection is not an animal, and a difference in detections is not by itself a difference
in occupancy. In this demo's declared scenario, the habitat with the HIGHER true occupancy
(Habitat A, &psi; = 0.8) is *expected* to show FEWER detections than the habitat with lower
occupancy but higher detectability (Habitat B, &psi; = 0.5, p = 0.8) — the exact inversion
a learner would not predict from the raw counts alone. One visit cannot separate &psi; and
p; the optional likelihood view exists to show that ambiguity rather than resolve it.

---

## The four stages

| Stage | What it is | Gate |
|---|---|---|
| **1 — Survey** | Predict a habitat, then run the one fixed round across all 48 sites. | none |
| **2 — Interpret** | Choose the claim actually justified by the round-1 detection difference. | unlocks after round 1 |
| **3 — Revisit** | Optionally repeat the fixed survey with rounds 2 and 3. | unlocks with stage 4, after interpreting |
| **4 — Compare** | Answer a transfer question, reveal the synthetic model, and optionally open the likelihood view. | unlocks with stage 3, after interpreting |

Stages 3 and 4 share one gate rather than a strict 2→3→4 chain: the original design lets a
learner add another round, reveal the model, or both, in either order once round 1 has been
correctly interpreted — that is a design choice preserved from the pre-retrofit demo, not an
accident of the template.

---

## How to present it

The full session plan is `teacher-guide.html` (and its PDF), and the same text is readable
on screen at **Settings → Open Presenter Notes**. It is the same file, injected at build
time, not a summary of it. Short version:

- **Presentation mode** (Settings) enlarges everything for a projector.
- **Settings → Reset** returns the whole demo to its start between rooms, in place — no
  reload — and leaves Presentation mode as set. Two demo-specific scenario controls sit
  below the contract triad: **Replay as practice** (same seed, clears progress) and **New
  seeded scenario** (draws the next one).
- **The `?` button is Guide** — the short how-to panel, which opens on first load.
- **Have the room commit to a habitat before pressing Survey round 1.** The reveal's
  inversion (more occupied sites in the habitat that showed fewer detections) is the point;
  it lands harder when the room has a stake in the wrong guess.
- **In Stage 2, do not accept "the habitat with fewer detections has lower occupancy."**
  It is a genuine, plausible-sounding overreach, not a strawman — only the cautious claim
  is correct given the declared model.

---

## Sourcing

- D. I. MacKenzie et al., "Estimating Site Occupancy Rates When Detection Probabilities Are
  Less Than One," *Ecology* 83(8), 2002, pp. 2248–2255 —
  [USGS publication record](https://www.usgs.gov/publications/estimating-site-occupancy-rates-when-detection-probabilities-are-less-one).
  The source context for separating occupancy probability and detection probability, and for
  the detection-history likelihood structure this model implements.
- T. M. Donovan, J. E. Hines, & D. I. MacKenzie (2024),
  [occupancyTuts: Occupancy modelling tutorials with RPresence](https://www.usgs.gov/publications/occupancytuts-occupancy-modelling-tutorials-rpresence),
  U.S. Geological Survey. **Replaces** a previously cited 2023 RPresence workshop page
  (`mbr-pwrc.usgs.gov/workshops/occupancy2023online.html`) that a 2026-09-15 fleet-wide
  dead-citation sweep found now blanket-redirects (confirmed against a second path on the
  same subdomain) to a generic USGS center homepage with no occupancy-modeling content. This
  current USGS publication is the direct successor in subject and intent — RPresence-based
  occupancy/detection teaching materials — and was fetched and confirmed live 2026-09-15.

Neither source establishes a current Murray State assignment or endorsement. The generating
&psi; and p values (Habitat A 0.8/0.25, Habitat B 0.5/0.8) are invented to make one
pedagogical point and are not drawn from either source or from a real survey.

---

## Model boundary

Sites are fixed as occupied or unoccupied across visits (closure). Given occupancy, visits
have conditionally independent detections, no false positives, and a constant detection
probability within each habitat. These are named teaching assumptions, not claims about a
local wildlife population. The data are synthetic and the lesson makes no conservation
recommendation.

---

## Building

Sources live in `src/`. `index.html` is the committed build output; do not edit it directly.
The build also reads the shared lesson shell at `../tools/lesson-shell/` (tokens, shell CSS,
dialog/tablist/presentation-mode/Reset behaviour) — a build-time-only dependency; the shipped
`index.html` stays one self-contained file (see `build.js`'s own head comment).

```bash
node test-model.js                                        # occupancy model: expectations, closure, likelihood
node build.js                                             # writes index.html and teacher-guide.html
node build.js --check                                     # verifies both match the canonical build; writes nothing
node test-build.js                                        # built index.html against the fleet template A0-A10
node ../tools/lesson-shell/check-shell.js what-the-survey-missed   # kit adoption: tokens, parts, kickers, self-contained
node tools/pdf.mjs                                        # regenerates teacher-guide.pdf
```

`build.js` refuses to write a file containing an external `src` or `href` on any
resource-loading tag, so a stray CDN reference fails the build rather than shipping.

### Files

| File | What it is |
|------|-----------|
| `src/model.js` | The occupancy-and-detection model: seeded scenario generation, observed summaries, expected fractions, and the relative-likelihood grid. Byte-identical to the pre-retrofit `model.js` — this retrofit changed the format, not the mechanism. |
| `src/app.js` | The four stages' own rendering: the evidence ledger (re-rendered into each of three stage slots rather than moved as one DOM node, since it is cheap markup, not a bound widget), the interpretation and transfer choices, the reveal, the optional likelihood view, and the required `lessonreset` handler. The header, stage tablist, and the Guide/Settings/Details/Presenter-Notes dialogs are the shared lesson shell's, not this file's. |
| `src/styles.css` | The activity's own styles only — the shared shell owns the chrome. |
| `src/template.html` | The app shell markup, built against `../tools/lesson-shell/partials.html`'s vocabulary. Stage 2's tab is gated on round 1; stages 3 and 4 share a gate on interpretation, authored as `disabled` directly in this markup (not only in `app.js`), so the shell's Reset snapshot re-locks them correctly. |
| `src/demo-guide.html` | **Canonical** presenter guide (renamed from `teacher-guide.html`, kept as the shipped output filename in `demo.json`). Its `<style id="guide-css">` block and its `.guide-scope` div are lifted into the app so the on-screen notes and the printable guide cannot drift. |
| `test-model.js` | Occupancy expectations, closure, no-false-positives, seeded replay, individual history probabilities, the likelihood grid, and boundary cases. |
| `test-build.js` | Checks the built `index.html` against CONTRACT.md's Required UX and the fleet template's A0–A10 parts: the shell stamp, four gated stage tabs, stage intros with Predict/Try/Takeaway, the six-word provenance vocabulary, the Details drawer's five sections per stage, check-yourself cards with a refutation item, the in-place Reset contract, and a build-parity drift gate proved in four directions (including a change to the shared kit). |
| `tools/pdf.mjs` | Guide → PDF. Prefers Playwright, falls back to a system Chrome or Edge. |
| `tools/render_guide.py` | The older ReportLab renderer, kept for reference only; not re-verified against the restructured guide. |

---

## Contract compliance

Built against the shared lesson shell at `../tools/lesson-shell/` (fleet-wide template; see
`plan-demo-fleet-format-alignment` in the memory store for the full template).

| Item | State |
|------|-------|
| Guide dialog on load, dismissible, reopenable from the `?` button (named **Guide**) | yes — shell-owned |
| Settings menu offering **Open Presenter Notes**, **Presentation mode**, **Reset** | yes, shell-owned — plus this demo's own **Replay as practice** and **New seeded scenario** |
| **Reset** returns the whole demo to fresh-load state | yes — in place, no reload: the shell restores its chrome (including re-locking the stage-2/3/4 gates from the template's own `disabled` attributes) and dispatches `lessonreset`; `src/app.js`'s handler restores the scenario, predictions, reveal state and the optional likelihood view |
| Presenter notes openable in-app, and identical to the printable guide | yes — injected from `src/demo-guide.html` at build time; `node build.js --check` fails on drift |
| Murray State theme | yes — kit tokens: navy `#002144`, gold `#ECAC00`, lite blue `#00A4E3` |
| Attribution visible | yes, in the footer on every stage and the credit pill |
| Mobile | phone-first; the kit's breakpoints apply fleet-wide (verified in the browser pass at 390/1024/1440 and a 320px no-overflow check) |
| Offline, no runtime inference | yes — zero external `src`/`href` in the shipped file, enforced by the build |

---

Bryant Harrison · Murray State University.
