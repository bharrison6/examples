---
id: contract-ux-pass
artifact_kind: memory
memory_class: episodic
lifecycle: complete
schema_version: 2
title: Completed contract UX pass — Guide, Settings (notes/presentation/reset), single-sourced presenter notes across every demo
created: 2026-09-09T03:21:00Z
updated: 2026-09-09T05:40:00Z
author: msu.soeai
model: claude-fable-5-1
model_basis: confirmed
status: active
scope: examples
source_basis: conversation
sensitivity: normal
priority: high
priority_by: human
tags: [demo-contract, presenter-notes, guide, settings, ai-fellows]
aliases: [contract pass, guide settings reset pass, notes equal guide]
---

# Completion — 2026-09-09

Sanction, preserved as historical provenance: `prose:79d3584e-dc82-4b90-84ba-ee7b6491e5fd@2026-09-09T03:10:51Z`
("Make that in the contract and fix everything that doesn't meet the contract standard").

All sixteen demos meet the rewritten `CONTRACT.md` Required UX, and the hub reports every
compliance key `true` for every demo (`node tools/build-hub.js --check`, commit `6da61ec`).
Fifteen lanes ran as opus builder subagents in three batches of five; each lane's own checks
were re-run by the orchestrator before its commit, and every lane also ran a real headless
Chrome check with a network probe and a positive control. The sixteenth demo,
`zero-to-unbeatable`, was brought to the standard by Codex session 01a08159 on its own branch
(`aaf3da6`, `eebd08a`, `e0c2561`) and verified against the tree here.

Lane commits: inhibitor-investigation `3b66317`, ion-flight `8ee5e18`, takeoff `b81ed54`,
wavelet-lab `0f26955` (with the Part 3 live check), bridge-works `af6ed35`,
what-the-survey-missed `bcae257`, missing-time `a657431`, topping-out `c115d16`, fuel-golf
`24198a7`, should-have-known-that `5924297`, front-doors `cab22b3`, two-winters `56cb7f6`,
ladder-lab `5916f6c`, the-stranger `3b3160e`, glass-box `57ba874`; credit-pill phone fix
`51a2c9e`; attribution removals and the inhibitor extraction fix `3d6a2cd`; hub `6da61ec`.
The Path A retitle ([[demo-titles-retitle]]) and the wavelet Part 3 rework
([[wavelet-lab-part-3-live]]) were folded into these lanes and completed with them.

Limits, stated plainly: the Playwright-based suites in takeoff, bridge-works, fuel-golf,
ladder-lab, glass-box, the-stranger and topping-out could not run here (no playwright, installs
barred), so their edited assertions are unexecuted; every property they assert was checked in
a real browser by the lane instead. `offline_no_inference` rests on in-browser request logs
with positive controls, not on a physically disconnected network. Four Codex-built demos keep
a legacy ReportLab renderer marked reference-only beside the working Chrome renderer. Batch 3
was interrupted once by an opus monthly spend limit and resumed from the lanes' progress
files with no loss. Follow-ups the lanes surfaced are minted as proposals:
[[run-playwright-suites-after-contract-pass]], [[retire-legacy-reportlab-renderers]],
[[glass-box-dialog-centering]], [[shared-credit-pill-design]].

## Original brief (preserved)

# Contract UX pass (2026-09-09)

Orchestrator: Claude session `79d3584e`. One builder per demo lane; builders read this
artifact first. The standard is `CONTRACT.md` → **Required UX** (already rewritten).
Sanction: the operator's prose of 2026-09-09 ("Make that in the contract and fix
everything that doesn't meet the contract standard") covers the fifteen lanes listed
below; the `zero-to-unbeatable/` lane fires on a released note from Codex session
01a08159 (or the operator saying it is free).

**Expected outcome.** Every demo's built `index.html` has a `?` button named Guide beside
a Settings button whose menu offers Open Presenter Notes, Presentation mode and Reset;
the presenter notes shown in-app are generated from the same source file as the printable
guide and its PDF, with a `--check` that fails on drift; each `demo.json` compliance block
reports these keys honestly; the hub table regenerates from the manifests. Nothing else
about any demo changes.

## The standard, in one screen

- **Guide (`?`)** — `?` button in the header beside Settings; accessible name (aria-label /
  title) is exactly **Guide**; opens the Guide overlay (the existing how-to content) on first
  load; dismissible; reopenable from that button. Overlay heading should read "Guide" (a
  demo-specific subtitle after it is fine). The how-to content itself is not being rewritten.
