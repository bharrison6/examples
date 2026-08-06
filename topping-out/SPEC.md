# Topping Out — original design brief

This is the brief the demo was built against, recorded verbatim. Notes on where the
implementation interpreted or deliberately departed from it follow at the end.

---

Build me "Topping Out" — a browser-based competitive construction scheduling game
for a university construction management program. Teams manage the schedule of the
same small commercial building project, week by week, against the same run of bad
luck. Highest profit at project completion wins. Fully deterministic, no AI calls,
runs offline in a browser on standard laptops.

CORE SCHEDULING ENGINE (non-negotiable — real CPM, not a scripted timeline):
- A project network of 25–40 activities for a 3-story commercial building
  (mobilization, excavation, foundations, slab, steel/structure per floor, deck,
  roofing, envelope, MEP rough-in per floor, inspections, insulation, drywall,
  finishes, elevator, sitework, punchlist). Real precedence logic: FS, SS, and
  FF relationships with lags where appropriate.
- Full CPM computation every turn: forward pass, backward pass, ES/EF/LS/LF,
  total float and free float per activity, critical path identified. The
  critical path must be COMPUTED, never hard-coded, so it can and will shift
  when players' decisions or events change the network. When it shifts, the
  game announces it ("Critical path has moved to MEP rough-in").
- Mandatory non-compressible lags: concrete cure times and inspection holds
  cannot be shortened by any acceleration action, ever.
- Weather-sensitive flags on the right activities only (earthwork, concrete
  pours, roofing, envelope). Rain days delay those and only those.
- Resource model: limited crews per trade; a zone/floor can hold a limited
  number of crews, and exceeding it (trade stacking) cuts every crew's
  productivity in that zone. Idle crews still cost money.
- Overtime works but decays: sustained overtime reduces productivity week over
  week (construction research supports roughly 10–15% productivity loss per
  additional sustained week — use a curve like that and cite it in the guide).
- Money model, which is also the score: general-conditions overhead burns per
  calendar day, liquidated damages accrue per day past the contract completion
  date, overtime costs premium rates, expedited deliveries cost fees, early
  finish earns a modest bonus. Score = profit remaining at completion.

