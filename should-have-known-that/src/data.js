/* =====================================================================
   QUESTION BANK  —  INSTRUCTORS: EDIT HERE
   ---------------------------------------------------------------------
   Each question is one object with these fields:
     id       unique number
     category grouping shown as a chip ("new" categories work automatically)
     prompt   the question text players see
     units    unit label ("°" and "%" attach without a space)
     value    the TRUE answer (must be > 0)
     min,max  slider endpoints (both must be > 0 when scale is "log")
     scale    "linear" | "log"  — use "log" when plausible guesses span
              orders of magnitude (resistivity, current, energy, ...)
     factoid  the one-line "You should have known that because..." reveal
     qualifier  OPTIONAL. A short honesty rider shown beside the reveal's
              "Sourced" kicker for a value that is really a range, a
              specified minimum, a design convention, or code/edition
              dependent — so a single number never teaches false
              precision. Omit for a value that is genuinely a single
              defined constant or an exact arithmetic identity.
     source   { name, url, fetched } — the primary or best-available
              citation actually checked for this build (see
              .aia/.data/demo-fleet-format-alignment/B-should-have-known-that-progress.md
              for which of these were freshly fetched this session vs.
              inherited from the pre-build accuracy audit's own fetches —
              both are research, never memory; none were back-filled).
   Tips: keep the true value OFF-center in [min,max], and make the range
   wide enough that the endpoints don't give the answer away.
   Scoring band thresholds live in SCORING (app.js).
===================================================================== */
'use strict';

