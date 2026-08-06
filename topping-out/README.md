# Topping Out — competitive construction scheduling for the classroom

**Murray State edition** — navy and gold throughout, cartoon crews in gold hard hats, the pennant on
the field office, and the projects renamed for home: *Racer Commons — Chestnut Street* and the *Shoe
Tree Annex* tutorial. Fully playable on a phone: under tablet width the interface folds into SITE and
MEETING tabs with the commit button always in reach.

Open `index.html` in any modern browser. **No build step, no server, no network** — it runs
offline on school laptops straight off a USB stick or a shared drive.

| File | What it is |
|---|---|
| `index.html` | The whole game — one self-contained file (~215 KB). |
| `teacher-guide.html` | Printable instructor guide — 75-minute session plan, CPM background, sources. |
| `Topping-Out-Instructor-Guide.pdf` | The same guide, pre-rendered to Letter. |
| `SPEC.md` | The original design brief this was built against. |

Teams manage the schedule of the same small commercial building, week by week, against the
same run of bad luck. Highest profit at completion wins.

## What makes it a real scheduler and not a scripted timeline

The engine runs a genuine precedence-diagram CPM over the live state of the job, **every turn**:

1. **Forward pass** — earliest start and earliest finish, honouring FS, SS and FF relationships
   with lags in working days.
2. **Backward pass** — latest start and latest finish from the computed project end.
3. **Float** — total float (`LS − ES`) and free float per activity, which are different numbers
   and the game insists on the difference.
4. **The critical path is computed, never declared.** Nothing in the data file is flagged
   critical. The driving chain is traced backwards from the latest-finishing zero-float
   activity through whichever relationship is actually binding — so it moves during play, and
   when it moves the game says so by name: *"The critical path has moved to MEP rough-in."*

Completed activities are pinned to the dates they really happened; work in progress is anchored
to its actual start with its remaining duration recomputed from the crews now on it. So the
schedule is an as-built to the data date and a forecast beyond it, which is what a real weekly
update is.

**Concrete cure and inspection holds are non-compressible.** No crew count, no overtime level and
no expediting fee shortens them, ever. The check sits at the only place progress is ever made, so
there is no path around it, and the test suite proves it by throwing every acceleration the game
offers at every hold.

## The weekly meeting

One turn is one project week, framed as Monday 7 a.m.

1. **The news** — this week's events, drawn from a seeded deck: weather (forecast shown as a range,
   actual may differ), late deliveries, subcontractor slips, failed inspections, RFIs and design
   changes, workforce shortage. Written with flavour, stated mechanically.
2. **Decisions** — answer the calls on the table, assign crews across work fronts, order or release
   a crew, authorise overtime per trade, expedite a delivery, take the weather on or stand down, or
   absorb it and spend float. A live preview shows the projected finish date and profit *before* you
   commit.
3. **Commit** — one button, no undo.
4. **The week runs** — five working days animate in the 4D view, costs tick, progress happens or
   doesn't.

## The calls — where the game actually is

A **call** is a judgment made *before* the work, whose consequence lands weeks later. Week one opens
with one: the geotech logged the design bearing at column line 4 with nothing to spare. Pour to plan
for nothing and carry a 45% chance the foundation inspection rejects it; get a field determination
from the engineer for $3,200 and two days and carry 14%; or over-excavate and add rebar for $9,800
and a day and carry 3%. You find out at `INSP1`, about six weeks later. Not answering is answering —
the free option is what happens.

Nine calls run through the main project and two through the tutorial: bearing, cold-weather
protection on the wall pour, embed tolerance on the level 3 deck, whether to start rough-in before
the building is dry, whether to pre-walk the rough-in inspection, and how you intend to run the
punchlist. Three more are procurement — pre-buy the structural steel, the switchgear and elevator, or
the curtain wall, and the matching late-delivery card lands with no impact at all.

**The roll is the same for everybody.** It is `hash(seed + '|' + callId)` — it depends on the seed
and the call and nothing else, not on the order of play, not on anything a team does. Every team on a
seed faces the identical roll on every call. What differs is the threshold they bought. Two teams
looking at the same 0.31 get different outcomes because one moved the bar to 0.05 and the other left
it at 0.45. That is a decision, not a dice game, and the test suite asserts both halves of it.

The debrief prints the calls back with the exposure you chose beside the roll you got, and grades
each one: *covered — never in doubt*, *got away with it*, *unlucky: you covered it and it still bit*,
*went against you — and you were exposed*. Grade the decision, not the outcome.