GAME LOOP — THE WEEKLY MEETING (this is where the fun lives):
- One turn = one project week, framed as the Monday morning meeting. Phases:
  1. THE NEWS: this week's events reveal — drawn from a seeded deterministic
     event deck. Events come only from documented real delay categories:
     weather (forecast shown with uncertainty; actuals may differ), late
     material deliveries, subcontractor slips, failed inspections, RFIs/design
     changes, workforce shortage. Write them with flavor ("Glazing sub called.
     It's not good.") but keep effects mechanical and stated plainly.
  2. DECISIONS: resequence remaining work where logic allows, authorize
     overtime or add a second crew (where the trade has one), expedite a
     delivery for a fee, reassign crews between zones, or absorb the hit and
     spend float. Show live preview of projected finish date and cost impact
     BEFORE committing.
  3. COMMIT: one button, no undo. Schedule decisions are irreversible — that's
     the point.
  4. THE WEEK RUNS: the 4D view animates the week, costs tick, progress
     happens or doesn't.
- COMPETITION: at game start, enter a seed code. Same seed = identical project
  and identical event sequence for every team, so the leaderboard measures
  decisions, not luck. Instructor picks the seed for the class session. Local
  leaderboard records team name, finish date, and final profit.

THE 4D VIEW (this is where the feedback lives):
- A stylized cutaway building view synced to the schedule: excavation opens,
  foundations pour, structure rises floor by floor, envelope closes, interiors
  progress visible in cutaway. Crews appear as markers in their zones so trade
  stacking is VISIBLE as overcrowding. Stalled work fronts look conspicuously
  idle. A building with a bare top floor and burning overhead should feel
  uncomfortable to look at.
- Alongside it: a Gantt view and a network diagram view, critical path
  highlighted in both, float shown per activity, with a toggle between them.
  A persistent HUD: day count, contract deadline, cash position, current
  critical path, total float remaining.

DEBRIEF (this is where the learning lives):
- On completion, a debrief screen: profit breakdown (where every dollar went),
  a timeline of the team's decisions annotated with their consequences, a
  chart of how the critical path moved over the project, and a comparison of
  their finish vs. the no-intervention baseline schedule.
- A shorter tutorial project (about 10 activities, 8 weeks) that teaches the
  loop and the views before the full game.

INSTRUCTOR FEATURES:
- Seed picker, projector-friendly large-UI mode, leaderboard reset, and a
  difficulty setting that scales event frequency and severity.
- Glossary tooltips throughout for float, lag, LDs, general conditions, crash,
  trade stacking — first-year students will play this.

LOOK AND FEEL:
- Clean, modern, readable from the back of a room. Construction-document
  aesthetic touches welcome (title block, drawing-set typography) but clarity
  beats theme. Mouse and touch. Satisfying but quick week animations —
  a full game should fit in about 45 minutes of class time.

DELIVERABLE:
- The game, plus a printable instructor guide: a 75-minute class session plan
  (tutorial, competitive run, debrief discussion), CPM background, the overtime
  productivity-decay rationale with sources, misconceptions to draw out in
  debrief (float is free time to spend casually; overtime always accelerates;
  the critical path is fixed at baseline; weather delays everything equally),
  and discussion questions keyed to things that happened in the game.
- Playtest before finishing and verify ALL of these:
  1. CPM math checks against a hand calculation: for the tutorial network,
     print the expected ES/EF/LS/LF/float table in the code comments and
     verify the engine reproduces it exactly.
  2. In at least one scripted scenario, delaying a non-critical activity
     consumes its float and then visibly SHIFTS the critical path.
  3. No combination of acceleration actions shortens a concrete cure lag or
     an inspection hold.
  4. Determinism: same seed + same decision script twice = identical final
     profit to the dollar.
  5. A test run using maximum overtime every week finishes with WORSE profit
     than a balanced strategy on the same seed.
  6. Overloading one floor with crews yields less total progress than
     splitting them across two floors.
  7. A full game with sensible play completes in under 45 minutes.

---

## Implementation notes and departures

**Where the seven verifications live.** 1–4 are asserted inside `src/engine.js` so the same
checks run in the browser from the Instructor menu; all seven are proved again end to end in
`src/playtest.test.js`, and #7 is timed against the real UI in `tools/integration.mjs`.
The hand-calculated ES/EF/LS/LF/TF/FF table for the tutorial network is written out activity
by activity in the comment block above `TUTORIAL_NETWORK` in `src/data.js`, with both passes
worked through, and the engine is tested against all sixty numbers.

**Tutorial length.** The brief asks for about 10 activities and 8 weeks. The network is 10
activities with an unimpeded CPM duration of 29 working days; with the event deck applied it
runs eight to ten turns.

**Float convention.** Float is measured to project completion, so total float is never
negative. Performance against the contract date is reported separately as calendar days early
or late. The alternative — setting the last activity's late finish to the contract date and
letting float go negative — is defensible and common in practice, but negative float is a
concept that costs a first-year class more than it teaches them in a 75-minute session.

**Cure and inspection holds are activities, not lags.** The brief calls them "non-compressible
lags". They are modelled as zero-crew activities with a `fixed` flag rather than as lag values
on a relationship, so students can see them sitting on the critical path in the Gantt and the
network diagram. They behave identically to a mandatory lag and are equally incompressible.

**The 60-hour overtime floor.** The published figures the brief points at are not quite
self-consistent: Business Roundtable's ~66% sustained 60-hour productivity nets
1.50 × 0.66 = 0.99, fractionally *better* than the 50-hour floor's 1.25 × 0.75 = 0.94, which
would teach students that if you are going to burn a crew out you may as well do it at sixty.
The same report concludes sustained 60-hour weeks finish later than the same crew on forty, so
the model uses a slightly steeper floor of 0.62 to reproduce the source's own conclusion.
This is documented in the code, in the guide, and enforced by a test.

**Weather boundary.** Only earthwork, concrete placement, roofing and envelope carry weather
flags, exactly as the brief specifies. Steel erection therefore does not, so the wind-advisory
card stops glazing and sheathing but not the crane. Two engine self-tests enforce the boundary
in both directions so no inert weather card can creep in.

**Crew crashing premium.** Not in the brief, but added because without it "hire every crew
available" is a dominant strategy and the resource decision stops being a decision. Marginal
output per added crew is 1.00 / 0.80 / 0.65.

## The decision layer (added after playtesting)

A construction manager played the version built to the brief above and reported the real problem
with it: *"I don't really see many decisions to be made. The defaults are mostly the right call.
Weather doesn't seem to make much of an impact. I saw the inspector wanting something and it's
great and should stay, but there doesn't seem to be anything I could have done. It's one thing if I
made a decision about extra digging — footing was noticed to be right on spec with no wiggle room
and let it ride and the inspector didn't like it. But no choices were made."*

That is a correct diagnosis of a game where events happen *to* the player. Four things were added in
response, none of them in the original brief:

**Judgment calls.** Nine in the main project, two in the tutorial. A call is a decision made before
the work whose consequence lands later, with options trading money and days now against exposure
later. The first one in the game is the one the CM described almost word for word: bearing at column
line 4, pour to plan or over-excavate, and you find out at the foundation inspection.

**A fairness mechanism that keeps the leaderboard honest.** Each call's roll is
`hash(seed + '|' + callId)` — independent of the order of play and of anything a team does — so every
team on a seed faces identical rolls and the only variable is the threshold they bought. The debrief
prints exposure against roll and grades the decision rather than the outcome, which is where the
"a good call can still go badly" lesson lives.

**The weather call, procurement calls, and crew lead time.** Working through the rain is now a
priced option with exposure that scales with how long you stay in it; long-lead packages can be
bought out early so a late-delivery card becomes a consequence of an earlier call; and a second crew
takes two weeks to arrive, so manpower is committed before the week that needs it.

**Real resource scarcity.** Floor-to-floor lags were tightened so a trade routinely has more open
work than one crew can feed, which is what turns float from a displayed number into the tool you use
to decide what to starve.

**Three follow-ups from the same reviewer**, all fixed: expedite options were offering to recover
more days than the delay had cost (the delay days had been retuned downward across several passes
and the recovery values never followed), so recovery is now clamped one day short of the scaled
delay and the offer is withdrawn entirely when that leaves nothing to buy; every call and every
expedite option now carries a plain-English panel explaining its jargon, because a call a first-year
cannot read is not a decision; and the deck now contains exactly one option that is not a legitimate
trade-off — backfilling against an uncured, unbraced foundation wall — flagged before it is chosen
and flagged again above the profit in the debrief whether or not it worked, on the grounds that
schedule pressure producing an unsafe shortcut is worth naming in a classroom. An engine self-test
holds the line: unsafe options must be rare, must carry an explanation, must never be the only way
through, and must survive into the debrief even when the roll goes the player's way.

**A fourth follow-up**: the event deck was drawn purely by week number, so a rebar short shipment
could arrive ten weeks after the last pour and report "no impact" — a third of all targeted cards
were landing on finished work, and two-thirds of the cards the tutorial drew targeted activities
that project has not got. Cards that name activities are now windowed to where those activities sit
in the project's own schedule. The window is derived from the network alone (critical-path dates
stretched to the pace a real run takes), so it is identical for every team on a seed and the
fairness guarantee is untouched; a card whose targets do not exist in the project is never drawn at
all. Measured rate of cards landing on finished work: 34% before, 0% after. Three self-tests hold
it. Closing the wasted third made the deck bite noticeably harder, so the contract moved from 126 to
129 working days and the buyout from $2.47M to $2.60M to restore the spread.

**Round three (requested):** a Murray State theme (navy/gold, horseshoe wordmark, campus project
names, gold hard hats), a cartoon graphics pass replacing the stick figures (posed workers with faces
and vests, gradient sky, brick veneer with limestone bands, a lattice tower crane, the topping-out
tree and pennant), full phone playability (SITE/MEETING tab layout under 820px, tested at 390×844 in
the integration suite), and three depth systems: cash flow (monthly pay applications, 5% retainage,
owner pays 30 days behind, line-of-credit interest off the score, a front-loading call with a seeded
audit risk, and the cash valley charted in the debrief), sub standing per trade (grinding a sub slows
their next crew and eventually drags their work; it recovers slowly), and roughly doubled decks — 48
events including a three-card RFI chain, 19 calls. Contract retuned to 134 working days. Measured:
defaults average ≈$79k and go negative on three of eight seeds; a player reading float, cash and the
calls averages ≈$156k and wins six of eight.

Verification 8 was added to the playtest suite as a result: a player who reads float, prices the
calls and plans manpower must beat a player who accepts every default. It does, on six of eight
seeds and by roughly 90% on average. It is deliberately *not* every seed — on two of them the rolls
let the cheap option through, and those seeds make the best debriefs.
