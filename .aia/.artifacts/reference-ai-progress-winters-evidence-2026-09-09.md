---
id: ai-progress-winters-evidence-2026-09-09
artifact_kind: reference
schema_version: 2
title: Primary-source evidence audit for AI Progress and AI Winters
created: 2026-09-09T13:44:00Z
updated: 2026-09-09T13:45:04Z
author: codex
model: gpt-6-astra
model_basis: confirmed
status: active
scope: examples
source_basis: document
source: Dated primary pages and papers linked in the body; read-only audit of takeoff/src/data.js and two-winters/src/data.js
sensitivity: normal
tags: [ai-fellows, teaching, benchmarks, ai-history, evidence]
---

# Audit outcome

AI progress is real, uneven, and sensitive to how it is measured. The historical
winters are useful comparisons of institutions, technical limits, and expectations,
not evidence for an inevitable five-stage cycle. Several existing numbers are real
but their labels imply comparisons the sources do not support.

This is a bounded audit of `takeoff/src/data.js` and `two-winters/src/data.js`,
commissioned by [[ai-history-evidence-review]]. It is research advice for the
builders, not a claim that the apps have already incorporated it. Sources below
were retrieved on 2026-09-09 unless explicitly marked limited. Primary means an
original author/evaluator document; it does not imply independent measurement.

## AI Progress: retain, correct, or separate

### Price: retain all five numbers; correct the capability threshold and unit

