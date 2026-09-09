# The Pace of AI Progress

An offline classroom activity for reading AI evidence: estimate missing historical results, inspect test conditions, and separate measurement from extrapolation. The public folder remains `takeoff/`.

The cream teaching canvas, navy measurement workspace, gold reveal, side Details, and question-led stages follow the collection's **Types of AI** and **Neural Network Training** demos. Bryant Harrison · Murray State University.

## Run and present

Open `index.html` directly in a browser. No server, network connection, dependency download, AI inference, or storage is needed at runtime. The entry Guide explains the activity and reopens from `?`. Settings contains Open Presenter Notes, Presentation mode, Reset, and data integrity checks.

1. **Measure:** estimate a missing piece of five historical charts. Draw with a pointer, or focus the chart and press Up/Down; Home/End set the low/high endpoint. Reveal the selected reports. The selector permits any order.
2. **Context:** explore eleven selected, source-backed release events. Company lanes are not capability ranks. Filters and date scrubber update the counters and accessible release list together.
3. **Transfer:** compare two work studies and two scientific systems. Change the illustrative forecast horizon to see three rules that agree at two invented observations but diverge afterward.

Details gives a concrete example, interpretation limits, and a source-linked measurement table. Hidden rows become visible after Reveal. A later non-robust METR estimate stays outside the trend, in Details. ARC-AGI-3 comparisons stay separate from the ARC-AGI-1 chart.

A 20–25 minute session and short route are in [the printable guide](presenter-guide.html). The four-page [PDF](Takeoff-Presenter-Guide.pdf) and the in-app notes derive from `src/presenter-guide.html`.

## What the evidence says

The snapshot was audited on **September 9, 2026**. These are selected reports, not a census, live leaderboard, or common-budget comparison. The primary-source status refers to the original reporting organization; it does not establish independent replication.

| Measurement | What is plotted | Main boundary |
|---|---|---|
| SWE-bench Verified | Four 2025 vendor-reported system scores, 63.7–77.2% | Task subsets, prompts, agents, and budgets vary. |
| GPQA Diamond | 198-question set, 50.6–94.3% across selected reports | Release and evaluation dates are distinguished; human markers from mismatched subsets removed. |
| METR Time Horizon 1.1 | Human-expert task minutes at 50% predicted success, with 95% intervals | Six points from one report; non-robust Sol result excluded; no claim of reliable autonomy. |
| Epoch price threshold | Listed USD per million tokens at MMLU ≥86% | Input/output blended 3:1; February 2025 historical endpoint, not full workflow cost. |
| ARC-AGI-1 | Historical puzzle results and two o3 compute configurations | ARC-AGI-3 uses RHAE and appears only in a separate comparison. |

The real-work cases are the revised Generative AI at Work support-agent study, METR's randomized early-2025 developer study with its February 2026 update, GenCast's retrospective comparison, and AlphaFold 3's bounded structure-prediction result. No broad claim about all professions follows from them.

The scenario is **invented**, not measured data or a forecast endorsed by the demo. At years `t` after the second point, its rules are `30 + 10t`, `30 * 1.5^t`, and `75 - 45 * (9/11)^t`. All equal 20 at `t=-1` and 30 at `t=0`. Values above the toy score's ceiling of 100 remain visible and are labeled invalid for that scale.

## Modify and verify

Use Node.js for the build and checks:

```sh
node build.js
node src/playtest.test.js
node tools/integration.mjs
node tools/pdf.mjs
node build.js --check
```

Run from this folder. Browser integration and optional PDF rendering need Playwright plus Chrome/Chromium; these are development tools only. `CHROME_PATH` can select the browser. The PDF renderer also supports a system Chrome/Edge without Playwright.

- `src/data.js`: canonical historical snapshot, source registry, examples and evidence conditions.
- `src/engine.js`: scales, interpolation, scoring and illustrative rules.
- `src/validation.js`: structural checks shared by Node and Settings; tests cannot establish that source claims are true.
- `src/chart.js` / `src/timeline.js`: canvas rendering and pointer interaction.
- `src/app.js`: activities, Details, keyboard controls and modal focus management.
- `src/template.html` / `src/styles.css`: application structure and responsive theme.
- `src/presenter-guide.html`: canonical notes and printable guide.
- `build.js`: self-contained build, guide injection and parity checks.

Regenerate app/HTML after changes and re-render PDF whenever the canonical guide changes. The mathematical tests retain scale round trips, clamp/edge handling, interpolation, scoring, uncertainty and source-graph validation. Negative controls verify that broken source references are rejected. Browser checks cover desktop and phone layouts, pointer/keyboard estimates, modal focus, stage navigation, reset, and zero runtime requests.

## Content decisions

The redesign removes the previous presumption that viewers should underestimate progress, an unsourced capability ranking, the broad 124-release catalog, unsupported headline rows, a mixed GPQA baseline, the mixed METR appendix row, and forced exponential conclusions. The selected releases intentionally omit many important models. AlphaFold 3's qualitative limitations were corroborated from publisher-indexed text in the source audit; no newly verified numeric accuracy claim is made.
