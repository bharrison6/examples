---
id: examples-public-demos-handoff
artifact_kind: memory
schema_version: 2
title: Examples public demo collection — review, UX completion, and restart handoff
created: 2026-08-27T19:35:22Z
updated: 2026-08-27T19:35:22Z
author: codex
model: gpt-5.6-sol
model_basis: confirmed
status: active
memory_class: episodic
session: codex-019fd350-f762-7123-a50b-f7befb8186a0
derived_from: C:\Users\Champion\.codex\sessions\2026\08\05\rollout-2026-08-05T14-05-26-019fd350-f762-7123-a50b-f7befb8186a0.jsonl
entities: [examples-repo, bharrison6, Murray-State-University, GitHub-Pages]
tags: [examples, demos, review, mobile, accessibility, Murray-State, guides, GitHub-Pages, handoff]
aliases: [examples repo handoff, public demos restart note, AI From Zero to Takeoff demos]
source_basis: transcript
confidence: 70
human_edited: false
sensitivity: normal
---

# Examples public demo collection — review, UX completion, and restart handoff

> The examples session completed a staged review/fix campaign, published the collection for phone use, and left a precise restart state for the next thread.

## Context

The user asked to inspect the examples repository, then directed a sequence of removals, renames, independent Sol reviews, Terra implementation passes, and independent acceptance. The user later requested a mobile-compatibility pass, an official Murray State theme pass, in-app student guides with separate teacher guides, public GitHub publication, GitHub Pages deployment, and finally a durable restart handoff.

## Discussion

- The legacy Snake, Memory Match, and Nine Board Tic Tac Toe demos were removed from the working collection; the former Outgrown demo was renamed to **Zero to Unbeatable** and its app, guides, tests, source templates, generated output, and cross-demo references were rebranded consistently.
- The review cadence became two demos at a time: read-only `gpt-5.6-sol` review, bounded `gpt-5.6-terra` implementation, then primary-agent verification. The retained review set in this session was Fuel Golf, Bridge Works, Ladder Lab, Topping Out, Zero to Unbeatable, Glass Box, and Undershoot.
- The verified implementation work covered Fuel Golf accessibility and portable UI checks; Bridge Works keyboard editing, projected collapse, failure accounting, self-weight, standalone parity, and guide behavior; Ladder Lab grader integrity, controls, selector state, and browser portability; Topping Out preview/commit parity, crew lead time, FF scheduling, recursive rework, seeded leaderboards, and browser portability; Zero RNG isolation, proof/report honesty, and modal accessibility; Glass Box cooperative STaR fallback, rerun reset, canvas alternatives, and target sizing; and Undershoot source provenance, forecast gating, timeline interactions, accessibility semantics, score display, portable tooling, and guide/PDF corrections.
- Undershoot acceptance finished at 120/120 Node checks, 163/163 browser checks, 123/123 model sources resolving, generated build parity, and a five-page Letter PDF that was rendered and visually checked.
- The final mobile audit passed all 42 retained-demo/viewport combinations (320–430 px portrait plus phone landscape), with no horizontal overflow, clipped or unreachable primary controls, undersized visible touch targets, broken dialogs, or unusable canvas interactions.
- The Murray State theme pass applied official navy `#002144` and gold `#ECAC00`, visible university identity, and measured 8.05:1 contrast across the seven retained demos while preserving each demo's own visual vocabulary.
- The Guide control now means student-facing quick instructions/how-to-play. The full presenter/teacher guide remains under Teacher, Instructor, or Settings as **Open teacher guide**. All seven retained demos expose the student guide in an accessible in-app dialog and retain printable standalone guide/PDF copies.
- Bridge Works specifically reopens its original self-evident How to Play content from Guide, includes the 60-second first-bridge walkthrough, and defaults the keyboard editing cursor off. Teacher mode offers an explicit toggle to enable keyboard editing; when disabled, the canvas is removed from the tab order and the cursor is hidden.
- The public repository was created under the user's `bharrison6` GitHub account using `bharrison6@murraystate.edu`; `main` was pushed and GitHub Pages was configured from `main`/root with HTTPS. The hub and direct demo URLs were verified HTTP 200. **Should Have Known That: Engineering Edition** was added, pushed, and verified live at `https://bharrison6.github.io/examples/should-have-known-that/`.

## Observations

- [current-state] On-disk verification at distill time shows `examples` on `main`, one commit ahead of `origin/main`: `HEAD dcb428d` (`chore: archive projectless demo evidence in OneDrive`) and `origin/main 443c403` (`Bring all nine demos up to CONTRACT.md Required UX`).
- [current-state] The working tree intentionally contains staged `.plans/radiant-mixing-lemon.md` (178-line Car Conversation Tracker negotiation-coach plan, unrelated to the examples demo work) and unstaged `topping-out/README.md`, `topping-out/index.html`, `topping-out/src/app.js`, and `topping-out/src/data.js` edits that only rename “Ellis Street Annex” to “Shoe Tree Annex” and “Calloway Commons” to “Racer Commons — Chestnut Street”. Preserve all of these for explicit user review; do not sweep them into an examples commit.
- [current-state] The current checkout contains nine manifest-backed demo folders: `bridge-works`, `fuel-golf`, `glass-box`, `ladder-lab`, `should-have-known-that`, `takeoff`, `the-stranger`, `topping-out`, and `zero-to-unbeatable`. The session's seven-demo review completion statement predates the current nine-demo contract/changelog state; treat the current checkout and `origin/main` as authoritative for any new work.
- [current-state] The live hub, Should Have Known That, and Topping Out pages returned HTTP 200 during distill verification: `https://bharrison6.github.io/examples/`, `https://bharrison6.github.io/examples/should-have-known-that/`, and `https://bharrison6.github.io/examples/topping-out/`.
- [handoff] Do not modify code, staging, Git history, or GitHub state merely to resume this work. Start the next thread by reading `examples/AGENTS.md`, `examples/.artifacts/reference-examples-repo-protocol.md`, this artifact, and the current `git status`.

## Notes for Future Sessions

- Treat folder names as public URLs and preserve shipped slugs. Generated README demo tables and launcher card bodies are produced by `node tools/build-hub.js`; edit manifests or tour data instead of hand-editing generated regions.
- Keep the review → Terra fix → independent verification discipline for any new demo or regression. No runtime network or AI inference is allowed in the demos.
- The public deployment is healthy, but the local branch is not clean by design. Reconcile the unrelated staged plan and the four Topping Out rename edits with the user before any commit or push.

## Relations

- references [[examples-repo-protocol]] (canonical repo operating rules)
- relates_to [[decision-examples-repo-structure]] (collection structure history)
- derived_from subagent reviews and implementer returns in the same captured conversation (legacy sibling transcript fan-in)