Every call carries a **What this actually means** panel explaining its jargon, because a first-year
does not know what a proof roll that *pumped* is, or a cylinder break, or fire-caulk at a
penetration — and a call you cannot read is not a decision. The same terms are in the hover glossary.

**One call is not a trade-off.** Almost every option in the deck is defensible; one is not. Backfilling
high against one side of an uncured, unbraced foundation wall is free, saves three days, and is marked
⚠ UNSAFE on the button with the reason printed before anyone clicks it. If a team takes it, the debrief
opens *above the profit* with a red block naming it and explaining why — and it fires whether or not
the wall stood. If the roll went their way it says so: *and it held. That is the most dangerous
possible outcome, because it teaches you it was fine.* Schedule pressure producing an unsafe shortcut
is not hypothetical in this industry, and naming it in a classroom is cheaper than meeting it on a job.

**Expediting is not an undo button.** A fee always buys back *some* of a late delivery and never all
of it: recovery is capped one day short of the delay at every difficulty, and where that leaves nothing
to buy, the offer is not made at all.

## The weather is something you do, not something you read

By default weather-exposed work stands down on rain days. You can instead work through it: 70%
production in the wet, $2,600 a rain day in pumping and protection, and a chance of placing something
you take back out that scales with how long you keep at it — 16% for a one-day blip, 48% for a
three-day washout. Pushing through a squall to protect a critical pour and pushing through a
washout to protect one with nine days of float are different decisions, and the game prices them
differently.

## The models, and why they bite

**Overtime decays.** A grace period with no measurable loss, then a compounding weekly decay to a
documented floor. A fourth consecutive 50-hour week delivers 1.3% more progress than straight time
and costs 37.5% more per crew-day; by the fifth it produces *less* than forty hours would have and
still bills the premium. Sixty-hour weeks cross that line a week earlier and settle 7% below
straight time at 75% more cost. Sources are named in the guide and in the code:
Business Roundtable Report C-2 (1980); Thomas & Raynar, ASCE *JCEM* 123(2), 1997; MCAA factors.

**Crews crash, but never for free.** Marginal output per added crew is 1.00 / 0.80 / 0.65 — the
second crew is the B team, working around the first. Doubling a crew buys about 44% off the
duration for 100% more labour on that activity, which only pays on the critical path.

**Trade stacking hurts everybody in the zone.** A floor holds two crews comfortably; past that,
every crew there loses 25% per crew over cap. Four crews on a two-crew floor do exactly the work
two crews would have done, at twice the cost — and you can see the overcrowding in the 4D view.

**Idle crews still bill.** A trade is on site only while it has a work front open, but any crew
you are carrying that you have not put on a front bills at half rate for doing nothing. An unopened
work front is expensive.

**Manpower is a forecast.** A second crew takes two weeks to arrive, so you commit to it before you
know what is coming; releasing one is immediate and free. And there is never enough — MEP, drywall
and finishes each ladder up three floors on a two-day stagger, so most weeks at least one trade has
more open work in front of it than one crew can feed. Float stops being decoration the moment the
question turns from "what do we work on" into "what do we starve".

**Money is the score — and cash is how you survive to collect it.** General conditions burn per
calendar day, liquidated damages accrue past contract completion, overtime pays premium, expediting
costs fees, finishing early earns a bonus. Underneath, a second set of books: you bill the owner
monthly against the schedule of values, they pay thirty days later holding 5% retainage to closeout,
costs go out weekly, and the gap lives on a line of credit at real interest that comes off the score.
Week one opens with the front-loading call — price the schedule of values straight and finance the
valley, or load it and risk the owner's reviewer kicking an application back mid-job. The debrief
charts the whole valley with the interest bill under it.

**Subs remember how you treat them.** Every trade carries standing (SOLID / WARY / BURNED on its crew
card). Sustained overtime, joint checks and idle mobilized crews grind it down; a wary sub takes an
extra week to field a crew, a burned one drags 5% on everything. It recovers slowly, which makes
resting a sub a real scheduling move — and makes overtime cost three ways.

## The weekly meeting on screen

