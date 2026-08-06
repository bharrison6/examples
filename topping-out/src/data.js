/* =====================================================================
   TOPPING OUT — PROJECT DATA
   Activity networks, crew definitions, event deck, money constants.

   Units:
     duration / work  ......  WORKING DAYS (5 per project week, Mon-Fri)
     money  ................  US dollars
     calendar days .........  derived: cal(d) = 7*floor(d/5) + (d%5)

   Relationship types: FS (finish-to-start), SS (start-to-start),
   FF (finish-to-finish). `lag` is in working days and may be 0.

   `fixed: true`   -> non-compressible. Concrete cure and inspection
                      holds. No crew, no overtime, no expediting can
                      shorten these. Enforced in engine.js.
   `weather: true` -> rain days consume working days on this activity.
                      Only earthwork, concrete placement, roofing and
                      envelope carry this flag.
   ===================================================================== */

const TRADES = {
  general:   { name: 'General / Laborers', weekly: 11000, short: 'GEN', color: '#7a8899' },
  earthwork: { name: 'Earthwork',          weekly: 16500, short: 'EARTH', color: '#a9761f' },
  concrete:  { name: 'Concrete',           weekly: 19000, short: 'CONC', color: '#6d7278' },
  steel:     { name: 'Steel Erection',     weekly: 24000, short: 'STEEL', color: '#3f5b78' },
  roofing:   { name: 'Roofing',            weekly: 14500, short: 'ROOF', color: '#7d4b3a' },
  envelope:  { name: 'Envelope / Glazing', weekly: 18500, short: 'ENVEL', color: '#2f7d78' },
  mep:       { name: 'MEP',                weekly: 21000, short: 'MEP', color: '#8a5a9e' },
  drywall:   { name: 'Drywall',            weekly: 13500, short: 'DRY', color: '#b08a4a' },
  finish:    { name: 'Finishes',           weekly: 15000, short: 'FINISH', color: '#4a8f52' },
  elevator:  { name: 'Elevator',           weekly: 17000, short: 'ELEV', color: '#9e5a5a' }
};

/* Zones hold a limited number of crews. Exceeding the cap is
   "trade stacking": every crew in that zone loses productivity. */
const ZONES = {
  SITE: { name: 'Site / Below Grade', cap: 3 },
  L1:   { name: 'Level 1',            cap: 2 },
  L2:   { name: 'Level 2',            cap: 2 },
  L3:   { name: 'Level 3',            cap: 2 },
  ROOF: { name: 'Roof',               cap: 2 },
  EXT:  { name: 'Exterior Envelope',  cap: 2 }
};

/* ---------------------------------------------------------------
   MAIN PROJECT — "Calloway Commons", 3-story commercial building
   38 activities.
   --------------------------------------------------------------- */
