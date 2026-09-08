# Two Winters

**Has this happened before?** — the fifth demo in *AI: From Zero to Takeoff*.

`takeoff` ends with the room having watched capability curves go nearly vertical. The
honest next question, and you will get it, is *"is this another bubble?"* This demo
answers it with evidence rather than reassurance: AI has boomed and collapsed twice, both
collapses followed the same five-stage mechanism, and knowing that sequence is how you
judge a claim without either swallowing it or dismissing it.

One HTML file. Runs offline. No AI at runtime, no network requests, nothing stored on the
device.

---

## The one thing the room should leave with

Confident predictions that AI was nearly here have a bad track record — **and so do
confident predictions that it would never work.** Most people only believe the first half
until they get scored on the second, which is what Act I is for.

---

## The four acts

| Act | What it is | Time |
|-----|-----------|------|
| **I — Guess the year** | Ten real predictions, 1950–2024, speaker and date hidden. Guess the year on a slider, guess whether it came true, then reveal. Scorecard splits promises from dismissals. | 7–9 min |
| **II — The two winters** | A scrubbable 1950–2026 timeline in six rows: landmark results on top, then one row per stage of the mechanism. Drag forward and the rows fire in order — twice. | 3–4 min |
| **III — Anatomy** | The first winter, the second winter and now, side by side on those same five stages. Two cells in the "now" column are marked open rather than filled in. | 2–3 min |
| **IV — Now** | What rhymes against what is genuinely different, then the cut list and every source. | 2–3 min |

### The five stages

The lanes in Act II, and the rows in Act III, are the same five things in the same order:

1. **A promise** — someone with standing says the thing is close.
2. **Money against it** — a government or an industry commits real budget.
3. **A hard limit** — an obstacle nobody had measured turns out to be load-bearing.
4. **Someone names it** — a report, or a market, states the gap out loud.
5. **The money leaves** — funding stops. The field calls it a winter.

It ran 1955→1974 and again 1982→1992. A third run is under way and has reached stage
three. Whether it reaches stages four and five is exactly what the demo refuses to
predict.

---

## How to present it

The full session plan is `presenter-guide.html` (and its PDF), and the same text is
readable on screen at **Settings → Presenter's notes** so you never need a second window.
Short version:

- **Presenter mode** (Settings) enlarges everything for a projector.
- **Do the first two cards yourself, out loud.** Then hand it over. Ask for a show of
  hands on the year *before* dragging the slider. The room being wrong together is the
  experience.
- **Short of time?** Keep four cards: Simon & Newell 1957, ALPAC 1966, Schank & Minsky
  1984, Amodei 2024. Then skip to Act III and close.
- **In Act II, do not narrate.** Drag slowly and let the room watch the rows fire. Say the
  stage names as each lane lights.
- **If someone asks where this came from**, open **Settings → Run the self-test** in front
  of them. It re-derives live that every claim resolves to a declared source, that no
  source is cited and never used, and that the counts quoted on screen match the data.

---

## Sourcing — the part that matters

This demo's entire claim to credibility is that every sentence on screen resolves to
something a sceptic can go and check.

- Every claim carries a `src` id resolving to an entry in `SOURCES`, and a **status**:
  - `primary` — checked against the document itself during the build: the paper, the
    report's own text, the lab's own page, the official results table.
  - `reported` — a specific, retrievable secondary source that names its own underlying
    scholarship. Used where the primary is a printed book, a paywall, or a page scan.
- No source URL is a journal or organisation homepage; the test suite enforces that every
  URL points at a specific page.
- **What could not be sourced was cut, and the cuts are on the page.** Act IV lists seven
  claims that were researched and left out, with the reason for each — including a dollar
  figure for XCON's savings at Digital (sources disagree, and the primary is paywalled)
  and any verbatim quotation from the ALPAC report (the National Academies' online copy is
  page images).
- **There is no continuous funding series**, because none exists in sourceable form. The
  demo shows four commitments it could actually source, in four different currencies, not
  inflation-adjusted, and says on the page that that is what they are.
- **Winter date ranges are conventional, not crisp.** The starts are well attested; the
  ends are argued over. The bands are drawn with a soft right edge and each carries a note
  saying exactly where historians disagree.