Decisions live on a single **crew board** grouped by trade — not three parallel lists of the same
ten trades, which is how this started and how it lost people. Each card carries the trade's
headcount as pips (solid = working, hollow amber = idle and still billing at half rate, with the
daily cost spelled out), its overtime switch, and beneath it every work front open to that trade
this week tagged with its zone, its remaining duration and its float. Trades with nothing open
collapse to a single line, so week one shows one card rather than ten. Cure times and inspection
holds sit in their own hatched block headed *"running on their own — nothing you can do"*.

## The three views

- **4D cutaway** — a section through the building driven entirely by activity progress. The
  finished building is always drawn first as a faint dashed **ghost** and real work fills it in, so
  week one shows the shape of the job rather than an empty field. Excavation opens and is backfilled
  away, footings and stem walls pour, steel walks up floor by floor behind a tower crane that comes
  down when the roof goes on, the envelope closes, interiors fill in behind the cut line. Crews
  stand on the floor they are working, tagged with their trade, so a stacked floor looks crowded and
  turns red. A floor with work open and nobody on it gets an amber WORK OPEN — NO CREW box. Each
  level carries a percent-built bar, and a topping-out flag goes up when the roof deck completes.

  None of it is hard-coded to one project: geometry is derived from the zones the network uses and
  every element is driven by an activity's `role`, so the ten-activity tutorial correctly draws a
  single-storey building instead of an empty three-storey ghost.
- **Gantt** — bars from ES to EF, a thin tail out to LF for float, critical work in red, cure and
  inspection holds hatched, today and the contract date both marked.
- **Network diagram** — nodes placed by early start and packed into lanes, relationship type and
  lag on the arrows, the driving path thick and red.

A persistent HUD carries day count, contract date, projected finish against it, cash position,
the current critical activity and total float remaining. Glossary tooltips sit on every term a
first-year will not know yet — float, free float, lag, LDs, general conditions, crash, trade
stacking.

## Competition

Everyone enters the **same seed code**. The seed fixes the project, the entire event sequence and
every call's roll, all resolved before anyone makes a decision, so no team's luck can diverge from
another's. Two teams that finish $200,000 apart made different calls. A local leaderboard records
team, finish date and final profit.

Every card that names activities is windowed to where those activities sit in this project's own
schedule, so a late rebar delivery cannot arrive ten weeks after the last pour went in, and the
ten-activity tutorial is never told its curtain wall is late. The window comes from the network alone,
so it is the same for every team and the fairness guarantee is untouched. A team running far enough
ahead that a card still lands on finished work is told exactly that — *no impact, you are ahead of
this one* — which is a reward rather than a shrug.

Measured across eight seeds: accepting every default averages about **$68,000** and goes negative on
two of them. A player who reads float, prices the calls by expected cost, orders manpower ahead of
need and only fights the weather when the exposed work has no float averages about **$205,000** —
three times as much — and wins on seven of the eight. On the eighth the rolls let the cheap options
through, which is exactly the seed you want when you have twenty minutes of debrief and a room that
thinks a good outcome means it was a good call. Four of the eight seeds allow a well-played job to
finish ahead of the contract date and collect the early bonus.

## Debrief

On completion: profit broken down to the dollar (where every dollar went), a week-by-week timeline
of the team's decisions annotated with what each one caused, a chart of how the projected
completion moved with the weeks the driving activity changed marked in red, and a comparison
against the **no-intervention baseline** — the same seed played by simply letting it happen.

## Instructor features

**⚙ Settings** menu: projector mode (large UI, readable from the back of a room), new game /
change seed, leaderboard reset, a link to the printable guide, and an engine self-test that runs
28 assertions — including the CPM hand calculation — in front of the class.

Difficulty (Easy / Standard / Hard) scales how often events fire and how hard they hit. The seed
fixes *which* events fire and in what order.

There is a 10-activity tutorial project (*Ellis Street Annex*, eight to ten turns) that teaches the
loop and the views before the competitive run on *Calloway Commons* (38 activities, 3 storeys,
21–30 turns).

## Developing

Sources live in `src/` and are concatenated by `build.js` into the single `index.html`.

```
node build.js                  # rebuild index.html from src/
node src/engine.js --test      # 36 engine assertions (also runs in-browser from the Settings menu)
node src/playtest.test.js      # 72 assertions — the seven required verifications, plus proof the decisions matter
node tools/integration.mjs     # 56 checks — desktop and phone viewports — drives the built game in a real browser, end to end
```

The engine is pure: no DOM, no network, no `Date.now`, no `Math.random`. Everything that varies
comes out of a seeded PRNG, and the test suite asserts that too.
