---
id: retire-legacy-reportlab-renderers
artifact_kind: memory
memory_class: prospective
prospective_kind: task
schema_version: 2
title: Recycle the four legacy ReportLab guide renderers now superseded by tools/pdf.mjs
created: 2026-09-09T05:45:00Z
updated: 2026-09-09T05:45:00Z
author: msu.soeai
model: claude-fable-5-1
model_basis: confirmed
status: proposed
snooze_until: 2026-09-23
priority: low
scope: examples
source_basis: conversation
sensitivity: normal
tags: [demo-contract, pdf, cleanup, ai-fellows]
aliases: [render_guide.py legacy, one renderer per folder]
---

# Retire the legacy ReportLab renderers

**Expected outcome.** `tools/render_guide.py` in inhibitor-investigation, ion-flight,
missing-time and what-the-survey-missed is recycled (Recycle Bin, not hard-deleted) and each
README's reference-only note about it is removed, leaving one renderer per folder
(`tools/pdf.mjs`, the dependency-free Chrome driver every demo now uses).

Why proposed rather than done: the scripts need ReportLab, which is not installed here, so
they could not be re-verified against the restructured guides; the lanes left them in place
under the destructive-operations rule and marked them reference-only. Removing them is a
deliberate delete outside the free surfaces and belongs to the operator's sanction.

## Relations

- follows [[contract-ux-pass]]