const MAIN_NETWORK = {
  id: 'main',
  name: 'Racer Commons — Chestnut Street',
  contractValue: 4450000,
  contractWorkingDays: 134,      // contract completion, working days
  fixedCost: 2600000,            // subcontract buyout + materials, committed at award
  gcPerCalendarDay: 3600,        // general conditions burn
  ldPerCalendarDay: 14000,       // liquidated damages — deliberately steep, see guide
  earlyBonusPerCalendarDay: 1600,
  earlyBonusCapDays: 20,
  startDate: '2026-09-07',       // a Monday
  /* ---- cash flow -------------------------------------------------
     You bill the owner monthly for work in place; they pay 30 days
     later and hold retainage until closeout. Costs go out weekly.
     The gap is financed on a line of credit, and the interest is real
     money off the score. Being profitable on paper and unable to make
     payroll is the oldest way a contractor dies, and now the game can
     teach it. */
  cash: {
    billingWeeks: 4,             // pay application every 4 project weeks
    payLagWeeks: 4,              // owner pays ~30 days after the app
    retainage: 0.05,             // held until closeout
    retainageLagWeeks: 2,        // released this long after completion
    locRatePerWeek: 0.0018       // line-of-credit interest, ~9.4% APR
  },
  activities: [
    // id, name, trade, zone, work (crew-days at 1 standard crew), maxCrews
    { id: 'MOB',   name: 'Mobilization & site setup',      trade: 'general',   zone: 'SITE', role: 'mobilize', work: 3,  maxCrews: 1, preds: [] },
    { id: 'EXC',   name: 'Excavation & mass grading',      trade: 'earthwork', zone: 'SITE', role: 'excavate', work: 5,  maxCrews: 2, weather: true,
      preds: [{ id: 'MOB', type: 'FS', lag: 0 }] },
    { id: 'FTG',   name: 'Footings — form, rebar, pour',   trade: 'concrete',  zone: 'SITE', role: 'footing', work: 6,  maxCrews: 2, weather: true,
      preds: [{ id: 'EXC', type: 'SS', lag: 3 }] },
    { id: 'FTGC',  name: 'Footing cure & strip',           trade: null,        zone: 'SITE', role: 'footing', work: 4,  maxCrews: 0, fixed: true, kind: 'cure',
      preds: [{ id: 'FTG', type: 'FS', lag: 0 }] },
    { id: 'UGU',   name: 'Underground utilities',          trade: 'earthwork', zone: 'SITE', role: 'underground', work: 5,  maxCrews: 2, weather: true,
      preds: [{ id: 'EXC', type: 'SS', lag: 4 }] },
    { id: 'FDW',   name: 'Foundation walls',               trade: 'concrete',  zone: 'SITE', role: 'wall', work: 6,  maxCrews: 2, weather: true,
      preds: [{ id: 'FTGC', type: 'FS', lag: 0 }] },
    { id: 'FDWC',  name: 'Foundation wall cure & strip',   trade: null,        zone: 'SITE', role: 'wall', work: 4,  maxCrews: 0, fixed: true, kind: 'cure',
      preds: [{ id: 'FDW', type: 'FS', lag: 0 }] },
    { id: 'INSP1', name: 'Foundation inspection hold',     trade: null,        zone: 'SITE', work: 2,  maxCrews: 0, fixed: true, kind: 'inspection',
      preds: [{ id: 'FDWC', type: 'FS', lag: 0 }] },
    { id: 'BKF',   name: 'Backfill & compaction',          trade: 'earthwork', zone: 'SITE', role: 'backfill', work: 3,  maxCrews: 2, weather: true,
      preds: [{ id: 'INSP1', type: 'FS', lag: 0 }, { id: 'UGU', type: 'FS', lag: 0 }] },
    { id: 'SOG',   name: 'Slab on grade',                  trade: 'concrete',  zone: 'L1', role: 'slab',   work: 4,  maxCrews: 2, weather: true,
      preds: [{ id: 'BKF', type: 'FS', lag: 0 }] },
    { id: 'SOGC',  name: 'Slab cure',                      trade: null,        zone: 'L1', role: 'slab',   work: 5,  maxCrews: 0, fixed: true, kind: 'cure',
      preds: [{ id: 'SOG', type: 'FS', lag: 0 }] },

    { id: 'STL1',  name: 'Steel erection — Level 1',       trade: 'steel',     zone: 'L1', role: 'structure',   work: 5,  maxCrews: 1,
      preds: [{ id: 'FDWC', type: 'FS', lag: 0 }] },
    { id: 'STL2',  name: 'Steel erection — Level 2',       trade: 'steel',     zone: 'L2', role: 'structure',   work: 5,  maxCrews: 1,
      preds: [{ id: 'STL1', type: 'SS', lag: 4 }] },
    { id: 'STL3',  name: 'Steel erection — Level 3',       trade: 'steel',     zone: 'L3', role: 'structure',   work: 5,  maxCrews: 1,
      preds: [{ id: 'STL2', type: 'SS', lag: 4 }] },
    { id: 'DECK2', name: 'Deck & pour — Level 2',          trade: 'concrete',  zone: 'L2', role: 'deck',   work: 4,  maxCrews: 2,
      preds: [{ id: 'STL2', type: 'FS', lag: 0 }] },
    { id: 'DECK3', name: 'Deck & pour — Level 3',          trade: 'concrete',  zone: 'L3', role: 'deck',   work: 4,  maxCrews: 2,
      preds: [{ id: 'STL3', type: 'FS', lag: 0 }, { id: 'DECK2', type: 'FS', lag: 0 }] },
    { id: 'DECKR', name: 'Roof deck',                      trade: 'steel',     zone: 'ROOF', role: 'roofdeck', work: 3,  maxCrews: 1,
      preds: [{ id: 'STL3', type: 'FS', lag: 0 }] },
    { id: 'DKC',   name: 'Deck concrete cure',             trade: null,        zone: 'L3',   work: 4,  maxCrews: 0, fixed: true, kind: 'cure',
      preds: [{ id: 'DECK3', type: 'FS', lag: 0 }] },
    { id: 'INSP2', name: 'Structural inspection hold',     trade: null,        zone: 'L3',   work: 2,  maxCrews: 0, fixed: true, kind: 'inspection',
      preds: [{ id: 'DKC', type: 'FS', lag: 0 }, { id: 'DECKR', type: 'FS', lag: 0 }] },

    { id: 'ROOF',  name: 'Roofing membrane & flashing',    trade: 'roofing',   zone: 'ROOF', role: 'roofing', work: 6,  maxCrews: 1, weather: true,
      preds: [{ id: 'DECKR', type: 'FS', lag: 0 }] },
    { id: 'ENV1',  name: 'Exterior framing & sheathing',   trade: 'envelope',  zone: 'EXT', role: 'sheathing',  work: 8,  maxCrews: 2, weather: true,
      preds: [{ id: 'INSP2', type: 'FS', lag: 0 }] },
    { id: 'ENV2',  name: 'Curtain wall & glazing',         trade: 'envelope',  zone: 'EXT', role: 'glazing',  work: 8, maxCrews: 2, weather: true,
      preds: [{ id: 'ENV1', type: 'SS', lag: 5 }, { id: 'ROOF', type: 'FS', lag: 0 }] },

    { id: 'MEP1',  name: 'MEP rough-in — Level 1',         trade: 'mep',       zone: 'L1', role: 'mep',   work: 6, maxCrews: 2,
      preds: [{ id: 'SOGC', type: 'FS', lag: 0 }, { id: 'DECK2', type: 'FS', lag: 0 }] },
    { id: 'MEP2',  name: 'MEP rough-in — Level 2',         trade: 'mep',       zone: 'L2', role: 'mep',   work: 6, maxCrews: 2,
      preds: [{ id: 'MEP1', type: 'SS', lag: 2 }, { id: 'DECK3', type: 'FS', lag: 0 }] },
    { id: 'MEP3',  name: 'MEP rough-in — Level 3',         trade: 'mep',       zone: 'L3', role: 'mep',   work: 6, maxCrews: 2,
      preds: [{ id: 'MEP2', type: 'SS', lag: 2 }, { id: 'INSP2', type: 'FS', lag: 0 }] },
    { id: 'ELEV',  name: 'Elevator install & certify',     trade: 'elevator',  zone: 'L1', role: 'elevator',   work: 12, maxCrews: 1,
      preds: [{ id: 'INSP2', type: 'FS', lag: 0 }] },
    { id: 'INSP3', name: 'MEP rough inspection hold',      trade: null,        zone: 'L2',   work: 3,  maxCrews: 0, fixed: true, kind: 'inspection',
      preds: [{ id: 'MEP3', type: 'FS', lag: 0 }] },

    { id: 'INSUL', name: 'Insulation & vapor barrier',     trade: 'drywall',   zone: 'L1',   work: 3,  maxCrews: 2,
      preds: [{ id: 'INSP3', type: 'FS', lag: 0 }, { id: 'ENV2', type: 'FS', lag: 0 }] },
    { id: 'DRY1',  name: 'Drywall hang & finish — L1',     trade: 'drywall',   zone: 'L1', role: 'partitions',   work: 5,  maxCrews: 2,
      preds: [{ id: 'INSUL', type: 'FS', lag: 0 }] },
    { id: 'DRY2',  name: 'Drywall hang & finish — L2',     trade: 'drywall',   zone: 'L2', role: 'partitions',   work: 5,  maxCrews: 2,
      preds: [{ id: 'DRY1', type: 'SS', lag: 2 }] },
    { id: 'DRY3',  name: 'Drywall hang & finish — L3',     trade: 'drywall',   zone: 'L3', role: 'partitions',   work: 5,  maxCrews: 2,
      preds: [{ id: 'DRY2', type: 'SS', lag: 2 }] },
    { id: 'FIN1',  name: 'Interior finishes — L1',         trade: 'finish',    zone: 'L1', role: 'finishes',   work: 6, maxCrews: 2,
      preds: [{ id: 'DRY1', type: 'FS', lag: 0 }] },
    { id: 'FIN2',  name: 'Interior finishes — L2',         trade: 'finish',    zone: 'L2', role: 'finishes',   work: 6, maxCrews: 2,
      preds: [{ id: 'DRY2', type: 'FS', lag: 0 }, { id: 'FIN1', type: 'SS', lag: 2 }] },
    { id: 'FIN3',  name: 'Interior finishes — L3',         trade: 'finish',    zone: 'L3', role: 'finishes',   work: 6, maxCrews: 2,
      preds: [{ id: 'DRY3', type: 'FS', lag: 0 }, { id: 'FIN2', type: 'SS', lag: 2 }] },

    { id: 'SITEW', name: 'Sitework, paving & landscape',   trade: 'earthwork', zone: 'SITE', role: 'sitework', work: 6,  maxCrews: 2, weather: true,
      preds: [{ id: 'ENV1', type: 'SS', lag: 10 }, { id: 'BKF', type: 'FS', lag: 0 }] },
    { id: 'COMM',  name: 'MEP commissioning & testing',    trade: 'mep',       zone: 'L1',   work: 4,  maxCrews: 1,
      preds: [{ id: 'INSP3', type: 'FS', lag: 0 }, { id: 'FIN3', type: 'FF', lag: 2 }] },
    { id: 'INSP4', name: 'Final inspection & C of O',      trade: null,        zone: 'L1',   work: 3,  maxCrews: 0, fixed: true, kind: 'inspection',
      preds: [{ id: 'COMM', type: 'FS', lag: 0 }, { id: 'ELEV', type: 'FS', lag: 0 }, { id: 'SITEW', type: 'FS', lag: 0 }] },
    { id: 'PUNCH', name: 'Punchlist & closeout',           trade: 'finish',    zone: 'L1',   work: 4,  maxCrews: 2,
      preds: [{ id: 'INSP4', type: 'FS', lag: 0 }] }
  ],
  /* Crews the team starts with. Idle crews still bill. */
  startingCrews: {
    general: 1, earthwork: 1, concrete: 1, steel: 1, roofing: 1,
    envelope: 1, mep: 1, drywall: 1, finish: 1, elevator: 1
  },
  maxHire: {
    general: 1, earthwork: 2, concrete: 2, steel: 1, roofing: 1,
    envelope: 2, mep: 2, drywall: 2, finish: 2, elevator: 1
  }
};