- **Dates show only what was verified.** Every timeline event declares its precision, and
  the app prints a year, a month or a day accordingly. *Perceptrons* is dated 1969, not
  "Jan 1969" — printing a month nobody checked is a small fabrication, and there is no
  budget for small ones here.

Where a claim rests on a printed history rather than a document — Crevier 1993,
McCorduck 2004 — the historian is named on the claim itself.

---

## Building

Sources live in `src/`. `index.html` is the committed build output; do not edit it.

```bash
node build.js            # writes index.html and presenter-guide.html
node build.js --check    # verifies both match the canonical build; writes nothing
node src/playtest.test.js   # dataset + engine tests
node tools/pdf.mjs       # regenerates Two-Winters-Presenter-Guide.pdf
node tools/pdf.mjs --check  # verifies the guide parses and the PDF exists
```

`build.js` refuses to write a file containing an external `src` or `href` on any
resource-loading tag, so a stray CDN reference fails the build rather than shipping.

### Files

| File | What it is |
|------|-----------|
| `src/data.js` | Every claim, every source, the cut list. The only file with facts in it. |
| `src/engine.js` | Pure functions: dates, the year scale, the scoring. No DOM. |
| `src/timeline.js` | The Act II canvas — lanes, winter bands, scrubber. Hand-rolled 2d context. |
| `src/app.js` | Controller: the four acts, the overlays, the live self-test. |
| `src/styles.css` | Phone-first. |
| `src/template.html` | The shell. `build.js` fills four placeholders. |
| `src/presenter-guide.html` | **Canonical** presenter guide. Its first `<style>` block and its `.guide-scope` div are lifted into the app so the on-screen notes and the printable guide cannot drift. |
| `src/playtest.test.js` | 86 checks. Run before committing. |
| `tools/pdf.mjs` | Guide → PDF. Prefers Playwright, falls back to a system Chrome or Edge. |

### The PDF tool differs from its neighbours

`takeoff/tools/pdf.mjs` and friends require Playwright. This repository has no
`node_modules`, so `tools/pdf.mjs` here tries Playwright first and otherwise drives a
system Chrome or Edge with `--print-to-pdf`. Set `CHROME_PATH` if your browser is
somewhere unusual; nothing is hardcoded to one machine.

---

## Modifying it

**Adding or changing a claim** means editing `src/data.js` and nothing else.

- A prediction card needs `id, quote, who, role, where, year, kind, verdict, verdictLine,
  what, status, src`. `kind` is what it *claimed* (`promise` / `dismiss` / `warning`);
  `verdict` is what *happened* (`no` / `yes` / `late` / `open`).
- A timeline event needs `d, p, stage, era, label, text, status, src`, plus an optional
  `money` block if it is one of the funding commitments. `p` is how much of the date you
  actually verified — `'y'`, `'m'` or `'d'` — and the app prints only that much. An event
  whose day is unknown is stored on the 1st so it sorts and plots; the tests refuse to let
  it claim day precision.
- Any new `src` id must exist in `SOURCES` and must actually be used — the test suite
  fails in both directions, so a dangling reference and an orphaned source are both build
  breaks.

The tests also enforce the prose. If you add a card, the counts quoted on the scorecard
("six confident promises", "three confident dismissals") will fail until you update them
— which is the point. The same is true of the money panel's "four commitments" caption and
the "ten predictions" line in the how-to.

Then: `node src/playtest.test.js && node build.js`.

---

## Contract compliance

| Item | State |
|------|-------|
| How-to popup on load, dismissible, reopenable from `?` | yes |
| Settings menu with presentation mode | yes |
| Presenter's notes openable in-app | yes, injected from the canonical guide |
| Murray State theme | yes — navy `#002144`, gold `#ECAC00`, sky `#00A4E3` |
| Red-orange `#FF4500` reserved for genuine failure states | yes — a wrong verdict, the "money leaves" stage, a failed self-test check, an unresolved source. Nothing else. |
| Attribution visible | yes, in the footer on every act |
| Mobile | phone-first; verified at 320px with zero horizontal overflow and no tap target under 36px, in all four acts, in both normal and presenter mode |
| Offline, no runtime inference | yes — zero external `src`/`href` in the shipped file, enforced by the build |

---

Bryant Harrison · Murray State University. Sources checked September 2026.