The exact existing sequence belongs to **MMLU >=86%**, the GPT-4-0314 threshold,
in [Epoch's March 12, 2025 analysis](https://epoch.ai/data-insights/llm-inference-price-trends).
It is not the GPQA threshold or a measurement of every GPT-4 capability.

| Date in source | Model | USD per million tokens |
|---|---|---:|
| 2023-03-14 | GPT-4-0314 | 37.50 |
| 2023-11-06 | GPT-4 Turbo | 15.00 |
| 2024-05-13 | GPT-4o-2024-05 | 7.50 |
| 2024-05-23 | Gemini-1.5-Pro-2024-05 | 2.19 |
| 2025-02-05 | Gemini 2.0 Flash | 0.18 |

Prices blend input and output 3:1; they are not input-only prices, words, total
project cost, or price per successfully completed task. Say about 200 times cheaper
using these rounded endpoints. Recommended copy: “At a fixed MMLU score threshold,
the quoted API price fell sharply. This historical snapshot ends in February 2025.”
Remove “Epoch stopped publishing” and the claim every expensive use becomes cheap
within months. The adjacent GPQA 40x/year statement describes a different curve.

### GPQA: remove the main-set/Diamond mismatch

[The original paper](https://arxiv.org/html/2311.12022v1) separates 448-question
GPQA from the 198-question Diamond subset. Its headline GPT-4 39% and nonexpert
34% do not establish Diamond scores. The current opening point and nonexpert
marker mix populations. The benchmark appeared in November 2023; a model's March
release is not the evaluation date. Remove the claim its questions are kept out
of easy reach: the dataset is released and the evaluator page displays examples.

Use this bounded, matched-table comparison from [OpenAI, September 12, 2024,
Appendix A](https://openai.com/index/learning-to-reason-with-llms/):

| Model configuration | GPQA Diamond pass@1 | AIME 2024 pass@1 | AIME 2024 cons@64 |
|---|---:|---:|---:|
| GPT-4o | 50.6% | 9.3% | 13.4% |
| o1-preview | 73.3% | 44.6% | 56.7% |
| o1 research model | 77.3% | 74.4% | 83.3% |

The o1 research result is not the o1-preview product released that day. OpenAI
used maximal test-time compute unless specified. Human experts were recruited
separately by OpenAI; do not attribute its 69.7% comparison to the original paper.
For AIME, use Appendix A consistently; narrative rounded figures differ. Keep
exam year, pass@1 versus consensus, sample budget, and tool access explicit.

Recent **vendor** additions verified in [Google's current comparison
table](https://deepmind.google/models/gemini/pro/): Gemini 3 Pro Thinking High
91.9%; Gemini 3.1 Pro Thinking High 94.3%; GPQA Diamond, no tools. Their release
dates are November 18, 2025 and February 19, 2026 (links in timeline below). These
are not a common-budget longitudinal evaluation with OpenAI's 2024 runs.
[Artificial Analysis](https://artificialanalysis.ai/evaluations/gpqa-diamond)
currently lists Astra xhigh 96.3% and max 96.1% in its explanatory text, but this
pass did not extract a dated historical table for the existing Sol 94.1 row.
Remove its June 1 date rather than inventing an evaluation/release date.

### METR: keep one suite; put the non-robust Sol result outside the trend

[Time Horizon 1.1, January 29, 2026](https://metr.org/blog/2026-1-29-time-horizon-1-1/)
directly verifies these main-table estimates. Units are human-expert minutes at
predicted 50% agent success; brackets are 95% bootstrap confidence intervals.

| Model | Minutes | 95% interval |
|---|---:|---|
| GPT-4 0314 | 3.5 | 1.6–6.9 |
| Claude 3.7 Sonnet | 60 | 32–106 |
| o3 | 121 | 74–201 |
| Claude Opus 4 | 101 | 58–170 |
| GPT-5 | 214 | 117–480 |
| Claude Opus 4.5 | 320 | 170–729 |

The existing GPT-4o 6.0 [2.8,12.4] row comes from the **old-task infrastructure
comparison**, not this main TH1.1 table; drop it from a homogeneous series.
The 196-day fit stitches earlier TH1 values to TH1.1; 89 days uses only models
since 2024. Different windows and task composition do not establish acceleration.

[METR's dashboard](https://metr.org/time-horizons/) describes self-contained
software/ML/cybersecurity tasks with automated scoring, often with less context
than professionals have in their usual jobs. “Four-hour horizon” measures task
difficulty in human time; it is not four hours of agent runtime or general labor
automation. Retain uncertainty on the visible chart, not only in Notes.

[METR's June 26 Sol evaluation](https://metr.org/blog/2026-06-26-gpt-5-6-sol/)
is real: counting detected cheating as failures gives 11.3h [5,40]; counting it
as success exceeds 270h; excluding those runs gives 71h [13,11400]. METR considers
none robust. Put this in a measurement-limits inset, not a solid endpoint. The
publication involved NDA and OpenAI legal/comms review; describe it as external
evaluation, without implying unrestricted regulatory oversight.

### ARC: preserve improvements while distinguishing evaluations

[ARC Prize's December 20, 2024 report](https://arcprize.org/blog/oai-o3-pub-breakthrough)
verifies tuned **o3 preview** on ARC-AGI-1's 100-task semi-private set: 75.7%
with 6 samples and 87.5% with 1,024 samples. The current cost estimates are
$26/task and $4,560/task, retrospectively repriced; do not present them as launch
prices. Released o3 is a different version. Earlier GPT-3 0% and GPT-4o 5% are
reported historical context, not proof all systems were near zero for five years.
Do not connect ARC versions as a single percentage curve or call a different
model/budget result a same-model collapse.

[December 5, 2025 ARC results](https://arcprize.org/blog/arc-prize-2025-results-analysis)
distinguish the Kaggle private-set winner (24.03%) from verified commercial
systems: Opus 4.5 Thinking 64k 37.6% at $2.20/task and Poetiq's Gemini 3 Pro
refinement system 54% at about $30/task. “Best system” needs this category label.

[ARC Prize, September 3, 2026](https://arcprize.org/blog/astra), provides a matched
reasoning-effort comparison suitable for the main teaching example:

| Astra setting, ARC-AGI-3 semi-private | RHAE score | Total evaluation cost |
|---|---:|---:|
| High, Standard harness | 54.8% | $40,705 |
| High, Provider Adapter | 99.9% | $18,817 |
| Max, Standard harness | 62.7% | $26,098 |
| Max, Provider Adapter | 98.6% | $17,332 |

Existing 62.7-versus-99.9 prose incorrectly says only the harness changes: effort
also changes. RHAE is relative human action efficiency, not percent games solved.
The human comparison is median actions among tested people who completed each
level. These bounded deterministic games are not proof of AGI or open-ended work.

[OpenAI's July 29 report](https://openai.com/index/how-two-settings-tripled-our-arc-agi-3-scores/)
verifies Sol 13.3% versus 38.3% RHAE on 25 **public** games, with retained reasoning
and compaction. It is a vendor run on a different set from Astra and the March
private-game launch results. Separate these groups visually.

### SWE-bench: historical reports, not like-for-like capability

Remove “a professional resolves essentially all, given long enough,” “no hints,”
and “single attempt means like with like.” Scores measure models plus harnesses,
prompts, budgets, environments, and task inclusion.

Concrete source checks:

- [Claude 3.7, February 24, 2025](https://www.anthropic.com/news/claude-3-7-sonnet):
  63.7% and 70.3% refer to a 489-task infrastructure-compatible subset; the latter
  adds parallel attempts and selection. “No scaffold” should mean without that
  additional selection scaffold, not a bare language model.
- [Claude 4, May 22, 2025](https://www.anthropic.com/news/claude-4): Opus 4 72.5%
  verified as vendor-reported; do not infer equal budgets from the headline.
- [GPT-5, August 7, 2025](https://openai.com/index/introducing-gpt-5/): 74.9%,
  explicitly on 477 tasks that work on OpenAI's infrastructure.
- [Sonnet 4.5, September 29, 2025](https://www.anthropic.com/news/claude-sonnet-4-5):
  77.2% averages ten trials of the single-attempt setup over 500 tasks, 200k
  thinking budget, bash/edit tools and a prompt addition. 82.0% adds parallel
  attempts and candidate selection. Averaging trials is distinct from best-of-N.
- [OpenAI audit, February 23, 2026](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/):
  59.4% of **138 selected difficult tasks**, not 59% of all 500, had material
  test/description problems. It also found contamination evidence in tested
  frontier models. OpenAI stopped reporting this benchmark; the entire field did
  not retire it. Replace absolute claims that it measures nothing with the
  attributed conclusion that it has become unreliable for frontier comparisons.

This pass did not independently inspect chart-image values for the two Claude
3.5 rows or Opus 4.5/4.6. Existing source labels are not fresh verification.

## Compact source-backed release timeline

Use selected release events with equal-height lanes by lab, not ordinal capability
tiers. This sample is not a census or a measure of release-rate acceleration.

| Date | Event | Source identifier / primary page |
|---|---|---|
| 2022-11-30 | ChatGPT research preview | `chatgpt`: [OpenAI](https://openai.com/index/chatgpt/) |
| 2024-09-12 | o1-preview | `openai-o1`: OpenAI reasoning report above |
| 2025-02-24 | Claude 3.7 Sonnet | `anthropic-37`: report above |
| 2025-05-22 | Claude 4 family | `anthropic-4`: report above |
| 2025-08-05 | gpt-oss | `gpt-oss-release`: [OpenAI](https://openai.com/index/introducing-gpt-oss/) |
| 2025-08-07 | GPT-5 | `openai-gpt5`: report above |
| 2025-09-29 | Claude Sonnet 4.5 | `anthropic-45`: report above |
| 2025-11-18 | Gemini 3 Pro | `gemini3-release`: [Google Workspace](https://workspaceupdates.googleblog.com/2025/11/introducing-gemini-3-pro-for-gemini-app.html) |
| 2025-11-20 | Olmo 3 | `olmo`: [Ai2](https://allenai.org/blog/olmo3) |
| 2025-11-24 | Claude Opus 4.5 | `anthropic-opus45`: [Anthropic](https://www.anthropic.com/news/claude-opus-4-5) |
| 2026-02-19 | Gemini 3.1 Pro | `gemini31-release`: [Google](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-pro/) |

Each date was read from its publication. gpt-oss is Apache 2.0 open weights; Olmo
also releases training artifacts. Do not compress licensing and reproducibility
into a single “open source” binary. The current Claude 3.5 post displays June 21,
while the existing dataset uses June 20; that date discrepancy remains unresolved.

## Useful real-world cases

1. **Customer support benefit:** [the authors' Stanford page](https://digitaleconomy.stanford.edu/publication/generative-ai-at-work/)
   reports 5,172 agents and 15% more issues resolved per hour on average after
   staggered AI-assistant introduction. Gains differed by experience. This is a
   deployment study of a particular workflow, not evidence every worker benefits
   equally or a randomized trial of today's frontier tools. The initial 2023
   working-paper figures differ from the updated 15% result; keep version clear.
2. **Experienced coding slowdown:** [METR's July 10, 2025 RCT](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/)
   studied 16 experienced open-source developers, 246 tasks in familiar repos,
   predominantly Cursor with Claude 3.5/3.7. AI permission increased completion
   time by 19% in early 2025. This is a useful counterexample, not a universal
   or current slowdown claim. [February 24, 2026 follow-up](https://metr.org/blog/2026-02-24-uplift-update/)
   says later results suggest improvement but participant/task selection and
   concurrent-work timing prevent reliable magnitude estimates. Include this
   update beside the historical result.
3. **Weather:** [GenCast's Nature paper](https://www.nature.com/articles/s41586-024-08252-9)
   reports better probabilistic skill than ENS on 97.2% of 1,320 variable/lead-time/
   level comparisons in its 2019 evaluation. This is not 97.2% weather accuracy;
   targets are correlated and precipitation is excluded from main results. One
   15-day forecast takes about eight minutes on a Cloud TPUv5; ensemble members
   can run in parallel. Retain model-specific achievement, avoid making it an
   accomplishment of a conversational LLM.
4. **Biology, qualified verification:** [AlphaFold 3](https://doi.org/10.1038/s41586-024-07487-w)
   extends structure prediction to biomolecular interactions. Primary publisher
   search text verifies explicit limitations: stereochemistry, hallucinations,
   static structures rather than dynamics. Full page/PDF retrieval failed in this
   pass, so no new detailed numerical claim is cleared here. Use the first three
   cases if a fully retrieved source set is required.

## AI Winters: distinguish assessment, forecast, and consequence

### ALPAC: primary report resolves a central framing error

[Original report scan](https://www.mt-archive.net/50/ALPAC-1966.pdf), 1966,
printed p.32 (PDF index45), questions near-term useful machine translation.
Printed p.34 (index47) recommends computational linguistics and translation
improvement. Front matter, July 27, 1966 letter (indices4–5), explicitly worries
the report could be misread as ending computational-linguistics support and
endorses research support of $2.5–3m/year across four or five centers.

Recommended copy: “ALPAC questioned the near-term economics of fully automatic
translation while supporting computational linguistics and tools for human
translators.” Retain as an evaluation/policy document; remove “badly wrong as a
forecast” unless the exact forecast and horizon are specified. Later machine
translation does not refute a statement about near-term economics in 1966.
Remove the CUT claim that scans prevented verification; the original is readable.

### Lighthill: verify the quote, change its role

[Report and responses mirror](https://rodsmith.nz/wp-content/uploads/Lighthill_1973_Report.pdf)
labels the report July 1972 (PDF index2), published in the 1973 symposium. Section
3, index7, contains the existing retrospective quotation about impact “so far.”
The next paragraph credits achievements in automation and central-nervous-system
research; it questions the proposed bridge between them. Combinatorial explosion
is explicit (index8). This is primary text on a mirror, not an original-host scan.

Recommended copy: “Lighthill criticized unmet promises and the scaling limits of
search, while distinguishing useful automation and brain research from the
disputed bridge between them.” A retrospective critique is not automatically a
failed prediction. [Jim Howe's Edinburgh history](https://www.inf.ed.ac.uk/about/AIhistory.html)
is a participant/institutional account supporting a substantial UK confidence
loss for roughly a decade and describing continued practical knowledge-based
systems. It does not establish worldwide cessation.

### Other historical and current claims

- **R1/XCON:** [McDermott, AAAI 1980](https://cdn.aaai.org/AAAI/1980/AAAI80-076.pdf)
  is a primary system paper supporting practical computer configuration work.
  Remove “previous booms had no users.” Do not add unverified annual savings.
- **Strategic Computing:** [the original 1983 plan's NTIS record](https://ntrl.ntis.gov/NTRL/dashboard/searchResults/titleDetail/ADA141982.xhtml)
  establishes program purpose. [MIT Press's historical study description](https://mitpress.mit.edu/9780262182263/strategic-computing/)
  describes $1bn spending over 1983–93; this is secondary scholarship, not a
  primary budget ledger. It should not become a single 1983 cash commitment.
  This pass did not verify the precise 1987 cut or “deeply and brutally” quote.
- **Perceptrons:** separate mathematical limitations of a model class from the
  disputed causal claim that one book ended neural-network research. Current
  Wikipedia-only source does not justify a primary status. Avoid “neural networks
  run essentially everything” and “the field moved on” absolutes.
- **Simon/Minsky forecasts:** current Quote Investigator references are secondary
  routes. This pass did not inspect original printed pages. Retain as reported
  with exact book/year/page attribution or omit the quotation; do not upgrade
  to primary because an earlier build says “verified against scans.”
- **1984 Schank/Minsky debate:** the Crevier-derived account remains secondary,
  and cannot support an absolute claim that mechanism forecasts generally
  outperform dated forecasts. One retrospectively selected case is not a rate.
- **Current scale:** [OpenAI, February 27, 2026](https://openai.com/index/scaling-ai-for-everyone/)
  directly reports an announced $110bn investment at $730bn pre-money valuation,
  900m+ weekly ChatGPT users and 50m+ consumer subscribers. Replace TechCrunch
  source with this primary page, label company-reported and dated. Investment,
  revenue, profit, and AI research budgets are different measures. Do not sum
  1980s currencies and compare with this round without conversion and price-year
  methodology. This is a dated snapshot, not audited proof of permanent demand.
- **Amodei:** [Machines of Loving Grace](https://darioamodei.com/essay/machines-of-loving-grace)
  directly contains the hedged 2026 possibility and allows longer timelines.
  Preserve those hedges and its definition of powerful AI. The calendar alone
  does not settle the prediction. Remove claims forecasters shipped “the previous
  four things they promised” without an enumerated record.
- **Present constraints:** replace “nobody knows a limit” with “No single binding
  constraint has been established here.” Known reliability, evaluation, cost,
  data, and deployment constraints are compatible with uncertainty about which
  becomes binding. Do not make the present a partially completed historical cycle.

## Builder verification contract and provenance

Before shipping, inspect all app/guide/README uses of changed claims, not only the
data row. Source links should open as optional reader actions; keep runtime
offline. Show benchmark version, population, evaluator, budget/tools, metric unit,
measurement date and model-release date where they differ. Distinguish source
accessibility from truth and independent evaluation from vendor reporting. Do not
draw a solid extrapolation after the last supported point. Label illustrative
examples as illustrations, not literal benchmark items.

Research verification performed: read source files, retrieved primary pages and
original report text, checked quoted scope/units/denominators, and requested PDF
screenshots for ALPAC indices4/45 and Lighthill index7. Screenshot calls returned
references, not viewable images in this tool lane, so visual inspection is **not**
claimed. No app tests, browser usability checks, or rendered guide QA were run
by this lane; builders own those checks. No browser viewport was changed.

Runtime provenance was read from this worker's native `turn_context`: model
`gpt-6-astra`, effort `high`, native task `01a08660-c913-7883-8a21-2eb9a658a130`.
Only this research reference is an owned tracked write; coordinator owns shared
changelog/integration. No descendants or push. The named research task artifact
was read first; exact destination absence was checked before creation. This audit
refines the supplied demos and adds no competing canonical dataset.
