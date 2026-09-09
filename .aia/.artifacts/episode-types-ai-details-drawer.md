---
id: types-ai-details-drawer
artifact_kind: memory
memory_class: episodic
lifecycle: complete
schema_version: 2
title: Move Types of AI explanations into a side drawer
created: 2026-09-09T04:43:05Z
updated: 2026-09-09T05:01:00Z
author: codex
model: gpt-6-astra
model_basis: confirmed
status: active
scope: examples
source_basis: conversation
sensitivity: normal
tags: [design, tic-tac-toe, details]
---

# Completion — 2026-09-09

Moved long evidence and explanations from the main activity into a right-side
Details drawer, opened by a labeled button beside the lesson cues. Reused the
existing live content nodes and sheet focus/dismissal mechanism. The drawer has
a fixed header and footer, keyboard-scrollable content, background scroll lock,
focus return and scroll reset on opening. It displays the active stage and keeps
selected-era evidence behavior. Ultimate navigation closes the drawer first.
Directional prose now points to Details rather than a panel below the activity.

Native gpt-5.6-sol high builder delivered 129754b and 5127e19. Parent gpt-6-astra
reviewed source and Chrome extension UI. Desktop and 390/320px drawer bounds fit;
Tab/Shift+Tab wrap, PageDown scroll, Escape and Back to activity dismissal, focus
return and scroll reset were observed. Checked entry Guide, all three stages,
500-game training then Era 0 evidence suppression, and neural-to-Ultimate handoff.
Chrome error log was empty. Parent observed nine UI/lifecycle tests and final
generated parity pass; builder reported 102 gameplay checks, neural suite, syntax
and diff checks passing. Core algorithms and canonical presenter guide/PDF did
not change. Shared backdrop handling was retained and inspected, not separately
clicked in final browser QA.

This completes the operator request recorded as
prose:01a08159-d0e4-7013-a510-bffe0b53d74f@2026-09-09T04:41:54.919Z.
Follow-up to [[types-ai-redesign]] and [[types-ai-controls]]. Claude coordinator
79d3584e was notified; implementation stayed isolated from its other demo edits.

# Original expected outcome

Long explanations and evidence currently below the activity are available in a
right-side Details drawer. A clearly labeled Details button near the lesson opens
it. The main activity retains its question, Try/Observe/Takeaway, board, rules or
training controls and score inspector. Top tabs and the newly relocated rule/Era
controls stay in place. Preserve the details' scientific qualifications, selected
era accuracy, and access to the optional Ultimate extension.

# Bounded builder lane

Continue in the existing codex/types-ai-redesign worktree. Own only
zero-to-unbeatable/src/template.html, src/styles.css, src/app.js, generated
index.html and README.md. No other demo, root hub/manifest, guide/PDF or memory
edits. Parent owns task/log updates, Chrome checks, integration and publishing.

Reuse the app's overlay/focus/Escape/backdrop mechanism and existing content nodes
for the drawer instead of copying explanations into parallel DOM. Move both the
long evidence banner and expandable explanation into it; avoid requiring an extra
expansion click to read the drawer. Keep an obvious Close control, sensible width
on desktop, full-width or nearly full-width phone treatment, scrollable content,
focus return, and reduced-motion handling. Any nested navigation (e.g. Ultimate
extension or Settings) should dismiss the drawer or hand off through the existing
overlay mechanism. Details correspond to the current stage/selected era. Do not
change any learning or rule algorithm, entry Guide, notes, PDF or contract actions.

No descendants or browser actions. Return early if the request is unsound or
cannot be completed as scoped. Commit NEW explicit-path commits, no amend.
Checkpoint if needed in .aia/.data/types-ai-redesign/drawer-progress.md. Run build
parity and applicable existing behavior checks; add a regression only for a
substantive new interaction risk. Signal candidate-ready before final checks so
parent can inspect the UI, then return commits, tests and limitations.
