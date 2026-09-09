# AI Progress: teaching and implementation specification

## Purpose

Teach participants to state what a measurement supports, identify comparison limits, distinguish a benchmark result from workplace impact, and expose assumptions behind an extrapolation. Neither optimism nor pessimism is the success condition.

The public slug is `takeoff`. The display title is **The Pace of AI Progress**. The app runs as one offline HTML file and retains the collection's Guide/Settings contract and visible Bryant Harrison/Murray State attribution.

## Learning sequence

**Measure** begins with a concise definition of a benchmark, a historical estimate activity, and an explicit indication that filling a gap in history is not forecasting the future. The five measurements retain their own units and time windows. A selector allows nonsequential participation. Each has a concrete illustrative example, plain explanation, limits, and source-linked tabular evidence in side Details.

A user draws or adjusts a straight line with the keyboard. Reveal compares its endpoint with the final selected result. Percentage-point differences accompany percentage metrics; ratios compare the published result and estimate without valuing either direction. No cross-benchmark capability average is shown. Returning to a measurement resets its current drawing; Reset clears all results.

**Context** distinguishes model, method, and measure. The selected timeline uses dates and company lanes with no capability tier. Hollow rings represent downloadable weights; solid dots represent hosted availability. Openness does not imply license freedom or laptop feasibility. The date slider and availability/region filters update the same visible collection, counters, and accessible list. The catalog is intentionally small and incomplete; its counts do not measure the field's growth.

**Transfer** presents source-backed outcomes from two work settings and two scientific systems, separating machine contribution, human contribution, and limitations. Evidence domains use buttons with selected state. The conclusion asks users to evaluate representative tasks in their own work with quality, time, cost, and failure measures.

A separate illustrative scenario follows. Its invented score has observations `(t=-1,20)` and `(t=0,30)`. Linear, proportional, and saturation rules match both exactly and diverge beyond them. The formulas are in Details and the canonical guide. The numeric output is not clipped when it passes 100: the violation of the score ceiling is made visible. The saturation ceiling 75 is an assumption, not a fitted fact.

## Evidence policy and snapshot

Audit date: 2026-09-09. `src/data.js` owns the embedded reports and their sources. Figures are source-linked original reports rather than uniformly replicated experiments. A model release date and evaluation report date must not be silently substituted for each other. Descriptive comparisons across vendors identify differing protocols and do not imply a causal model-only effect.

- SWE-bench: four text-confirmed 2025 values, source-specific task subsets and compute conditions. Small numerical differences should not be interpreted as precise capability ranks.
- GPQA: Diamond's 198 questions; no original-main-set 39%/34% figures or mismatched human marker. o1 research evaluation is distinguished from o1-preview release.
- METR: six main-table Time Horizon 1.1 estimates and confidence intervals; human-expert task duration at 50% success. The mismatched GPT-4o appendix row is removed. Sol's later non-robust estimate appears only as a limitations note.
- Price: MMLU ≥86%, input/output price blended 3:1, USD per million tokens. Historical February 2025 endpoint. No claim the publisher stopped producing research.
- ARC: version 1 puzzle scores; version 3 RHAE shown in a separate comparison. Astra standard/provider comparison uses the same high effort and semi-private set; the different Sol public set is discussed as a limit.
- Transfer: support-agent study has uneven 15% average improvement in a particular deployment; METR's 19% longer early-2025 developer result includes the 2026 update; GenCast's 97.2% is a share of probabilistic-score comparisons; AlphaFold 3 gets no universal accuracy claim.

Source checks are distinct from application integrity tests. A passing test validates references, dates, bounds and math, not the truth or generality of a paper.

## Architecture and invariant checks

`build.js` concatenates local source files and embeds the canonical guide's scoped CSS/body verbatim. It emits `index.html` and copies `presenter-guide.html`. No runtime fetches, imports, images, fonts, inference endpoints or storage are used. Outbound reading links require a user action.

The scale engine supports linear and logarithmic mapping, inverse mapping, ticks, pointer interpolation and endpoint comparison. The estimate endpoint is the actual ask date, not its padded chart boundary. The chart keeps a separate visual margin so endpoints remain legible. Duplicate ARC dates indicate configurations, not elapsed progress. No ARC version-change line is drawn.

Guide, Settings, Details, and Presenter Notes use one modal mechanism. Opening an overlay makes the background inert; nested overlays make lower overlays inert. Tab cycles inside the active overlay; Escape closes the top one and restores focus. Presentation mode scales type and controls. On phones, readable explanations and a usable chart take precedence over forcing all content into a single viewport.

Canonical notes are `src/presenter-guide.html`; printable HTML and PDF derive from it. PDF rendering uses Letter pages with four explicit logical page groups. `build.js --check` verifies output parity and PDF/source freshness. Local PDF images are review evidence only and do not ship.

## Acceptance evidence

The Node suite retains numerical scale/interpolation/scoring checks and adds dataset/protocol regressions, source-graph positive/negative controls, scenario anchor/divergence checks, and canonical guide/offline checks. Browser verification covers desktop, 320px and 390px widths; draw/reveal; all measurement selections; details and source labels; selected timeline/filter counts; scenario changes; modal focus; settings/presentation/reset; zero runtime requests. PDF verification renders and visually inspects every page.

Committed source and generated surfaces must agree. Changes remain within `takeoff/**`; shared hub regeneration and publication belong to the coordinator.