const QUESTIONS = [

  /* ---------------- STATICS & MECHANICS ---------------- */
  { id: 1, category: "Statics & Mechanics",
    prompt: "Acceleration due to gravity at Earth's surface",
    units: "m/s²", value: 9.81, min: 2, max: 30, scale: "linear",
    factoid: "g = 9.81 m/s² — 'ten minus a bit.' Misremember it and every answer downstream is wrong.",
    qualifier: "defined exact constant is 9.80665 m/s²; local g varies ~9.78–9.83 by latitude and altitude",
    source: { name: "BIPM, 3rd CGPM (1901) Resolution 2", url: "https://www.bipm.org/en/committees/cg/cgpm/3-1901/resolution-2", fetched: "2026-09-16" } },

  { id: 2, category: "Statics & Mechanics",
    prompt: "Speed of sound in air at room temperature",
    units: "m/s", value: 343, min: 50, max: 1200, scale: "linear",
    factoid: "343 m/s — count the seconds after lightning and divide by 5 to get miles away.",
    source: { name: "The Physics Factbook, \"Speed of Sound in Air\"", url: "https://hypertextbook.com/facts/2000/CheukWong.shtml", fetched: "2026-09-15" } },

  { id: 3, category: "Statics & Mechanics",
    prompt: "Atmospheric pressure at sea level",
    units: "psi", value: 14.7, min: 2, max: 60, scale: "linear",
    factoid: "14.7 psi (101 kPa) — about a ton of air force rests on your shoulders; it cancels out.",
    qualifier: "defined standard atmosphere = 14.696 psi; day-to-day sea-level pressure varies ~14.5–14.9 psi with weather",
    source: { name: "Wikipedia, \"Standard atmosphere (unit)\" (1954 CGPM definition)", url: "https://en.wikipedia.org/wiki/Standard_atmosphere_(unit)", fetched: "2026-09-15" } },

  { id: 4, category: "Statics & Mechanics",
    prompt: "Density of steel",
    units: "kg/m³", value: 7850, min: 1000, max: 20000, scale: "linear",
    factoid: "7,850 kg/m³ (specific gravity 7.85) — a one-meter cube of steel weighs almost 8 tons.",
    qualifier: "typical reference value; real range ~7,750–8,050 kg/m³ by alloy",
    source: { name: "AmesWeb, Density of Steel", url: "https://www.amesweb.info/Materials/Density_of_Steel.aspx", fetched: "2026-09-15" } },

  { id: 5, category: "Statics & Mechanics",
    prompt: "Weight of one cubic foot of water",
    units: "lb", value: 62.4, min: 10, max: 250, scale: "linear",
    factoid: "62.4 lb/ft³ — the anchor number for buoyancy, tank weights, and the 0.433 psi/ft rule.",
    qualifier: "at ~60°F reference temperature; drops slightly at higher temperatures",
    source: { name: "Engineering ToolBox, Hydrostatic Pressure — Water", url: "https://www.engineeringtoolbox.com/hydrostatic-pressure-water-d_1632.html", fetched: "2026-09-15" } },

  { id: 6, category: "Statics & Mechanics",
    prompt: "How many feet per second is 60 mph?",
    units: "ft/s", value: 88, min: 20, max: 250, scale: "linear",
    factoid: "60 mph is exactly 88 ft/s — at highway speed you cover ~6 car lengths every second.",
    source: { name: "Exact unit conversion (60 × 5,280 ÷ 3,600)", url: "", fetched: "2026-09-16" } },

  { id: 7, category: "Statics & Mechanics",
    prompt: "Angle of repose of dry sand (steepest stable pile)",
    units: "°", value: 34, min: 5, max: 85, scale: "linear",
    factoid: "Dry sand won't stack steeper than ~34° — the same physics shapes hoppers, stockpiles, and dunes.",
    qualifier: "range 30–35° for dry sand's angle of repose; a distinct quantity from the engineering (design) friction angle, which this item does not name",
    source: { name: "ResearchGate, \"Typical values of angle of repose\"", url: "https://www.researchgate.net/figure/Typical-values-of-angle-of-repose-30_tbl1_323441895", fetched: "2026-09-15" } },

  { id: 8, category: "Statics & Mechanics",
    prompt: "Speed of sound in steel",
    units: "m/s", value: 5900, min: 800, max: 15000, scale: "linear",
    factoid: "~5,900 m/s — about 17× faster than in air, which is why you'd hear a train through the rail first.",
    qualifier: "alloy/heat-treatment dependent; commonly cited 5,900–6,000 m/s across steel grades",
    source: { name: "Engineering ToolBox, Sound Speed in Solids", url: "https://www.engineeringtoolbox.com/sound-speed-solids-d_713.html", fetched: "2026-09-15" } },

  /* ---------------- MATERIALS ---------------- */
  { id: 9, category: "Materials",
    prompt: "Young's modulus of structural steel",
    units: "GPa", value: 200, min: 10, max: 800, scale: "linear",
    factoid: "200 GPa is the stiffness yardstick — aluminum ~70, concrete ~30, wood ~10.",
    qualifier: "AISC 360's fixed design constant (29,000 ksi) for all structural-steel grades, not a measured average — physically measured steel runs ~190–215 GPa",
    source: { name: "AISC 360 design value (29,000 ksi), via steelcalculator.app reference", url: "https://steelcalculator.app/reference/steel-modulus-of-elasticity/", fetched: "2026-09-16" } },

  { id: 10, category: "Materials",
    prompt: "Yield strength of A36 mild steel",
    units: "MPa", value: 250, min: 20, max: 1200, scale: "linear",
    factoid: "The '36' in A36 is the yield strength in ksi — 36 ksi ≈ 250 MPa, the default mild-steel number.",
    qualifier: "specified minimum, not typical — real mill-certified A36 commonly tests higher, and the minimum drops to 220 MPa (32 ksi) above 8 in thickness",
    source: { name: "Wikipedia, \"A36 steel\" (quoting ASTM A36/A36M's minimum-yield and thickness-exception language)", url: "https://en.wikipedia.org/wiki/A36_steel", fetched: "2026-09-15" } },

  { id: 11, category: "Materials",
    prompt: "Young's modulus of aluminum",
    units: "GPa", value: 70, min: 5, max: 400, scale: "linear",
    factoid: "~70 GPa — a third of steel, so an aluminum beam deflects 3× more under the same load.",
    qualifier: "alloy-dependent; range ~69–73 GPa",
    source: { name: "Wikipedia, \"6061 aluminium alloy\"", url: "https://en.wikipedia.org/wiki/6061_aluminium_alloy", fetched: "2026-09-15" } },

  { id: 12, category: "Materials",
    prompt: "Typical compressive strength of standard concrete",
    units: "psi", value: 4000, min: 500, max: 15000, scale: "linear",
    factoid: "Sidewalks run ~3,000 psi, structural work 4,000–5,000 — and concrete is ~10× weaker in tension, hence rebar.",
    source: { name: "Engineering ToolBox, Concrete Properties", url: "https://www.engineeringtoolbox.com/concrete-properties-d_1223.html", fetched: "2026-09-16" } },

  { id: 13, category: "Materials",
    prompt: "Approximate melting point of carbon steel",
    units: "°C", value: 1500, min: 200, max: 3500, scale: "linear",
    factoid: "Pure iron melts at 1,538 °C, carbon steel a bit lower — a building fire won't melt steel, but it softens it enough to fail.",
    source: { name: "Engineering ToolBox, Metal Alloys — Melting Points", url: "https://www.engineeringtoolbox.com/melting-points-mixtures-metals-d_1269.html", fetched: "2026-09-16" } },

  { id: 14, category: "Materials",
    prompt: "Density of aluminum",
    units: "kg/m³", value: 2700, min: 500, max: 10000, scale: "linear",
    factoid: "2,700 kg/m³ — SG 2.7, one-third of steel. Fun twist: their stiffness-to-weight ratios are nearly identical.",
    source: { name: "AmesWeb, Density of Aluminum (Alloys)", url: "https://amesweb.info/Materials/Density_of_Aluminum.aspx", fetched: "2026-09-16" } },

  { id: 15, category: "Materials",
    prompt: "Coefficient of thermal expansion of steel",
    units: "µm/m·°C", value: 12, min: 1, max: 50, scale: "linear",
    factoid: "~12 µm/m·°C — close enough to concrete's own rate that reinforced concrete works at all.",
    qualifier: "typical value; concrete's CTE is itself a 7–13 µm/m·°C range depending on aggregate, so the steel/concrete match is approximate, not exact",
    source: { name: "Eng-Tips forum, \"Coefficient of Thermal Expansion for Concrete\" (citing US Steel's Atlas for steel, 11.7–13.5 µm/m·°C)", url: "https://www.eng-tips.com/threads/coefficient-of-thermal-expansion-for-concrete.124080/", fetched: "2026-09-16" } },

  { id: 16, category: "Materials",
    prompt: "Density of reinforced concrete",
    units: "lb/ft³", value: 150, min: 40, max: 500, scale: "linear",
    factoid: "~150 lb/ft³ — 2.4× water. One cubic yard of concrete weighs about two tons.",
    qualifier: "ACI 318's normal-weight design convention; the code's normal-weight band is 135–160 pcf, not a single physical constant",
    source: { name: "ACI 318-19 §19.2.4 normal-weight concrete definition (135–160 pcf)", url: "https://www.structurepoint.org/publication/pdf/Modification-Factor-Lightweight-Concrete-Types.pdf", fetched: "2026-09-15" } },

  /* ---------------- ELECTRICAL ---------------- */
  { id: 17, category: "Electrical",
    prompt: "Nominal voltage of a standard US wall outlet",
    units: "V", value: 120, min: 20, max: 500, scale: "linear",
    factoid: "120 V is the RMS value — the waveform actually swings to ±170 V peak, 60 times a second.",
    source: { name: "NEMA 5-15R outlet configuration reference (125 V nominal, standard US residential/commercial receptacle)", url: "https://asmr.education/faq/electric-outlets/nema-5-15r-outlet-configuration", fetched: "2026-09-16" } },

  { id: 18, category: "Electrical",
    prompt: "Smallest standard circuit breaker size in a US home",
    units: "A", value: 15, min: 2, max: 80, scale: "linear",
    factoid: "15 A × 120 V = 1,800 W — why a hair dryer plus a space heater on one circuit trips the breaker.",
    source: { name: "NEC Table 240.6(A), Standard Ampere Ratings", url: "https://up.codes/s/standard-ampere-ratings", fetched: "2026-09-15" } },

  { id: 19, category: "Electrical",
    prompt: "Electrical resistivity of copper",
    units: "Ω·m", value: 1.7e-8, min: 1e-10, max: 1e-4, scale: "log",
    factoid: "1.7×10⁻⁸ Ω·m — the benchmark all conductors are measured against; aluminum is ~60% more resistive.",
    qualifier: "at 20°C; rises ~0.4%/°C",
    source: { name: "Engineering ToolBox, Resistivity and Conductivity", url: "https://www.engineeringtoolbox.com/resistivity-conductivity-d_418.html", fetched: "2026-09-15" } },

  { id: 20, category: "Electrical",
    prompt: "Cooking (output) power of a typical countertop microwave",
    units: "W", value: 1000, min: 100, max: 4000, scale: "linear",
    factoid: "Most microwaves run 700–1,200 W of cooking power — the one in the break room is probably 1,000.",
    source: { name: "Whirlpool, \"What Microwave Wattage Do You Need?\" (appliance-manufacturer reference)", url: "https://www.whirlpool.com/blog/kitchen/what-microwave-wattage-do-you-need.html", fetched: "2026-09-16" } },

  { id: 21, category: "Electrical",
    prompt: "Voltage of a single AA alkaline battery",
    units: "V", value: 1.5, min: 0.2, max: 12, scale: "linear",
    factoid: "1.5 V per alkaline cell — a 9 V battery is literally six tiny cells stacked in series.",
    source: { name: "Pololu, \"Understanding battery capacity: Ah is not A\"", url: "https://www.pololu.com/blog/2/understanding-battery-capacity-ah-is-not-a", fetched: "2026-09-15" } },

  { id: 22, category: "Electrical",
    prompt: "Speed of light in a vacuum",
    units: "m/s", value: 3e8, min: 1e4, max: 1e12, scale: "log",
    factoid: "3×10⁸ m/s — about one foot per nanosecond, the number that sets the speed limit for every circuit.",
    source: { name: "Wikipedia, \"Speed of light\" (SI-exact definition since 1983)", url: "https://en.wikipedia.org/wiki/Speed_of_light", fetched: "2026-09-15" } },

  { id: 23, category: "Electrical",
    prompt: "Rule-of-thumb AC current across the chest for cardiac fibrillation risk",
    units: "mA", value: 100, min: 0.01, max: 10000, scale: "log",
    factoid: "Not a threshold but one point on a curve: IEC 60479-1 sets fibrillation risk by current, duration and path — 80 mA for 10 s is already ~50% risk. Lower is not safe.",
    qualifier: "a rule-of-thumb anchor on a current-duration-path curve; sustained (>1 s) exposure carries meaningful fibrillation risk from as low as ~30 mA, while ~16 mA is the commonly cited let-go threshold and ~20 mA can paralyze the muscles used to breathe",
    source: { name: "NIH/NCBI StatPearls, \"Electrical Injuries\"; and Wikipedia, \"Electrical injury\" (citing IEC 60479-1)", url: "https://www.ncbi.nlm.nih.gov/books/NBK580528/", fetched: "2026-09-16" } },

  { id: 24, category: "Electrical",
    prompt: "Minimum voltage you can feel as a static shock",
    units: "V", value: 3000, min: 10, max: 1e7, scale: "log",
    factoid: "Below ~3,000 V you feel nothing; a doorknob zap is 5–25 kV at almost zero energy. Voltage alone isn't danger.",
    qualifier: "perception threshold reported 2,000–4,000 V depending on humidity, contact area and the specific discharge event",
    source: { name: "EC&M, \"Electrostatic Discharge: Causes, Effects, and Solutions\" (citing ANSI/ESDA/JEDEC JS-001 and NFPA-77)", url: "https://www.ecmweb.com/content/article/20897138/electrostatic-discharge-causes-effects-and-solutions", fetched: "2026-09-16" } },

  /* ---------------- FLUIDS & THERMO ---------------- */
  { id: 25, category: "Fluids & Thermo",
    prompt: "How much lower is water's boiling point in Denver (5,280 ft) than at sea level?",
    units: "°F", value: 10, min: 1, max: 50, scale: "linear",
    factoid: "Boiling drops ~2 °F per 1,000 ft of altitude — Denver loses ~10 °F, boiling at ~202 °F, so pasta takes longer.",
    source: { name: "NIST Chemistry WebBook, Water (saturation pressure–temperature relation)", url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=4", fetched: "2026-09-16" } },

  { id: 26, category: "Fluids & Thermo",
    prompt: "Water pressure gained per foot of depth",
    units: "psi/ft", value: 0.433, min: 0.05, max: 2, scale: "linear",
    factoid: "0.433 psi per foot — divers pick up one full atmosphere every 33.9 ft of water.",
    source: { name: "Exact derivation: 62.4 lb/ft³ ÷ 144 in²/ft² (see item 5)", url: "https://www.engineeringtoolbox.com/hydrostatic-pressure-water-d_1632.html", fetched: "2026-09-15" } },

  { id: 27, category: "Fluids & Thermo",
    prompt: "Density of air at sea level",
    units: "kg/m³", value: 1.225, min: 0.1, max: 5, scale: "linear",
    factoid: "1.2 kg/m³ — sounds like nothing, but the air in your classroom weighs more than you do.",
    qualifier: "ISA reference condition at 15°C, 101.325 kPa; real air density varies ~1.15–1.3 kg/m³ with temperature and humidity",
    source: { name: "ICAO Doc 7488, Manual of the ICAO Standard Atmosphere", url: "https://news.ncac.mn/uploads/bookSubject/2022-11/6369ec174ab34.pdf", fetched: "2026-09-16" } },

  { id: 28, category: "Fluids & Thermo",
    prompt: "Typical city water pressure at your tap",
    units: "psi", value: 60, min: 5, max: 200, scale: "linear",
    factoid: "Municipal mains deliver 40–80 psi; above 80, plumbing code requires a pressure regulator.",
    source: { name: "up.codes, \"Minimum Pressure\" (IPC 604.8 / UPC 608.2)", url: "https://up.codes/s/minimum-pressure", fetched: "2026-09-15" } },

  { id: 29, category: "Fluids & Thermo",
    prompt: "Latent heat of vaporization of water",
    units: "kJ/kg", value: 2260, min: 200, max: 6000, scale: "linear",
    factoid: "2,260 kJ/kg — boiling water away takes over 5× the energy of heating it from 0 to 100 °C. It's why sweating works.",
    source: { name: "NIST Chemistry WebBook, Water (thermophysical properties)", url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=4", fetched: "2026-09-16" } },

  { id: 30, category: "Fluids & Thermo",
    prompt: "Specific heat capacity of liquid water",
    units: "J/g·°C", value: 4.18, min: 0.5, max: 15, scale: "linear",
    factoid: "4.18 J/g·°C — one calorie. Water's huge heat capacity is why coastal cities have mild weather.",
    source: { name: "NIST Chemistry WebBook, Water (thermophysical properties)", url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=4", fetched: "2026-09-16" } },

  { id: 31, category: "Fluids & Thermo",
    prompt: "Energy content of one gallon of gasoline",
    units: "kWh", value: 33.7, min: 5, max: 120, scale: "linear",
    factoid: "The EPA 'e-gallon' is 33.7 kWh — roughly one full day of an average US home's electricity in a single gallon.",
    qualifier: "EPA's MPGe regulatory constant (115,010 BTU/gal); sits inside real gasoline's measured ~32–34 kWh/gal range for both E0 and E10, not below it",
    source: { name: "EPA, Fuel Economy and EV Range Testing; Wikipedia, \"Gasoline gallon equivalent\"", url: "https://www.epa.gov/greenvehicles/fuel-economy-and-ev-range-testing", fetched: "2026-09-15" } },

  { id: 32, category: "Fluids & Thermo",
    prompt: "Heat output of a resting human body",
    units: "W", value: 100, min: 10, max: 600, scale: "linear",
    factoid: "You idle at ~100 W — a warm light bulb. HVAC engineers literally count room loads in people.",
    qualifier: "typical value; measured range ~100–120 W depending on body size and activity level",
    source: { name: "Engineering ToolBox, Metabolic Heat Gain from Persons", url: "https://www.engineeringtoolbox.com/metabolic-heat-persons-d_706.html", fetched: "2026-09-16" } },

  /* ---------------- EVERYDAY ENGINEERING ---------------- */
  { id: 33, category: "Everyday Engineering",
    prompt: "Weight of a gallon of water",
    units: "lbs", value: 8.34, min: 1, max: 30, scale: "linear",
    factoid: "'A pint's a pound the world around' — plus a little: 8.34 lbs per gallon.",
    source: { name: "NIST Chemistry WebBook, Water (density at ~62°F)", url: "https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=4", fetched: "2026-09-16" } },

  { id: 34, category: "Everyday Engineering",
    prompt: "Proper angle between an extension ladder and the ground",
    units: "°", value: 75, min: 20, max: 90, scale: "linear",
    factoid: "OSHA's 4-to-1 rule — base out one foot for every four feet up — works out to about 75°.",
    qualifier: "the governing rule is the 4-to-1 base offset (arctan 4 ≈ 75.5°); 75° is the commonly rounded figure",
    source: { name: "OSHA 1926.1053, Ladders (4-to-1 base-offset rule)", url: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.1053", fetched: "2026-09-16" } },

  { id: 35, category: "Everyday Engineering",
    prompt: "Maximum current rating of a 16-gauge extension cord",
    units: "A", value: 13, min: 1, max: 50, scale: "linear",
    factoid: "Light-duty 16 AWG cords are rated 13 A for a short 2-conductor cord — a 1,500 W heater pulls 12.5 A continuously, past the 80% derate, and the cord becomes the heater.",
    qualifier: "NEC Table 400.5(A)(1) conditions ampacity on conductor count and ambient temperature, not length; a separate, widely published length-based derating guide (13 A to 25 ft, dropping toward 7–10 A by 50–100 ft) is a manufacturer/practical-safety convention, not the NEC table itself",
    source: { name: "up.codes, \"Ampacities for Flexible Cords and Flexible Cables\" (NEC Table 400.5(A)(1))", url: "https://up.codes/s/ampacities-for-flexible-cords-and-flexible-cables", fetched: "2026-09-16" } },

  { id: 36, category: "Everyday Engineering",
    prompt: "Maximum grade allowed on US Interstate highways",
    units: "%", value: 6, min: 1, max: 25, scale: "linear",
    factoid: "Interstates are capped at 6% grade in mountainous terrain, 3–4% on the flat — runaway-truck ramps exist for what happens past that.",
    qualifier: "AASHTO's Green Book sets maximum grade by a terrain × design-speed table, not a flat cap; 6% is the commonly cited mountainous-terrain ceiling for Interstate design speeds",
    source: { name: "TxDOT Roadway Design Manual, Ch. 4.8.1 Grades (terrain × design-speed table, Table 4-11)", url: "https://www.txdot.gov/manuals/des/rdw/chapter-4--basic-design-criteria/4-8-vertical-alignment/4-8-1-grades.html", fetched: "2026-09-16" } },

  { id: 37, category: "Everyday Engineering",
    prompt: "Total energy stored in one AA alkaline battery",
    units: "J", value: 13500, min: 100, max: 1e7, scale: "log",
    factoid: "1.5 V × 2,500 mAh ≈ 13.5 kJ (3.7 Wh) — enough energy to lift a small car about one meter.",
    qualifier: "assumes a typical rated capacity (1,800–3,000 mAh band); actual deliverable energy is also load-dependent",
    source: { name: "Pololu, \"Understanding battery capacity: Ah is not A\"", url: "https://www.pololu.com/blog/2/understanding-battery-capacity-ah-is-not-a", fetched: "2026-09-15" } },

  { id: 38, category: "Everyday Engineering",
    prompt: "Maximum stair riser height under US residential code",
    units: "in", value: 7.75, min: 3, max: 16, scale: "linear",
    factoid: "The IRC caps risers at 7¾ in — and requires every riser in a flight to match within ⅜ in. Uneven stairs cause falls.",
    qualifier: "IRC 2021 R311.7.5.1, residential occupancies; IBC's general means-of-egress cap is 7 in, but §1011.5.2 Exception 3 raises dwelling units to the same 7¾ in — the two codes converge for houses and diverge only for non-dwelling occupancies",
    source: { name: "up.codes, IRC R311.7.5.1 and IBC §1011.5.2 Stair Treads and Risers", url: "https://up.codes/s/stair-treads-and-risers", fetched: "2026-09-15" } },

  { id: 39, category: "Everyday Engineering",
    prompt: "Recommended home water heater temperature setting",
    units: "°F", value: 120, min: 60, max: 210, scale: "linear",
    factoid: "The CPSC/DOE point-of-use target is 120 °F — hot enough to limit scalds, but real installations juggle a second risk too.",
    qualifier: "a scald-prevention point-of-use target, not the only safe number — many manufacturers ship at 140°F and storage below ~122°F raises Legionella growth risk, so some codes call for storing hotter and tempering down with a mixing valve",
    source: { name: "CPSC Publication 5098, \"Tap Water Scalds\"; ASSE water-heater scald-hazard white paper", url: "https://www.cpsc.gov/s3fs-public/5098.pdf", fetched: "2026-09-16" } },

  { id: 40, category: "Everyday Engineering",
    prompt: "Typical cruising altitude of a commercial jet",
    units: "ft", value: 35000, min: 5000, max: 80000, scale: "linear",
    factoid: "~35,000 ft — the air is about ⅓ sea-level density (less drag) while engines still breathe. It's −55 °C outside.",
    source: { name: "ICAO Doc 7488, Manual of the ICAO Standard Atmosphere (altitude/density/temperature table)", url: "https://news.ncac.mn/uploads/bookSubject/2022-11/6369ec174ab34.pdf", fetched: "2026-09-16" } },
];

/* Items scored on the log slider — see app.js scoreGuess(). Kept as an
   explicit id list here (rather than re-deriving it from `scale` at every
   call site) because stage 2 ("Log estimates") is defined as exactly this
   set: the demo's five orders-of-magnitude questions, regardless of which
   category each belongs to. */
const LOG_IDS = QUESTIONS.filter(q => q.scale === "log").map(q => q.id);

if (typeof module !== "undefined") module.exports = { QUESTIONS, LOG_IDS };
