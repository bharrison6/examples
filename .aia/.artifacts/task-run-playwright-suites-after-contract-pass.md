---
id: run-playwright-suites-after-contract-pass
artifact_kind: memory
memory_class: prospective
prospective_kind: task
schema_version: 2
title: Run the seven Playwright browser suites edited by the contract pass on a machine that has Playwright
created: 2026-09-09T05:45:00Z
updated: 2026-09-09T05:45:00Z
author: msu.soeai
model: claude-fable-5-1
model_basis: confirmed
status: proposed
snooze_until: 2026-09-23
priority: normal
scope: examples
source_basis: conversation
sensitivity: normal
tags: [demo-contract, testing, playwright, ai-fellows]
aliases: [playwright suites unrun, integration.mjs unverified, ui-smoke unrun]
---

# Run the Playwright suites the contract pass could not

**Expected outcome.** `takeoff/tools/integration.mjs`, `bridge-works/ui-smoke.js`,
`fuel-golf/ui-smoke.js`, `ladder-lab/tools/integration.mjs`, `glass-box/tools/integration.mjs`,
`topping-out/tools/integration.mjs` and `the-stranger/tools/playtest.py` run green on a machine
where Playwright is installed, or their failures are fixed. Each was edited during
[[contract-ux-pass]] to match the new Guide, Settings and Reset surface, but none could execute
here (no `node_modules`, installs barred by the lane rules), so those edits are syntax-checked and
mirrored by each lane's headless-Chrome probe but not executed as written.

Why proposed rather than done: the lanes' CDP probes covered every property the suites assert,
so nothing is known to be broken; this closes the gap between "verified by a substitute probe"
and "the demo's own suite passes".

## Relations

- follows [[contract-ux-pass]]
