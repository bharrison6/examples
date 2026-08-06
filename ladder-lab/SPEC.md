# Ladder Lab — Shared Architecture Spec (v1)

Single self-contained offline HTML app: a PLC trainer centered on a stoplight program.
This spec is the binding contract between modules. Do not deviate from names, formats,
or semantics defined here. If something is unspecified, choose sensibly and document
it in a comment.

## Build layout

Source files in `src/`, concatenated in this order into one `index.html` (no ES
modules, no external network resources, no localStorage — in-memory + file
download/upload only):

1. `styles.css`   (inlined into `<style>`)
2. `engine.js`    — window.LL.Engine, LL.Validate
3. `programs.js`  — window.LL.Programs
4. `faults.js`    — window.LL.Faults
5. `ladder.js`    — window.LL.Ladder  (ladder SVG renderer + click inspector)
6. `watch.js`     — window.LL.Watch   (watch window + image-table scan debugger)
7. `sim.js`       — window.LL.Sim     (intersection world + rendering + input widgets)
8. `editor.js`    — window.LL.Editor
9. `challenges.js`— window.LL.Challenges
10. `app.js`      — window.LL.App (shell, wiring, main loop)

Conventions: plain ES2018 (works in Chrome ~90+), `window.LL = window.LL || {}`
namespace, no libraries, no `fetch`, no `Date.now()` inside deterministic logic
(sim time comes from the engine). `Math.random()` is forbidden everywhere;
use `LL.Util.rng(seed)` (defined in engine.js) — a mulberry32 PRNG.

## Fixed tag list (the entire I/O universe)

Type prefixes are implicit; tags are flat strings. `kind`: I=physical input,
O=physical output, B=internal bit, T=timer, C=counter.

INPUTS (physical, clickable in the sim pane):
- `PB_START`   momentary NO pushbutton — motor start
- `PB_STOP`    momentary NO pushbutton — motor stop (use XIO in ladder for classic stop logic)
- `PED_NS`     momentary NO — pedestrian button, walk in N/S direction (crosses the E/W roadway)
- `PED_EW`     momentary NO — pedestrian button, walk in E/W direction
- `LOOP_EW`    inductive loop in the E/W approach; true while a car is over it (sim-driven, also click-forcible)
- `SW_NIGHT`   maintained selector switch — AUTO(off)/NIGHT(on)
- `SW_STOP`    maintained master stop switch

