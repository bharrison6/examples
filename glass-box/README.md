# Glass Box

A single-file, phone-first interactive demo of how modern AI works, in three acts:
**Act 1** — what a language model is (a real transformer trains from scratch in front of you);
**Act 2** — how reasoning models are made from one (chain-of-thought, verifiers, test-time
compute, and reinforcement, all genuinely running); **Act 3** — how a reasoning model plus
tools becomes an agent (a real tool loop you can drive yourself).

Open `index.html`. No install, no accounts, no network, no AI service, nothing pre-trained.
Built for showing other educators what is actually inside the black box — each act ends with a
"What is real here" panel that states exactly where the toy ends and scale begins.

**Companion:** `demo-guide.html` / `Glass-Box-Demo-Guide.pdf` — a printable session plan
(three 10-minute acts, quotable lines, misconceptions to draw out, the questions you will get).

---

## Act 1 — the predictor

A complete GPT-style decoder-only transformer — token + position embeddings, two blocks of
causal multi-head attention and GELU feed-forward with layer norms, Adam, warmup + annealed
learning rate — hand-written in plain JavaScript, **42,458 parameters**, training live in a Web
Worker on one small original story (~4,700 characters, deliberately tiny vocabulary).

| era | steps | loss | it writes |
|---|---|---|---|
| Newborn | 0 | 3.26 | `mwwcmqkyjibgccm.hqfc.joshcnmtfrmtyeqcefc…` |
| Babble | 200 | ~1.75 | `ngat dand witcat ond bof okeded ang jot afors the the sang…` |
| Words | 400 | ~1.28 | `mone the gorder under oneven the wirl on the wouserst…` |
| Phrases | 800 | ~0.77 | `the bird lik the to sing the best sat stong the cat garden…` |
| Sentences | 1,200 | ~0.48 | `flowere and full of some path soid. the map ship and map it the robot…` |

Everything the page shows is read out of the live model: the weight heatmaps are the actual
parameter matrices, the probability bars are the actual softmax output, and the attention view
renders the actual per-head attention weights of whichever era you select (tap a character to
see where the model looks; the eras are kept as frozen checkpoints, like Zero to Unbeatable's).

Training runs at roughly 12–15 steps/s on a laptop and a recent phone; the four era presses
total 2–3 minutes of compute, streaming live samples the whole way.

## Act 2 — the reasoner

Two copies of the same tiny transformer (~19k parameters, identical width/depth/heads) train
live on 3-digit addition with equal wall-clock budgets. Model D sees `347+285=632.` — Model S
sees `347+285= 7+5=12 c1 4+8+1=13 c1 3+2+1=6 c0 632.` Then both sit a 100-problem exam of
unseen problems. The shipped run: **Model D 54%, Model S 96%**.

Then two more mechanisms, both genuinely running on a deliberately under-trained sibling of
Model S (400 steps, 49% alone):

- **§2.3 Test-time compute.** Sample N chains at temperature 0.8; a **verifier that is never
  told the true answer** checks each chain's internal arithmetic (every column sum, every
  carry, final assembly) and survivors vote. Shipped curve: N=1 **60%**, 2 **62%**,
  4 **68%**, 8 **78%** — accuracy bought with compute, not training.
- **§2.4 Reinforcement (STaR-style).** The model poses itself 120 fresh problems per round,
  keeps attempts its verifier certifies as correct, and fine-tunes on its own kept work.
  Shipped rounds: **49% → 77% → 83% → 84% → 85%**, keeping 82 → 93 → 101 chains of 120 —
  better at the task, so better at generating its own curriculum.

### The phase-transition finding (why training is seeded)

The most instructive engineering result in this act: **direct-answer 3-digit addition sits on
a learning phase transition at this model scale.** Identical recipe, different data-stream
seeds, measured on this exact code:

```
direct @2200 steps, by data seed:   53%  61%  61%  62%  63%  48%  93%  95%   (and 1.5–25% under
scratchpad @1000 steps, same seeds: 97%  95%  85%  91%  96%  ...              earlier variants)
```

Some direct runs "grok" the carry structure; most never do. The scratchpad model has no cliff —
every step of its curriculum is locally easy, which is precisely the demo's thesis. A live demo
cannot stand on a coin flip, so the shipped run is **seeded** (`SEED_DATA` in `src/arith.js`)
and lands on a modal outcome; changing the seed is the supported way to explore the spread.

### Bit-exact determinism, everywhere

Seeding only helps if every device computes the same numbers. IEEE-754 `+ - * / sqrt` are
correctly rounded and identical in every JS engine, but `Math.exp/log/tanh/cos/pow` are not —
and training is chaotic enough for one differing last bit to change which story a run tells.
So the engine computes its own transcendentals from polynomials over IEEE ops only
(`EXP`/`LOG`/`TANH` in `src/engine.js`), uses a Marsaglia polar normal sampler (no trig), a
smoothstep LR anneal (no cosine), and incremental Adam bias-correction (no `pow`). Result: the
same seed produces the same model, bit for bit, in Node and in the browser — verified: the
integration suite reproduces the Node harness numbers exactly.

## Act 3 — the agent

A goal (order pizza for a club party under real constraints), five documents, five tools, and
the loop: context → model → action → tool → observation → context. **The tools are real**: the
calculator is a genuine recursive-descent parser that genuinely rejects `9 x $13.00` (watch
the agent read the error and correct — that beat is scripted to happen, the rejection is not),
search genuinely searches, the notebook genuinely stores. The context is one growing text
transcript with a live token meter, and a raw view shows exactly what the model sees.

