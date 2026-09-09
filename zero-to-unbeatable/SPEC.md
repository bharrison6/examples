# Types of AI — current implementation specification

The model row exposes 1a Symbolic AI (GOFAI), 1b Value table, 1c Neural Network,
and 1d Other model types. A-C compare strategy representations on one game;
D is a model-family overview. The top-level Model types / How they learn row
distinguishes representations from cross-cutting learning methods. The model row
appears below it only while Model types is selected. Switching these reading views
preserves the selected model and its state.
The tabs are not an exhaustive AI taxonomy or a progression of difficulty.
`#rules`, `#learning`, and `#neural` select them directly.

1a is a readable hand-written eight-rule ladder. It receives no experience and
is verified by `OG.verifyPolicy`. Its ordered tests can be expressed as a decision
tree; the tests here are authored, though trees can also be learned. GOFAI expands
to Good Old-Fashioned Artificial Intelligence. 1b uses tabular reinforcement
learning. Its
table records the value for the player who just made a complete afterstate;
visible training bursts create eras, and Show move scores exposes legal-move
estimates. Human play does not update the table. An inline report below the
training controls uses the selected era's immutable snapshot and compares it
with the immediately preceding snapshot. Era 0 describes the initial baseline.
Selecting an older era updates the report; completing a burst selects its new era
and displays the report without a popup. Example score changes are observed
estimates, not guaranteed perfect-game values.

1c uses a fresh copy of the 1b learner as a frozen supervised teacher, never as
a runtime game oracle. `NET.makeTeacher` runs 20,000 seeded tabular games and
clones the result. `NET.makeDataset` enumerates unique reachable afterstates,
uses `teacher.V[code]` as each label, and assigns an entire rotation/reflection
group to train or held-out by a deterministic seed hash. A label is a current
table estimate, not a perfect-game target; an unvisited position can remain at
its initial zero value.

The model has 29 one-hot cell/turn inputs, 28 and 18 ReLU hidden units, and a linear
value output clamped only when read. Its weights are adjustable numbers reused
to calculate many positions, unlike the table’s separate stored entries. A
read-only inspector visualizes the actual instance and exposes signed connection
weights and biases with changes from initialization. Counts are derived from the
instance: 1,334 connection weights plus 47 biases, 1,381 parameters. Numerical
weight inspection must cover values omitted from any simplified overview and
must not mutate model state. Backpropagation supplies derivatives to normalized
gradient updates on frozen supervised targets. People
designed both the inputs and learning procedure. Bounded training batches keep
preparation, training, Reset, and tab changes interruptible. The network policy
evaluates legal afterstates with `NET.predict(model, child)` and has no teacher
parameter. MSE is average squared prediction-score error; reported train/held-out
error and the fixed-seed playing score remain separate measurements. No neural-
network unbeatable claim appears unless that exact policy is separately verified
and the wording is deliberately revised.

How they learn distinguishes supervised, unsupervised, self-supervised,
reinforcement and semi-supervised feedback using examples, without treating them
as mutually exclusive model families. Self-play does not imply self-supervision;
supervised targets need not come from humans. Gradient and evolutionary methods
are optimization approaches. D lists linear/logistic models, learned trees,
ensembles, nearest neighbors, support-vector machines and probabilistic/Bayesian
models; search/planning is identified separately as a problem-solving approach.

The required Guide opens on entry and from the header’s Guide button. Settings,
beside Guide, contains Open Presenter Notes, Presentation mode, and Reset. The
canonical `src/demo-guide.html` supplies both embedded Presenter Notes and the
printable guide; the build check detects drift. Its visible controls use the
current contract names: New game, Show/Hide move scores, Create learning
examples, Train network, and Open printable PDF.

Ultimate tic-tac-toe remains an optional advanced representation-limit activity,
not 1c. Its additional global facts are absent from a one-board input, and a
neural network with those same incomplete inputs cannot repair that omission.