OUTPUTS (physical, drive the intersection):
- `NS_GRN` `NS_YEL` `NS_RED` — north/south light stack (both N and S heads mirror these)
- `EW_GRN` `EW_YEL` `EW_RED` — east/west stack
- `WALK_NS`  walk sign for pedestrians moving N/S (sim shows DON'T WALK when off)
- `WALK_EW`  walk sign for pedestrians moving E/W
- `MOTOR`    motor contactor (motor program; sim pane shows a small motor widget when the loaded program uses it)

INTERNAL BITS available to students in the editor: `B1`..`B12`.
Built-in programs may use readable internal names (e.g. `STEP1`, `REQ_NS`) — any
tag not in the fixed lists is an internal bit auto-declared by the program.

TIMERS: `T1`..`T8`.  COUNTERS: `C1`..`C4`.
Timer members referenced in contacts as `T1.DN`, `T1.TT`, `T1.EN`; counters `C1.DN`.
A contact tag may be any bit tag or a `.DN/.TT/.EN` member.

## Program JSON format

```js
{
  "id": "stoplight_basic",          // stable id
  "name": "1 — Basic Timed Stoplight",
  "description": "one-liner",
  "notes": "optional longer teaching note (markdown-ish plain text)",
  "usesMotor": false,                // sim shows motor widget if true
  "rungs": [
    {
      "comment": "Latch step 1 on power-up",
      "items": [ /* series of elements, left to right */ ]
    }
  ]
}
```

Rung `items` is a SERIES array. Each element is one of:

```js
{ "t": "XIC", "tag": "PB_START" }
{ "t": "XIO", "tag": "PB_STOP" }
{ "t": "ONS", "tag": "B7" }              // tag = storage bit, required, must be unique per ONS
{ "t": "OTE", "tag": "MOTOR" }
{ "t": "OTL", "tag": "STEP1" }
{ "t": "OTU", "tag": "STEP1" }
{ "t": "TON", "tag": "T1", "pre": 5000 } // pre in ms of simulated time
{ "t": "TOF", "tag": "T2", "pre": 3000 }
{ "t": "CTU", "tag": "C1", "pre": 4 }
{ "t": "CTD", "tag": "C1", "pre": 4 }
{ "t": "RES", "tag": "T1" }              // resets timer or counter
{ "t": "BR", "paths": [ [/*series*/], [/*series*/], ... ] }  // parallel branch, 2+ paths
```

Branches may appear anywhere in the series (input side or output side, e.g.
parallel OTE/OTL coils, or the seal-in contact branch). Branch paths contain
series arrays of the same element types. **Branches must not nest** (a BR path
never contains another BR) — keeps the editor and renderer simple; all included
programs obey this.

Condition class: XIC, XIO, ONS (pass/condition power).
Output class: OTE, OTL, OTU, TON, TOF, CTU, CTD, RES (execute with incoming
power, and PASS THE INCOMING POWER THROUGH unchanged, AB-style, so a series of
output instructions all fire from the same condition).

## Engine semantics (LL.Engine) — the non-negotiable part

`new LL.Engine.PLC(programJson, { scanMs: 20 })`

Scan cycle — `plc.scan()` performs exactly:
1. INPUT SCAN: copy latched physical input states into the input image table.
2. LOGIC: solve rungs 0..N-1 in order; within a rung, elements strictly left to
   right; branch paths top to bottom (path 0 first). All contact reads come from
   the image tables / internal state AS THEY ARE AT THAT MOMENT — a bit written
   by an earlier rung (or earlier element in the same rung) is seen by later
   logic in the SAME scan; earlier rungs see it NEXT scan. No event-driven
   shortcuts.
3. OUTPUT SCAN: copy the output image built during logic to the committed
   outputs (`plc.outputs()`), which is what the sim pane reads.
4. `simTimeMs += scanMs`, `scanCount += 1`.

Element semantics:
- XIC: out = in && bit. XIO: out = in && !bit.
- OTE: bit := in (every scan it is solved). out = in.
- OTL: if in, bit := 1 (else unchanged). OTU: if in, bit := 0. out = in.
- ONS: out = in && !stored; stored := in. Storage per ONS tag.
- TON (executed when solved, with rung-in `in`):
  EN := in. If in: ACC = min(ACC + scanMs·(counted once per scan; see note), PRE)… 
  Precisely: if in { ACC += scanMs; if ACC >= PRE { DN := 1 } ; TT := !DN }
  else { ACC := 0; DN := 0; TT := 0 }. Cap ACC at PRE for display. out = in.
- TOF: if in { DN := 1; TT := 0; ACC := 0 } else { if DN && !doneTiming { TT := 1; ACC += scanMs;
  if ACC >= PRE { DN := 0; TT := 0 } } }. EN := in. out = in.
- CTU: on rising edge of in (per-instruction stored edge bit): ACC += 1.
  DN := ACC >= PRE. out = in. (ACC may exceed PRE.)
- CTD: on rising edge: ACC -= 1. DN := ACC >= PRE. out = in.
- RES: if in: target timer → ACC=0, DN=0, TT=0, EN unchanged; counter → ACC=0, DN recomputed. out = in.
- BR: out = OR over paths of path-out; every path is fully executed (side
  effects run even if an earlier path already made the OR true).
- Timer/counter accumulation uses SIMULATED time (scanMs per scan). Never wall clock.

A timer solved twice in one scan (double-coiled TON) accumulates twice — real
PLC behavior; the fault library exploits this class of bug. A bit written by two
OTEs: last write wins (both execute).

Public API (exact names — UI code depends on these):

```js
plc.scan()                     // one full scan
plc.reset()                    // zero everything incl. timers, scanCount, simTime; keeps program & physical inputs? NO — clears physical inputs too
plc.setPhysicalInput(tag, v)   // latched; picked up at next scan's input read
plc.getPhysicalInput(tag)
plc.program                    // the loaded (possibly fault-patched) program JSON, with stable element ids (below)
plc.scanCount, plc.simTimeMs, plc.scanMs
plc.inputImage                 // {tag: 0|1} snapshot read this scan
plc.outputImage                // {tag: 0|1} as built during logic
plc.outputs()                  // committed output image (after output scan) {tag:0|1}
plc.bits                       // {tag: 0|1} internal bits (incl. named ones)
plc.timers                     // {tag: {EN,TT,DN,ACC,PRE}}
plc.counters                   // {tag: {CU,CD,DN,ACC,PRE}}
plc.power                      // per-element power map from the LAST scan: {elemId: {in:0|1, out:0|1}}
plc.changedBits                // Set of "table:tag" strings that changed value during last scan, e.g. "I:PED_NS","O:NS_GRN","B:STEP1","T:T1.DN" — for UI highlighting
plc.tagList()                  // [{tag, kind:'I'|'O'|'B'|'T'|'C', value|state}] every tag the program touches + all physical I/O
```

Element ids: at load, engine walks the program and assigns `elem.id =
"r{rung}.{path}.{index}"` strings (branch paths get `r2.b0p1.3` style — exact
scheme is engine's choice but MUST be stable and stored on each element object;
`plc.program` exposes them and `plc.power` is keyed by them).

`LL.Validate.check(programJson) -> [{level:'error'|'warn', rung:i, msg:'plain English'}]`
Rules: duplicate OTE coil (same tag, two OTEs — warn "last write wins" style
error), TON/TOF/CTU/CTD with missing/zero preset, any element with missing tag,
unknown physical tag (not in fixed lists and not a B/T/C pattern or declared
internal), ONS reusing a storage bit, BR with <2 paths, empty rung, output-class
element on a branch input side is allowed (no error), RES targeting a tag with
no timer/counter.

`LL.Util`: `rng(seed)` mulberry32 returning ()=>float[0,1); `deepClone(obj)`.

## Determinism / main loop (app.js owns this)

Fixed-timestep accumulator: at speed `spd` (0.25–50×) and scan period `scanMs`,
run `floor(elapsedWall·spd/scanMs)` scans per animation frame (cap 200/frame).
Per tick, IN THIS ORDER:
1. `LL.Sim.prePlcTick(plc)`   — sim computes physical sensor states (LOOP_EW from car positions) and calls setPhysicalInput
2. `plc.scan()`
3. `LL.Sim.postPlcTick(plc, scanMs)` — sim reads plc.outputs(), moves cars/peds by scanMs of sim time
4. (renderers run per animation frame, not per scan)

STEP MODE: pause; "Step 1 Scan" button runs exactly one tick (1→2→3) then
renders. The scan debugger (image tables) makes single-stepping meaningful.

## Module init contracts (app.js calls these)

Each UI module attaches to a container and gets a shared `ctx`:

```js
ctx = {
  getPlc(),            // current PLC instance (replaced on program change/reset — always call, don't cache)
  onSelectElement(cb), // ladder click → inspector; app wires this
  bus: {on(evt,cb), emit(evt,data)},   // simple event bus (app.js provides)
  bigUI: bool
}
LL.Ladder.init(containerEl, ctx);  LL.Ladder.render();      // full redraw (program changed)
LL.Ladder.update();                                          // per-frame cheap state refresh
LL.Watch.init(containerEl, ctx);   LL.Watch.update();
LL.Sim.init(containerEl, ctx);     LL.Sim.reset(seed);  LL.Sim.update();  // update = per-frame draw
LL.Editor.init(containerEl, ctx);  // manages its own DOM; emits bus 'editor:run'(programJson)
LL.Challenges.init(containerEl, ctx);
LL.Faults;  // data + pure helpers, plus small UI panel: LL.Faults.initPanel(el, ctx)
```

Bus events (min set): `program:loaded` {program, plc}, `scan:done`, `mode:changed`,
`bigui:changed`, `editor:run` {program}, `fault:injected`, `fault:revealed`.

### Ladder pane (LL.Ladder)
SVG between left/right power rails; standard symbols: XIC `-| |-`, XIO `-|/|-`,
coil `-( )-`, OTL `-(L)-`, OTU `-(U)-`, ONS `-[ONS]-`, timer/counter as a box
showing type, tag, PRE, live ACC, and EN/TT/DN pips. Tag label above each
element. Energized elements + wire segments highlight (use `plc.power`).
Clicking any element → popup/panel: tag, current state, one-line plain-English
description ("XIC PED_NS — 'examine if closed': passes power while the ped
button reads ON. Currently OFF, blocking."). Rung comments render above rungs.
Rung numbers on the left rail. Scrollable vertically.

### Sim pane (LL.Sim)
Top-down 4-way intersection, industrial-clean style. Two visible light stacks
(NS pair renders one stack graphic + the far one mirrored small, fine to show 2
stacks total: one for NS, one for EW). Cars: colored rectangles spawning on a
seeded schedule on all 4 approaches, queue behind stop line on red/yellow,
proceed on green, despawn off-screen. E/W approach has a visible loop rectangle
at the stop line; LOOP_EW true while any car overlaps it. Ped: walk/don't-walk
signs (WALK white/walking figure when WALK_x on, orange hand otherwise); when
WALK_NS on, a stick pedestrian crosses. Clickable physical inputs rendered as a
panel strip under the intersection: PB_START, PB_STOP (momentary: active while
pointer down), PED_NS, PED_EW (momentary), LOOP_EW force button (momentary),
SW_NIGHT (toggle), SW_STOP (toggle). Momentary buttons must latch at least until
the next scan even on a fast click (set on pointerdown, clear on pointerup but
minimum 1 scan — implement by OR-ing "clickedSinceLastScan"). Motor widget
(spinning when MOTOR on) shown when program.usesMotor. Collision flash: if both
NS_GRN and EW_GRN are ever on simultaneously, draw a red flashing "CONFLICT"
banner over the intersection (teaching moment for faults) — read from committed
outputs. All-off = all-red-dark (lights show dark lenses).

### Watch window (LL.Watch)
Table: sections Inputs / Outputs / Bits / Timers / Counters. Live values; timers
as `ACC/PRE` + EN TT DN chips; rows flash briefly when in `plc.changedBits`.
Second tab/section "Image Tables" (the scan debugger): input image and output
image as LED grids with tag labels, changed-this-scan bits ringed; shows
scanCount and simTime. Must be legible in step mode.

### Editor (LL.Editor)
Constrained editor over the program JSON: list of rungs; per-rung horizontal
slot strip; palette (XIC XIO ONS OTE OTL OTU TON TOF CTU CTD RES BR); click
palette then click a slot gap to insert; click element to select → tag dropdown
(fixed lists + B1..B12, T1..T8, C1..C4 + .DN/.TT/.EN members for contacts),
preset number input for timers/counters; delete selected; add/delete rung; add
branch = wraps selected contiguous span OR inserts empty 2-path branch, paths
editable the same way (no nesting — hide BR in palette while inside a branch).
"Run my program" button → validates (LL.Validate + plain-English list) → emits
`editor:run`. Save = download JSON file; Load = file input. Keep the data model
identical to the program format — no translation layer.

### Challenges (LL.Challenges)
4 challenges, each: title, plain spec shown to student, required tags, a
deterministic grader. Grader API:
`LL.Challenges.grade(challengeId, programJson) -> {pass, steps:[{desc, pass, detail}]}`
Implementation: fresh `PLC(program,{scanMs:20})`, drive scripted physical inputs
at given scan counts, assert outputs at scan counts (tolerance ±3 scans where
timing-sensitive; assert invariants like "never both greens" continuously).
1. Seal-in: MOTOR latches on momentary PB_START, drops on PB_STOP.
2. Delayed start: after PB_START, MOTOR energizes 3.0 s later (TON), still
   stop-able, latch survives button release during the delay.
3. Basic stoplight from spec: NS green 6 s / yellow 2 s / EW green 6 s / yellow
   2 s, opposite red, never both green, cycles forever.
4. Crosswalk add-on: PED_NS pressed mid-cycle → WALK_NS only at the START of the
   next NS-green, on for 4 s, never on outside NS green.
Feedback names the failing step in plain English with scan/second timestamps.

### Faults (LL.Faults)
`LL.Faults.list` — ≥8 entries:
`{id, programId, title(hidden until reveal), apply(programJsonClone)->patchedJson, symptom, explanation, difficulty}`
Faults are pure JSON transforms of a deep-cloned built-in program (never mutate
originals; never leak across programs). Panel UI: "Inject random fault" (seeded
by user click count is fine — may use real entropy here ONLY, it's a user
choice, not sim logic), "I've diagnosed it → Reveal", shows explanation +
highlights the patched rung(s) in the ladder (bus event `fault:revealed`
{elemIds}), solve timer (wall clock OK) + best-times table kept in memory.
Required coverage: missing seal-in branch; swapped XIC/XIO on ped button; wrong
yellow preset (0.3 s); double-coiled output; missing green-green interlock
(+step overlap so it actually shows conflict); rung-order bug delaying a
transition one scan; sensor logic inverted (XIO LOOP_EW); WALK never unlatched;
night-flash timer preset 0 (solid not flashing); PB_STOP XIC/XIO swap.

## Built-in programs (LL.Programs.list) — hand-written, correct

1. `stoplight_basic` — 4-step sequencer: STEP1 NS-green (T_NSG TON 8 s) → STEP2
   NS-yellow (3 s) → STEP3 EW-green (8 s) → STEP4 EW-yellow (3 s) → STEP1.
   Power-up rung latches STEP1 when no step active. Output rungs at the END
   (after step logic): NS_GRN = STEP1 **AND XIO EW_GRN**; EW_GRN = STEP3 AND XIO
   NS_GRN (cross-interlock); yellows from their steps; NS_RED = STEP3 OR STEP4;
   EW_RED = STEP1 OR STEP2. SW_STOP: XIO SW_STOP gates the timers (freeze) and
   forces both reds on + greens/yellows off when active (branch logic) — all-red
   safe state.
2. `stoplight_ped` — program 1 + PED_NS/PED_EW latch REQ_NS/REQ_EW (OTL);
   at the scan a green step BEGINS (ONS on the step bit), if REQ latched → OTL
   WALK, OTU REQ; WALK_x on for 4 s (walk timer) then OTU WALK; DON'T WALK is
   simply WALK off. Requests pressed mid-green are NOT honored until the next
   green (the ONS already fired) — this is the required behavior.
3. `stoplight_sensor` — rest in NS green; when LOOP_EW true AND minimum-green
   timer done → advance to NS yellow → EW green (fixed 8 s or until loop clear
   + min 4 s — keep simple: fixed) → back to NS green rest.
4. `stoplight_night` — program 1 logic gated by XIO SW_NIGHT; plus two-timer
   flasher (T_FA/T_FB 500 ms each, classic: rung1 XIO T_FB.DN → TON T_FA; rung2
   XIC T_FA.DN → TON T_FB; FLASH = T_FA.DN); when SW_NIGHT: NS_YEL = FLASH,
   EW_RED = FLASH, everything else off.
5. `motor_sealin` — rung: [BR: [XIC PB_START],[XIC MOTOR]] XIO PB_STOP → OTE
   MOTOR. Plus a comment-rich second rung optional (e.g. run-hours CTU on MOTOR
   rising edge — nice touch, optional).
6. `scan_order_demo_a` / `scan_order_demo_b` — two 2-rung programs proving scan
   order matters. A: r1: XIC B_SRC → OTE B_ECHO; r2: XIC PB_START → OTE B_SRC.
   B: same rungs swapped. In A, B_ECHO lags PB_START by one full scan (visible
   in step mode); in B it updates same-scan. Include notes text explaining what
   to watch. These count as one selector entry "6 — Scan Order Demo" with A/B
   variant toggle handled by them being two list entries with `variantOf` field
   (app renders an A/B switch).

Presets/timing are part of the program `notes` so the ladder matches its spec.

## App shell (app.js) + DOM

```
<body>
 <header id="topbar">  title · program <select> · mode tabs [Trainer|Editor|Challenges|Troubleshoot]
   · run controls (Run/Pause, Step Scan, speed select, scanMs select 10/20/50/100)
   · teacher menu (☰: Big UI toggle, Hide ladder toggle, Reset everything, Teacher guide link (opens teacher-guide.html), Self-test)
 <main id="panes">
   <section id="left-pane">   … ladder OR editor OR challenge UI (challenges embed the editor)
   <section id="right-pane">  … sim pane (always visible) + fault panel (troubleshoot mode)
 <footer id="bottom-pane">    … watch window + image tables/scan debugger (collapsible)
```

Modes: Trainer (ladder+sim), Editor (editor+sim — running student program drives
the sim), Challenges (challenge list/spec + editor + sim), Troubleshoot (ladder+
sim + fault panel). Hide-ladder toggle collapses left pane (Trainer/Troubleshoot).
Big-UI toggle adds `body.bigui` scaling ~1.35× fonts/symbols. Reset everything:
reload program fresh, sim reset with fixed seed 12345, timers zeroed.
`?selftest=1` runs engine unit tests and renders a pass/fail report (also
runnable in node: `node src/engine.js --test` guarded by `typeof window`).

## Look and feel (styles.css)

Industrial panel: dark charcoal background (#23272b), light panel cards
(#f4f4f2) with 2px dark borders and subtle corner screws motif, safety-yellow
(#f5a800) accents, green/red/amber indicator colors matching real stack lights,
monospace for tags (ui-monospace), sans (system-ui) for prose, high contrast,
min 14px base / 19px in .bigui. Buttons look like panel pushbuttons (round for
momentary, rocker/rotary look for switches). Touch targets ≥40px. No animation
that depends on wall-clock for logic — CSS transitions for polish only.
