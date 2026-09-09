---
id: glass-box-dialog-centering
artifact_kind: memory
memory_class: prospective
prospective_kind: task
schema_version: 2
title: Centre glass-box's overlay cards on desktop (pre-existing, pinned top-left by the global margin reset)
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
tags: [glass-box, layout, demos, ai-fellows]
aliases: [glass box dialogs top-left, student-guide margin auto]
---

# Centre glass-box's overlay cards

**Expected outcome.** The three `<dialog>` cards in glass-box (Guide, Settings, Presenter
Notes) open centred on desktop instead of pinned to the top-left corner, at every width the
demo supports, with no change to phone layout.

Found by the glass-box lane of [[contract-ux-pass]] and measured identical on the committed
baseline (`[0,0,660,706]`), so it is not a regression of that pass: the demo's global
`* { margin: 0 }` cancels the browser's default `margin: auto` on `dialog`. The likely fix is
one rule, `.student-guide { margin: auto }`, but it changes how every card in the demo looks,
which is why the lane flagged it rather than shipping it.

## Relations

- follows [[contract-ux-pass]]
