/*
 * Ladder Lab — programs.js
 * ------------------------
 * window.LL.Programs — the built-in, hand-written teaching programs.
 *
 *   LL.Programs.list    array of program JSONs, in menu order
 *   LL.Programs.byId(id) -> program JSON or null
 *
 * The objects returned here are the PRISTINE masters. Treat them as
 * read-only: the engine deep-clones at PLC construction, and the fault
 * library deep-clones before patching, so nothing here is ever mutated.
 *
 * Every ladder below is written the way a maintenance electrician would
 * expect to read it: sequencer (step) logic first, then the per-lamp
 * output rungs at the very end, one OTE per output, with the safety
 * cross-interlock spelled out on both green rungs. Rung comments are the
 * primary teaching text; the `notes` field carries the phase timings and
 * a "what to watch" pointer for step mode. Rung references in comments
 * and notes are 1-based, matching the ladder pane and validator messages.
 *
 * Works in the browser (attaches to window.LL) and under node
 * (module.exports = the LL namespace, same pattern as engine.js).
 */
(function () {
  'use strict';

  var LL;
  if (typeof window !== 'undefined') {
    window.LL = window.LL || {};
    LL = window.LL;
  } else {
    LL = {}; // node: exported at the bottom
  }

  /* ----------------------------------------------------------------------
   * Tiny element constructors so each rung reads like ladder shorthand.
   * Each call returns a FRESH object (no shared references between rungs).
   * ------------------------------------------------------------------- */
  function XIC(tag)      { return { t: 'XIC', tag: tag }; }
  function XIO(tag)      { return { t: 'XIO', tag: tag }; }
  function ONS(tag)      { return { t: 'ONS', tag: tag }; }
  function OTE(tag)      { return { t: 'OTE', tag: tag }; }
  function OTL(tag)      { return { t: 'OTL', tag: tag }; }
  function OTU(tag)      { return { t: 'OTU', tag: tag }; }
  function TON(tag, pre) { return { t: 'TON', tag: tag, pre: pre }; }
  function CTU(tag, pre) { return { t: 'CTU', tag: tag, pre: pre }; }
  function BR()          { return { t: 'BR', paths: Array.prototype.slice.call(arguments) }; }
  function rung(comment, items) { return { comment: comment, items: items }; }

  /* ======================================================================
   * 1 — stoplight_basic
   * 4-step latch sequencer. One step bit is latched at all times; each
   * step runs a TON; the timer's DN bit advances the sequencer.
   * ==================================================================== */
  var STOPLIGHT_BASIC = {
    id: 'stoplight_basic',
    name: '1 — Basic Timed Stoplight',
    description: 'Fixed-time 4-step sequencer: NS green 8 s, yellow 3 s, EW green 8 s, yellow 3 s.',
    usesMotor: false,
    notes:
      'PHASE PLAN (22 s cycle): NS green 8 s -> NS yellow 3 s -> EW green 8 s -> ' +
      'EW yellow 3 s -> repeat. Timers: T_NSG 8000 ms, T_NSY 3000 ms, T_EWG 8000 ms, ' +
      'T_EWY 3000 ms. SW_STOP forces the all-red safe state; the interrupted phase ' +
      'restarts from zero when it is released (a TON resets when its rung goes false, ' +
      'so "gating" a timer restarts, not resumes, the phase - by design the safe choice).\n' +
      'TEACHING NOTE: watch rung 3 in step mode as T_NSG.ACC reaches 8000 - STEP1 and ' +
      'STEP2 swap in a single scan, and one scan later T_NSG resets itself because its ' +
      'own rung (rung 2) has gone false. Then click the XIO EW_GRN contact on rung 10 ' +
      'and ask the class: when would this contact ever matter? (Only when something ' +
      'else is broken. That is exactly why it is there.)',
    rungs: [
      rung('Power-up: with no step latched yet, latch STEP1 so the sequencer always has exactly one active step.',
        [XIO('STEP1'), XIO('STEP2'), XIO('STEP3'), XIO('STEP4'), OTL('STEP1')]),

      rung('STEP 1 - N/S green. T_NSG times the 8 s green. XIO SW_STOP holds the timer at rest during a master stop.',
        [XIC('STEP1'), XIO('SW_STOP'), TON('T_NSG', 8000)]),

      rung('Green time done: advance the sequencer - latch STEP2, unlatch STEP1. T_NSG resets itself next scan (its rung goes false).',
        [XIC('T_NSG.DN'), OTL('STEP2'), OTU('STEP1')]),

      rung('STEP 2 - N/S yellow, 3 s.',
        [XIC('STEP2'), XIO('SW_STOP'), TON('T_NSY', 3000)]),

      rung('Yellow done: advance to STEP3 (E/W green).',
        [XIC('T_NSY.DN'), OTL('STEP3'), OTU('STEP2')]),

      rung('STEP 3 - E/W green, 8 s.',
        [XIC('STEP3'), XIO('SW_STOP'), TON('T_EWG', 8000)]),

      rung('E/W green done: advance to STEP4 (E/W yellow).',
        [XIC('T_EWG.DN'), OTL('STEP4'), OTU('STEP3')]),

      rung('STEP 4 - E/W yellow, 3 s.',
        [XIC('STEP4'), XIO('SW_STOP'), TON('T_EWY', 3000)]),

      rung('Cycle complete: back to STEP1 (N/S green).',
        [XIC('T_EWY.DN'), OTL('STEP1'), OTU('STEP4')]),

      rung('N/S GREEN lamp. XIO EW_GRN is the cross-interlock: even if the step logic misbehaves, N/S green can never light while E/W green is on. XIO SW_STOP blanks it during a master stop.',
        [XIC('STEP1'), XIO('SW_STOP'), XIO('EW_GRN'), OTE('NS_GRN')]),

      rung('N/S YELLOW lamp during STEP2 (blanked by the master stop).',
        [XIC('STEP2'), XIO('SW_STOP'), OTE('NS_YEL')]),

      rung('E/W GREEN lamp, cross-interlocked against NS_GRN - the mirror of the N/S green rung.',
        [XIC('STEP3'), XIO('SW_STOP'), XIO('NS_GRN'), OTE('EW_GRN')]),

      rung('E/W YELLOW lamp during STEP4 (blanked by the master stop).',
        [XIC('STEP4'), XIO('SW_STOP'), OTE('EW_YEL')]),

      rung('N/S RED: on through the whole E/W half of the cycle (STEP3 or STEP4), and forced on by the master stop switch.',
        [BR([XIC('STEP3')], [XIC('STEP4')], [XIC('SW_STOP')]), OTE('NS_RED')]),

      rung('E/W RED: on through the whole N/S half (STEP1 or STEP2), and forced on by the master stop switch.',
        [BR([XIC('STEP1')], [XIC('STEP2')], [XIC('SW_STOP')]), OTE('EW_RED')])
    ]
  };

  /* ======================================================================
   * 2 — stoplight_ped
   * Program 1 plus pedestrian crossings. A button press LATCHES a request
   * (REQ_NS / REQ_EW); the request is granted only at the scan the matching
   * green step BEGINS (ONS on the step bit). A press made during a green
   * is therefore held for the NEXT green - the one-shot has already fired.
   * ==================================================================== */
  var STOPLIGHT_PED = {
    id: 'stoplight_ped',
    name: '2 — Stoplight + Pedestrian Crossing',
    description: 'Timed stoplight with latched walk requests, granted only at the start of the matching green.',
    usesMotor: false,
    notes:
      'PHASE PLAN: same 22 s cycle as program 1 (greens 8000 ms, yellows 3000 ms). ' +
      'Walk timers T_WNS / T_WEW = 4000 ms, so WALK ends 4 s before its green does.\n' +
      'TEACHING NOTE: watch rung 12 (the ONS grant rung) in step mode at the scan ' +
      'STEP1 gets latched: the one-shot passes power for exactly that one scan, so a ' +
      'request latched mid-green waits for the NEXT green - press PED_NS while NS is ' +
      'already green and watch REQ_NS sit latched for a full cycle. That is correct ' +
      'traffic-engineering behavior, not a bug: pedestrians must get their full 4 s.',
    rungs: [
      rung('Power-up: latch STEP1 when no step is active (same sequencer core as program 1).',
        [XIO('STEP1'), XIO('STEP2'), XIO('STEP3'), XIO('STEP4'), OTL('STEP1')]),

      rung('A press on PED_NS latches a walk request. The latch remembers the press however brief it was.',
        [XIC('PED_NS'), OTL('REQ_NS')]),

      rung('A press on PED_EW latches the E/W walk request.',
        [XIC('PED_EW'), OTL('REQ_EW')]),

      rung('STEP 1 - N/S green, 8 s (timer at rest during a master stop).',
        [XIC('STEP1'), XIO('SW_STOP'), TON('T_NSG', 8000)]),

      rung('N/S green done: advance to STEP2.',
        [XIC('T_NSG.DN'), OTL('STEP2'), OTU('STEP1')]),

      rung('STEP 2 - N/S yellow, 3 s.',
        [XIC('STEP2'), XIO('SW_STOP'), TON('T_NSY', 3000)]),

      rung('N/S yellow done: advance to STEP3.',
        [XIC('T_NSY.DN'), OTL('STEP3'), OTU('STEP2')]),

      rung('STEP 3 - E/W green, 8 s.',
        [XIC('STEP3'), XIO('SW_STOP'), TON('T_EWG', 8000)]),

      rung('E/W green done: advance to STEP4.',
        [XIC('T_EWG.DN'), OTL('STEP4'), OTU('STEP3')]),

      rung('STEP 4 - E/W yellow, 3 s.',
        [XIC('STEP4'), XIO('SW_STOP'), TON('T_EWY', 3000)]),

      rung('Cycle complete: back to STEP1.',
        [XIC('T_EWY.DN'), OTL('STEP1'), OTU('STEP4')]),

      rung('WALK GRANT, N/S: the ONS fires for exactly ONE scan when STEP1 begins. If a request is latched at that moment, grant the walk and consume the request. A press later in the green waits for the next cycle.',
        [XIC('STEP1'), ONS('ONS_NS'), XIC('REQ_NS'), OTL('WALK_NS'), OTU('REQ_NS')]),

      rung('N/S walk timer: WALK_NS shows for 4 s.',
        [XIC('WALK_NS'), TON('T_WNS', 4000)]),

      rung('4 s of walk served: back to DON\'T WALK (WALK_NS off = the sim shows the orange hand).',
        [XIC('T_WNS.DN'), OTU('WALK_NS')]),

      rung('WALK GRANT, E/W: mirror of the N/S grant, one-shot at the scan STEP3 begins.',
        [XIC('STEP3'), ONS('ONS_EW'), XIC('REQ_EW'), OTL('WALK_EW'), OTU('REQ_EW')]),

      rung('E/W walk timer: WALK_EW shows for 4 s.',
        [XIC('WALK_EW'), TON('T_WEW', 4000)]),

      rung('E/W walk served: back to DON\'T WALK.',
        [XIC('T_WEW.DN'), OTU('WALK_EW')]),

      rung('Master stop: pedestrians get DON\'T WALK in both directions while the intersection is held all-red.',
        [XIC('SW_STOP'), OTU('WALK_NS'), OTU('WALK_EW')]),

      rung('N/S GREEN lamp with the cross-interlock (XIO EW_GRN) and master-stop blanking.',
        [XIC('STEP1'), XIO('SW_STOP'), XIO('EW_GRN'), OTE('NS_GRN')]),

      rung('N/S YELLOW lamp during STEP2.',
        [XIC('STEP2'), XIO('SW_STOP'), OTE('NS_YEL')]),

      rung('E/W GREEN lamp, cross-interlocked against NS_GRN.',
        [XIC('STEP3'), XIO('SW_STOP'), XIO('NS_GRN'), OTE('EW_GRN')]),

      rung('E/W YELLOW lamp during STEP4.',
        [XIC('STEP4'), XIO('SW_STOP'), OTE('EW_YEL')]),

      rung('N/S RED through the E/W half of the cycle, or during a master stop.',
        [BR([XIC('STEP3')], [XIC('STEP4')], [XIC('SW_STOP')]), OTE('NS_RED')]),

      rung('E/W RED through the N/S half of the cycle, or during a master stop.',
        [BR([XIC('STEP1')], [XIC('STEP2')], [XIC('SW_STOP')]), OTE('EW_RED')])
    ]
  };

  /* ======================================================================
   * 3 — stoplight_sensor
   * Traffic-actuated: the controller RESTS in N/S green. Only when a car
   * is on the E/W loop AND the minimum green (4 s) has been served does it
   * advance: NS yellow 3 s -> EW green fixed 8 s -> EW yellow 3 s -> back
   * to the N/S rest. Demand is deliberately NOT memorized (kept simple per
   * spec): the car must still be on the loop when minimum green completes.
   * ==================================================================== */
  var STOPLIGHT_SENSOR = {
    id: 'stoplight_sensor',
    name: '3 — Traffic-Actuated Stoplight (Loop Sensor)',
    description: 'Rests in NS green; a car on the EW loop (after 4 s minimum green) gets a fixed 8 s EW green.',
    usesMotor: false,
    notes:
      'PHASE PLAN: rest in NS green (minimum green T_MING = 4000 ms) -> when LOOP_EW ' +
      'is true and minimum green is served: NS yellow 3000 ms -> EW green fixed ' +
      '8000 ms -> EW yellow 3000 ms -> back to the NS-green rest. (The EW yellow is ' +
      'not in the spec\'s one-line phase list but no real intersection ends a green ' +
      'without one - it is included deliberately.)\n' +
      'TEACHING NOTE: watch rung 3 with a car parked on the loop from power-up: the ' +
      'transition rung sits with TWO of its three contacts made (STEP1, LOOP_EW) and ' +
      'only fires when T_MING.DN closes at 4 s - minimum green is exactly the same ' +
      'trick as the phase timers, just used as a permission instead of a trigger. ' +
      'Demand is not latched: a car that drives off the loop before 4 s is forgotten.',
    rungs: [
      rung('Power-up: latch STEP1 (the N/S-green REST state) when no step is active.',
        [XIO('STEP1'), XIO('STEP2'), XIO('STEP3'), XIO('STEP4'), OTL('STEP1')]),

      rung('Minimum green: T_MING guarantees N/S keeps its green at least 4 s no matter how quickly a car shows up.',
        [XIC('STEP1'), XIO('SW_STOP'), TON('T_MING', 4000)]),

      rung('DEMAND transition: leave the rest state only when the minimum green is served AND a car is actually on the E/W loop.',
        [XIC('STEP1'), XIC('T_MING.DN'), XIC('LOOP_EW'), OTL('STEP2'), OTU('STEP1')]),

      rung('STEP 2 - N/S yellow, 3 s.',
        [XIC('STEP2'), XIO('SW_STOP'), TON('T_NSY', 3000)]),

      rung('N/S yellow done: give E/W its green.',
        [XIC('T_NSY.DN'), OTL('STEP3'), OTU('STEP2')]),

      rung('STEP 3 - E/W green, fixed 8 s (kept simple per spec: no early gap-out).',
        [XIC('STEP3'), XIO('SW_STOP'), TON('T_EWG', 8000)]),

      rung('E/W green done: E/W yellow next.',
        [XIC('T_EWG.DN'), OTL('STEP4'), OTU('STEP3')]),

      rung('STEP 4 - E/W yellow, 3 s.',
        [XIC('STEP4'), XIO('SW_STOP'), TON('T_EWY', 3000)]),

      rung('Back to the N/S-green rest state; the minimum-green timer starts over.',
        [XIC('T_EWY.DN'), OTL('STEP1'), OTU('STEP4')]),

      rung('N/S GREEN lamp with cross-interlock and master-stop blanking.',
        [XIC('STEP1'), XIO('SW_STOP'), XIO('EW_GRN'), OTE('NS_GRN')]),

      rung('N/S YELLOW lamp during STEP2.',
        [XIC('STEP2'), XIO('SW_STOP'), OTE('NS_YEL')]),

      rung('E/W GREEN lamp, cross-interlocked against NS_GRN.',
        [XIC('STEP3'), XIO('SW_STOP'), XIO('NS_GRN'), OTE('EW_GRN')]),

      rung('E/W YELLOW lamp during STEP4.',
        [XIC('STEP4'), XIO('SW_STOP'), OTE('EW_YEL')]),

      rung('N/S RED during the E/W phases, or during a master stop.',
        [BR([XIC('STEP3')], [XIC('STEP4')], [XIC('SW_STOP')]), OTE('NS_RED')]),

      rung('E/W RED during the N/S phases, or during a master stop.',
        [BR([XIC('STEP1')], [XIC('STEP2')], [XIC('SW_STOP')]), OTE('EW_RED')])
    ]
  };

  /* ======================================================================
   * 4 — stoplight_night
   * Program 1 gated by XIO SW_NIGHT, plus the classic two-timer flasher:
   *   flasher rung A: XIC SW_NIGHT, XIO T_FB.DN -> TON T_FA (500 ms)
   *   flasher rung B: XIC T_FA.DN            -> TON T_FB (500 ms)
   *   FLASH = T_FA.DN
   * T_FA times 500 ms then holds DN while T_FB times its own 500 ms; when
   * T_FB.DN closes, rung A goes false, both timers reset, and the pair
   * starts over: ~500 ms on / ~500 ms off forever. At night NS_YEL and
   * EW_RED show FLASH; every other lamp is dark.
   * ==================================================================== */
  var STOPLIGHT_NIGHT = {
    id: 'stoplight_night',
    name: '4 — Stoplight with Night Flasher',
    description: 'Normal cycling by day; at night NS flashes yellow and EW flashes red (500 ms on / 500 ms off).',
    usesMotor: false,
    notes:
      'PHASE PLAN (day): same 22 s cycle as program 1 (greens 8000 ms, yellows ' +
      '3000 ms). NIGHT (SW_NIGHT on): two-timer flasher T_FA / T_FB = 500 ms each; ' +
      'NS_YEL and EW_RED flash together 0.5 s on / 0.5 s off; all other lamps dark. ' +
      'Day cycling resumes from the step that was latched when night began.\n' +
      'TEACHING NOTE: watch rungs 10 and 11 (the flasher pair) in step mode: T_FA ' +
      'times 500 ms and then HOLDS its DN bit while T_FB times the off-delay ... ' +
      'until T_FB.DN breaks rung 10, which resets T_FA, which resets T_FB one rung ' +
      'later - a two-timer oscillator with no moving parts. Ask the class what ' +
      'happens if T_FA\'s preset were (nearly) zero, then try it in Troubleshoot mode.',
    rungs: [
      rung('Power-up: latch STEP1 when no step is active. Steps stay latched at night; day cycling resumes where it left off.',
        [XIO('STEP1'), XIO('STEP2'), XIO('STEP3'), XIO('STEP4'), OTL('STEP1')]),

      rung('STEP 1 - N/S green, 8 s. XIO SW_NIGHT holds the whole sequencer at rest during night mode.',
        [XIC('STEP1'), XIO('SW_STOP'), XIO('SW_NIGHT'), TON('T_NSG', 8000)]),

      rung('N/S green done: advance to STEP2.',
        [XIC('T_NSG.DN'), OTL('STEP2'), OTU('STEP1')]),

      rung('STEP 2 - N/S yellow, 3 s.',
        [XIC('STEP2'), XIO('SW_STOP'), XIO('SW_NIGHT'), TON('T_NSY', 3000)]),

      rung('N/S yellow done: advance to STEP3.',
        [XIC('T_NSY.DN'), OTL('STEP3'), OTU('STEP2')]),

      rung('STEP 3 - E/W green, 8 s.',
        [XIC('STEP3'), XIO('SW_STOP'), XIO('SW_NIGHT'), TON('T_EWG', 8000)]),

      rung('E/W green done: advance to STEP4.',
        [XIC('T_EWG.DN'), OTL('STEP4'), OTU('STEP3')]),

      rung('STEP 4 - E/W yellow, 3 s.',
        [XIC('STEP4'), XIO('SW_STOP'), XIO('SW_NIGHT'), TON('T_EWY', 3000)]),

      rung('Cycle complete: back to STEP1.',
        [XIC('T_EWY.DN'), OTL('STEP1'), OTU('STEP4')]),

      rung('FLASHER rung A: T_FA times 500 ms whenever it is night and T_FB has not finished. T_FB.DN breaking this rung is what resets the pair.',
        [XIC('SW_NIGHT'), XIO('T_FB.DN'), TON('T_FA', 500)]),

      rung('FLASHER rung B: once T_FA is done, T_FB times the 500 ms OFF half of the blink.',
        [XIC('T_FA.DN'), TON('T_FB', 500)]),

      rung('FLASH follows T_FA.DN: on ~500 ms, off ~500 ms. Kept as a named bit so the watch window shows the blink directly.',
        [XIC('T_FA.DN'), OTE('FLASH')]),

      rung('N/S GREEN lamp - day only (XIO SW_NIGHT), with cross-interlock and master-stop blanking.',
        [XIC('STEP1'), XIO('SW_STOP'), XIO('SW_NIGHT'), XIO('EW_GRN'), OTE('NS_GRN')]),

      rung('N/S YELLOW: by day it is the STEP2 lamp; at night it is the flasher. One OTE, two branch paths.',
        [BR([XIC('STEP2'), XIO('SW_STOP'), XIO('SW_NIGHT')], [XIC('SW_NIGHT'), XIC('FLASH')]), OTE('NS_YEL')]),

      rung('E/W GREEN lamp - day only, cross-interlocked against NS_GRN.',
        [XIC('STEP3'), XIO('SW_STOP'), XIO('SW_NIGHT'), OTE('EW_GRN')]),

      rung('E/W YELLOW lamp - day only.',
        [XIC('STEP4'), XIO('SW_STOP'), XIO('SW_NIGHT'), OTE('EW_YEL')]),

      rung('N/S RED - day only: the E/W half of the cycle or a master stop. Dark at night (the night indication for N/S is the flashing yellow).',
        [BR([XIC('STEP3')], [XIC('STEP4')], [XIC('SW_STOP')]), XIO('SW_NIGHT'), OTE('NS_RED')]),

      rung('E/W RED: by day the N/S half of the cycle or a master stop; at night it is the flasher (E/W must treat the intersection as a stop sign).',
        [BR([XIC('STEP1'), XIO('SW_NIGHT')], [XIC('STEP2'), XIO('SW_NIGHT')], [XIC('SW_STOP'), XIO('SW_NIGHT')], [XIC('SW_NIGHT'), XIC('FLASH')]), OTE('EW_RED')])
    ]
  };

  /* ======================================================================
   * 5 — motor_sealin
   * THE classic first ladder: momentary START is paralleled by the motor's
   * own contact (the seal-in); a normally-closed-style XIO on STOP breaks
   * the seal. Plus a start counter as the optional comment-rich extra.
   * ==================================================================== */
  var MOTOR_SEALIN = {
    id: 'motor_sealin',
    name: '5 — Motor Seal-In (Start/Stop)',
    description: 'Momentary START latches the motor through its own seal-in contact; STOP breaks the seal.',
    usesMotor: true,
    notes:
      'No timed phases - this one is about the seal-in. Press PB_START: power flows ' +
      'through the top branch path, energizes MOTOR, and from the NEXT scan the ' +
      'XIC MOTOR path carries the power instead, so the button can be released. ' +
      'XIO PB_STOP passes power while the stop button is NOT pressed - classic ' +
      'stop-circuit wiring, and fail-safe-shaped: anything that opens that contact ' +
      'stops the motor.\n' +
      'TEACHING NOTE: run in step mode and watch rung 1 the scan after you release ' +
      'PB_START - the highlight moves from the top branch path to the seal-in path. ' +
      'That picture IS the seal-in concept. Rung 2 counts motor starts (CTU is ' +
      'edge-triggered, so it adds exactly one per start, not one per scan).',
    rungs: [
      rung('Seal-in: (PB_START OR the motor\'s own contact) AND stop-not-pressed drives the motor. The XIC MOTOR path is the seal that keeps it running after the button is released.',
        [BR([XIC('PB_START')], [XIC('MOTOR')]), XIO('PB_STOP'), OTE('MOTOR')]),

      rung('Maintenance extra: count motor starts. CTU counts rising edges of MOTOR - flag for inspection after 10 starts (C_STARTS.DN).',
        [XIC('MOTOR'), CTU('C_STARTS', 10)])
    ]
  };

  /* ======================================================================
   * 6A / 6B — scan_order_demo
   * Two 2-rung programs that differ ONLY in rung order, proving the scan
   * order matters. The app shows them as one menu entry with an A/B
   * switch: each entry's `variantOf` names its partner (mutual link),
   * and `variant` gives the letter for the switch label.
   * ==================================================================== */
  var SCAN_ORDER_A = {
    id: 'scan_order_demo_a',
    name: '6A — Scan Order Demo (echo lags one scan)',
    description: 'The echo rung is ABOVE the source rung, so B_ECHO lags PB_START by one full scan.',
    usesMotor: false,
    variant: 'A',
    variantOf: 'scan_order_demo_b',
    notes:
      'WHAT TO WATCH (use Step Scan with the Image Tables open): hold PB_START, then ' +
      'step ONE scan - B_SRC turns on but B_ECHO does not, because rung 1 read B_SRC ' +
      'BEFORE rung 2 wrote it. Step again: now B_ECHO follows. Release PB_START and ' +
      'the same one-scan lag shows on the way off. Rungs are solved strictly top to ' +
      'bottom every scan; a bit written by a LOWER rung is not seen by an UPPER rung ' +
      'until the next scan. Compare with variant B - same two rungs, swapped.',
    rungs: [
      rung('Echo rung FIRST: reads B_SRC as it was at this point in the scan - the value written LAST scan by the rung below.',
        [XIC('B_SRC'), OTE('B_ECHO')]),

      rung('Source rung SECOND: copies PB_START into B_SRC. The rung above will not see this write until the next scan.',
        [XIC('PB_START'), OTE('B_SRC')])
    ]
  };

  var SCAN_ORDER_B = {
    id: 'scan_order_demo_b',
    name: '6B — Scan Order Demo (echo follows same scan)',
    description: 'Same two rungs as 6A but source ABOVE echo, so B_ECHO updates in the same scan.',
    usesMotor: false,
    variant: 'B',
    variantOf: 'scan_order_demo_a',
    notes:
      'WHAT TO WATCH (use Step Scan with the Image Tables open): hold PB_START and ' +
      'step ONE scan - B_SRC and B_ECHO turn on TOGETHER, because rung 2 reads the ' +
      'value rung 1 wrote moments earlier in the SAME scan. This is the exact same ' +
      'pair of rungs as variant A with the order swapped; the one-scan lag is gone. ' +
      'Rule of thumb this pair teaches: data should flow DOWN the ladder - producers ' +
      'above consumers - unless you want last-scan values on purpose.',
    rungs: [
      rung('Source rung FIRST: copies PB_START into B_SRC.',
        [XIC('PB_START'), OTE('B_SRC')]),

      rung('Echo rung SECOND: reads the B_SRC value written a moment ago in this same scan - no lag.',
        [XIC('B_SRC'), OTE('B_ECHO')])
    ]
  };

  /* ======================================================================
   * Public surface
   * ==================================================================== */
  var list = [
    STOPLIGHT_BASIC,
    STOPLIGHT_PED,
    STOPLIGHT_SENSOR,
    STOPLIGHT_NIGHT,
    MOTOR_SEALIN,
    SCAN_ORDER_A,
    SCAN_ORDER_B
  ];

  var byIdMap = {};
  list.forEach(function (p) { byIdMap[p.id] = p; });

  LL.Programs = {
    list: list,
    /** byId(id) -> the pristine program JSON (read-only by convention) or null. */
    byId: function (id) { return byIdMap[id] || null; }
  };

  // Node export (same pattern as engine.js): the namespace object itself.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LL;
  }
})();
