---
id: examples-repo-structure
artifact_kind: decision
schema_version: 2
title: Examples repo — local-only demo collection, one folder per demo, originals retired not deleted
created: 2026-08-03T18:04:28Z
updated: 2026-08-03T18:04:28Z
author: msu.soeai
model: claude-fable-5
model_basis: confirmed
status: chosen
question: How should the new examples/demos collection be structured, and what happens to the pre-existing standalone Tic_Tac_Toe folder?
position: One git repo at GitHub\examples with a subfolder per self-contained demo (no build step, open index.html), a root launcher page + README table, tic-tac-toe COPIED in and the original folder moved to _to_delete (session tooling cannot delete on-device files), local-only until the user opts into a remote.
scope: workspace
load_profile: on_demand
session: session_01MtHFEZCTJS2eNpUuqH7dgc
entities: [examples-repo]
tags: [examples, repo-structure, demos, tic-tac-toe, decision]
aliases: [examples folder layout, demo repo structure, where did Tic_Tac_Toe go]
source_basis: transcript
human_edited: false
sensitivity: normal
---

# Examples repo structure (user-chosen, 2026-08-03)

## Position
- **Layout**: `examples\` is a single git repo; each demo is a self-contained subfolder
  (`tic-tac-toe\`, `snake\`, `memory-match\`, `fuel-golf\`) of plain HTML/CSS/JS with no
  build step. A root `index.html` launcher card-links every demo; `README.md` carries the
  same table. Adding a demo = new folder + row + card.
- **Tic_Tac_Toe migration**: game files copied into `examples\tic-tac-toe\`; the original
  `GitHub\Tic_Tac_Toe\` folder was retired to `GitHub\_to_delete\Tic_Tac_Toe` for the user
  to delete (remote-session tooling can move but not delete on-device files). Its old
  `.git` was a gitdir pointer into `.acc-gitdb\Tic_Tac_Toe`; the move orphaned that
  pointer — history, if any, remains in `.acc-gitdb`, and the files live on in examples.
- **Remote**: none by user choice ("local folder only"). No public `Tic_Tac_Toe` repo
  exists under the bharrison0369 account (404). Publish path when wanted:
  `gh repo create examples --private --source . --push`.

## Consequences
- `_to_delete\` also accumulates git lock files (`index.lock`, `HEAD.lock`, `tmp_obj_*`)
  swept out of `.git` after each remote-session commit — the OneDrive-mounted filesystem
  forbids unlink from the session VM, so locks are moved instead of deleted. Safe to purge.

## Relations
- relates_to [[decision-git-tracking-policy-onedrive-era]] (what earns tracking)
- relates_to [[decision-examples-fleet-gitdb-migration]] (later move of this repo's git dir)
