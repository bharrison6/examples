# Plan: Negotiation-Coach Framework for the Car Conversation Tracker

## Context — why we're building this

The tracker (`conversation-tracker/`) is the **data layer**: VIN-keyed vehicle records with a full SMS/call event history, a per-vehicle markdown `scratchpad`, a `BUYER_PROFILE.md` playbook, a canonical Jeep trade-in profile, and a privacy contract that governs how dealer threads are read. It was always meant to be topped by an **intelligence layer** — a deal-coaching agent.

Bryant already had a working coach prompt on Gemini (the "Elite Negotiator" persona). It's good but generic: it isn't wired into the tracker's data, it doesn't carry the deal-specific facts (the field, the $24k trade, the KY tax math, what's already been leaked to whom), and it has no memory or improvement loop. The Engineer's Curse it targets is real and live — on 2026-05-27 Bryant leaked his $24k trade ceiling and "~$6k apart" to LR Albany on a call.

**Goal:** port and expand the Gemini framework into a tracker-native coach that (1) works both as a live in-chat persona and a one-shot dispatched subagent, (2) teaches the *why* behind every tactic (Bryant learns fastest when he can reason about a move), (3) inherits the privacy contract, and (4) logs every coaching session so the coach can be tuned over time.

**User decisions (this session):** Both modes (live persona + dispatchable subagent) · **Portable docs only** (no registered `.claude/agents` type — dispatch a general agent at the docs each time) · Companion `PLAYBOOK.md` teaching reference **plus** inline reasoning in every response.

---

## Deliverables & file layout

All new files live in a new `coaching/` folder inside the tracker, so they version with the data (tracker is git-init'd in OneDrive):

```
conversation-tracker/coaching/
├── COACH.md          # operational framework + persona + workflow wiring + invocation
├── PLAYBOOK.md       # teaching reference: every tactic, the WHY, failure modes, car examples
├── LESSONS.md        # distilled, dated lessons that feed back into COACH/PLAYBOOK/BUYER_PROFILE
└── sessions/         # one log file per coaching session (the conversation log)
    └── 2026-05-30-1530_LRAlbany_27909.md   # example
```

Plus one small edit to **`AGENT.md`** (shrink its "Coaching mode" stub to a pointer at `coaching/COACH.md`, keeping AGENT.md focused on import + privacy).

No code changes to `tracker.html` in this phase — coaching output renders through the existing `scratchpad` markdown pane. (A dedicated comparison/coaching UI is explicitly deferred to a later phase.)

---

## 1. `COACH.md` — the operational brain

Sections to write:

**A. Role & persona** (port from Gemini, keep the spine)
- Elite real-time negotiation coach; client is an engineer/professor who runs on logic & problem-solving.
- Counteract the **Engineer's Curse**: over-explaining, solving the dealer's problems, negotiating against himself, leaking leverage under live pressure (loss aversion).
- Tone: direct & unflinching · analytical/systemic (treat the dealership as an adversarial system) · **Late-Night FM DJ voice** (emotional temperature at zero).

**B. The output contract** (this is what makes it teach, every time)
Every recommendation follows: **`Framework name → Why it works (mechanism) → exact script → ⚠️ risk/failure mode`**. Bryant is most fluent in Voss; anchor there and name the play explicitly so he learns the *why* behind the *what*. Each coaching response is structured:
1. **Situation read** (one line).
2. **Leverage snapshot** — the numbers: this vehicle vs the field, trade BATNA, days-on-lot, dealer's price arc, end-of-month timing.
3. **The play** — 1–3 moves in the name→why→script→risk format.
4. **Guardrails** — what NOT to say / what not to concede this round (Engineer's-Curse tripwires).
5. **Info-state / leak ledger** — what THIS dealer already knows, what to protect.
6. **Log line** — append a dated note to the vehicle `scratchpad` + write/update the session file.

**C. Operating rules** (port + harden from Gemini)
- Never concede unilaterally; never negotiate against himself.
- **Never anchor a price ceiling.** Force the dealer to define the math via an itemized **out-the-door (OTD) buyer's order**; anchor analysis on the **financed balance / OTD**, not line items (the Palm Chevy lesson).
- Smuggle tactics inside casual "car-buyer" language so the salesperson's radar stays quiet.
- **Per-dealer info hygiene:** track what's been disclosed to each dealer separately; never re-leak; treat the $24k/"$6k apart" LR Albany leak as already-spent and play around it.

**D. Workflow integration** (the tracker wiring — this is the new part)
On every engagement the coach reads, in order:
- `BUYER_PROFILE.md` (criteria, trim taxonomy, budget ~$41k financed, disclosure discipline)
- `coaching/PLAYBOOK.md` (tactics + reasoning it will cite)
- The target `vehicles/<vin>.json` — `events[]` (tone + history), `scratchpad`, `facts{}`, `starting_price`/`current_price`/`best_offer_received`/`status`
- `index.json` — the **whole field** for BATNA/comparison (current_prices, statuses, trims)
- Jeep trade facts (from `reference_jeep_trade_in_profile.md` / the vehicle facts): payoff **$21,730.73**, best trade **$24,000 local (Purchase Ford)** then Parks $23,700 → Stuckey $23,000 → LR Albany $22,500 → Palm $20,000
- `.research/expedition-recalls-and-reliability.md` for risk flags
Writes: append dated coaching note to `scratchpad`; create/append the `sessions/` log; **propose** changes to `current_price`/`best_offer_received` but never silently change them.

**E. Privacy inheritance** — restate the non-negotiable contract by reference to `AGENT.md` §Privacy rules: dealer threads only, no inbox enumeration/summarizing, never surface non-dealer content. The coach reasons over already-imported `events[]`; if it needs fresh SMS it asks for an import run (it does not free-range the inbox).

**F. Two invocation modes** (portable-doc pattern; no registered agent type)
- **Live persona:** "Load the coach" → main chat reads `COACH.md` + `PLAYBOOK.md` + context and stays in persona for turn-by-turn coaching while Bryant texts.
- **Dispatched subagent:** a copy-paste **dispatch template** (lives at the bottom of COACH.md) handed to the Agent tool, e.g. *"Read coaching/COACH.md and coaching/PLAYBOOK.md, then coach on vehicles/<vin>.json given <latest quote/message>. Follow the output contract. Write a session log."* Good for deep one-shot work: quote forensics, fleet-wide leverage scan, pre-call game-planning.

**G. Deal-specific seed context** baked in: Bryant persona; the active LR Albany fight (Allstate paint/fab addon, ~$6k apart); the BATNA field; KY trade-tax-credit math; disclosure scripts; and recognition of the **trade-sheet-harvesting tactic** (driving DQ vehicles like the Glen Sain pair purely to bank trade appraisals = BATNA-building, not wasted trips).

---

## 2. `PLAYBOOK.md` — the teaching reference (the WHY)

The study guide COACH.md cites. Each entry = **Tactic → Mechanism (why it works) → How it looks in a car deal → Failure mode / tell.** Voss-anchored, then Fisher-Ury, Cialdini, and the deal-math modules. Entries to write:

**Voss (Never Split the Difference)** — Bryant's home turf, so this section is the deepest:
- Tactical empathy & **labeling** ("It sounds like you need to move this unit before month-end") — names the other side's drivers, lowers defensiveness, surfaces hidden constraints.
- **Mirroring** (repeat their last 1–3 words) — makes them elaborate, buys think-time, keeps the info flowing toward you.
- **Calibrated How/What questions** ("How am I supposed to do that at that price?") — Illusion of Control; forces *them* to solve your problem, no yes/no to push against.
- **The "No" frame / "Is now a bad time?"** — "no" makes people feel safe & in control; a protected "no" beats a hollow "yes."
- **"That's right" vs "you're right"** — aim to summarize their world until they say *that's right* (true buy-in); *you're right* is a brush-off.
- **Accusation audit** ("You're going to think I'm a lowballer…") — voice their objection first to defang it.
- **Extreme anchor** — first number bends the settlement toward it; use only when you must name one, justified by criteria.
- **Ackerman** (65→85→95→100% of target, shrinking increments, precise odd final number, non-monetary throw-in) — shrinking steps signal you're tapped out; a precise number ($41,317) reads as calculated, not arbitrary.
- **Dynamic silence** — after an anchor/calibrated question, shut up; the void pressures them to concede. Direct antidote to the Engineer's Curse.
- **Black swans** — hunt the dealer's unknown drivers (floorplan interest on aged inventory, quota, a soon-to-arrive trade) that rewrite the deal.

**Fisher / Ury (Getting to Yes):**
- **Objective criteria** — ground every demand in external data (KBB/market range, OTD math, KY tax, the recall slate) so it's "the numbers," not Bryant vs salesperson.
- **BATNA** — quantify the walk-away: the field + $24k local trade + private-party sale. A strong, *named* BATNA = patience = leverage; defines his true reservation price.
- **Interests not positions** — find *why* a dealer holds a line and trade on it.

**Cialdini (Influence) — defense-oriented:**
- **Scarcity defense** — phantom deposits / "another buyer" manufacture urgency; naming the tactic neutralizes it (several tracked units "sold via deposit" — flag real vs pressure).
- **Authority/consistency-trap defense** — the wife as absent final decision-maker lets Bryant retreat without losing face and blocks today-only closes.
- **Reciprocity awareness** — "I went to bat with my manager" / free perks create felt obligation; label it internally so it doesn't soften the number.
- **Contrast/anchoring** — "$795 at our cost" after $1,495 weaponizes contrast; recognize it.

**Deal-math modules (the objective-criteria engine):**
- **OTD-first discipline** — why only the itemized out-the-door / financed balance is real; line items (doc fee, paint/fab, "at cost") are where margin hides.
- **KY trade-in tax credit** — tax is on the trade *difference*, not full price (~6%); trading in beats private-party unless PP clears trade by >~$1,400. Include the worked breakeven.
- **Leak ledger discipline** — per-dealer disclosure tracking; why asymmetric information is the whole game and re-leaking compounds the damage.
- **Trade-appraisal harvesting** — why driving out-of-target units to bank appraisal sheets strengthens BATNA across the field.

---

## 3. Conversation logging (the session log)

`coaching/sessions/<YYYY-MM-DD-HHMM>_<dealer>_<vinTail>.md`, written every coaching engagement. Template:

```
# Coaching session — <date/time> — <vehicle(s)>, status <...>
## Ask            (what Bryant wanted)
## Situation      (prices, days-on-lot, dealer tone, what's been leaked to this dealer)
## Leverage / BATNA snapshot
## Play given      (frameworks applied — name→why→script→risk)
## Decision        (what Bryant actually did)        ← may be filled live or after
## Outcome         (dealer response, price movement)  ← filled later, links to events[]
## Lessons         (what to fold back)
```

Also: a one-line dated pointer appended to the vehicle's `scratchpad` (keeps the per-vehicle record self-contained, matching the existing LR-Albany convention) linking to the session file.

---

## 4. Improvement loop (tune the coach over time)

The mechanism that satisfies "improve the agent over time":
- Every session logs **Advice → Decision → Outcome**, so each recommendation is later checkable against what the dealer actually did (outcome is pulled from the now-richer `events[]`).
- **`LESSONS.md`** accumulates distilled, dated findings: which scripts moved price, which leaked leverage, recurring dealer tactics (e.g., the Allstate addon's 4-attempt re-attach pattern), what Bryant struggles to hold under pressure.
- **Retro cadence** (a coach task itself, run periodically or after a deal closes/dies): read recent `sessions/`, update `LESSONS.md`, and **propose diffs** to `COACH.md` / `PLAYBOOK.md` / `BUYER_PROFILE.md` (with approval). This is how the rough v1 becomes the "really well-tuned" version Bryant wants.

---

## Critical files

- **Create:** `conversation-tracker/coaching/COACH.md`, `coaching/PLAYBOOK.md`, `coaching/LESSONS.md` (seeded with current known lessons: Palm-Chevy line-item mistake, the $24k/$6k LR-Albany leak, the Allstate re-attach pattern), `coaching/sessions/` (folder + one example/template entry).
- **Edit:** `conversation-tracker/AGENT.md` — replace the "Coaching mode" body with a 2-line pointer to `coaching/COACH.md`; leave import + privacy sections intact.
- **Reuse (read, don't duplicate):** `BUYER_PROFILE.md` (playbook/disclosure), `reference_jeep_trade_in_profile.md` + vehicle `facts` (trade numbers), `index.json` (fleet/BATNA), `vehicles/1FMJU1RT9NEA27909.json` `scratchpad` (the gold-standard analysis style to emulate), `.research/expedition-recalls-and-reliability.md` (risk flags), `AGENT.md` §Privacy rules (inherited verbatim by reference).

---

## Verification (end-to-end)

1. **Dry-run dispatch** the coach (Agent tool, using COACH.md's dispatch template) on the live deal `vehicles/1FMJU1RT9NEA27909.json` (LR Albany) with the latest quote. Confirm the output:
   - follows the `name → why → script → ⚠️risk` contract;
   - cites real numbers from `index.json` + the trade field (BATNA), not invented ones;
   - **correctly flags the already-spent $24k / "$6k apart" leak** and does not re-leak;
   - holds OTD-first discipline (refuses to name a ceiling; pushes for itemized buyer's order);
   - respects privacy (reasons over imported `events[]`; asks for an import run rather than touching the inbox).
2. Confirm it **wrote a `sessions/` log** and appended a dated pointer to the vehicle `scratchpad`, and **proposed** (did not silently change) any price field.
3. **Live-persona smoke test:** "load the coach" in main chat, paste a single dealer text, confirm it coaches turn-by-turn in persona.
4. **Teaching check:** open `PLAYBOOK.md` and confirm every tactic has Mechanism + car-deal example + failure mode (spot-check Ackerman, calibrated questions, KY tax math).

---

## Retrieval & re-homing (Ultraplan → local tracker)

The refined plan was executed remotely by Ultraplan (Claude Code on the web). That session ran against the **GitHub** repo connected to `C:\GitHub` (`bharrison0369/multiagent_coordination`) — **not** the car tracker, which is a **local-only git repo in OneDrive with no GitHub remote**. So the cloud session had **no access to the real tracker data** (BUYER_PROFILE, vehicle JSONs, AGENT.md, trade profile); whatever it authored is a **draft from the plan text**, landing as a PR on `multiagent_coordination`.

**Agreed approach — re-home into the tracker:** when the PR lands (user teleports/pulls it, or pastes the session link/diff), take the authored `COACH.md` + `PLAYBOOK.md` content, place it in `conversation-tracker/coaching/` in OneDrive, and **verify every reference against the real local files** before it's considered done:
- trade numbers match `reference_jeep_trade_in_profile.md` + vehicle `facts` (payoff $21,730.73; field $24k→$20k);
- the LR-Albany leak ($24k / "$6k apart") is reflected in the leak-ledger discipline;
- privacy section matches `AGENT.md` §Privacy rules verbatim;
- fleet/BATNA references resolve against the actual `index.json`;
- `AGENT.md` "Coaching mode" stub repointed to `coaching/COACH.md`.
The cloud wrote the prose; local implementation lands it in the right repo and makes the references true. Run the Verification section below after re-homing.

## Phasing

- **Now (rough v1):** the four docs + AGENT.md pointer + logging + improvement-loop scaffold. Usable immediately in both modes.
- **Later (tuning):** run retros to harden COACH/PLAYBOOK from real outcomes; optionally add a fleet **comparison/leverage view** to `tracker.html` and structured (machine-readable) coaching output. Explicitly out of scope for v1.