The one scripted part — honestly labeled on the page — is the decision policy, a hand-written
rulebook standing in for Act 2's model at scale. It is a **pure function of the visible
context text**, which makes the closing experiment honest: set the context window to "tiny"
and re-run, and once the goal scrolls out of the window the agent stops dead, telling you it
no longer knows what it is doing. In "you are the model" mode the loop pauses each turn and
you choose between the policy's action and tempting distractors that really execute —
including finishing early with a confidently wrong answer.

The correct run: 11 turns, reads all three pizzeria flyers (the cheapest two fail on hours and
days — reading, not price-sorting, is the lesson), computes 9 pizzas and $131.76, and cites
why the rejected options were rejected.

## Look and feel

Murray State's palette, same policy as Zero to Unbeatable: **navy `#002144`** and **gold `#ECAC00`**,
sky `#00A4E3` as the second accent, and red-orange `#FF4500` only where something is wrong (a
wrong answer, a rejected chain, a tool error, lost context). Chart series colors are
lightness-band-validated steps of the brand hues — gold-step `#B8860B` and sky-step `#0087BD`
— checked with a CVD-separation validator on the dark surface (worst adjacent-pair ΔE 21.9,
all contrast ≥ 3:1), with direct labels everywhere so no reading depends on hue alone.

Phone-first: single column, every tap target ≥ 36px (asserted in the integration suite at
375×667), the TRAIN button sticky so it is never below the fold, era chips instead of wide
tables.

## Getting around the page

Three overlay cards share one style — a white panel with a navy bar and a gold rule, full-screen
under 600px, with the title bar and the closing button pinned so only the body scrolls. Each one
closes on Escape, on a tap outside it, on its ×, and on its footer button.

- **How to use** — opens on every load and explains what to do in each of the three acts. Reopen
  it any time from the **?** in the sticky header (or `how to use` in the footer).
- **Settings** — the header's second control. Holds **presentation mode**, which scales one CSS
  variable to enlarge the whole page for a projector and puts a **Notes** button in the header;
  the **presenter's notes**; and the full teacher guide.
- **Presenter's notes** — the stage version of `demo-guide.html`, distilled: what to do before you
  start, the timed beats and quotable lines for each act, the numbers this seeded run produces, the
  six misconceptions to draw out, and the four questions you will get. The complete printable plan
  stays in the teacher guide. Reachable from Settings, from the footer, and — while presenting —
  from the header.

The byline pill (bottom-left, fixed) lifts clear of the sticky TRAIN button on narrow screens.

Training normally runs in a Web Worker so the UI never blocks. Some hosts refuse blob workers
(sandboxed preview panes, strict CSP) — synchronously, with a late error event, or by silently
never starting. All three paths fall back to running the identical runtime on the main thread
in chunked slices: same code, same seeds, same numbers, honestly noted in the footer. The
integration suite runs this scenario with `Worker` sabotaged and asserts the training still
works and matches.

## Tests

```
node src/selftest.test.js     # 29 checks, ~60s: gradient check vs numerics, untrained-model
                              # honesty, both training arcs, verifier soundness (accepts truth,
                              # rejects five kinds of tampering, never needs the answer key),
                              # calculator/search/policy behavior, the 11-turn run, the
                              # tiny-window failure
node tools/integration.mjs    # drives the built file in a phone-sized browser (~4 min):
                              # the required-UX pass (how-to on load, Escape and the ? control,
                              # settings, presenter's notes, presentation mode, the byline),
                              # trains era 1 live, full Act 2 (both models + voting + a
                              # self-improvement round, asserting the gaps), Act 3 autoplay to
                              # the correct answer and the context-window failure, zero network
                              # requests, zero console errors, tap-target sizes
node tools/integration.mjs --quick   # same minus Act 2 training (~1 min)
```

The engine's gradient check compares every layer's analytic gradients against numerical
derivatives (fp32 tolerance) — the transformer backprop is hand-written, so this is the test
that matters.

## Building

`index.html` is generated. Edit `src/`, then:

```
node build.js        # concatenates src/ into index.html + copies the guide
node build.js --check # read-only source/generated parity check
node tools/pdf.mjs   # re-renders Glass-Box-Demo-Guide.pdf
node tools/shots.mjs # screenshot pass at phone + desktop sizes (visual review)
```

The build refuses to emit a file containing any external `src` or `href`, so the single-file
promise cannot rot.

```
src/engine.js          the transformer: forward, hand-derived backward, Adam, sampling,
                       deterministic EXP/LOG/TANH — no DOM, runs in node, page, and worker
src/text.js            Act 1: corpus, vocabulary, model config, era ladder, LR schedule
src/arith.js           Act 2: problem formats, the answer-key-free verifier, training steps,
                       verified voting, the self-improvement round, the seed rationale
src/agent.js           Act 3: documents, real tools, the context, the window-honest policy,
                       candidate distractors
src/worker.js          the training worker (chunked loops, progress messages, era snapshots)
src/app.js             all UI
src/styles.css         phone-first; presenter mode scales one variable
src/template.html      shell and copy, with build placeholders
src/demo-guide.html    the printable presenter guide
src/selftest.test.js   the 29 node checks, including cooperative STaR parity
tools/integration.mjs  the browser suite
tools/pdf.mjs          guide -> PDF        tools/shots.mjs   screenshots
```

## Where the toy honestly ends

Act 1's model is ~50 million times smaller than a frontier model and reads one story instead
of trillions of tokens; what transfers is the mechanism (same architecture, same training
rule), not capability. Act 2's verifier checks column arithmetic where frontier labs grade
math, code, and dialogue — with unit tests, proof checkers, and humans (RLHF) — but
sample-filter-retrain is the actual shape of the loop. Act 3's tools and loop are real; its
decision-maker is a rulebook because a model that plans runs in a data center, not a phone.
Wire Act 2's idea into Act 3's loop at scale and you have the agents shipping today.
