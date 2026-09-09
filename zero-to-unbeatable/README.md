# Types of AI

Demo 1 uses one tic-tac-toe board to compare three sources of a program’s skill:
written rules, experience stored as move scores, and neural-network weights:
adjustable numbers reused to score many board positions. Open `index.html` in a
modern browser. It is a single offline file:
no account, network request, AI service, or installation is needed.

## Teaching sequence

The three top-level tabs sit below the branded header because they change the
whole lesson; they are mechanisms, not difficulty levels. **Details** opens the
current stage's evidence and technical explanation in a right-side drawer, so
the main activity keeps the question, Try/Observe/Takeaway cues, board, and
stage controls together. The drawer follows the selected era, closes with its
button, backdrop, or Escape, and returns focus to the Details button.

- **1a · Rules-based intelligence** follows a hand-written eight-rule ladder.
  It learns nothing from play; the policy check examines every reachable game
  line before the app calls the full ladder unbeatable. Directly above the
  ordered list, **First 2 rules**, **First 4 rules**, and **All 8 rules** choose
  how much of that visible ladder the opponent can use.
- **1b · Machine learning** stores estimates for positions after visible
  training bursts. `Show move scores` exposes those estimates. Human play does
  not train the table; only the app’s training burst updates it. The opponent
  era selector sits directly above **Train the AI** so comparing Era 0 with a
  trained era is part of the same action.
- **1c · Neural networks** first uses a fresh 20,000-game seeded table learner
  to create frozen learning examples, then trains reusable adjustable weights to
  approximate them. People still designed the board inputs and learning
  procedure. Train and held-out error show agreement with that teacher; the
  separate playing score does not turn either error into a strength guarantee.

Ultimate tic-tac-toe is an optional representation-limit extension from 1c. A
network cannot recover facts absent from its inputs merely by changing weights.

## Presenter and contract surfaces

Guide opens automatically and from the header’s **Guide** button. Settings
contains **Open Presenter Notes**, **Presentation mode**, and **Reset**.
Presenter Notes and the printable guide share the canonical source
`src/demo-guide.html`; `Open printable PDF` opens the rendered handout.

`#rules`, `#learning`, and `#neural` select the three stages while preserving
the public page URL. The guide supplies a compact 20-minute sequence with a
question, activity, expected observation, and teaching limit for each stage.

## Reproducibility and checks

`src/net.js` contains deterministic teacher preparation, the grouped held-out
split, bounded updates, policy, and measurements. `src/neural.test.js` checks
deterministic preparation and updates, distinct afterstates, the grouped split,
gradient agreement away from ReLU corners, no teacher consultation in play, and
fixed-seed measurements.

Run:

```text
node src/playtest.test.js
node src/neural.test.js
node --test src/neural-lifecycle.test.js
node build.js --check
python tools/render_guide.py --check
```

Edit `src/demo-guide.html` for any presenter-guide change. `node build.js`
embeds that canonical guide in the app; the parent packaging lane renders and
inspects the PDF after the source is stable.
