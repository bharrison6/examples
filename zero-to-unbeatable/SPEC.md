# Zero to Unbeatable — current implementation specification

The demo has one public learning sequence with three accessible tabs: 1a
Rules-based intelligence, 1b Machine learning, and 1c Neural networks. The
tabs are different mechanisms, not difficulty levels. `#rules`, `#learning`,
and `#neural` select them directly.

1a is a readable, hand-written eight-rule ladder. It receives no experience
and is verified by `OG.verifyPolicy`. 1b is the existing tabular afterstate
value learner. Its value is from the player who just made the move; its table
stores a value for a complete afterstate code. It retains its visible bursts,
eras, board inspector, and exhaustive verification.

1c uses a fresh copy of the 1b algorithm as a frozen supervised teacher, never
as a runtime game oracle. `NET.makeTeacher` runs 20,000 seeded tabular games and clones the
result. `NET.makeDataset` enumerates unique reachable afterstates, uses the
frozen `teacher.V[code]` as each label, and assigns an entire dihedral
rotation/reflection group to train or held-out by a deterministic seed hash.
It does not use retired `nine.js` semantics, fixed-X values, or unreachable
board pictures.

The label is a current table estimate, not a perfect-game target. For example,
the seeded preparation can leave an unvisited winning afterstate at its initial
zero value. That is intentionally preserved in the dataset and documented in
the interface rather than disguised as an oracle label.

The model has one-hot cell/turn inputs, two ReLU hidden layers, and a linear
value output clamped only when read. It is trained by normalized least-mean
squares on bounded batches. Preparation itself is also batched and visibly counts
its seeded games. The UI yields once per 512 examples, so Stop,
Reset, and choosing another tab can stop a neural run between batches. The
network policy evaluates legal afterstates by `NET.predict(model, child)` and
has no teacher parameter. MSE is average squared prediction-score error, with
zero meaning an exact label match. Reported errors and playing scores are
separate; each checkpoint’s random-play score uses the same independent seed
and scoring procedure (although resulting game paths can change), and is
cached rather than re-sampled on render.

Validation is independent of a good-looking animation: `src/neural.test.js`
tests deterministic frozen snapshots, unique reachable examples, grouped
hold-out assignment, finite differences away from activation kinks, no teacher
consultation in a policy call, and fixed-seed scores. It reports rather than
asserts neural playing strength. A neural policy may be run through the shared
exhaustive verifier for diagnosis, but no neural-network unbeatable badge is
shown unless the exact policy is separately verified and the wording is
changed deliberately.

Ultimate tic-tac-toe is retained only as an optional advanced extension. It is
not 1c, and its existing representation-limit lesson does not establish a
claim about neural networks.
