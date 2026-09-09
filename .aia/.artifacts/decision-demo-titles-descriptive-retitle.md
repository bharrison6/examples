---
id: demo-titles-descriptive-retitle
artifact_kind: memory
memory_class: prospective
prospective_kind: decision
schema_version: 2
title: "Retitle the cryptic demos: display titles only, or folder slugs too?"
created: 2026-09-09T03:24:00Z
updated: 2026-09-09T03:24:00Z
author: msu.soeai
model: claude-fable-5-1
model_basis: confirmed
status: open
question: "Thirteen demos have evocative titles that do not say what they are. Should they be retitled in the descriptive layer only (folder slugs and public URLs unchanged), or should the folders be renamed as well?"
position: "Path A: change display titles only. Slugs stay, the 2026-08-07 never-rename rule stands, and the old title survives as the tagline where it is good."
alternatives:
  - "Path A: retitle in demo.json, each demo's header, tab, guide, PDF and README; folder slugs and URLs unchanged (recommended)"
  - "Path B: retitle AND rename folders to descriptive slugs, leaving a redirect stub page at each old slug; supersedes the 2026-08-07 never-rename ruling"
  - "Not now: record the preference in the contract only"
answer_shape: choice
stakes: medium
deadline: none
default: "Path A."
reasoning: "The operator said titles must not be cryptic and confirmed the list below. Path A meets that with no broken links and no conflict with the ratified folder rule; the hub card already shows topic and blurb, and the tab, in-app header, guide and PDF would now carry a descriptive title too. Path B additionally breaks any shared deep link and GitHub Pages cannot redirect server-side, so each old slug would need a stub page. The QR codes point at the hub root and survive either way."
scope: examples
load_profile: on_demand
entities: [examples-repo]
tags: [decision, naming, demos, ai-fellows]
aliases: [retitle demos, cryptic names, path a or b]
source_basis: authored
confidence: 85
human_edited: false
sensitivity: normal
---

# Retitling the cryptic demos

The operator's direction on 2026-09-09: "we don't want to be cryptic... and the other
examples probably need a less cryptic name as well." The preference is now recorded in
`CONTRACT.md` (Naming). What remains is how far the retitle reaches.

## Confirmed title list

Edited by the operator on 2026-09-09; these are the target titles under either path.

| Slug | Current title | New title |
|---|---|---|
| ion-flight | Ion Flight | Time-of-Flight Mass Spectrometer |
| glass-box | Glass Box | How a Language Model Works |
| front-doors | Front Doors | AI Tool Guide |
| two-winters | Two Winters | AI Winters: Boom and Bust |
| takeoff | Takeoff | The Pace of AI Progress |
| the-stranger | The Stranger | Prompting Strategies |
| missing-time | Missing Time | Gaps in the Rock Record |
| topping-out | Topping Out | Construction Scheduling |
| ladder-lab | Ladder Lab | PLC Ladder Logic Trainer |
| should-have-known-that | Should Have Known That | Engineering Trivia |
| fuel-golf | Fuel Golf | Orbital Mechanics Golf |
| bridge-works | Bridge Works | Truss Bridge Builder |
| zero-to-unbeatable | Zero to Unbeatable | Types of AI |

Wavelet Lab, Inhibitor Investigation and What the Survey Missed keep their titles.

Open point inside the list: the hub is titled "AI: From Zero to Takeoff", so retitling
the Takeoff demo drops the echo of the talk's name. Suggested: keep "Takeoff" as that
demo's tagline.

## What each path touches

Path A, per demo: `demo.json` title (and tagline), the in-app header and browser tab, any
how-to or notes text that names the demo, the guide heading in source and shipped copies
with a PDF re-render, the README heading; then one hub regeneration and the launcher's
hand-authored narrative wherever it names a demo.

Path B adds: a folder rename per demo, a stub `index.html` at each old slug carrying a
meta refresh to the new one, and closing [[examples-repo-protocol]]'s never-rename rule
with `superseded_by` written.

## Relations

- relates_to [[examples-repo-protocol]]
- relates_to [[examples-repo-structure]]
- relates_to [[contract-ux-pass]]

<!-- producing-model: claude-fable-5-1 2026-09-09T03:24:00Z, Claude Code runtime record -->