/* ---------------------------------------------------------------
   TUTORIAL PROJECT — 10 activities, ~8 weeks.
   Teaches the loop and the views.

   HAND-CALCULATED CPM (verification #1). All durations in working
   days, 1 crew each, no events. Project start = day 0.

   Network:
     T1 Mobilize            dur 3   preds: -
     T2 Excavate            dur 5   preds: T1 FS 0
     T3 Footings            dur 6   preds: T2 SS 2
     T4 Cure (fixed)        dur 4   preds: T3 FS 0
     T5 Utilities           dur 4   preds: T2 FS 0
     T6 Slab                dur 5   preds: T4 FS 0, T5 FS 0
     T7 Inspection (fixed)  dur 2   preds: T6 FS 0
     T8 Steel frame         dur 7   preds: T4 FS 0
     T9 Roof                dur 4   preds: T8 FS 0, T7 FS 0
     T10 Closeout           dur 3   preds: T9 FS 0, T6 FF 1

   FORWARD PASS
     T1  ES 0   EF 3
     T2  ES 3   EF 8            (T1 FS0 -> 3)
     T3  ES 5   EF 11           (T2 SS2 -> 3+2 = 5)
     T4  ES 11  EF 15           (T3 FS0)
     T5  ES 8   EF 12           (T2 FS0)
     T6  ES 15  EF 20           (max of T4 EF 15, T5 EF 12)
     T7  ES 20  EF 22           (T6 FS0)
     T8  ES 15  EF 22           (T4 FS0)
     T9  ES 22  EF 26           (max of T8 EF 22, T7 EF 22)
     T10 ES 26  EF 29           (T9 FS0 -> 26; T6 FF1 -> EF >= 20+1=21 -> ES >= 18)
   PROJECT DURATION = 29 working days

   BACKWARD PASS (LF of terminal = 29)
     T10 LF 29  LS 26
     T9  LF 26  LS 22           (T10 FS0: LS(T10) - 0 = 26)
     T8  LF 22  LS 15           (T9 FS0: 22)
     T7  LF 22  LS 20           (T9 FS0: 22)
     T6  LF 20  LS 15           (T7 FS0: LS(T7)=20; T10 FF1: LF(T10)-1 = 28; min = 20)
     T5  LF 15  LS 11           (T6 FS0: LS(T6)=15)
     T4  LF 15  LS 11           (T6 FS0: 15; T8 FS0: LS(T8)=15; min 15)
     T3  LF 11  LS 5            (T4 FS0: LS(T4)=11)
     T2  LF 8   LS 3            (T5 FS0: LS(T5)=11; T3 SS2: LS(T3)-2+dur(T2) = 5-2+5 = 8; min 8)
     T1  LF 3   LS 0            (T2 FS0: LS(T2)=3)

   TOTAL FLOAT (LS - ES)
     T1 0   T2 0   T3 0   T4 0   T5 3   T6 0   T7 0   T8 0   T9 0   T10 0

   FREE FLOAT
     T1  min(ES(T2)-EF(T1)-0) = 3-3 = 0
     T2  FS to T5: ES(T5)-EF(T2) = 8-8 = 0 ; SS to T3: ES(T3)-ES(T2)-2 = 5-3-2 = 0  -> 0
     T3  ES(T4)-EF(T3) = 11-11 = 0
     T4  min(ES(T6)-EF(T4), ES(T8)-EF(T4)) = min(15-15, 15-15) = 0
     T5  ES(T6)-EF(T5) = 15-12 = 3
     T6  FS to T7: 20-20 = 0 ; FF to T10: EF(T10)-EF(T6)-1 = 29-20-1 = 8 -> 0
     T7  ES(T9)-EF(T7) = 22-22 = 0
     T8  ES(T9)-EF(T8) = 22-22 = 0
     T9  ES(T10)-EF(T9) = 26-26 = 0
     T10 terminal: 29-29 = 0

   CRITICAL PATH: T1 -> T2 -> T3 -> T4 -> T8 -> T9 -> T10
   (T6 and T7 also carry zero total float; the driving chain through
    T4 -> T8 -> T9 has the same length. Both are critical. T5 is the
    only activity with float, and it has 3 days.)
   --------------------------------------------------------------- */
const TUTORIAL_NETWORK = {
  id: 'tutorial',
  name: 'Tutorial — Shoe Tree Annex',
  contractValue: 780000,
  contractWorkingDays: 30,
  gcPerCalendarDay: 900,
  ldPerCalendarDay: 700,
  earlyBonusPerCalendarDay: 300,
  earlyBonusCapDays: 10,
  startDate: '2026-09-07',
  tutorial: true,
  cash: {
    billingWeeks: 4, payLagWeeks: 4, retainage: 0.05,
    retainageLagWeeks: 1, locRatePerWeek: 0.0018
  },
  activities: [
    { id: 'T1',  name: 'Mobilize',            trade: 'general',   zone: 'SITE', role: 'mobilize', work: 3, maxCrews: 1, preds: [] },
    { id: 'T2',  name: 'Excavate',            trade: 'earthwork', zone: 'SITE', role: 'excavate', work: 5, maxCrews: 2, weather: true,
      preds: [{ id: 'T1', type: 'FS', lag: 0 }] },
    { id: 'T3',  name: 'Footings',            trade: 'concrete',  zone: 'SITE', role: 'footing', work: 6, maxCrews: 2, weather: true,
      preds: [{ id: 'T2', type: 'SS', lag: 2 }] },
    { id: 'T4',  name: 'Footing cure',        trade: null,        zone: 'SITE', role: 'footing', work: 4, maxCrews: 0, fixed: true, kind: 'cure',
      preds: [{ id: 'T3', type: 'FS', lag: 0 }] },
    { id: 'T5',  name: 'Site utilities',      trade: 'earthwork', zone: 'SITE', role: 'underground', work: 4, maxCrews: 2, weather: true,
      preds: [{ id: 'T2', type: 'FS', lag: 0 }] },
    { id: 'T6',  name: 'Slab on grade',       trade: 'concrete',  zone: 'L1', role: 'slab',   work: 5, maxCrews: 2, weather: true,
      preds: [{ id: 'T4', type: 'FS', lag: 0 }, { id: 'T5', type: 'FS', lag: 0 }] },
    { id: 'T7',  name: 'Slab inspection',     trade: null,        zone: 'L1',   work: 2, maxCrews: 0, fixed: true, kind: 'inspection',
      preds: [{ id: 'T6', type: 'FS', lag: 0 }] },
    { id: 'T8',  name: 'Steel frame',         trade: 'steel',     zone: 'L1', role: 'structure',   work: 7, maxCrews: 1,
      preds: [{ id: 'T4', type: 'FS', lag: 0 }] },
    { id: 'T9',  name: 'Roof & dry-in',       trade: 'roofing',   zone: 'ROOF', role: 'roofing', work: 4, maxCrews: 1, weather: true,
      preds: [{ id: 'T8', type: 'FS', lag: 0 }, { id: 'T7', type: 'FS', lag: 0 }] },
    { id: 'T10', name: 'Closeout',            trade: 'finish',    zone: 'L1', role: 'finishes',   work: 3, maxCrews: 1,
      preds: [{ id: 'T9', type: 'FS', lag: 0 }, { id: 'T6', type: 'FF', lag: 1 }] }
  ],
  startingCrews: {
    general: 1, earthwork: 1, concrete: 1, steel: 1, roofing: 1, finish: 1
  },
  maxHire: {
    general: 1, earthwork: 2, concrete: 2, steel: 1, roofing: 1, finish: 1
  }
};

/* Expected CPM table for the tutorial, used by the self-test.
   [id, ES, EF, LS, LF, TF, FF] */
const TUTORIAL_EXPECTED_CPM = [
  ['T1',  0,  3,  0,  3, 0, 0],
  ['T2',  3,  8,  3,  8, 0, 0],
  ['T3',  5, 11,  5, 11, 0, 0],
  ['T4', 11, 15, 11, 15, 0, 0],
  ['T5',  8, 12, 11, 15, 3, 3],
  ['T6', 15, 20, 15, 20, 0, 0],
  ['T7', 20, 22, 20, 22, 0, 0],
  ['T8', 15, 22, 15, 22, 0, 0],
  ['T9', 22, 26, 22, 26, 0, 0],
  ['T10',26, 29, 26, 29, 0, 0]
];

/* ---------------------------------------------------------------
   EVENT DECK
   Every entry maps to a documented construction delay category:
     weather | delivery | subcontractor | inspection | design | labor
   Effects are mechanical and are always stated to the player.
   --------------------------------------------------------------- */
