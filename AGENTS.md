# examples — agent instructions

Public demo collection for showing off AI-built classroom software, curated as the live
tour for **"AI: From Zero to Takeoff"** (Bryant Harrison, Murray State University).
Hosted at `bharrison6.github.io/examples`; remote `github.com/bharrison6/examples`.

This file is the canonical agent instruction file for this repo — Cowork, Claude Code,
Codex, and any other harness follow the same rules below (`CLAUDE.md` here is just a
pointer to this file).

## Ground rules

- **Folder names are public URLs** (`bharrison6.github.io/examples/<slug>/`) — never
  rename a shipped demo folder. New demos: kebab-case title slug (`bridge-works`).
- **Every demo meets [CONTRACT.md](CONTRACT.md)** — required files (index.html,
  README.md, demo.json, printable guide) and required UX (how-to popup, settings +
  presentation mode with presenter notes, theme, attribution, mobile, offline).
- **Generated surfaces**: the README demo table and the launcher card bodies in
  `index.html` are generated from `demo.json` manifests. Edit the manifest (or
  `tours/*.json` for ordering), then run `node tools/build-hub.js`. Never hand-edit
  between the demo-table markers or inside a launcher `<a class="card">` body.
- **No runtime network or AI inference in demos** (standing policy; change only by
  explicit user decision, never incidentally).
- **Record provenance**: set `built_with` in `demo.json` to the tools that actually
  built the demo (`cowork`, `claude-code`, `codex`, `gpt`, ...). Provenance is part of
  what this repo demonstrates — keep it honest.

## Memory (all harnesses)

Durable repo memory lives in `.artifacts/*.md` — ACC v2 artifacts with YAML front
matter. This is the one memory store; do not invent a parallel one.

- **On session start**: read every `.artifacts` file whose front matter has
  `load_profile: scope_entry` (currently `reference-examples-repo-protocol.md`).
- **When a durable decision, preference, or gotcha lands**: create or update an
  artifact there. Copy a neighbor's front-matter shape; set `model` to your actual
  model id (or `unattributed`); one artifact per fact — update rather than fork.
- Never delete or wholesale-rewrite another session's artifact.

## Changelog

Log substantive work in `.changelog.md`: add-only, newest-first, insert immediately
below `<!-- acc-changelog-entry-point -->`, entry format per the file's preamble.

## Git

`.git` here is a pointer file (`gitdir: ../../../.acc-gitdb/examples`); the real git
database lives outside OneDrive at `C:\Users\Champion\.acc-gitdb\examples`. Moving or
renaming the repo folder breaks the pointer. Cloud/remote sessions may need explicit
`GIT_DIR`/`GIT_WORK_TREE`. Commit locally at logical units; **pushing requires explicit
user confirmation** — a push deploys the public hosted copy.
