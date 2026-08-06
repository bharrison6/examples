# Undershoot — original design brief

This is the brief the demo was built against, recorded verbatim, followed by the
clarifications that were asked and answered before work started, and then notes
on where the implementation interpreted or deliberately departed from it.

---

I want to create a demo in our examples project that shows model release cadence
since the release of chat gpt. This demo is going to be a bit different in that
its going to be interactive. I want to first add in all of the primary models
that have been released since chat gpt first was released with players like
google and anthropic models being put in as well as open source models like deep
seek and kimi and others. The main thing we want to convey is something along the
lines of relative intelligence and capibility unlocks that these models start to
show. We also want to show things like math problems solved by the ai that are
open problems and such. You will need to do some research into these topics. (or
send some sonnet subagents to research the topics)

**Clarified before building:**

- Audience: a conference or public talk, driven by a presenter in front of a room.
- Interactive core: a predict-the-curve game — the room is shown real data to a
  cutoff, draws where it goes next, and then the truth is revealed.
- Framing: lean into the acceleration story rather than staying neutral.

---

## Implementation notes and departures

**The brief asked for a timeline; the answer is a game with a timeline in it.**
A release timeline is a chart, and a chart in a conference talk is something the
room watches. The brief's own word was "interactive," and the clarified interaction
was predict-the-curve, so the timeline became Act II — the explanation of where the
curves in Act I came from — rather than the demo itself. Act III is the "open maths
problems" the brief asked for. The three acts are the brief's three requests in the
order that makes them land: be wrong, understand why, then see what it bought.

**Five rounds, and the fifth one turns.** Rounds 1–4 (SWE-bench, GPQA, METR task
horizon, price-of-capability) all rise faster than a room draws them. That is four
repetitions of the same lesson, which is three more than a point needs — except
that the repetition is the setup. Round 5 shows ARC-AGI-1 going from five years
near zero to 87.5% in one announcement, rewarding the newly-trained instinct to
guess high, and then reveals that the same model scored 4% on ARC-AGI-2 three
months later and that frontier systems sit at 0.51% on ARC-AGI-3 against a human
100%. Without rounds 1–4 the fifth is a curiosity. With them it is a correction,
and the audience administers it to themselves.

The brief said "lean into the acceleration story." This is that story told so it
survives contact with a sceptic: the acceleration is real, it is faster than the
room thinks, and it is not uniform. A talk that stops before the fifth round is
one economic downturn away from looking foolish.

