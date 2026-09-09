# Types of AI

Demo 1 uses one tic-tac-toe board to compare three sources of a program’s skill:
written rules, experience stored as move scores, and neural-network weights:
adjustable numbers reused to score many board positions. Open `index.html` in a
modern browser. It is a single offline file:
no account, network request, AI service, or installation is needed.

## Teaching sequence

The three tabs are mechanisms, not difficulty levels.

- **1a · Rules-based intelligence** follows a hand-written eight-rule ladder.
  It learns nothing from play; the policy check examines every reachable game
  line before the app calls the full ladder unbeatable.
- **1b · Machine learning** stores estimates for positions after visible
  training bursts. `Show move scores` exposes those estimates. Human play does
  not train the table; only the app’s training burst updates it.
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