const EVENT_DECK = [
  /* @EXTRA-EVENTS@ — content pass appends below this line */

  // ---- WEATHER (content pass) ----------------------------------
  { id: 'w-heat', cat: 'weather', w: 6, minWeek: 1,
    title: 'Heat advisory',
    text: 'Highs near 100 and the humidity is worse. Pours move to 4 a.m. and everything else just moves slower.',
    rainDays: [0, 1], affects: ['concrete', 'roofing'], cost: 3800,
    costNote: 'Ice in the mix, retarder, and a batch plant that opens at 3 a.m.' },
  { id: 'w-ice', cat: 'weather', w: 4, minWeek: 8,
    title: 'Freezing drizzle',
    text: 'Everything above the second floor has a glaze on it. Nobody is welding membrane or setting glass until it burns off.',
    rainDays: [1, 2], affects: ['roofing', 'envelope'] },
  { id: 'w-remnant', cat: 'weather', w: 3, minWeek: 2,
    title: 'Remnants of a named storm',
    text: 'What is left of the hurricane arrives Wednesday. It is down to a tropical depression, which still rains like one.',
    rainDays: [2, 3] },

  // ---- LATE MATERIAL DELIVERY (content pass) -------------------
  { id: 'd-truck', cat: 'delivery', w: 6, minWeek: 5,
    title: 'No trucks',
    text: 'The sheathing is at the distributor, palletized and paid for. What there is not, anywhere in the state this week, is a flatbed.',
    delay: { targets: ['ENV1'], days: 2 },
    expedite: { fee: 4800, recover: 1, label: 'Pay the hot-shot flatbed rate',
      detail: 'A dedicated flatbed at the spot rate instead of waiting for the broker to find one. One of the two days.' } },
  { id: 'd-insul', cat: 'delivery', w: 5, minWeek: 10,
    title: 'Insulation shipment shorted',
    text: 'Half the batts arrived. The carrier describes the other half as "in the network."',
    delay: { targets: ['INSUL'], days: 2 },
    expedite: { fee: 3900, recover: 1, label: 'Buy the balance retail from two supply houses',
      detail: 'Clean out the shelves at two supply houses at retail price instead of waiting on the carrier. One of the two days.' } },
  { id: 'd-hardware', cat: 'delivery', w: 5, minWeek: 12,
    title: 'Door hardware slipped',
    text: 'The keyed cylinders are six weeks out. The doors are here. A door without hardware is a wall with hinges.',
    delay: { targets: ['FIN2', 'FIN3'], days: 2 },
    expedite: { fee: 5600, recover: 1, label: 'Temporary cores now, permanent cores at punch',
      detail: 'Construction cores get the doors working and inspectable now; the permanent keyed cylinders swap in at punchlist. One of the two days.' } },

  // ---- SUBCONTRACTOR SLIP (content pass) -----------------------
  { id: 's-noshow', cat: 'subcontractor', w: 5, minWeek: 5,
    title: 'Roofing crew no-showed',
    text: 'Opening day of deer season. Four of the six called in, and the foreman was honest enough not to say sick.',
    productivity: { trades: ['roofing'], factor: 0.7, weeks: 1 } },
  { id: 's-elevtech', cat: 'subcontractor', w: 4, minWeek: 9,
    title: 'Elevator mechanic keeps leaving',
    text: 'Every entrapment call in the county outranks your install. He has been here three half-days this week and apologized twice.',
    productivity: { trades: ['elevator'], factor: 0.75, weeks: 2 } },
  { id: 's-overspray', cat: 'subcontractor', w: 4, minWeek: 12,
    title: 'Overspray on the sprinkler heads',
    text: 'The painters bagged most of the heads. The fire marshal is interested in the ones they did not.',
    delay: { targets: ['FIN1', 'FIN2'], days: 2 }, cost: 5600,
    costNote: 'Replace painted heads and re-walk with the marshal.' },

  // ---- FAILED INSPECTION (content pass) ------------------------
  { id: 'i-airbar', cat: 'inspection', w: 4, minWeek: 8,
    title: 'Air-barrier test failed',
    text: 'The smoke pencil found daylight at the window heads on the north elevation. The consultant seemed pleased with himself.',
    delay: { targets: ['ENV2'], days: 2 }, cost: 4300,
    costNote: 'Reseal the window heads and re-test.' },
  { id: 'i-marshal', cat: 'inspection', w: 4, minWeek: 14,
    title: 'Fire marshal walked the final early',
    text: 'He came a week ahead "to save everyone time" and left a list. Exit signage, two door swings, one dead smoke detector.',
    holdExtend: { targets: ['INSP4'], days: 2 }, cost: 2800,
    costNote: 'Corrections and the return visit.' },

  // ---- RFI / DESIGN CHANGE (content pass, chained) -------------
  { id: 'r-duct', cat: 'design', w: 5, minWeek: 8,
    title: 'RFI 067 — duct main vs beam',
    text: 'The level 3 duct main wants to be exactly where the W21 already is. RFI is in. The architect has "asked the engineer."',
    delay: { targets: ['MEP3'], days: 2 } },
  { id: 'r-duct-ans', cat: 'design', chain: 'r-duct', w: 5, minWeek: 9,
    title: 'RFI 067 answered — as a change',
    text: 'The answer arrived as a sketch: drop the corridor ceiling and split the main into two runs. That is not an answer, that is scope.',
    delay: { targets: ['MEP3', 'DRY3'], days: 2 }, cost: 9500,
    costNote: 'Reroute ductwork and reframe the corridor soffit. PCO submitted.' },
  { id: 'r-duct-cost', cat: 'design', chain: 'r-duct-ans', w: 5, minWeek: 10,
    title: 'Owner disputes PCO 067',
    text: 'The owner’s PM calls the reroute "means and methods." Two meetings and a markup war later, you settle at eighty cents on the dollar.',
    revenue: 12000, cost: 4000,
    costNote: 'Settled change order, less the PM hours it took to collect it.' },

  // ---- WORKFORCE (content pass) --------------------------------
  { id: 'l-flu', cat: 'labor', w: 5, minWeek: 6,
    title: 'Flu is going around',
    text: 'It started in the drywall crew and it is democratic about it. Half the site sounds like a kennel.',
    productivity: { trades: ['drywall', 'mep', 'finish', 'general'], factor: 0.8, weeks: 1 } },
  { id: 'l-apprentice', cat: 'labor', w: 4, minWeek: 4,
    title: 'The hall sent apprentices',
    text: 'You asked for four journeymen. You got one journeyman and three first-years who are trying very hard.',
    productivity: { trades: ['envelope', 'drywall'], factor: 0.8, weeks: 2 } },

  // ---- GOOD NEWS (content pass, flavor only) -------------------
  { id: 'd-early', cat: 'delivery', w: 5, minWeek: 2,
    title: 'Everything on the truck',
    text: 'The delivery arrived on the day, on the count, undamaged. The super checked it twice, on principle.',
    flavorOnly: true },
  { id: 's-coord', cat: 'subcontractor', w: 5, minWeek: 6,
    title: 'Coordination meeting worked',
    text: 'The plumber and the tin knocker traded a corridor without being asked. Someone should write this down.',
    flavorOnly: true },
  { id: 'f-owner', cat: 'design', w: 4, minWeek: 5,
    title: 'Owner walked the site',
    text: 'She took pictures for the board meeting and said "ahead of where I thought." Do not correct her.',
    flavorOnly: true },

  // ---- WEATHER -------------------------------------------------
  { id: 'w-front', cat: 'weather', w: 10, minWeek: 1,
    title: 'Front moving through',
    text: 'Forecast has a system parked over the county midweek. Super wants to know if the pour still happens.',
    rainDays: [1, 2] },
  { id: 'w-soak', cat: 'weather', w: 7, minWeek: 1,
    title: 'Ground is soup',
    text: 'Two inches Sunday night. The cut is holding water and nobody is tracking mud onto the mats.',
    rainDays: [1, 3], affects: ['earthwork', 'concrete'] },
  { id: 'w-wind', cat: 'weather', w: 6, minWeek: 3,
    title: 'Wind advisory',
    text: 'Gusts to 40. Nobody is setting glass on the swing stage in this, and the sheathing crew keeps losing panels off the stack.',
    rainDays: [0, 2], affects: ['envelope'] },
  { id: 'w-cold', cat: 'weather', w: 5, minWeek: 6,
    title: 'Cold snap',
    text: 'Overnight lows in the twenties. Blankets and heaters or you are not placing concrete.',
    rainDays: [1, 2], affects: ['concrete'], cost: 6500,
    costNote: 'Cold-weather protection: blankets, heaters, admixture.' },
  { id: 'w-clear', cat: 'weather', w: 17, minWeek: 1,
    title: 'Clear week',
    text: 'High pressure. Nothing in the forecast. Take it.',
    rainDays: [0, 0] },
  { id: 'w-scatter', cat: 'weather', w: 15, minWeek: 1,
    title: 'Scattered showers',
    text: 'Pop-up storms most afternoons. Might cost you a half day, might cost you three.',
    rainDays: [0, 1] },

  // ---- LATE MATERIAL DELIVERY ----------------------------------
  { id: 'd-steel', cat: 'delivery', blockedBy: 'buy_steel', w: 8, minWeek: 2,
    title: 'Mill is behind',
    text: 'Fabricator called. The second sequence of steel slipped at the mill.',
    delay: { targets: ['STL2', 'STL3'], days: 3 },
    expedite: { fee: 15500, recover: 2, label: 'Pay premium freight + reshuffle the mill queue', detail: 'A premium-freight run and a shuffle up the mill queue. It buys back two of the three days, never all three.' } },
  { id: 'd-glazing', cat: 'delivery', blockedBy: 'buy_glazing', w: 7, minWeek: 6,
    title: 'Glazing sub called. It is not good.',
    text: 'The curtain wall units are sitting at the port. Customs hold, no release date yet.',
    delay: { targets: ['ENV2'], days: 3 },
    expedite: { fee: 19000, recover: 2, label: 'Broker + air freight the first two elevations', detail: 'A customs broker to clear the hold and air freight for the first two elevations. Two of the three days.' } },
  { id: 'd-elev', cat: 'delivery', blockedBy: 'buy_mep', w: 4, minWeek: 4,
    title: 'Elevator cab pushed',
    text: 'Manufacturer moved your slot three weeks out. They were apologetic about it.',
    delay: { targets: ['ELEV'], days: 3 },
    expedite: { fee: 16000, recover: 2, label: 'Buy someone else’s production slot',
      detail: 'You are buying somebody else’s production slot from the manufacturer. Two of the three days.' } },
  { id: 'd-rebar', cat: 'delivery', w: 6, minWeek: 1,
    title: 'Rebar short shipment',
    text: 'Count came up two bundles light on the #5s. Yard says Thursday.',
    delay: { targets: ['FTG', 'FDW', 'SOG', 'T3', 'T6'], days: 2 },
    expedite: { fee: 6500, recover: 1, label: 'Hot-shot the balance from the regional yard', detail: 'A hot shot is a dedicated truck sent for one load instead of waiting for the scheduled run. One of the two days.' } },
  { id: 'd-mep', cat: 'delivery', blockedBy: 'buy_mep', w: 6, minWeek: 8,
    title: 'Switchgear lead time',
    text: 'Gear that used to take 12 weeks now takes 30. Everyone is finding this out at once.',
    delay: { targets: ['MEP2', 'MEP3'], days: 2 },
    expedite: { fee: 11000, recover: 1, label: 'Source a substitute assembly, submit for approval', detail: 'A substitute assembly, resubmitted for the engineer’s approval. One of the two days.' } },
  { id: 'd-roof', cat: 'delivery', w: 5, minWeek: 5,
    title: 'Membrane on backorder',
    text: 'Your spec\'d TPO is out of stock in the width you need.',
    delay: { targets: ['ROOF', 'T9'], days: 2 },
    expedite: { fee: 8000, recover: 1, label: 'Take the alternate width, pay the seam labor', detail: 'Take the alternate membrane width and pay the extra seaming labour. One of the two days.' } },

  // ---- SUBCONTRACTOR SLIP --------------------------------------
  { id: 's-manning', cat: 'subcontractor', w: 8, minWeek: 3,
    title: 'Sub is manning another job',
    text: 'They pulled six people to a hospital job across the river. "Back next week." Sure.',
    productivity: { trades: ['mep', 'drywall'], factor: 0.7, weeks: 1 } },
  { id: 's-quality', cat: 'subcontractor', w: 6, minWeek: 4,
    title: 'Rework on the deck',
    text: 'Embeds are out of tolerance in two bays. It has to come out.',
    delay: { targets: ['DECK2', 'DECK3', 'DECKR'], days: 2 }, cost: 11000,
    costNote: 'Demo and replace out-of-tolerance embeds.' },
  { id: 's-drywall', cat: 'subcontractor', w: 6, minWeek: 10,
    title: 'Drywall sub cash flow',
    text: 'Their supplier put them on credit hold. Material stopped at the door.',
    delay: { targets: ['DRY1', 'DRY2', 'DRY3'], days: 2 },
    expedite: { fee: 9500, recover: 1, label: 'Joint-check the supplier direct', detail: 'A joint check pays the supplier directly so material moves again. One of the two days.' } },
  { id: 's-concrete', cat: 'subcontractor', w: 6, minWeek: 2,
    title: 'Batch plant double-booked',
    text: 'Your 6 a.m. pour became a 1 p.m. pour. Finishers are standing around.',
    productivity: { trades: ['concrete'], factor: 0.75, weeks: 1 } },
  { id: 's-good', cat: 'subcontractor', w: 7, minWeek: 2,
    title: 'Steel crew is rolling',
    text: 'Erector brought a second rig for free and picked up half a sequence.',
    bonus: { targets: ['STL1', 'STL2', 'STL3', 'DECKR', 'T8'], days: 2 } },

  // ---- FAILED INSPECTION ---------------------------------------
  { id: 'i-found', cat: 'inspection', w: 5, minWeek: 2,
    title: 'Footing inspection failed',
    text: 'Inspector wants additional dowels at the two column lines you value-engineered.',
    holdExtend: { targets: ['INSP1'], days: 2 }, cost: 5500,
    costNote: 'Added dowels and re-inspection fee.' },
  { id: 'i-mep', cat: 'inspection', w: 6, minWeek: 9,
    title: 'Rough-in inspection failed',
    text: 'Fire-caulk missing at 30-odd penetrations on two. Correct and call them back.',
    holdExtend: { targets: ['INSP3'], days: 3 }, cost: 4200,
    costNote: 'Correction labor and re-inspection.' },
  { id: 'i-struct', cat: 'inspection', w: 4, minWeek: 5,
    title: 'Special inspector flagged welds',
    text: 'UT found three suspect moment connections. They get ground out and redone.',
    holdExtend: { targets: ['INSP2'], days: 2 }, cost: 8000,
    costNote: 'Weld repair and re-test.' },
  { id: 'i-clean', cat: 'inspection', w: 6, minWeek: 2,
    title: 'Inspection passed first time',
    text: 'No punch items. The inspector even said the layout was clean.',
    flavorOnly: true },

  // ---- RFI / DESIGN CHANGE -------------------------------------
  { id: 'r-stair', cat: 'design', w: 6, minWeek: 4,
    title: 'RFI 042 — stair landing conflict',
    text: 'Architect\'s stair lands 4 inches into the duct main. Somebody moves.',
    delay: { targets: ['MEP2', 'MEP3', 'STL3'], days: 2 }, cost: 6000,
    costNote: 'Redesign coordination and fabrication change.' },
  { id: 'r-owner', cat: 'design', w: 5, minWeek: 7,
    title: 'Owner changed the lobby',
    text: 'New finish package for the level 1 lobby. Signed change order, adds scope and time.',
    delay: { targets: ['FIN1'], days: 2 }, revenue: 38000, cost: 26000,
    costNote: 'Added lobby scope — change order revenue less added cost.' },
  { id: 'r-slab', cat: 'design', w: 4, minWeek: 3,
    title: 'Structural revision to slab edge',
    text: 'Revised drawings landed. Slab edge detail changed at three elevations.',
    delay: { targets: ['SOG', 'ENV1', 'T6'], days: 2 }, cost: 4500,
    costNote: 'Rework of edge form and embed layout.' },
  { id: 'r-none', cat: 'design', w: 6, minWeek: 3,
    title: 'RFI log is quiet',
    text: 'Nothing outstanding over 7 days. Enjoy it.',
    flavorOnly: true },

  // ---- WORKFORCE -----------------------------------------------
  { id: 'l-short', cat: 'labor', w: 7, minWeek: 5,
    title: 'Nobody in the hall',
    text: 'Called for four more carpenters. The hall has two, and one is on light duty.',
    productivity: { trades: ['drywall', 'finish', 'envelope'], factor: 0.8, weeks: 2 } },
  { id: 'l-poach', cat: 'labor', w: 5, minWeek: 8,
    title: 'Data center is paying more',
    text: 'Lost three electricians to the hyperscale job out on the parkway.',
    productivity: { trades: ['mep'], factor: 0.75, weeks: 2 } },
  { id: 'l-injury', cat: 'labor', w: 4, minWeek: 4,
    title: 'Recordable on site',
    text: 'Laborer took a fall from a ladder. He is going to be fine. The site is not working today.',
    productivity: { trades: ['general', 'earthwork', 'concrete', 'steel', 'roofing', 'envelope', 'mep', 'drywall', 'finish'], factor: 0.85, weeks: 1 },
    cost: 3500, costNote: 'Stand-down, retraining, incident investigation.' },
  { id: 'l-good', cat: 'labor', w: 6, minWeek: 3,
    title: 'Full crews all week',
    text: 'Everybody showed up. Every day. It happens.',
    flavorOnly: true }
];


