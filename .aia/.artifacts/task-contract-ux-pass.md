---
id: contract-ux-pass
artifact_kind: memory
memory_class: prospective
prospective_kind: task
schema_version: 2
title: Contract UX pass — Guide, Settings (notes/presentation/reset), single-sourced presenter notes across every demo
created: 2026-09-09T03:21:00Z
updated: 2026-09-09T03:21:00Z
author: msu.soeai
model: claude-fable-5-1
model_basis: confirmed
status: open
scope: examples
source_basis: conversation
sensitivity: normal
sanctioned_by: operator prose 2026-09-09, session 79d3584e ("Make that in the contract and fix everything that doesn't meet the contract standard.")
tags: [demo-contract, presenter-notes, guide, settings, ai-fellows]
aliases: [contract pass, guide settings reset pass, notes equal guide]
---

# Contract UX pass (2026-09-09)

Orchestrator: Claude session `79d3584e`. One builder per demo lane; builders read this
artifact first. The standard is `CONTRACT.md` → **Required UX** (already rewritten).

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
| zero-to-unbeatable/ | 3336 / 2385 fork | yes | build.js + tools/pdf.mjs | **HELD** — Codex session 01a08159 owns it; do not dispatch until released |

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