- **Settings (`⚙`)** — beside the Guide button. Its menu always contains these three,
  labelled exactly: **Open Presenter Notes**, **Presentation mode**, **Reset**. Reset returns
  the demo to its fresh-load state (Guide overlay stays closed). Demo-specific options may
  remain alongside.
- **Presenter Notes are the printable guide** — the notes overlay opened from Settings and
  the printable guide (`*.html` + `*.pdf`, declared in `demo.json` → `guide`) are one
  document from one canonical source. The in-app copy is generated at build time from that
  source (no runtime fetch, no iframe, no external file); a `--check` fails when they drift;
  the PDF is rendered from the same source. Reference implementation: `two-winters/build.js`
  (lifts the guide's `.guide-scope` body and its scoped `<style>` into the app at the
  `<!--__GUIDE__-->` and `/*__GUIDE_CSS__*/` placeholders). A demo with no build step may add
  a minimal one, or a `tools/guide-sync.js` that writes the notes block between markers in
  `index.html` and verifies with `--check`. Either satisfies the contract.
- Everything else in CONTRACT.md stays as is (theme, attribution, mobile, offline: zero
  network at runtime).

Standardizations from the first completed lane (inhibitor-investigation, 2026-09-09):

- **Reset leaves Presentation mode alone.** Presentation mode is a presenter display
  preference, not demo state; Reset restores demo state and closes overlays and menus.
- **Provenance:** add `"claude-code"` to `demo.json` → `built_with` if it is not already
  there (CONTRACT.md asks for honest provenance; this pass is a real build step).
- **Guide prose may change only as back-propagation** (for example, a first-load step that
  now says the Guide overlay opens, or a step naming the three Settings items); no rewrite.
- **`offline_no_inference` may become `true` only from an in-browser network probe with a
  positive control** (for example, CDP `Network.requestWillBeSent` while exercising every
  control, with a control page that makes external requests and is seen to do so).

Lessons from the ion-flight and takeoff lanes (2026-09-09):

- **Do not locate the guide stylesheet with `indexOf('<style>')`** as `two-winters/build.js`
  does: a literal `<style>` inside an HTML comment in the guide makes extraction start inside
  the comment and the browser then drops the first scoped rule. Use an explicit marker such
  as `<style id="guide-css">` (the two-winters and front-doors lanes should fix the reference
  implementation the same way).
- **Placeholders must appear exactly once in the template.** `String.replace` substitutes the
  first occurrence; a placeholder named in a head comment received the whole guide. Guard for
  duplicate placeholders in `build.js`.
