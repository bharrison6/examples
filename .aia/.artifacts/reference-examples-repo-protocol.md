---
id: examples-repo-protocol
artifact_kind: reference
schema_version: 2
title: Examples repo protocol — naming, contract, generated surfaces, memory, git
created: 2026-08-07T15:17:29Z
updated: 2026-08-07T15:17:29Z
author: msu.soeai
model: claude-fable-5
model_basis: confirmed
status: active
source: CONTRACT.md and AGENTS.md (canonical in-repo files); user ratification 2026-08-07
reachable_via: local
scope: examples
load_profile: scope_entry
session: bed2f7b7-a6b3-4247-8253-e09a213548ae
entities: [examples-repo]
tags: [examples, repo-protocol, demo-contract, naming, manifests, cross-harness-memory, scope-entry]
aliases: [examples protocol, demo repo rules, how examples is organized, examples scope entry]
source_basis: transcript
human_edited: false
sensitivity: normal
---

# Examples repo protocol (ratified 2026-08-07)

> The operating rules for `GitHub\examples`. Canonical detail lives in the repo's own
> files — this artifact is the map, not a second copy.

## What this repo is

Public collection of self-contained browser demos showing off AI-built classroom
software, curated as the live tour for **"AI: From Zero to Takeoff"** (Bryant Harrison,
Murray State University). Hosted via GitHub Pages at `bharrison6.github.io/examples`
(QR codes in the launcher point there); remote `github.com/bharrison6/examples`.

## Canonical files (read these, don't duplicate them)

- `CONTRACT.md` — the demo contract: required files AND required UX (how-to popup with
  reopen, settings + presentation mode with presenter notes, MSU theme for MSU demos,
  Bryant Harrison attribution, mobile capable, offline/no runtime inference). Open
  list by user directive — items get added; new keys are backfilled into every
  `demo.json` compliance block.
- `AGENTS.md` — canonical agent instructions, read by every harness (Cowork, Claude
  Code, Codex, GPT tools). `CLAUDE.md` is a pointer to it — keep it that way
  (single source).
- `<demo>/demo.json` — per-demo manifest: identity, metadata, `built_with`
  provenance, compliance state.
- `tours/*.json` — launcher/README ordering as data; the launcher's narrative prose
  stays hand-authored in `index.html`.

## Standing rules

- **Naming (user-ratified 2026-08-07)**: folders are kebab-case **title slugs** and
  are public URLs — never rename a shipped demo. The descriptive layer is manifest
  metadata, not the folder name. (The one sanctioned rename: `engineering-demo` →
  `bridge-works`, 2026-08-07.)
- **Generated surfaces**: README demo table + launcher card bodies come from
  `node tools/build-hub.js`. Hand-editing them is a fork; edit manifests/tours.
- **Provenance matters**: `built_with` records which harness built each demo — part
  of the repo's demonstration value. Currently unrecorded for all nine demos
  (backfill pending from user).
- **Memory**: `.artifacts\` is the one memory store for every harness; this artifact
  is the only `scope_entry` one. Decisions stay `on_demand`.
- **Changelog**: `.changelog.md`, add-only newest-first below the marker.

## Git gotcha

`.git` is a gitdir pointer into `C:\Users\Champion\.acc-gitdb\examples` (outside
OneDrive). Folder moves break it; cloud sessions may need explicit `GIT_DIR`/
`GIT_WORK_TREE`. Pushing deploys the public site — user confirmation required.

## Relations

- relates_to [[decision-examples-repo-structure]] (structure history; refreshed 2026-08-07)
- relates_to [[decision-examples-fleet-gitdb-migration]] (why .git is a pointer)
- relates_to [[legacy-changelog-format]] (changelog entry shape)
