---
id: examples-fleet-gitdb-migration
artifact_kind: decision
schema_version: 2
title: Examples repo joins the fleet gitdir convention — git database relocated to .acc-gitdb
created: 2026-08-03T18:04:28Z
updated: 2026-08-03T18:04:28Z
author: msu.soeai
model: claude-fable-5
model_basis: confirmed
status: chosen
question: Should the examples repo keep its embedded .git directory or adopt the workspace fleet convention of a gitdir pointer into .acc-gitdb?
position: Adopt the fleet convention (user choice): the git database moves to C:\Users\Champion\.acc-gitdb\examples and examples\.git becomes a pointer file "gitdir: ../../../.acc-gitdb/examples", matching PersonalContext and the retired Tic_Tac_Toe. History (all commits since init) is preserved intact through the move.
scope: AIA
load_profile: on_demand
session: session_01MtHFEZCTJS2eNpUuqH7dgc
entities: [examples-repo, agent-context-system]
tags: [examples, git, acc-gitdb, gitdir-pointer, fleet-convention, decision]
aliases: [examples gitdb move, why examples .git is a file, fleet git layout for examples]
source_basis: transcript
human_edited: false
sensitivity: normal
decided_by: human
---
<!-- era-note 2026-08-31 (A5): absolute paths naming C:\GitHub, D:\OneDrive\GitHub, C:\Users\dover\..., or C:\Users\Champion\OneDrive\GitHub are pre-2026-08-30 era locations, kept verbatim as record; the entrance is now the AIA scope and current locations resolve via the scope registry. -->

# Fleet gitdb migration for examples (user-chosen, 2026-08-03)

## Position
- `.acc-gitdb` lives at `C:\Users\Champion\.acc-gitdb` — outside OneDrive, so git
  internals are never OneDrive-synced, and outside the working tree, so the parent
  AIA repo never sees a nested `.git` directory.
- Pointer depth from `OneDrive\GitHub\examples`: three levels up ⇒
  `gitdir: ../../../.acc-gitdb/examples` (same depth Tic_Tac_Toe used).
- `core.worktree` in the relocated config anchors the working tree back to
  `examples\`, mirroring the existing fleet repos' config pattern.
- The superseded embedded `.git` directory is retired to `GitHub\_to_delete\`
  (remote sessions cannot delete on-device files), safe to purge after verification.

## Consequences
- Remote (cloud) sessions see different relative depths through their mounts, so
  in-session git operations use explicit `GIT_DIR`/`GIT_WORK_TREE` overrides rather
  than the pointer file. On Windows the pointer resolves natively.
- Moving or renaming the examples folder breaks the relative pointer (as happened to
  Tic_Tac_Toe when it was retired) — update the pointer file if the folder ever moves.

## Relations
- relates_to [[decision-git-tracking-policy-onedrive-era]] (tracking rubric)
- relates_to [[decision-examples-repo-structure]] (the repo this migrates)
