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
     band     OPTIONAL [lo, hi]. A guess anywhere inside it scores as
              correct (BULLSEYE); outside it, the error is measured from
              the nearest edge instead of from `value`. Use ONLY where the
              item's own qualifier or factoid already names a sourced
              numeric range for the SAME quantity the prompt asks about —
              never invent one, and never widen it past the source. The
              reveal still shows `value` as the single anchor; the band
              changes the score, not the display.
     source   { name, url, fetched } — the primary or best-available
              citation actually checked for this build, with the date it
              was fetched. Every URL here was fetched on the date shown and
              contains the taught number (or the derivation's inputs);
              none were back-filled from memory. Where a better citation
              exists only behind a paywall, a bot wall or a certificate
              failure, `name` says so and `url` points at the reachable
              page that carries the number. Lane records:
              .aia/.data/demo-fleet-format-alignment/{B,R,C}-should-have-known-that-progress.md.
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
    qualifier: "range 30–35° for dry, not-too-angular granular material; a distinct quantity from the engineering (design) friction angle, which this item does not name",
    band: [30, 35],
    source: { name: "MIT OpenCourseWare 12.090, Ch. 10 \"Mass Wasting\" §2.1.2 (\"the angle of repose lies in the range 30-35°\")", url: "https://ocw.mit.edu/courses/12-090-the-environment-of-the-earths-surface-spring-2007/ab6d240ac88d9c3c222f09fbea7fc615_earthsurface_10.pdf", fetched: "2026-09-16" } },

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
    qualifier: "AISC 360's fixed design constant (29,000 ksi) for all structural-steel grades — a convention every grade shares, not a measured average for any one of them",
    source: { name: "AISC 360 design value (29,000 ksi), via steelcalculator.app reference", url: "https://steelcalculator.app/reference/steel-modulus-of-elasticity/", fetched: "2026-09-16" } },

  { id: 10, category: "Materials",
    prompt: "Yield strength of A36 mild steel",
    units: "MPa", value: 250, min: 20, max: 1200, scale: "linear",
    factoid: "The '36' in A36 is the yield strength in ksi — 36 ksi ≈ 250 MPa, the default mild-steel number.",
    qualifier: "specified minimum, not typical — real mill-certified A36 commonly tests higher (AISC 341's seismic provisions take the expected yield as 1.5 × 36 = 54 ksi ≈ 370 MPa), and the minimum drops to 220 MPa (32 ksi) above 8 in thickness",
    band: [250, 370],
    source: { name: "Wikipedia, \"A36 steel\" (quoting ASTM A36/A36M's minimum-yield and thickness-exception language)", url: "https://en.wikipedia.org/wiki/A36_steel", fetched: "2026-09-16",
              also: [{ name: "AISC 341-16 Table A3.1, Ry = 1.5 for A36 (expected yield 54 ksi), via steelcalculator.app", url: "https://steelcalculator.app/reference/astm-a36-steel/" }] } },

  { id: 11, category: "Materials",
    prompt: "Young's modulus of aluminum",
    units: "GPa", value: 70, min: 5, max: 400, scale: "linear",
    factoid: "~70 GPa — a third of steel, so an aluminum beam deflects 3× more under the same load.",
    qualifier: "alloy-dependent, but only slightly: pure aluminum ~69 GPa, common structural alloys ~70 GPa (6061 is 68–69 GPa regardless of temper)",
    source: { name: "Engineering ToolBox, Young's Modulus of Elasticity (Aluminum 69, Aluminum Alloys 70 GPa)", url: "https://www.engineeringtoolbox.com/young-modulus-d_417.html", fetched: "2026-09-16",
              also: [{ name: "Wikipedia, \"6061 aluminium alloy\" (68–69 GPa)", url: "https://en.wikipedia.org/wiki/6061_aluminium_alloy" }] } },

  { id: 12, category: "Materials",
    prompt: "Typical compressive strength of standard concrete",
    units: "psi", value: 4000, min: 500, max: 15000, scale: "linear",
    factoid: "Sidewalks run ~3,000 psi, structural work 4,000–5,000 — and concrete is ~10× weaker in tension, hence rebar.",
    band: [3000, 5000],
    source: { name: "Engineering ToolBox, Concrete Properties (compressive strength 20–40 MPa = 3,000–6,000 psi; tensile 300–700 psi)", url: "https://www.engineeringtoolbox.com/concrete-properties-d_1223.html", fetched: "2026-09-16" } },

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
    qualifier: "typical value; steels tabulate at ~10.8–12.5 µm/m·°C by grade, and concrete at ~10–14 depending on aggregate, so the steel/concrete match is approximate, not exact",
    band: [10.8, 12.5],
    source: { name: "Engineering ToolBox, Linear Thermal Expansion Coefficients (Steel 10.8–12.5; Concrete 13–14; concrete structure 9.8 ×10⁻⁶/K)", url: "https://www.engineeringtoolbox.com/linear-expansion-coefficients-d_95.html", fetched: "2026-09-16" } },

  { id: 16, category: "Materials",
    prompt: "Density of reinforced concrete",
    units: "lb/ft³", value: 150, min: 40, max: 500, scale: "linear",
    factoid: "~150 lb/ft³ — 2.4× water. One cubic yard of concrete weighs about two tons.",
    qualifier: "ACI 318's normal-weight design convention; the code's normal-weight band is 135–160 pcf, not a single physical constant",
    band: [135, 160],
    source: { name: "ACI 318-14 Table 19.2.4.2 normal-weight concrete definition (135–160 pcf), as quoted in StructurePoint's lightweight-concrete modification-factor note", url: "https://www.structurepoint.org/publication/pdf/Modification-Factor-Lightweight-Concrete-Types.pdf", fetched: "2026-09-15" } },

  /* ---------------- ELECTRICAL ---------------- */
  { id: 17, category: "Electrical",
    prompt: "Nominal voltage of a standard US wall outlet",
    units: "V", value: 120, min: 20, max: 500, scale: "linear",
    factoid: "120 V is the RMS value — the waveform actually swings to ±170 V peak, 60 times a second.",
    source: { name: "NEMA 5-15R outlet configuration reference (device rated 15 A at 125 V; 120 V is the nominal US system voltage)", url: "https://asmr.education/faq/electric-outlets/nema-5-15r-outlet-configuration", fetched: "2026-09-16" } },

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
    band: [700, 1200],
    source: { name: "Top Ten Reviews, \"What microwave wattage is best?\" (appliance-expert guidance: 600–700 W entry models, 1,000–1,200 W mainstream; the Whirlpool guide cited earlier now times out or refuses fetches, so it is not linked)", url: "https://www.toptenreviews.com/what-microwave-wattage-is-best", fetched: "2026-09-16" } },

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
    band: [30, 100],
    source: { name: "NIH/NCBI StatPearls, \"Electrical Injuries\" (16 mA let-go, 20 mA respiratory paralysis, 100 mA fibrillation)", url: "https://www.ncbi.nlm.nih.gov/books/NBK580528/", fetched: "2026-09-16",
              also: [{ name: "Wikipedia, \"Electrical injury\" (>1 s across the chest: fibrillation from as low as 30 mA; IEC 60479-1 zones)", url: "https://en.wikipedia.org/wiki/Electrical_injury" },
                     { name: "IEC 60479-1:2018 §3.3.2 Note 1 (50 % fibrillation probability at 10 s: 80 mA AC), sample pages", url: "https://cdn.standards.iteh.ai/samples/102053/a6ad398bc8e94fc29370ca887ba3cb16/IEC-60479-1-2018.pdf" }] } },

  { id: 24, category: "Electrical",
    prompt: "Minimum voltage you can feel as a static shock",
    units: "V", value: 3000, min: 10, max: 1e7, scale: "log",
    factoid: "Most people first feel a static shock somewhere in the 2,000–4,000 V range; a doorknob zap is 5–25 kV at almost zero energy. Voltage alone isn't danger.",
    qualifier: "perception threshold reported 2,000–4,000 V for most people, depending on humidity, contact area and the specific discharge event; sources disagree at the edges (one industry article puts it above 4,000 V)",
    band: [2000, 4000],
    source: { name: "Xerox EHS, \"Facts about Electrostatic Discharge\" (\"the threshold for feeling static shocks is in the range of 2,000-4,000 volts\")", url: "https://www.xerox.com/downloads/usa/en/e/ehs_facts_about_esd.pdf", fetched: "2026-09-16",
              also: [{ name: "EC&M, \"Electrostatic Discharge: Causes, Effects, and Solutions\" (\"only sensitive on ESD levels that exceed 4,000V\"; cites NFPA 77)", url: "https://www.ecmweb.com/content/article/20897138/electrostatic-discharge-causes-effects-and-solutions" }] } },

  /* ---------------- FLUIDS & THERMO ---------------- */
  { id: 25, category: "Fluids & Thermo",
    prompt: "How much lower is water's boiling point in Denver (5,280 ft) than at sea level?",
    units: "°F", value: 10, min: 1, max: 50, scale: "linear",
    factoid: "Boiling drops ~2 °F per 1,000 ft of altitude — Denver loses ~10 °F, boiling at ~202 °F, so pasta takes longer.",
    source: { name: "Engineering ToolBox, Boiling Point of Water vs. Altitude (5,000 ft → 202.4 °F; 212 − 202.4 = 9.6 °F)", url: "https://www.engineeringtoolbox.com/boiling-points-water-altitude-d_1344.html", fetched: "2026-09-16" } },

  { id: 26, category: "Fluids & Thermo",
    prompt: "Water pressure gained per foot of depth",
    units: "psi/ft", value: 0.433, min: 0.05, max: 2, scale: "linear",
    factoid: "0.433 psi per foot — divers pick up one full atmosphere every 33.9 ft of water.",
    source: { name: "Exact derivation: 62.4 lb/ft³ ÷ 144 in²/ft² (see item 5)", url: "https://www.engineeringtoolbox.com/hydrostatic-pressure-water-d_1632.html", fetched: "2026-09-15" } },

  { id: 27, category: "Fluids & Thermo",
    prompt: "Density of air at sea level",
    units: "kg/m³", value: 1.225, min: 0.1, max: 5, scale: "linear",
    factoid: "1.2 kg/m³ — sounds like nothing, but the air in your classroom weighs more than you do.",
    qualifier: "ISA reference condition at 15°C, 101.325 kPa; at sea-level pressure, dry air runs ~1.29 kg/m³ at 0°C down to ~1.16 at 30°C",
    band: [1.164, 1.292],
    source: { name: "Engineering ToolBox, U.S. Standard Atmosphere (sea level: 15 °C, 1.225 kg/m³)", url: "https://www.engineeringtoolbox.com/standard-atmosphere-d_604.html", fetched: "2026-09-16",
              also: [{ name: "Engineering ToolBox, Air Density vs. Temperature at 1 atm (0 °C 1.292; 15 °C 1.225; 30 °C 1.164 kg/m³)", url: "https://www.engineeringtoolbox.com/air-density-specific-weight-d_600.html" }] } },

  { id: 28, category: "Fluids & Thermo",
    prompt: "Typical city water pressure at your tap",
    units: "psi", value: 60, min: 5, max: 200, scale: "linear",
    factoid: "Utilities aim to deliver at least ~40 psi to the property line, and above 80 psi plumbing code requires a pressure regulator — so most taps see 40–80.",
    band: [40, 80],
    source: { name: "City of Portland Code 21.30.140, Water Pressure at Service (service goal 40–110 psi at the property line; pressure-reducing device required above 80 psi)", url: "https://www.portland.gov/code/21/30/140", fetched: "2026-09-16",
              also: [{ name: "up.codes, IRC P2903.3 as served (static water pressure shall be not greater than 80 psi; jurisdiction-routed page)", url: "https://up.codes/s/minimum-pressure" }] } },

  { id: 29, category: "Fluids & Thermo",
    prompt: "Latent heat of vaporization of water",
    units: "kJ/kg", value: 2260, min: 200, max: 6000, scale: "linear",
    factoid: "2,260 kJ/kg at the boiling point — boiling water away takes over 5× the energy of heating it from 0 to 100 °C. It's why sweating works.",
    source: { name: "Engineering ToolBox, Water — Properties vs. Temperature (heat of vaporization 2,256.4 kJ/kg at 100 °C)", url: "https://www.engineeringtoolbox.com/water-properties-d_1573.html", fetched: "2026-09-16" } },

  { id: 30, category: "Fluids & Thermo",
    prompt: "Specific heat capacity of liquid water",
    units: "J/g·°C", value: 4.18, min: 0.5, max: 15, scale: "linear",
    factoid: "4.18 J/g·°C — one calorie. Water's huge heat capacity is why coastal cities have mild weather.",
    source: { name: "Engineering ToolBox, Water — Specific Heat vs. Temperature (4.18 kJ/kg·K from 25 °C to 60 °C)", url: "https://www.engineeringtoolbox.com/specific-heat-capacity-water-d_660.html", fetched: "2026-09-16" } },

  { id: 31, category: "Fluids & Thermo",
    prompt: "Energy content of one gallon of gasoline",
    units: "kWh", value: 33.7, min: 5, max: 120, scale: "linear",
    factoid: "The EPA 'e-gallon' is 33.7 kWh — roughly one full day of an average US home's electricity in a single gallon.",
    qualifier: "EPA's MPGe regulatory constant (≈115,000 BTU/gal, lower-heating-value basis); sits inside real gasoline's measured ~33–34 kWh/gal LHV range for both E0 and E10, not below it — on a higher-heating-value basis gasoline is ~35–36 kWh/gal",
    source: { name: "EPA, Fuel Economy and EV Range Testing (\"33.7 kilowatt-hours\")", url: "https://www.epa.gov/greenvehicles/fuel-economy-and-ev-range-testing", fetched: "2026-09-15",
              also: [{ name: "AFDC Fuel Properties Comparison (gasoline LHV 112,114–116,090 Btu/gal = 32.9–34.0 kWh; HHV 120,388–124,340 = 35.3–36.4 kWh)", url: "https://afdc.energy.gov/fuels/properties" }] } },

  { id: 32, category: "Fluids & Thermo",
    prompt: "Heat output of a resting human body",
    units: "W", value: 100, min: 10, max: 600, scale: "linear",
    factoid: "You idle at ~100 W — a warm light bulb. HVAC engineers literally count room loads in people.",
    qualifier: "the ISO/ASHRAE-based table value for an average adult male 'seated at rest'; the same table's next row, 'seated, very light work', is 120 W — body size and activity move it in both directions",
    source: { name: "Engineering ToolBox, Metabolic Heat Gain from Persons (Seated at rest 100 W; Seated, very light work 120 W)", url: "https://www.engineeringtoolbox.com/metabolic-heat-persons-d_706.html", fetched: "2026-09-16" } },

  /* ---------------- EVERYDAY ENGINEERING ---------------- */
  { id: 33, category: "Everyday Engineering",
    prompt: "Weight of a gallon of water",
    units: "lbs", value: 8.34, min: 1, max: 30, scale: "linear",
    factoid: "'A pint's a pound the world around' — plus a little: 8.34 lbs per gallon.",
    source: { name: "Derivation from item 5: 62.4 lb/ft³ × 231 in³/gal ÷ 1,728 in³/ft³ = 8.34 lb (US gallon; an imperial gallon is ~10 lb). NIST defines the gallon as 231 cubic inches", url: "https://www.nist.gov/how-do-you-measure-it/how-do-you-measure-fuel-gas-pump", fetched: "2026-09-16",
              also: [{ name: "USGS Water Science School, Water Density (62.366 lb/ft³ at 60 °F, 62.4 at 40–50 °F)", url: "https://www.usgs.gov/special-topics/water-science-school/science/water-density" }] } },

  { id: 34, category: "Everyday Engineering",
    prompt: "Proper angle between an extension ladder and the ground",
    units: "°", value: 75, min: 20, max: 90, scale: "linear",
    factoid: "OSHA's 4-to-1 rule — the base sits out one-quarter of the ladder's working length — works out to about 75°.",
    qualifier: "OSHA 1926.1053(b)(5)(i) sets the base offset at one-quarter of the ladder's WORKING LENGTH (along the ladder), so the angle is arccos ¼ = 75.5°; the rise-over-run reading (arctan 4 = 76.0°) is a common approximation, and 75° the commonly rounded figure",
    source: { name: "29 CFR 1926.1053(b)(5)(i), Ladders — via Cornell LII (osha.gov's own copy refuses automated readers)", url: "https://www.law.cornell.edu/cfr/text/29/1926.1053", fetched: "2026-09-16" } },

  { id: 35, category: "Everyday Engineering",
    prompt: "Maximum current rating of a 16-gauge extension cord",
    units: "A", value: 13, min: 1, max: 50, scale: "linear",
    factoid: "Light-duty 16 AWG cords are rated 13 A with two current-carrying conductors (10 A with three) — a 1,500 W heater pulls 12.5 A continuously, past the 80% derate, and the cord becomes the heater.",
    qualifier: "NEC Table 400.5(A)(1) conditions ampacity on conductor count and ambient temperature, not length; a separate, widely published length-based derating guide (13 A to 25 ft, dropping toward 7–10 A by 50–100 ft) is a manufacturer/practical-safety convention, not the NEC table itself",
    source: { name: "NEC Table 400.5(A)(1) as rendered by Distributor Wire & Cable (16 AWG: 13 A with 2 current-carrying conductors, 10 A with 3)", url: "https://www.distributorwire.com/blogs/soow-so-cord-ampacity-chart-nec-400-5", fetched: "2026-09-16",
              also: [{ name: "MSHA, NEC Article 400 excerpt (Table 400-5, 16 AWG: 10 A / 13 A)", url: "https://arlweb.msha.gov/District/DIST_09/Electrical%20test%20materials/ART400.pdf" },
                     { name: "up.codes, NEC 400.5 Ampacities for Flexible Cords and Flexible Cables (conditions text; the table itself is not served to automated readers)", url: "https://up.codes/s/ampacities-for-flexible-cords-and-flexible-cables" }] } },

  { id: 36, category: "Everyday Engineering",
    prompt: "Maximum grade allowed on US Interstate highways",
    units: "%", value: 6, min: 1, max: 25, scale: "linear",
    factoid: "Interstates are capped at 6% grade in mountainous terrain, 3–4% on the flat — runaway-truck ramps exist for what happens past that.",
    qualifier: "AASHTO's Interstate policy sets maximum grade by a terrain × design-speed table, not a flat cap — Montana's Interstate standards read 3 / 4 / 5% for level / rolling / mountainous at 70 mph, with up to 7% where needed in mountains; 6% is the commonly cited mountainous figure at lower design speeds (the AASHTO table itself is paywalled)",
    source: { name: "Montana DOT Geometric Design Standards, §2.1 Rural Freeways (Interstate): max grade by terrain, note 8 (up to 7% in mountainous terrain)", url: "https://www.mdt.mt.gov/other/webdata/external/cadd/RDM/STANDARDS/GEOMETRIC-DESIGN-STANDARDS.pdf", fetched: "2026-09-16",
              also: [{ name: "TxDOT Roadway Design Manual, Ch. 4.8.1 Grades (terrain × design-speed structure, Table 4-11; no Interstate row)", url: "https://www.txdot.gov/manuals/des/rdw/chapter-4--basic-design-criteria/4-8-vertical-alignment/4-8-1-grades.html" }] } },

  { id: 37, category: "Everyday Engineering",
    prompt: "Total energy stored in one AA alkaline battery",
    units: "J", value: 13500, min: 100, max: 1e7, scale: "log",
    factoid: "1.5 V × 2,500 mAh ≈ 13.5 kJ (3.7 Wh) — enough energy to lift a small car about one meter.",
    qualifier: "assumes a typical rated capacity (2,000–3,000 mAh, i.e. 10.8–16.2 kJ at 1.5 V); actual deliverable energy is also load-dependent",
    band: [10800, 16200],
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
    source: { name: "Military & Aerospace Electronics, \"Why commercial aircraft cruise around 35,000 feet\" (2026-08-21)", url: "https://www.militaryaerospace.com/commercial-aerospace/news/55399427/why-commercial-aircraft-cruise-around-35000-feet", fetched: "2026-09-16",
              also: [{ name: "Engineering ToolBox, U.S. Standard Atmosphere (35,000 ft: −65.6 °F, density 0.31× sea level)", url: "https://www.engineeringtoolbox.com/standard-atmosphere-d_604.html" }] } },
];

/* Items scored on the log slider — see app.js scoreGuess(). Kept as an
   explicit id list here (rather than re-deriving it from `scale` at every
   call site) because stage 2 ("Log estimates") is defined as exactly this
   set: the demo's five orders-of-magnitude questions, regardless of which
   category each belongs to. */
const LOG_IDS = QUESTIONS.filter(q => q.scale === "log").map(q => q.id);

if (typeof module !== "undefined") module.exports = { QUESTIONS, LOG_IDS };