- **Pass a function, not a string, as the replacement** in `String.replace(from, to)` when the
  injected text may contain `$` (`$$`, `$&`, `` $` ``, `$'` are otherwise consumed).
- **Reset present in the audit table may be a per-round or per-level control**, not a
  whole-demo reset; verify fresh-load semantics rather than trusting the label.
- **The browser pane cannot run local files and its tabs are shared across lanes**; the working
  route is headless Chrome over the DevTools protocol with Node builtins (no installs), as the
  inhibitor-investigation and takeoff lanes did.

From the bridge-works lane (2026-09-09):

- **The shared `.bh-credit` attribution pill is clipped off-screen at 390px** (measured
  `left = -110px` on a 492px pill) in every demo that carries it: fuel-golf, glass-box,
  ladder-lab, should-have-known-that, takeoff, the-stranger, topping-out, bridge-works,
  zero-to-unbeatable. If your demo has it, add `max-width:calc(100vw - 16px); white-space:normal`
  to the pill's rule and confirm "Bryant Harrison" is readable at 390px before setting
  `attribution_visible` and `mobile` to `true`. The orchestrator patches the already-committed
  bridge-works and takeoff copies; Astra owns zero-to-unbeatable's.
- **Single-sourcing a stale guide exposes stale prose**: if the guide names controls that no
  longer exist (old labels, removed modes), correct them to the real labels in the source as
  back-propagation. Report what you changed.
- **A guide that has outgrown its PDF** may legitimately become two pages; do not shrink type
  below readability to force one page. Correct the README if it promised one page.

From the missing-time and what-the-survey-missed lanes (2026-09-09):

- **Use a lane-private scratch directory**: the session scratchpad is shared by every lane and
  files named `probe.mjs`, `cdp.mjs`, `guide.png` were overwritten mid-run. Write your harness
  and screenshots under `<scratchpad>\<slug>-lane\` and re-read nothing you did not just write.
- **Label assertions must be scoped to the Settings block**, not the whole document: once the
  guide is injected, its prose names "Open Presenter Notes" and the others, so a document-wide
  search matches its own answer key. Extract the menu block first and guard that it contains no
  `guide-scope`.
- **No `src/` copy step is needed when the root guide is the source**: lifting the scoped
  stylesheet and `.guide-scope` body straight from the root `teacher-guide.html` gives one file,
  no copy, and the same `--check` (missing-time's `build.js` is the worked example).

From the fuel-golf and topping-out lanes (2026-09-09):

- **Any marker you document in a comment will be matched inside that comment first**, including
  `<style id="guide-css">`. Mask every `<!-- -->` region to same-length spaces before searching,
  and assert each marker occurs exactly once in the masked text.
- **After the pill fix, re-measure what the wrapped pill lands on.** At 320 to 480px it wraps to
  two lines (about 34px) and can cover a bottom control bar or the notes overlay's foot; raise
  the reserved height or lift the pill at the narrow breakpoint and re-measure at several widths.
  Correction from the ladder-lab lane: an overlay opened with `<dialog>.showModal()` paints in
  the top layer above every z-index including the pill's, so no reserve is needed there; only
  plain `div` overlays and bottom control bars can collide with the pill.

From the should-have-known-that lane (2026-09-09):

- **Anchor every marker to the start of a line and refuse a marker that matches twice**; that
  rule holds where "name the block by id" alone did not (the header comment that documents the
  id is itself a match). Comment-masking is the equivalent alternative.
- **Re-measure a long-word retitle at 320, 360, 390 and 430px** before claiming `mobile: true`:
  "Engineering Trivia" overflowed where "Should Have Known That" fit, because ENGINEERING has no
  break opportunity. "PLC Ladder Logic Trainer" and "AI Winters: Boom and Bust" deserve the same
  check. Fit by `clamp()`/`min()` so desktop sizes are unchanged.

## Orchestrator sweep after batch 3 (not lane work)

- `inhibitor-investigation/build.js` still locates the guide stylesheet with `indexOf('<style>')`
  and its `src/teacher-guide.html` head comment contains that literal, so the first
  `.guide-scope` rule is swallowed (notes render at 16px). Fix with a comment-masked search or an
  explicit `<style id="guide-css">` marker, rebuild, and scope its `test-build.js` label
  assertions (lines ~34-36) to the menu block.
- Regenerate the hub (`node tools/build-hub.js`) once, push, and record the completion episode.

## Folded in (operator answers of 2026-09-09, before the pass started)

- **Retitle, Path A** ([[demo-titles-descriptive-retitle]], [[demo-titles-retitle]]): each lane
  also changes its demo's display title to the new title in the table below, everywhere the
  title appears inside the folder: `demo.json` `title`, the in-app header and `<title>`, the
  guide heading (source and shipped) with a PDF re-render, and the README heading. Folder name
  and guide filenames do not change. The old title may stay as a subtitle or in the tagline
  where it reads well; it is not required to survive.
- **Wavelet Lab Part 3** ([[wavelet-lab-part-3-rework]], [[wavelet-lab-part-3-live]]): the
  `wavelet-lab/` lane also replaces Part 3 with the live predict-your-next-toggle mechanic and
  adds a "Portrait at 64" preset, per that task's expected outcome.
- Fan-out width: batches of five, approved in prose ("Batches of five").

| Lane | New display title (Path A) |
|---|---|
| bridge-works | Truss Bridge Builder |
| front-doors | AI Tool Guide |
| fuel-golf | Orbital Mechanics Golf |
| glass-box | How a Language Model Works |
| inhibitor-investigation | (unchanged) |
| ion-flight | Time-of-Flight Mass Spectrometer |
| ladder-lab | PLC Ladder Logic Trainer |
| missing-time | Gaps in the Rock Record |
| should-have-known-that | Engineering Trivia |
| takeoff | The Pace of AI Progress |
| the-stranger | Prompting Strategies |
| topping-out | Construction Scheduling |
| two-winters | AI Winters: Boom and Bust |
| wavelet-lab | (unchanged) |
| what-the-survey-missed | (unchanged) |
| zero-to-unbeatable | Types of AI (held) |

## Lanes

Each builder owns ONE demo folder and nothing else. Known state from the orchestrator's
audit (in-app notes words vs guide words; controls seen in a `<button>` scan):

| Lane (owned folder) | Notes/guide words | Reset present | Build shape | Notes |
|---|---|---|---|---|
| bridge-works/ | 872 / 1510 fork | yes | flat index.html | |
| front-doors/ | single-sourced already | **no** | build.js + src/ + tools/pdf.mjs | only Guide label + Reset |
| fuel-golf/ | 1214 / 1065 fork | per-level Restart only | flat + tools/pdf.mjs | needs whole-demo Reset |
| glass-box/ | 1098 / 1503 fork | yes | build.js copies guide (not injected) | |
| inhibitor-investigation/ | 30 / 446 | **no** | build.js | scan found no notes/presentation buttons: verify the settings menu |
| ion-flight/ | 148 / 929 | **no** | build.js | |
| ladder-lab/ | 661 / 824 fork | yes | build.js + src/guide | scan did not find a Settings button: verify |
| missing-time/ | 69 / 727 | yes | build.js | |
| should-have-known-that/ | 791 / 1329 fork | **no** | flat | |
| takeoff/ | 1961 / 2072 hand-copied fork | yes | build.js copies guide + tools/pdf.mjs | replace the copy with injection |
| the-stranger/ | unclear (scan noisy) | yes | build.js; guide is presenter-sheet.html | verify by reading |
| topping-out/ | 1155 / 8239 | yes | build.js + src/guide | guide is very long: inject it whole, scrollable |
| two-winters/ | single-sourced already | **no** | build.js + src/ + tools/pdf.mjs | only Guide label + Reset |
| wavelet-lab/ | 97 / 816 | **no** | build.js (template + core injection) + tools/pdf.mjs | extend build.js |
| what-the-survey-missed/ | 29 / 620 | partial (responses only) | build.js | Reset must reset the whole demo |
| zero-to-unbeatable/ | 3336 / 2385 fork | yes | build.js + tools/pdf.mjs | **FULFILLED by Codex session 01a08159**, not by a lane here: integrated on main at `aaf3da6` (2026-09-09T04:15Z) with Guide, exact Settings actions, source-generated notes, 2-page PDF and the "Types of AI" title; evidence in `episode-types-ai-redesign`; hub regenerated by that session. No builder dispatched. |

## Rules for every lane

- Write only inside your owned folder plus your progress file
  `.aia/.data/contract-pass/<slug>.md` (create the directory if needed). Do NOT touch
  `index.html` at the repo root, `README.md` at the root, `CONTRACT.md`, `tours/`, root
  `tools/`, any other demo, or `.aia/.artifacts/`.
- Do not commit, branch, push, install dependencies, or add network calls. The orchestrator
  commits each lane after verifying the tree.
- Keep the printable guide's filename and the `demo.json` → `guide` declaration unchanged
  (they are linked from the hub). Keep the folder name unchanged (public URL).
- Reuse before building: read `two-winters/build.js`, `two-winters/src/template.html` (search
  for `__GUIDE__`) and `two-winters/src/presenter-guide.html` (the `.guide-scope` markers)
  before designing your mechanism. Match the demo's existing theme and code style.
- Write progress and design decisions to your progress file as you go, not at the end.
- Open one advisory intent for your folder before editing and close it when done:
  `pwsh -NoProfile -WorkingDirectory <repo> -File C:\Users\Champion\.claude\skills\intent\scripts\intent.ps1 open -Target "<slug>/" -Text "contract UX pass" -Task contract-ux-pass -Lane <slug>`
  then `... close -Intent <id> -Outcome "<one line>"`.

## Verification each lane must run and report verbatim

1. Your demo's own tests (whatever its `README.md`, `package.json`, or `src/*.test.js` says),
   plus `node build.js --check` (or your sync script's `--check`) proving the in-app notes
   equal the guide source, plus a fresh PDF render (`node tools/pdf.mjs` or the sibling
   pattern; Chrome is at `C:/Program Files/Google/Chrome/Application/chrome.exe`).
2. A static runtime audit of the built `index.html`: no `http(s)://` in `src=` or `href=`
   except the local guide link and outbound reading links; no `fetch(`, `XMLHttpRequest`,
   `WebSocket`, `@import`, `url(http`. Report the grep and a positive control.
3. Update `demo.json` → `compliance` honestly: `guide_button`, `settings_menu`,
   `presenter_notes`, `presentation_mode`, `settings_reset`, `notes_match_guide` become
   `true` only for what you implemented AND checked in the built page; otherwise
   `"unverified"` or `false`. Never delete a key.
4. Do not claim a browser check you did not run. If you can exercise the page in a browser,
   say what you did; if not, say "not browser-tested".

## Return contract (final message)

- Files touched (paths), in one list.
- Tests and checks run, with their actual output lines.
- The compliance values you set and why.
- Anything the contract asks for that you could not meet, with the reason.
- Remaining concerns the orchestrator should know.

## Escape hatch (first-class outcome, not a failure)

If the task looks impossible, wrong, or senseless for your demo — the mechanism does not fit
its build, the guide is not actually presenter material, "Reset" has no sensible meaning, or
the standard would damage the demo — stop early and return that reasoning instead of forcing
a fit. That return is evidence about the task, and the orchestrator will reframe.