**"Relative intelligence" is not plotted, deliberately.** The brief asked to convey
relative intelligence across models. Act II positions models on a vertical axis, and
that axis is an explicit *generation band*, labelled in the interface as not a
benchmark score. There is no defensible single number ranking fifty models across
four years and eleven labs on one scale; the composite indices that try (Epoch's ECI,
Artificial Analysis's index) are useful and are cited, but rendering one as a height
would assert a precision nothing supports — in a demo whose entire argument is that
capability is not one quantity. What Act II conveys instead is *cadence*: dot density
over time, which is a fact about the world rather than an opinion about ranking.

**Research first, and then a second pass that deleted things.** Five research agents
produced dossiers on releases, benchmarks, capability unlocks, AI in open mathematics,
and the open-weight gap. Four more agents were then sent to adversarially verify the
numbers that would actually appear on a projector. That second pass changed the
dataset materially:

- The current top score on Humanity's Last Exam is **46.44%** (Gemini 3.1 Pro, from
  Scale's own leaderboard), not the 53.3% or 64.7% that aggregator sites publish. Both
  higher figures were traced to sites that rank well in search and cite nothing. Cut.
- SWE-bench figures for Claude Opus 4.5/4.7/4.8 could not be found on Anthropic's own
  pages — because Anthropic **stopped reporting the benchmark**. The Opus 4.7 page
  mentions it only to say it screens for memorisation of it; Opus 5 reports a different
  benchmark entirely. The series now ends at Sonnet 4.5 in September 2025, and the
  benchmark's quiet retirement became the round's punchline instead of a fabricated
  2026 data point.
- METR's original paper says the horizon doubled every **207 days**, not the 196 that
  circulates; 196.5 is the figure from the later Time Horizon 1.1 revision. Both are
  METR's, they disagree, and the app quotes the one that matches the methodology it
  plots.
- A claimed counterexample to the Jacobian conjecture, a claimed solution to Erdős
  #793, and claimed perfect 42/42 AI scores at IMO 2026 were all cut for lack of a
  traceable source. One verification agent flagged that its own tooling had returned
  self-contradictory attributions for the Jacobian story, which is exactly the
  circumstance in which a claim should not be shown to a room.

These five deletions are displayed in the app, with reasons, under **Cut from this
demo**. A demo that shows only what it found is an advertisement; showing what it
refused is the cheapest credibility available, and it is the box to point at when
somebody in the front row challenges a number.

**Every datum carries a source, and the app can prove it live.** `data.js` attaches a
source key and a verification status to every plotted point. Settings → Run the
self-test checks, in front of the audience, that every point resolves to a declared
source, that no source is cited and then never used, that each series runs forward in
time, that the hidden half genuinely postdates the shown half, that the scoring is
monotone and scores a perfect guess at 1.0×, and that the doubling time quoted in
Act III agrees with the points actually plotted in Act I. The same checks run in
`src/playtest.test.js` under node. Sixty-two of them.

**The doubling figure in Act III is fitted, not typed.** Act III shows METR's published
post-2024 figure of 89 days *and* a least-squares fit computed at runtime from the five
points the app itself plots. They do not match exactly — five points are not METR's
dataset — and the card says so. A number quoted in prose that no longer matches the
chart beside it is the most common way a demo starts lying without anyone deciding to.

**Two right-hand edges on the chart.** The guessable region ends at the ask date and
never moves; the axis edge is separate, and the ARC round widens it when the twist
fires so the ARC-AGI-2 series has somewhere to be drawn. These began as one variable,
which clipped four labels off the right edge and stretched the audience's drawn guess
sideways when the axis grew.

**The fold rule, and why it is enforced in JavaScript.** As in the other demos here:
the chart and the Reveal button are both reachable without scrolling. Unlike the other
demos, the chrome above the chart changes height per round, because each round's
question is a different length and wraps to a different number of lines at every width.
A CSS-only version put Reveal below the fold at five of eight test viewports. `fitChart()`
measures the space actually remaining and sets the height, and the integration suite
asserts the rule at eight viewports from 320×568 up, plus presenter mode on 720p and
1080p projectors. Short-and-wide viewports — a phone held sideways — move the question
beside the chart rather than above it.

**A bug worth recording, because it was invisible.** `.overlay { display: flex }` outranks
the browser's own `[hidden] { display: none }` rule, which is a bare attribute selector.
The settings sheet was therefore stretched across the viewport at all times, fully
transparent and swallowing every pointer event aimed at the canvas. Nothing looked wrong.
It was found by an integration test that counted zero `pointerdown` events on a canvas
that was plainly visible in a screenshot — measuring rather than looking, again.

**Scoring is a ratio, not a difference.** Being told you were "33 points low" on
SWE-bench does not land. Being told the truth was 1.7× your guess does, and it is the
right unit besides: people are wrong about this multiplicatively. The price round falls
rather than rises, so its ratio is inverted — otherwise a good guess would score as a
catastrophic miss — and there is a test for that specifically.

**No persistence, no network, one file.** No `localStorage`, no accounts, no saved
scores. Reloading returns to round one. The integration suite asserts zero network
requests at load, and the build refuses to emit an `index.html` containing any external
`src` or `href`.

**What will rot.** This is a dataset about a moving field, verified in August 2026. The
SWE-bench series is already historical, Epoch's price series stopped publishing in March
2025, and the ARC-AGI-2 and HLE leaders will move. The app says so in its About panel.
The right maintenance action is to edit `data.js` and re-run both suites — the tests
check internal consistency, so a number changed in one place and not another will fail
rather than ship.


---

## Second pass — the revision after the first review

The first build was reviewed and came back with three substantive problems. All
three were correct, and fixing them changed the shape of the demo.

**“Most people in this presentation don't know anything about where AI is.”**
The first Act I opened cold on a chart labelled *SWE-bench Verified* and asked
for a forecast. That is a demo for people who already read the leaderboards. It
now opens on a screen that explains, in plain words, that these systems are
graded on public tests and that the room is about to draw five of them. Every
test then explains what it actually measures before any chart appears, offers a
concrete example of a single task from it, and gives a human reference point.
The metric names were demoted out of the headings entirely: the rounds are now
called *Fixing real bugs*, *Questions that beat PhDs*, *How long it can work
alone*, *What it costs*, and *The one that turns*.

The strongest addition is in test five. It ships an actual ARC-style puzzle,
playable, rendered as coloured grids with a hidden answer. A room solves it in
about two seconds — and that is precisely what makes the 0.51% land. A test
suite check confirms the worked examples and the answer all obey one consistent
rule, because a wrong example in front of a room is worse than no example.

**“Your y axis isn't labeled.”** Correct, and neither was the x axis. Both are
now drawn as rotated and centred titles with the padding to hold them, and named
in words rather than metric jargon: *Bugs actually fixed*, *How long that job
takes a person*, *Dollars per million words in*. On the two logarithmic rounds
the axis also states *each step is 10× the last*, because that is not something
a general audience reads off a tick sequence. The title is suppressed when the
plot is too short to hold it — a clipped smear is worse than none, and the tick
values still carry the unit. Both suites now assert that every round labels both
axes.

**“You are excluding a lot of open weight models.”** Also correct. The timeline
went from 52 entries to 123, and from a handful of open-weight releases to a
majority of them. Added: the whole Gemma family including MedGemma and TxGemma,
Microsoft's Phi line, AI2's OLMo and Molmo and Tülu (the ones that publish
training data as well as weights), NVIDIA's Nemotron, IBM's Granite, TII's
Falcon, Apple's OpenELM, Databricks DBRX, Snowflake Arctic, Hugging Face's
SmolLM and StarCoder, and Cohere's Command A. Europe gained EuroLLM, Poro from
Finland and Occiglot alongside Mistral's full line. China gained Yi, InternLM,
Hunyuan, MiniMax, Ernie, Seed, LongCat, MiMo, Ling, Step3 and dots.llm1
alongside DeepSeek, Qwen, Kimi and GLM. The coding-tool models the brief asked
about — Cursor's Composer and Windsurf's SWE-1 — are there too, marked closed,
because that is what they are.

A region filter was added beside the openness filter, and the counters now
describe what is actually visible rather than the unfiltered total: a statistic
that disagrees with the dots above it is worse than no statistic. A test asserts
that every family named in the review is present, that the majority of the
timeline is downloadable, and that every open model declares a licence.

**“Act 3 is all mathematics and that is just one story.”** The sharpest note of
the three. Act III is now six domains — proteins, medicine, weather, materials,
mathematics, software — and mathematics is four entries out of nineteen, kept
because it is where the potential appeared earliest and where verification is
most rigorous: a proof is either right or it is not.

What the broadening bought is a much better argument. The domains disagree with
each other in useful ways. Proteins has a Nobel Prize. Weather is running in
production in Europe. Medicine has a drug through a randomised trial *and* a
peer-reviewed result showing models 16–25 points worse than clinicians on real
patient records rather than exam questions. Materials has a flagship discovery
that was first reported in 1972. And software has the single most important
number in the demo: METR's randomised controlled trial finding experienced
developers 19% slower with AI tools, while predicting a 24% speed-up beforehand
and still believing they had been 20% faster afterwards.

That last finding also earned a place in Act II's unlock timeline, flagged as a
counterweight, because a list of capability unlocks that contains no entry
reading *and it can make you slower* is not a timeline, it is a sales sheet.

**Two things the second research pass deleted.** Gemma 4 and MiniMax M3 both
appeared in the first catalogue. Neither exists. And a widely-repeated critique
— that a robotic lab's 41 "new" materials were already catalogued — could not be
traced to any real citation, so it was replaced with two claims that could be
verified: a peer-reviewed critique in *Chemistry of Materials*, and the fact
that the original paper's own abstract claims 41 while its main text confirms 36
of 57. Both deletions are listed in the app's *Cut from this demo* box.

**Test counts after the revision:** 81 node checks, 108 browser checks. The new
ones are mostly about the review's three points — that every test explains
itself without jargon, that both axes are labelled, that the puzzle's rule is
self-consistent, that the timeline spans four regions and 100+ releases, and
that Act III is not one subject wearing a hat.


---

## Third pass — the time axis

**“The x axis on Act I test 1 only has one data point. You can't tell scale
with only one data point on x axis.”** Correct, and it was the worst remaining
bug in the demo, because it broke the one thing the round needs the reader to
know.

The axis drew a gridline at each 1 January and nothing else. The bug-fixing
round spans sixteen months — June 2024 to October 2025 — and crosses exactly one
of them, so it shipped with a single mark reading *2025*. A reader looking at
that cannot tell whether the gap they are being asked to forecast across is
three months or three years, which is precisely the quantity they need in order
to answer. The round was asking for a forecast over an unstated interval.

The tick logic now picks a month step — 1, 2, 3, 6, 12, 24 or 60 — such that the
axis carries roughly four to eight marks whatever the span, and labels sub-year
ticks as *Jul ’24* rather than a bare month, which would be ambiguous on an axis
covering more than one July. Where labels would collide the label is dropped but
the gridline stays, because a denser rule still reads as scale even where the
text will not fit; on a 390px phone the bug-fixing round thins from six labels to
three while keeping all six lines. January gridlines are drawn slightly brighter
than the rest so the year boundaries stay findable.

The five rounds now carry 6, 7, 7, 4 and 5 marks respectively, against 1, 3, 3,
2 and 5 before.

The tick generator lives in `engine.js` rather than `chart.js` specifically so
node can test it: nine new checks cover the sixteen-month case that failed, the
multi-year case, a four-month case, ordering, range containment, a degenerate
zero-width range, and a sweep asserting that every round the app actually ships
clears four ticks. The browser suite additionally asserts, for every round, that
the rendered axis carries at least four marks and that they are all distinct.

**And a second bug the same screenshot exposed.** The *drag across to draw your
guess* hint is drawn centred in the guessable region. On a 390px phone that
region is about 180px wide and the sentence is not, so it ran off the right edge
of the plot. It now steps down through shorter wordings and smaller sizes until
one fits, and the integration suite measures the chosen wording against the plot
edge at all eight viewports. This had been shipping since the first build and no
test caught it, because every assertion about overflow was about the DOM — and
this text is painted on a canvas, where the document knows nothing about it.


---

## Fourth pass — axis values, and Act II's missing label

**“Test 3 scale on y axis is odd.”** It was. The task-length round is
logarithmic and the axis was built from the usual 1-2-5 ladder, so it produced
eleven gridlines reading *1 min, 2 min, 5 min, 10 min, 20 min, 50 min, 1.7 hr,
3.3 hr, 8.3 hr, 16.7 hr, 33.3 hr*. Arithmetically impeccable and unreadable:
nobody thinks in 3.3 hours, and the axis silently changed unit halfway up
without changing its step.

Duration axes now draw from a ladder of round times — 1, 2, 5, 10, 15, 30
minutes, then 1, 2, 4, 8, 12 hours, then 1, 2, 4, 7 days — thinned to keep the
spacing even in log space. Test 3 now reads *1 min · 5 min · 30 min · 2 hr ·
8 hr · 2 days*, which is six marks a person can hold in their head. Every value
on the ladder divides cleanly into its unit, so no label can ever carry a
decimal point, and there is a test asserting exactly that.

The generic log axis was thinning badly too: the price round had ten gridlines
on a plot 300px tall. It now steps down from 1-2-5 to 1-5 to bare decades until
it is under target, giving *$0.05 · $0.10 · $0.50 · $1 · $5 · $10 · $50*.

Two consequences worth recording. First, the rotated note under the y title
said *each step is 10× the last*, which the duration ladder is not — the claim
had been true of the old ticks and became false the moment they improved. It is
now a plain-language sentence below the chart: *the vertical scale multiplies
rather than adds — each gridline is several times the one below it, not a fixed
step*. It moved into the DOM because a second rotated line collided with the
tick labels; sideways text in an 82px gutter has room for one line, not two.
Second, an earlier guard dropped the y title entirely when the plot was under
190px tall, which at ordinary laptop height meant *always*. It now shrinks the
type, then falls back to a shorter wording each round declares, and only gives
up if neither fits — checked at all eight viewports.

**“Act 2 y axis isn't labeled.”** Correct, and it had no x label either. The
prose above the chart explained what height meant, but a chart has to survive
being read on its own — someone photographs the screen, or glances up mid-
sentence. It now carries *Roughly how capable* with the qualifier *a generation
band, not a score* underneath, *When it was released* along the bottom, an axis
frame, and the words *newer generations* and *earlier generations* in the two
corners the dots never reach. The hedged wording is deliberate: the height is a
coarse band, and calling it a score would be precisely the overclaim this demo
exists to argue against.

**Counts after this pass:** 103 node checks, 148 browser checks. The new ones
cover the duration ladder, log-tick thinning, that every round produces four to
eight distinct value labels, that the y title fits and is drawn at every
viewport, and that Act II declares both axis labels and says the height is not
a score.


---

## Fifth pass — stale axes, and getting ARC-AGI-3 wrong

**“Some of the graphs only go until 2025.”** Three of the five did. Every chart's
time axis now runs to August 2026, so the five cover the same window and none of
them looks like the most recent thing that ever happened was eighteen months ago.

Two of those series genuinely have no 2026 data, and I could not manufacture any
honestly: Epoch has not published a point on the cost curve since February 2025,
and no lab has published a SWE-bench Verified figure since September 2025. So the
axis extends and the *line* stops, with a dashed marker and a label saying which
of those two things happened. An empty stretch of plot with no explanation reads
as an oversight; labelled, it is the most honest thing on the chart. The
extension is applied up front where it leaves a usable drawing band and staged
behind the reveal where it would not — on the ARC round, whose data starts in
2020, stretching to 2026 immediately would squeeze the drawable region to a tenth
of the width.

This surfaced a bug that had been live since the ARC twist was built: `reset()`
restored the axis to the guess edge, which silently undid the extension every
time a round loaded. It restores to the round's own starting axis now.

**“The ARC AGI 3 test is confusing being displayed (not really told what it is)
but also a bit misleading since evidence shows that agents with retained memory
score much better than 0.5%.”** Both halves were right, and the second one was
worse than a presentation problem — the demo was making exactly the kind of claim
it exists to warn against.

The old finale showed two bars: *People 100%, the best AI 0.51%*. Checking it
properly:

- **100% is not humans acing the test.** ARC-AGI-3 scores on Relative Human
  Action Efficiency — how many moves you take against the median successful
  human. 100% *is* the human baseline, by construction. On the public games the
  average human tester scores **48%**.
- **0.51% is one measurement of many.** It is bare frontier models, no agent
  scaffolding, on ARC Prize's private set of 55 games, in March 2026.
- **And the number moves enormously with the harness.** OpenAI published on
  29 July 2026 that GPT-5.6 Sol scored **13.3%** on the public games through the
  standard harness and **38.3%** with two settings changed — retaining its own
  reasoning across turns, and compacting rather than truncating its context.
  Same model, same games, same week. Roughly three times the score.

The finale now explains what the test actually is — 135 games, a 64×64 grid of
coloured squares, a few keys, no rules, no stated goal, work out what winning
means — and shows four bars with the measurement condition written under each
one, plus an open caveat headed *why these bars are not four measurements of one
thing*. It names the demo's own earlier draft as an example of the error.

The lesson improved as a result. It used to be "look how bad AI is at this",
which was both weaker and less true. It is now: in one month the same systems
beat PhDs on science questions, scored 4% on a puzzle set they had aced a version
earlier, and swung from 13% to 38% on a third because of two configuration flags.
A startling share of any headline capability number is decided by how somebody
wired the thing up — which is a more useful thing for a room to leave with than
either optimism or doom.

Worth recording how this was caught: a research pass I ran concluded the 0.51%
figure was current and defensible, and specifically advised against the
memory-agent framing on the grounds that the double-digit numbers in circulation
came from a non-comparable preview competition. That was right about the preview
numbers and wrong about the conclusion, because it never reached the OpenAI post
— which the user supplied directly. A confident negative from a search that
missed one source is still a search that missed one source.

**Counts after this pass:** 110 node checks, 152 browser checks, including
assertions that the finale explains the benchmark before quoting a score, that no
bar claims humans score 100%, that both harness conditions are shown, and that
the non-comparability caveat is present.

---

## Sixth pass — a plain-language copy edit for a cold reader

Review note: *"Most of this text isn't very good. The Act II headline reads
'Where all of that came from' — what is that? The body's first line is a
fragment. This whole app needs the text examined to see if it makes sense to an
audience that doesn't know what the app is for."*

All correct. The copy had drifted into an in-group register — headlines that
refer back to things the reader hasn't seen yet ("all of that", "the fifth
round"), and sentence fragments that read like captions rather than
instructions. A cold reader who lands on Act II is not told what Act II is.

What changed:

- **The opening headline.** *"You are going to draw five lines, and get four of
  them wrong"* asserted an outcome the app cannot know — it has no idea how the
  viewer will draw — and framed the exercise as a gotcha. It is now a plain
  question that says what the app is and what you'll do: *"How much has AI
  changed since ChatGPT? Draw your guess, then see the real answer."* The body
  was rewritten to orient someone who knows nothing: what ChatGPT was, what
  "graded on public tests" means, what the interaction is, and — honestly — that
  people usually undershoot but that it is not one smooth story.

- **The unsupported "four of them" claim, everywhere.** A quick log-rate check
  showed only two of the five series actually steepen after their cutoff, so
  "four went up faster than the room drew them" was false as written. The claim
  is gone from the opening, the scorecard and the Act III finale. The honest
  version is about *level*, not slope: people tend to draw the endpoint too low.
  The scorecard now says so conditionally ("if you drew most of these too low…")
  and leans on the per-viewer tally it already computes.

- **Act II** went from *"Where all of that came from"* (meaningless cold) to
  *"Every AI model since ChatGPT"*, and its first line now connects the acts
  explicitly — *"Those five tests were run on the AI models below"* — instead of
  opening on a fragment.

- **Act III** headline *"What it can actually do"* → *"What AI has actually
  done"* (the subject was ambiguous), with a lede that frames it as real-world
  results rather than more tests.

- **The nav tabs** lost their jargon: *"The cadence"* → *"The models"*, and
  *"What it can do"* → *"What AI can do"*.

- **"The room"**, a presenter's word for the audience, was removed from every
  place the *viewer* reads it (it stays, correctly, in the presenter guide). The
  three stat-tile captions in Act III that read as fragments were made into
  standalone labels.

No numbers, sources or structure changed — this was purely a language pass.
Both suites still pass unchanged (110 node, 152 browser), since none of the
copy under test was among what changed.

---

## Seventh pass — a full copy audit, every user-facing string

Review note: *"Should we name the test? And the opening sentence for test 2 is
another incomplete sentence. If I wasn't clear with my last instructions I want
a full audit, not a once-over on things I called out."*

Fair. The previous pass fixed the specific things flagged; this one reads every
user-facing string against one rule and applies it consistently.

**The rule.** Prose — any sentence a reader reads to *understand* something —
must be a complete sentence. Labels, captions, headlines and subtitles — short
scannable phrases that *name or annotate* — may be phrases. The earlier drafts
blurred the two, shipping noun fragments where explanatory prose belonged.

**Naming the tests.** Added: each round now shows the benchmark's real name as a
quiet caption under the plain-language title — *"Researchers call this test
SWE-bench Verified,"* *"This is METR's ‘time horizon’ measure,"* *"This is the
ARC-AGI benchmark, created by François Chollet,"* and so on. For an education
audience this adds a credential and something to look up, without letting the
jargon become the headline. (Two of the five `metric` fields had been holding a
*description* rather than a name — METR and the price tracker — so those were
corrected to real names too.)

**Fragments fixed (prose that was masquerading as a sentence):**

- Test 2's opening — *"A few hundred multiple-choice questions… written by PhDs
  to be hard for other PhDs."* — the one flagged. Now: *"This test is a set of a
  few hundred multiple-choice questions…"* Its worked example had the same defect
  (*"A question that names three reagents, asks…, and offers…"*) and is now a
  complete sentence.
- Test 5's opener (*"Small coloured grids."*) → *"This test is made of small
  coloured grids."*
- **All seven Act III domain intros** were fragments — *"Real trials, real
  patients, and the domain where…"*, *"The cautionary domain."*, *"Quantum
  computing, fusion, chip design — …"* — and are now complete sentences.
- Bare citation fragments in the result cards — *"Published in Nature."*, *"Made
  in a laboratory and measured."*, *"Insilico Medicine's pipeline, their
  attribution."* — rewritten as sentences.
- Both closing stat notes had dangling participial fragments (*"Published seven
  weeks before Kimi K3…"*, *"METR's fit over models released since 2024."*) and
  the seven "Cut from this demo" reasons were clipped notes; all now read as
  complete thoughts.

**Other cleanups:** the shouty ALL-CAPS emphasis (*PERSON*, *USE*, *LONGER*,
*LESS*) is gone — the sentences carry the contrast without it; the price round's
"tokens" jargon is now glossed on first use; and "Google" vs "a search engine"
on the same GPQA screen is reconciled.

**What was deliberately left as phrases,** under the rule above: the reveal
headlines (*"Three minutes, to eleven hours."*), the one-line subject captions
under each Act III card title (*"Breast cancer screening from mammograms."*), the
chart axis and marker labels, and the timeline hover notes. These are captions
and headlines, not prose, and forcing them into full sentences would bloat the
cards and read worse.

**A test now guards this.** A node check walks every `plain`, `human` and domain
`lede` and asserts the first sentence contains a verb — a crude but effective
tripwire against shipping a noun fragment as an explanation again. Counts: 112
node checks, 152 browser checks.