/* ---------------------------------------------------------------
   THE CALLS
   A call is a judgment you make BEFORE the work, whose consequence
   lands later. Each option carries an immediate price and a `risk`:
   the probability that the deferred consequence fires.

   Fairness: the roll for a call is derived from the seed and the
   call's id alone — hash(seed + '|' + callId) — so every team on a
   seed faces the IDENTICAL roll. What differs between teams is the
   threshold they bought. Two teams with the same roll of 0.31 get
   different outcomes because one paid to move the threshold to 0.05
   and the other left it at 0.45. That is a decision, not a dice game.

   `offerAt`   the activity this call is about. Offered in the week
               that activity opens, while it is still unstarted.
   `resolveAt` the activity whose start reveals the consequence.
   `sets`      a flag consulted elsewhere (procurement immunity).
   --------------------------------------------------------------- */
const CALLS = [
  /* @EXTRA-CALLS@ — content pass appends below this line */
  {
    id: 'pothole', offerAt: 'EXC', resolveAt: 'UGU', project: 'main',
    title: 'What is under the dig',
    detail: 'Before excavating, the one-call service (811) sends locators to paint the ground over utilities its member companies own — but the marks do not cover private lines, abandoned lines, or anything the last contractor buried and forgot. Potholing means vacuum-excavating small test holes to physically expose each line, because the paint is an opinion and the pipe is a fact. Hitting a live line stops the dig, floods or de-energizes the trench, and hands you the repair bill.',
    text: 'The locate marks are down and they look thin for a corner this old. There was a filling station here in the seventies, which nobody mentions in the geotech report.',
    fail: { rework: ['UGU'], days: 3, cost: 12500,
      text: 'The excavator hooked an unmarked 6-inch water line. The trench flooded, the city came out, and the repair is yours.' },
    pass: 'The dig found nothing the marks did not promise.',
    options: [
      { id: 'marks', label: 'Dig to the marks', cost: 0, delay: 0, risk: 0.32,
        note: 'The paint is free. So is whatever the paint missed.' },
      { id: 'hand', label: 'Hand-dig inside the tolerance zone', cost: 2200, delay: 1, risk: 0.14,
        note: 'Slower near the marks. Does nothing about lines with no marks at all.' },
      { id: 'vac', label: 'Private locator plus vacuum potholes', cost: 4900, delay: 1, risk: 0.03,
        note: 'A day and a truck to know instead of guess.' }
    ]
  },
  {
    id: 'winterdeck', offerAt: 'DECK2', resolveAt: 'DKC', project: 'main',
    title: 'Winter concrete on the elevated decks',
    detail: 'Concrete gains strength through a chemical reaction that needs warmth: below about 40°F it slows to a crawl, and if a fresh pour freezes before it reaches strength the surface can scale off in sheets. A slab on grade borrows heat from the earth; an elevated deck is a thin slab in the open air, cold on both faces, which makes it the worst place on the job to gamble with temperature. Protection means insulated blankets on top and heaters underneath, running until the concrete can look after itself.',
    text: 'The level 2 deck pours into a forecast with three nights below freezing. The concrete sub priced blankets. He did not price heat.',
    fail: { hold: 'DKC', days: 3, cost: 9200,
      text: 'The deck surface froze before it set — scaled concrete ground down and topped, and the cure hold runs long while the breaks catch up.' },
    pass: 'The decks cured warm and broke on schedule.',
    options: [
      { id: 'blankets', label: 'Blankets only, like the sub priced', cost: 0, delay: 0, risk: 0.36,
        note: 'The number in the buyout. The forecast gets a vote.' },
      { id: 'accel', label: 'Hot-water batch and accelerator', cost: 4300, delay: 0, risk: 0.14,
        note: 'The mix fights the cold from the inside. Usually enough.' },
      { id: 'heat', label: 'Full hoarding and heaters under the deck', cost: 11800, delay: 1, risk: 0.03,
        note: 'A day to build the enclosure, and the weather stops being your problem.' }
    ]
  },
  {
    id: 'stage', offerAt: 'ENV1', resolveAt: 'ENV2', project: 'main',
    title: 'Scaffold or swing stage for the skin',
    detail: 'A swing stage is the suspended platform that hangs off the roof on cables — cheap to mobilize, quick to move, and grounded any day the wind is up. Pipe scaffold is a fixed frame built up the face of the building: real money and days to erect, but crews work from it in weather that parks a stage. Mast climbers are powered platforms on vertical towers, the middle ground. The skin is where your schedule meets the wind forecast, every day, for months.',
    text: 'The glazing sub priced swing stages, because everyone prices swing stages. This elevation catches the wind off the river all winter, and you have seen his rigs tied off more than once.',
    fail: { rework: ['ENV2'], days: 3, cost: 7200,
      text: 'The stages sat tied off half the month and a unit swung into the parapet coming up — reglaze, refab, and the elevation waits.' },
    pass: 'The skin went up without drama.',
    options: [
      { id: 'swing', label: 'Swing stages, as priced', cost: 0, delay: 0, risk: 0.30,
        note: 'The number in the bid. The wind gets a vote.' },
      { id: 'mast', label: 'Mast climbers on the two exposed elevations', cost: 8400, delay: 1, risk: 0.10,
        note: 'Steadier platform, higher wind limits, one day to erect.' },
      { id: 'scaffold', label: 'Full pipe scaffold on the river face', cost: 14500, delay: 2, risk: 0.03,
        note: 'Two days to build. After that the wind is just the weather report.' }
    ]
  },
  {
    id: 'storecw', offerAt: 'ROOF', resolveAt: 'ENV2', project: 'main',
    title: 'Curtain wall is done early. Now what.',
    detail: 'The curtain wall units are finished glass-and-aluminum assemblies, crated and fragile, and the fabricator wants them off his floor. Take them now and they sit on your site for weeks — billable as stored material, but every crate is one forklift mistake from a reglaze. Refuse and he charges warehouse rates, and your delivery re-queues behind whoever ships next. An IGU is the insulated glazing unit, the sealed double pane inside each frame; they do not repair, they replace, on the fabricator’s lead time.',
    text: 'The fabricator finished your units three weeks early and wants his floor back. They can sit in your laydown, in a rented conex yard, or in his warehouse at his rates.',
    fail: { rework: ['ENV2'], days: 2, cost: 8600,
      text: 'Crates came out of storage with racked corners and two broken IGUs — refab on the fabricator’s lead time while the elevation waits.' },
    pass: 'Every crate came out of storage the way it went in.',
    options: [
      { id: 'laydown', label: 'Take them — tarps and dunnage in the laydown', cost: 2100, delay: 0, risk: 0.28,
        note: 'Cheap, billable, and in everyone’s way for a month.' },
      { id: 'racks', label: 'Take them — covered racks in a fenced conex yard', cost: 6800, delay: 0, risk: 0.03,
        note: 'Proper storage. Costs what proper storage costs.' },
      { id: 'refuse', label: 'Refuse delivery, pay his warehouse rate', cost: 3900, delay: 2, risk: 0.08,
        note: 'His yard is not a museum either, and you re-queue behind his next ship-out.' }
    ]
  },
  {
    id: 'drysub', offerAt: 'INSUL', resolveAt: 'DRY2', project: 'main',
    title: 'The cheaper drywall number',
    detail: 'A buyout bust means the subcontract price carried in your bid is lower than what the trade will actually sign for — the difference comes out of your fee unless a cheaper sub appears. One has: a non-union outfit from two counties over, unknown to your supers, whose references are a phone that rings. Drywall finish is graded by level, and a bad finisher shows up as screw pops, telegraphing joints and a level-4 wall that photographs like a relief map — after the paint is on.',
    text: 'Your carried drywall number is busted by eleven grand. The estimator found an outfit that will take it as bid. Nobody on your staff has ever met them.',
    fail: { rework: ['DRY2'], days: 3, cost: 9800,
      text: 'Level 2 came up short — screw pops and telegraphing joints down the corridor. Skim, sand and repaint, on your dime.' },
    pass: 'The new sub hung and finished clean. The estimator is insufferable.',
    options: [
      { id: 'known', label: 'Pay the bust, keep the sub you know', cost: 11000, delay: 0, risk: 0.02,
        note: 'Eleven grand buys a wall you never think about again.' },
      { id: 'cheap', label: 'Sign the cheap number', cost: 0, delay: 0, risk: 0.34,
        note: 'The bust disappears. The references are a phone that rings.' },
      { id: 'watched', label: 'Sign them, add a QC walk on every floor', cost: 4200, delay: 0, risk: 0.12,
        note: 'Most of the savings, plus a superintendent who now owns drywall.' }
    ]
  },
  {
    id: 't-locate', offerAt: 'T2', resolveAt: 'T5', project: 'tutorial',
    title: 'Before the bucket goes in',
    detail: 'Call 811 before you dig: the one-call service sends locators to paint the ground where member utilities run. The marks are free and required by law, but they only cover lines the members know about — a private locator with ground-penetrating radar finds the rest. Hitting a live line stops the dig and buys you the repair.',
    text: 'The marks are down for the utility trench. The old-timers say there used to be a shop building back here. The marks do not.',
    fail: { rework: ['T5'], days: 2, cost: 2600,
      text: 'The bucket found an unmarked water service. Small line, big mess, your repair.' },
    pass: 'The trench held nothing but dirt.',
    options: [
      { id: 'dig', label: 'Dig to the marks', cost: 0, delay: 0, risk: 0.4,
        note: 'Free. The marks cover what the marks cover.' },
      { id: 'scan', label: 'Private locator sweep first', cost: 2000, delay: 1, risk: 0.03,
        note: 'A day and a truck to know what is actually down there.' }
    ]
  },

  /* ---- structure and below grade ---------------------------- */
  {
    id: 'sov', offerAt: 'MOB', resolveAt: 'ENV1', project: 'main',
    title: 'Loading the schedule of values',
    detail: 'The schedule of values is the price breakdown you bill against: every month you invoice the owner for the value of work in place, they pay about thirty days later, and they hold 5% retainage until closeout. Front-loading means pricing the early activities rich and the late ones lean — same total, but the money arrives sooner and finances your job instead of the bank. Owners know the trick, and their reviewer is allowed to reject a pay application that has drifted too far from the work.',
    text: 'Your PM drafts the schedule of values tonight. Priced straight, the early months run cash-negative on the line of credit. Priced heavy up front, the job carries itself — unless the owner\u2019s reviewer decides the numbers smell.',
    fail: { payDelay: 3, cost: 2400,
      text: 'The owner\u2019s reviewer audited the pay application against work in place and kicked it back — resubmittal, three weeks of payment delay, and every application after this one gets the long look.' },
    pass: 'The schedule of values sailed through every review.',
    options: [
      { id: 'straight', label: 'Price it straight', cost: 0, delay: 0, risk: 0,
        note: 'Honest curve, deeper cash valley, more interest on the line.' },
      { id: 'frontload', label: 'Front-load it', cost: 0, delay: 0, risk: 0.30, sets: 'sov_frontload',
        note: 'The job finances itself early. A 30% chance the reviewer kicks an application back mid-job.' }
    ]
  },
  {
    id: 'bearing', offerAt: 'FTG', resolveAt: 'INSP1', project: 'main',
    title: 'Bearing at column line 4',
    detail: 'Bearing capacity is how much load the soil under a footing can carry before it settles or fails, in pounds per square foot. The geotechnical report gives a design value and the structural engineer sizes the footings against it. "Nothing to spare" means the soil at that column line tested right at the number the footings were designed to, with no margin — so if the inspector’s own probe reads lower, the pads are undersized and they come back out. The EOR is the Engineer of Record, the licensed engineer who sealed the drawings; a field determination is a written call from them that the inspector will accept.',
    text: 'Geotech logged the design bearing at line 4 with nothing to spare. The drawings say it is adequate. The inspector will have his own opinion.',
    fail: { hold: 'INSP1', days: 3, cost: 8500,
      text: 'Foundation inspection failed at line 4 — undercut and re-pour the two pads.' },
    pass: 'Inspector took the pads at line 4 without comment.',
    options: [
      { id: 'plan', label: 'Pour to plan', cost: 0, delay: 0, risk: 0.45,
        note: 'Costs nothing today. The drawings are the drawings.' },
      { id: 'engineer', label: 'Field determination by the EOR', cost: 3200, delay: 2, risk: 0.14,
        note: 'Two days waiting on the engineer, and his letter is what the inspector reads.' },
      { id: 'overex', label: 'Over-excavate and add rebar', cost: 9800, delay: 1, risk: 0.03,
        note: 'Buys the problem out. You will never know whether you needed it.' }
    ]
  },
  {
    id: 'backfill', offerAt: 'BKF', resolveAt: 'SOG', project: 'main',
    title: 'Backfilling against the foundation walls',
    detail: 'A foundation wall is designed to be held at the top by the floor structure that eventually bears on it, and to have soil pushing on both sides or on neither. Backfilling high against one side of a wall that has neither reached strength nor been braced loads it in a direction it was never designed for. Kickers are temporary diagonal braces, sized by the engineer, that carry that load until the slab does.',
    text: 'The walls are up but they are young, and nothing braces them across the top yet. The backfill is sitting on the schedule and the machine is on site.',
    fail: { rework: ['FDW'], days: 5, cost: 24000,
      text: 'A wall section rotated at the base under the fill and cracked through. Pull the backfill, demolish and re-pour forty feet of wall.' },
    pass: 'The walls took the fill without moving.',
    options: [
      { id: 'cured', label: 'Wait for strength, then backfill both sides evenly', cost: 0, delay: 3, risk: 0,
        note: 'The way the wall was designed to be loaded. It costs three days.' },
      { id: 'brace', label: 'Engineered kickers, then backfill early', cost: 6400, delay: 0, risk: 0.03,
        note: 'Temporary bracing carries the load until the slab does. Buys the three days back.' },
      { id: 'push', label: 'Backfill high on one side now and keep the machine moving', cost: 0, delay: 0, risk: 0.34,
        unsafe: true,
        unsafeWhy: 'An uncured, unbraced foundation wall with fill against one side only is loaded in a way nobody designed for. When one of these lets go it does not crack quietly — it rotates in on whoever is standing in the excavation, and people are killed this way every year. This is an OSHA excavation and structural-stability violation before it is a schedule decision, and the person who authorised it owns it personally, in the citation and in the deposition.',
        note: 'Free, and it saves the three days. It is also the option that gets somebody hurt.' }
    ]
  },
  {
    id: 'coldpour', offerAt: 'FDW', resolveAt: 'FDWC', project: 'main',
    title: 'Night temperatures on the wall pour',
    detail: 'Concrete gains strength through a chemical reaction that slows badly below about 40°F, so a cold night can leave a pour weaker than the drawings assume. Test cylinders are sample cans filled from the same truck and broken in a lab at 7 and 28 days to prove the concrete reached its design strength. If the 7-day breaks come back low you cannot strip the forms or load the wall until a later break clears it.',
    text: 'Lows in the thirties midweek. Warm enough to place, cold enough that the cylinders might not come back where you want them.',
    fail: { hold: 'FDWC', days: 2, cost: 6400,
      text: 'Seven-day breaks came back low — the walls stay shored two extra days while they re-test.' },
    pass: 'Cylinders broke well above design. Strip on schedule.',
    options: [
      { id: 'place', label: 'Place it and watch the breaks', cost: 0, delay: 0, risk: 0.38,
        note: 'Most of the time this is fine. Most.' },
      { id: 'admix', label: 'Accelerating admixture', cost: 3100, delay: 0, risk: 0.16,
        note: 'Cheap insurance, partial cover.' },
      { id: 'protect', label: 'Blankets, heaters and cure boxes', cost: 7200, delay: 0, risk: 0.02,
        note: 'The full protection package. Not free and not glamorous.' }
    ]
  },
  {
    id: 'embeds', offerAt: 'DECK3', resolveAt: 'INSP2', project: 'main',
    title: 'Embed layout on the level 3 deck',
    detail: 'Embeds are steel plates and anchor bolts cast into the concrete deck that the next trade bolts to — the frame, the stair, the equipment rail. If they are out of position the piece that lands on them does not fit, and the fix is chipping concrete out of a finished deck. Special inspection is the code-required independent check of exactly this, by an inspector who works for the owner, not for you.',
    text: 'The layout crew shot the embeds and two bays read a half inch out. Within tolerance if you measure it generously.',
    fail: { hold: 'INSP2', days: 2, cost: 8000,
      text: 'Special inspector rejected the two bays — chip out and re-set before the frame goes up.' },
    pass: 'Special inspector measured the embeds and signed them off.',
    options: [
      { id: 'accept', label: 'Accept them and move on', cost: 0, delay: 0, risk: 0.42,
        note: 'Generous measuring. It has worked before.' },
      { id: 'reshoot', label: 'Re-shoot and reset the two bays', cost: 3600, delay: 2, risk: 0.04,
        note: 'Two days out of the deck pour to be certain.' }
    ]
  },

  /* ---- dry-in and interiors ---------------------------------- */
  {
    id: 'dryin', offerAt: 'MEP1', resolveAt: 'INSP3', project: 'main',
    title: 'Start the rough-in before the building is dry',
    detail: 'Dry-in is the point at which the roof and the exterior walls keep weather out of the building. Rough-in is the ductwork, pipe and conduit installed inside the walls and above the ceilings before they are closed up. Starting rough-in before dry-in puts finished work under an open roof: wet insulation, rusted boxes, and a mould problem you own.',
    text: 'Level 1 rough-in can start now. The envelope is not closed and the roof may not be either. Every super has made this call and about a third of them regret it.',
    fail: { rework: ['MEP1', 'MEP2'], days: 3, cost: 7400,
      text: 'Water got in. Wet insulation and corroded boxes on two levels — tear out and redo.' },
    pass: 'Nothing blew in. The gamble paid.',
    options: [
      { id: 'go', label: 'Start now, weather be damned', cost: 0, delay: 0, risk: 0.40,
        note: 'Buys you the schedule. Puts finished work under an open roof.' },
      { id: 'temp', label: 'Temporary enclosure on the open elevations', cost: 8600, delay: 0, risk: 0.07,
        note: 'Visqueen and blowers. Ugly, effective.' },
      { id: 'wait', label: 'Hold rough-in until the building is dry', cost: 0, delay: 4, risk: 0.0,
        note: 'Four days of schedule, and no exposure at all.' }
    ]
  },
  {
    id: 'prewalk', offerAt: 'MEP3', resolveAt: 'INSP3', project: 'main',
    title: 'Calling the rough-in inspection',
    detail: 'Rough-in inspection is the code official’s check of everything inside the walls before drywall covers it up. Fire-caulk is the rated sealant packed around every pipe and conduit where it passes through a fire-rated wall — each of those is a penetration. Miss them and the wall no longer holds its fire rating, so the inspector fails the whole floor and nothing gets covered until it is corrected.',
    text: 'The sub says he is ready. The sub always says he is ready.',
    fail: { hold: 'INSP3', days: 3, cost: 4200,
      text: 'Failed rough-in — fire-caulk missing at thirty-odd penetrations. Correct and call them back.' },
    pass: 'Passed rough-in first time. No punch items.',
    options: [
      { id: 'call', label: 'Call the inspector', cost: 0, delay: 0, risk: 0.44,
        note: 'If he passes it first time you saved a day and a half.' },
      { id: 'walk', label: 'Pre-walk it with the sub and the fire marshal', cost: 1900, delay: 1, risk: 0.06,
        note: 'One day, and you find what he would have found.' }
    ]
  },
  {
    id: 'punch', offerAt: 'FIN2', resolveAt: 'PUNCH', project: 'main',
    title: 'How you intend to run the punchlist',
    detail: 'The punchlist is the list of small defects — a scratched door, a missing cover plate, paint at a switch — that must be corrected before the owner will accept the building. Walking each floor as it finishes catches them while that trade is still on site; leaving it to the end means calling every sub back for an afternoon of work each.',
    text: 'The owner rep has asked how you want to handle punch. You can walk each floor as it finishes, or you can do it all at the end like everyone says they will not.',
    fail: { rework: ['PUNCH'], days: 3, cost: 3000,
      text: 'The end-of-job punch ran long — the list came back three pages deeper than anyone expected.' },
    pass: 'Punch went clean.',
    options: [
      { id: 'end', label: 'Punch at the end', cost: 0, delay: 0, risk: 0.40,
        note: 'Keeps the finish crews moving now.' },
      { id: 'rolling', label: 'Walk each floor with the owner as it completes', cost: 2600, delay: 0, risk: 0.05,
        note: 'Costs supervision now, and the closeout is boring, which is the goal.' }
    ]
  },

  /* ---- procurement ------------------------------------------- */
  {
    id: 'buy-steel', offerAt: 'FTG', resolveAt: null, project: 'main',
    title: 'Buyout — structural steel',
    detail: 'Buyout is the period after award when the general contractor actually purchases the subcontracts and materials. Long-lead items — structural steel, switchgear, elevators, curtain wall — sit in manufacturing queues measured in months, and your place in that queue is set by the day you release the order, not the day you need it.',
    text: 'The fabricator will hold your slot in the mill queue if you release now with a deposit. Or you take the quoted lead time like everybody else.',
    procurement: true,
    options: [
      { id: 'lead', label: 'Take the quoted lead time', cost: 0, delay: 0, risk: 0,
        note: 'Free. And the mill has other customers.' },
      { id: 'prebuy', label: 'Release early and hold the mill slot', cost: 15500, delay: 0, risk: 0,
        sets: 'buy_steel', note: 'A late steel delivery cannot touch you.' }
    ]
  },
  {
    id: 'buy-mep', offerAt: 'SOG', resolveAt: null, project: 'main',
    title: 'Buyout — switchgear and the elevator',
    detail: 'Switchgear is the main electrical distribution equipment; both it and the elevator are built to order. Submitting on the normal cycle means the manufacturer schedules you when the paperwork clears, behind whoever released before you.',
    text: 'Both are long lead and both got longer this year. Release now at a premium, or submit on the normal cycle.',
    procurement: true,
    options: [
      { id: 'lead', label: 'Submit on the normal cycle', cost: 0, delay: 0, risk: 0,
        note: 'Free, and entirely at the mercy of the manufacturers.' },
      { id: 'prebuy', label: 'Release both early at a premium', cost: 22000, delay: 0, risk: 0,
        sets: 'buy_mep', note: 'Switchgear and elevator delays cannot touch you.' }
    ]
  },
  {
    id: 'buy-glazing', offerAt: 'INSP2', resolveAt: null, project: 'main',
    title: 'Buyout — curtain wall',
    detail: 'Shop drawings are the fabricator’s detailed drawings of exactly what they intend to build, reviewed and approved by the architect and engineer before fabrication starts. Ordering against a deposit before that approval means if the review comes back with changes, you own the wrong glass.',
    text: 'The glazing sub can order the units now against your deposit, or wait for approved shop drawings like the contract says.',
    procurement: true,
    options: [
      { id: 'lead', label: 'Wait for approved shop drawings', cost: 0, delay: 0, risk: 0,
        note: 'Correct procedure. Slower.' },
      { id: 'prebuy', label: 'Order against a deposit now', cost: 18500, delay: 0, risk: 0,
        sets: 'buy_glazing', note: 'A glazing delay cannot touch you.' }
    ]
  },

  /* ---- tutorial ---------------------------------------------- */
  {
    id: 't-bearing', offerAt: 'T3', resolveAt: 'T7', project: 'tutorial',
    title: 'Subgrade under the slab',
    detail: 'A proof roll is a loaded truck driven slowly across the prepared subgrade while the inspector watches the ground under the tyres. If the surface flexes and rebounds in a visible wave behind the wheel, it is "pumping" — the soil is too wet or too soft to carry the slab. The fix is to undercut it: dig the bad material out and replace it with compacted stone.',
    text: 'The proof-roll pumped in the north corner. You can undercut it now or you can hope the inspector walks the other way.',
    fail: { hold: 'T7', days: 2, cost: 4200,
      text: 'Slab inspection failed on subgrade — undercut and recompact the north corner.' },
    pass: 'Inspector walked the subgrade and passed it.',
    options: [
      { id: 'plan', label: 'Leave it and proof-roll again later', cost: 0, delay: 0, risk: 0.5,
        note: 'Free. This is the choice the game is about.' },
      { id: 'undercut', label: 'Undercut and recompact now', cost: 5200, delay: 1, risk: 0.03,
        note: 'A day and some money to remove the risk entirely.' }
    ]
  },
  {
    id: 't-buy-steel', offerAt: 'T2', resolveAt: null, project: 'tutorial',
    title: 'Buyout — the steel frame',
    detail: 'Buyout is when the contractor actually places the orders. Fabricated steel sits in a queue at the mill and the shop, and releasing early holds your place in it.',
    text: 'Release the frame now and hold the fabricator slot, or take the lead time.',
    procurement: true,
    options: [
      { id: 'lead', label: 'Take the lead time', cost: 0, delay: 0, risk: 0, note: 'Free, and exposed.' },
      { id: 'prebuy', label: 'Release now and hold the slot', cost: 6500, delay: 0, risk: 0,
        sets: 'buy_steel', note: 'A late steel delivery cannot touch you.' }
    ]
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TRADES, ZONES, MAIN_NETWORK, TUTORIAL_NETWORK, TUTORIAL_EXPECTED_CPM, EVENT_DECK, CALLS };
}
