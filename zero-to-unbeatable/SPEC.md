# Types of AI — current implementation specification

The demo exposes three accessible tabs on one shared tic-tac-toe board:
1a Rules-based intelligence, 1b Machine learning, and 1c Neural networks.
The tabs compare different sources of skill, not a progression of difficulty.
`#rules`, `#learning`, and `#neural` select them directly.

1a is a readable hand-written eight-rule ladder. It receives no experience and
is verified by `OG.verifyPolicy`. 1b is tabular afterstate value learning. Its
table records the value for the player who just made a complete afterstate;
visible training bursts create eras, and Show move scores exposes legal-move
estimates. Human play does not update the table.

1c uses a fresh copy of the 1b learner as a frozen supervised teacher, never as
a runtime game oracle. `NET.makeTeacher` runs 20,000 seeded tabular games and
clones the result. `NET.makeDataset` enumerates unique reachable afterstates,
uses `teacher.V[code]` as each label, and assigns an entire rotation/reflection
group to train or held-out by a deterministic seed hash. A label is a current
table estimate, not a perfect-game target; an unvisited position can remain at
its initial zero value.

The model has one-hot cell/turn inputs, two ReLU hidden layers, and a linear
value output clamped only when read. Its weights are adjustable numbers reused
to calculate many positions, unlike the table’s separate stored entries. People
designed both the inputs and learning procedure. Bounded training batches keep
preparation, training, Reset, and tab changes interruptible. The network policy
evaluates legal afterstates with `NET.predict(model, child)` and has no teacher
parameter. MSE is average squared prediction-score error; reported train/held-out
error and the fixed-seed playing score remain separate measurements. No neural-
network unbeatable claim appears unless that exact policy is separately verified
and the wording is deliberately revised.

The required Guide opens on entry and from the header’s Guide button. Settings,
beside Guide, contains Open Presenter Notes, Presentation mode, and Reset. The
canonical `src/demo-guide.html` supplies both embedded Presenter Notes and the
printable guide; the build check detects drift. Its visible controls use the
current contract names: New game, Show/Hide move scores, Create learning
examples, Train network, and Open printable PDF.

Ultimate tic-tac-toe remains an optional advanced representation-limit activity,
not 1c. Its additional global facts are absent from a one-board input, and a
neural network with those same incomplete inputs cannot repair that omission.
