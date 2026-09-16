/* Engineering Trivia — Should Have Known That. The view + game layer.
   QUESTIONS and LOG_IDS come from data.js, injected into an earlier <script>
   tag in the same document (top-level `const` in a classic script is shared
   across sibling inline scripts — the same pattern ion-flight/src/model.js
   and src/app.js use).

   THREE STAGES, ONE BANK, THREE ROUNDS OF THE SAME MACHINERY:
     Stage 1 "Linear estimates" — the 35 linear-scale questions, with the
       original setup screen (length / categories / mode / teams) folded
       into this stage's workbench instead of covering the whole viewport.
     Stage 2 "Log estimates"   — the fixed 5-question log-scale deck, no
       setup of its own; it reuses stage 1's team roster and starts the
       moment the (gated) tab is reached.
     Stage 3 "Debrief"         — combined final scores, the sharpest/
       should-have-known cards across BOTH decks, and the linear-vs-log
       point comparison this retrofit's work order calls the calibration
       check.

   GATING (ruling 2): tab 2 is disabled until the linear deck is fully
   answered; tab 3 until the log deck is. selectStage()'s clamp already
   refuses to jump past a disabled tab, so the only thing this file has to
   do is flip `.disabled` at the right moment and call
   window.lessonShell.selectStage(next) to walk forward automatically —
   exactly the shape ion-flight uses for its own core-lesson unlock.
*/
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function shuffle(a) {
    const out = a.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /* ---------- scoring (byte-identical to the pre-kit file's SCORING/BANDS —
     preserved verbatim per the work order; only the presentation moved) --- */
  const SCORING = { linear: [0.05, 0.15, 0.35, 0.60], log: [0.10, 0.33, 0.70, 1.20] };
  const BANDS = [
    { label: 'BULLSEYE', pts: 100, cls: 'b0' },
    { label: 'CLOSE', pts: 75, cls: 'b1' },
    { label: 'WARM', pts: 40, cls: 'b2' },
    { label: 'COLD', pts: 10, cls: 'b3' },
    { label: 'WAY OFF', pts: 0, cls: 'b4' }
  ];
  const STEPS = 1000;

  function posToValue(q, pos) {
    const t = pos / STEPS;
    if (q.scale === 'log') {
      const lo = Math.log10(q.min), hi = Math.log10(q.max);
      return Math.pow(10, lo + (hi - lo) * t);
    }
    return q.min + (q.max - q.min) * t;
  }
  function valueToPos(q, v) {
    let t;
    if (q.scale === 'log') {
      const lo = Math.log10(q.min), hi = Math.log10(q.max);
      t = (Math.log10(v) - lo) / (hi - lo);
    } else {
      t = (v - q.min) / (q.max - q.min);
    }
    return clamp(t, 0, 1) * STEPS;
  }
  /* Never starts inside a scoring band, so a point always has to be earned. */
  function startPos(q) {
    const truth = valueToPos(q, q.value);
    const minGap = STEPS * 0.28;
    for (let tries = 0; tries < 40; tries++) {
      const pos = Math.round(STEPS * (0.08 + Math.random() * 0.84));
      if (Math.abs(pos - truth) >= minGap) return pos;
    }
    return truth > STEPS / 2 ? Math.round(STEPS * 0.08) : Math.round(STEPS * 0.92);
  }

  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function sci(v) {
    const e = Math.floor(Math.log10(Math.abs(v)));
    const m = Math.round((v / Math.pow(10, e)) * 100) / 100;
    return m + '×10' + String(e).split('').map(c => SUP[c] || c).join('');
  }
  function roundSig(v, n) {
    if (v === 0) return 0;
    const p = n - 1 - Math.floor(Math.log10(Math.abs(v)));
    const m = Math.pow(10, p);
    return Math.round(v * m) / m;
  }
  function fmt(v) {
    if (!isFinite(v)) return '–';
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a < 1e-3 || a >= 1e6) return sci(v);
    if (a >= 1000) return Math.round(v).toLocaleString('en-US');
    if (a >= 10) return String(Math.round(v * 10) / 10);
    if (a >= 1) return String(Math.round(v * 100) / 100);
    return String(Math.round(v * 1000) / 1000);
  }
  function withUnits(v, units) {
    const tight = (units === '°' || units === '%');
    return fmt(v) + (tight ? '' : ' ') + units;
  }
  /* Band-aware since the 2026-09-16 correction pass. Where an item carries
     `band: [lo, hi]` — a sourced range its own qualifier or factoid already
     names — a guess inside the band is exactly right (err 0), and a guess
     outside it is measured from the NEAREST EDGE rather than from `value`.
     Before this, item 23's qualifier taught "~30 mA sustained" and the game
     scored 30 mA WARM and the let-go figure 16 mA COLD; items 12/20/28
     printed a range in their reveal text and scored both of its ends WARM.
     The 29 single-valued items are scored exactly as before. The reveal
     still displays `value`, the single anchor; only the score changes. */
  function scoreGuess(q, guess) {
    const b = Array.isArray(q.band) && q.band.length === 2 ? q.band : null;
    const inBand = !!b && guess >= b[0] && guess <= b[1];
    const ref = !b ? q.value : (inBand ? guess : (guess < b[0] ? b[0] : b[1]));
    let err;
    if (q.scale === 'log') err = Math.abs(Math.log10(guess / ref));
    else err = Math.abs(guess - ref) / Math.abs(ref);
    const th = SCORING[q.scale === 'log' ? 'log' : 'linear'];
    let band = th.length;
    for (let i = 0; i < th.length; i++) { if (err <= th[i]) { band = i; break; } }
    const normErr = (q.scale === 'log') ? Math.pow(10, err) - 1 : err;
    const tail = b ? ' past the range' : ' off';
    const offBy = inBand ? 'in range' : ((q.scale === 'log')
      ? (Math.round(Math.pow(10, err) * 10) / 10) + '×' + tail
      : Math.round(err * 100) + '%' + tail);
    return { band, err, normErr, offBy, inBand, pts: BANDS[band].pts };
  }
  function bandText(q) {
    return q.band ? fmt(q.band[0]) + '–' + withUnits(q.band[1], q.units) : '';
  }
  /* Expected points of a uniformly random slider position on these
     questions — the exact mean over all STEPS+1 positions, scored through
     the same scoreGuess (and the same 3-significant-figure snap) the game
     applies to a real guess. Used by the debrief as its control. */
  function randomGuessAvg(qs) {
    if (!qs.length) return 0;
    let total = 0;
    qs.forEach(q => {
      let s = 0;
      for (let pos = 0; pos <= STEPS; pos++) s += scoreGuess(q, roundSig(posToValue(q, pos), 3)).pts;
      total += s / (STEPS + 1);
    });
    return total / qs.length;
  }

  /* ---------- category colours, assigned automatically ---------- */
  const CAT_PALETTE = ['#00A4E3', '#ECAC00', '#7FD3F5', '#FFD766', '#C7E9F8'];
  const CATS = [...new Set(QUESTIONS.map(q => q.category))];
  const catColor = c => CAT_PALETTE[CATS.indexOf(c) % CAT_PALETTE.length];
  const LINEAR_QUESTIONS = QUESTIONS.filter(q => q.scale !== 'log');
  const LOG_QUESTIONS = QUESTIONS.filter(q => LOG_IDS.includes(q.id));

  /* ---------- populate the Details drawer's per-item Sources lists once,
     from the SAME data.js table the game itself plays from — one canonical
     source of truth for both surfaces, per the back-propagate rule. -------- */
  function renderSources() {
    const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const anchor = s => s.url
      ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`
      : esc(s.name);
    const list = (host, qs) => {
      host.innerHTML = qs.map(q => {
        const s = q.source;
        const also = (s.also || []).map(a => '; ' + anchor(a)).join('');
        const qual = q.qualifier ? ` <i>(${esc(q.qualifier)})</i>` : '';
        const band = q.band ? ` — scored as correct anywhere in ${esc(bandText(q))}` : '';
        return `<li>${anchor(s)}${also} — item ${q.id}, "${esc(q.prompt)}"${qual}${band}${s.fetched ? ` — checked ${s.fetched}` : ''}</li>`;
      }).join('');
    };
    if ($('sources-0')) list($('sources-0'), LINEAR_QUESTIONS);
    if ($('sources-1')) list($('sources-1'), LOG_QUESTIONS);
  }

  /* ---------- setup-screen state (stage 1 only) ---------- */
  const sel = { len: 10, mode: 'solo', teamCount: 2, cats: new Set(CATS) };
  const teamNameDefaults = ['Team 1', 'Team 2', 'Team 3', 'Team 4'];

  function buildSetup() {
    const lr = $('len-row'); lr.innerHTML = '';
    [5, 10, 15].forEach(n => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt' + (sel.len === n ? ' on' : '');
      b.innerHTML = n + "<small>questions</small>";
      b.addEventListener('click', () => { sel.len = n; buildSetup(); });
      lr.appendChild(b);
    });
    const cr = $('cat-row'); cr.innerHTML = '';
    CATS.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      const on = sel.cats.has(c);
      b.className = 'chip' + (on ? ' on' : '');
      if (on) b.style.background = catColor(c);
      b.textContent = c;
      b.addEventListener('click', () => {
        if (sel.cats.has(c)) sel.cats.delete(c); else sel.cats.add(c);
        buildSetup();
      });
      cr.appendChild(b);
    });
    const mr = $('mode-row'); mr.innerHTML = '';
    [['solo', 'SOLO'], ['teams', 'TEAMS']].forEach(([m, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt' + (sel.mode === m ? ' on' : '');
      b.innerHTML = label + '<small>' + (m === 'solo' ? 'just you' : 'pass & play') + '</small>';
      b.addEventListener('click', () => { sel.mode = m; buildSetup(); });
      mr.appendChild(b);
    });
    $('team-setup').classList.toggle('hidden', sel.mode !== 'teams');
    if (sel.mode === 'teams') {
      const tr = $('teamcount-row'); tr.innerHTML = '';
      [2, 3, 4].forEach(n => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'opt' + (sel.teamCount === n ? ' on' : '');
        b.textContent = n;
        b.addEventListener('click', () => { sel.teamCount = n; buildSetup(); });
        tr.appendChild(b);
      });
      const tn = $('team-names');
      [...tn.querySelectorAll('input')].forEach((inp, i) => { teamNameDefaults[i] = inp.value || teamNameDefaults[i]; });
      tn.innerHTML = '';
      for (let i = 0; i < sel.teamCount; i++) {
        const inp = document.createElement('input');
        inp.maxLength = 16;
        inp.value = teamNameDefaults[i];
        inp.setAttribute('aria-label', 'Team ' + (i + 1) + ' name');
        inp.addEventListener('input', () => { teamNameDefaults[i] = inp.value; });
        tn.appendChild(inp);
      }
    }
    updateStartNote();
  }
  function linearPoolSize() { return LINEAR_QUESTIONS.filter(q => sel.cats.has(q.category)).length; }
  function updateStartNote() {
    const pool = linearPoolSize();
    const nTeams = sel.mode === 'teams' ? sel.teamCount : 1;
    const per = Math.min(sel.len, Math.floor(pool / nTeams));
    const note = $('start-note'), btn = $('start-btn');
    if (pool === 0) { note.textContent = 'Pick at least one category to play.'; btn.disabled = true; return; }
    if (per === 0) { note.textContent = 'Not enough questions for that many teams — add categories.'; btn.disabled = true; return; }
    btn.disabled = false;
    let t = pool + ' linear questions in the pool';
    t += sel.mode === 'teams'
      ? (per < sel.len ? ' — capped at ' + per + ' per team' : ' — ' + sel.len + ' per team')
      : (per < sel.len ? ' — capped at ' + per : '');
    note.textContent = t;
  }

  /* ---------- shared game state ---------- */
  let G = null;              // { mode, teams:[{name,linearScore,logScore}] }
  let pendingTimers = [];
  function clearTimers() { pendingTimers.forEach(clearTimeout); pendingTimers = []; }
  function later(fn, ms) { pendingTimers.push(setTimeout(fn, ms)); }

  function currentTeamIdx(round) { return round.i % G.teams.length; }

  /* ---------- generic per-round rendering, parameterised by suffix ------- */
  function beginRound(suffix, round, turnHost, playHost) {
    clearTimers();
    if (round.i >= round.deck.length) { finishRound(suffix); return; }
    if (G.mode === 'teams') {
      const t = G.teams[currentTeamIdx(round)];
      $('turn-team' + turnHost).textContent = t.name;
      const roundNo = Math.floor(round.i / G.teams.length) + 1;
      const per = Math.floor(round.deck.length / G.teams.length) || round.deck.length;
      $('turn-progress' + turnHost).textContent = 'Question ' + roundNo + ' of ' + per;
      $('tv-turn' + turnHost).classList.remove('hidden');
      $('tv-play-' + suffix).classList.add('hidden');
    } else {
      $('tv-turn' + turnHost).classList.add('hidden');
      showQuestion(suffix, round);
    }
  }

  function renderTeamStrip(suffix, round) {
    const strip = $('team-strip-' + suffix);
    if (G.mode !== 'teams') { strip.classList.add('hidden'); return; }
    strip.classList.remove('hidden');
    strip.innerHTML = '';
    G.teams.forEach((t, i) => {
      const d = document.createElement('div');
      d.className = 'tchip' + (i === currentTeamIdx(round) ? ' now' : '');
      const scoreField = suffix === '1' ? 'linearScore' : 'logScore';
      d.innerHTML = '<span>' + t.name + ' </span><b>' + t[scoreField] + '</b>';
      strip.appendChild(d);
    });
  }

  function updateKicker(suffix, q) {
    /* The qualifier names the KIND of value -- typical, specified minimum,
       code-dependent. It is populated here but deliberately kept HIDDEN until
       the reveal. 18 of the 23 qualifiers narrow the answer and 6 state it
       outright ("13 A", "6%", "7 3/4 in"), so rendering it above the slider
       hands the learner the very estimate the stage exists to elicit -- and the
       Details drawer promises the opposite ("endpoints are chosen to be wide
       enough not to give the answer away"). Unhidden in the reveal below. */
    if (q.qualifier) $('qual-' + suffix).textContent = q.qualifier;
    $('qual-' + suffix).hidden = true;
    $('kicker-note-' + suffix).textContent = q.category + ' — ' + q.source.name;
  }

  function showQuestion(suffix, round) {
    clearTimers();
    const q = round.deck[round.i];
    const scoreField = suffix === '1' ? 'linearScore' : 'logScore';
    const qNum = G.mode === 'teams' ? Math.floor(round.i / G.teams.length) + 1 : round.i + 1;
    const per = G.mode === 'teams' ? Math.floor(round.deck.length / G.teams.length) : round.deck.length;
    $('q-counter-' + suffix).textContent = 'Q ' + qNum + '/' + per;
    const catPill = $('q-category-' + suffix);
    catPill.textContent = q.category;
    catPill.style.background = catColor(q.category);
    const me = G.teams[currentTeamIdx(round)];
    $('q-score-' + suffix).textContent = (G.mode === 'teams' ? me.name + ' · ' : '') + me[scoreField] + ' pts';
    renderTeamStrip(suffix, round);
    updateKicker(suffix, q);
    $('q-prompt-' + suffix).textContent = q.prompt;
    $('value-units-' + suffix).textContent = (q.units === '°' || q.units === '%') ? q.units : ' ' + q.units;
    $('range-min-' + suffix).textContent = fmt(q.min);
    $('range-max-' + suffix).textContent = fmt(q.max);
    if ($('scale-tag-' + suffix)) $('scale-tag-' + suffix).classList.toggle('hidden', q.scale !== 'log');
    const slider = $('slider-' + suffix);
    slider.value = startPos(q);
    updateSliderReadout(suffix, round);
    $('guess-panel-' + suffix).classList.remove('hidden');
    $('guess-panel-' + suffix).style.display = 'flex';
    $('reveal-panel-' + suffix).classList.add('hidden');
    $('lock-btn-' + suffix).disabled = false;
    $('tv-play-' + suffix).classList.remove('hidden');
  }

  function updateSliderReadout(suffix, round) {
    const q = round.deck[round.i];
    const slider = $('slider-' + suffix);
    const raw = posToValue(q, Number(slider.value));
    const snapped = roundSig(raw, 3);
    $('value-display-' + suffix).textContent = fmt(snapped);
    slider.style.setProperty('--fill', (Number(slider.value) / 10) + '%');
  }

  function lockIn(suffix, round) {
    const q = round.deck[round.i];
    const scoreField = suffix === '1' ? 'linearScore' : 'logScore';
    const slider = $('slider-' + suffix);
    $('lock-btn-' + suffix).disabled = true;
    const guess = roundSig(posToValue(q, Number(slider.value)), 3);
    const result = scoreGuess(q, guess);
    const team = G.teams[currentTeamIdx(round)];
    round.answers.push({ team: team.name, q, guess, band: result.band, pts: result.pts, normErr: result.normErr, offBy: result.offBy });

    $('guess-panel-' + suffix).style.display = 'none';
    const rp = $('reveal-panel-' + suffix);
    rp.classList.remove('hidden'); rp.style.display = 'flex';

    /* The guess is locked, so the qualifier can now do the work it is for:
       telling the learner whether the truth they just missed is a typical
       value, a specified minimum, or code-dependent. Before this point it
       would only have leaked the answer. */
    $('qual-' + suffix).hidden = !q.qualifier;

    const guessPct = valueToPos(q, guess) / 10;
    const truthPct = valueToPos(q, q.value) / 10;
    const mkG = $('mk-guess-' + suffix), mkT = $('mk-truth-' + suffix);
    mkG.style.left = guessPct + '%';
    mkT.style.transition = 'none';
    mkT.style.left = guessPct + '%';
    $('rv-you-' + suffix).textContent = 'You: ' + withUnits(guess, q.units);
    $('rv-truth-' + suffix).textContent = 'Truth: ' + withUnits(q.value, q.units);
    const badge = $('band-badge-' + suffix);
    badge.className = 'band-badge ' + BANDS[result.band].cls;
    badge.textContent = BANDS[result.band].label;
    $('points-' + suffix).textContent = '';
    const facto = $('factoid-' + suffix);
    facto.innerHTML = '';
    const lead = document.createElement('span'); lead.className = 'lead'; lead.textContent = 'You should have known that because...';
    const body = document.createElement('span'); body.textContent = q.factoid;
    facto.appendChild(lead); facto.appendChild(body);
    const nextBtn = $('next-btn-' + suffix);
    nextBtn.classList.remove('show');
    const isLast = (round.i + 1 >= round.deck.length);
    nextBtn.textContent = isLast ? 'See results' : 'Next';

    /* A4 observation cue — the "what just happened", within one screen of the
       LOCK IT IN control that caused it. The qualifier rides along INTACT:
       an earlier build cut it at the first semicolon, which on item 23 kept
       "a rule-of-thumb anchor on a current-duration-path curve" and dropped
       the 16 / 20 / 30 mA figures that were the point. Where the item is
       scored against a band, the cue says so and names the band, so the
       learner can see why an answer that is not the anchor still scored. */
    const bandNote = q.band
      ? (result.inBand
        ? ' Any answer from ' + bandText(q) + ' scores as correct; ' + withUnits(q.value, q.units) + ' is the anchor shown.'
        : ' Scored from the nearer edge of the accepted ' + bandText(q) + ' range.')
      : '';
    $('cue-' + suffix).textContent = BANDS[result.band].label + ' — ' + result.offBy + '.' + bandNote +
      (q.qualifier ? ' Qualifier: ' + q.qualifier + '.' : '');

    /* A2 echo — the captured prediction shown beside the observed result. */
    const echo = $('echo-' + suffix);
    if (echo) { echo.hidden = false; echo.textContent = 'Last guess: ' + withUnits(guess, q.units) + ' vs. truth ' + withUnits(q.value, q.units) + ' (' + result.offBy + ')'; }

    later(() => { void mkT.offsetWidth; mkT.style.transition = ''; mkT.style.left = truthPct + '%'; }, 120);
    later(() => {
      if (result.band === 0) confettiBurst();
      const t0 = performance.now(), dur = 700;
      (function tick(now) {
        const k = Math.min(1, (now - t0) / dur);
        $('points-' + suffix).innerHTML = '+' + Math.round(result.pts * k) + ' pts' + "<span class='offby'>" + result.offBy + '</span>';
        if (k < 1) requestAnimationFrame(tick);
      })(performance.now());
    }, 1300);
    later(() => { facto.style.opacity = '1'; }, 1750);
    later(() => {
      team[scoreField] += result.pts;
      $('q-score-' + suffix).textContent = (G.mode === 'teams' ? team.name + ' · ' : '') + team[scoreField] + ' pts';
      renderTeamStrip(suffix, round);
      nextBtn.classList.add('show');
    }, 2150);
  }

  function confettiBurst() {
    const colors = ['#ECAC00', '#00A4E3', '#FFD766', '#7FD3F5', '#FFE9A8', '#ffffff'];
    for (let i = 0; i < 24; i++) {
      const c = document.createElement('div');
      c.style.cssText = 'position:fixed;width:10px;height:10px;top:38%;left:50%;z-index:2000;pointer-events:none;border-radius:2px;background:' + colors[i % colors.length];
      document.body.appendChild(c);
      const ang = Math.random() * Math.PI * 2, dist = 80 + Math.random() * 220;
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 100;
      const rot = (Math.random() * 800 - 400);
      c.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + dx + 'px,' + (dy + 220) + 'px) rotate(' + rot + 'deg)', opacity: 0 }
      ], { duration: 1000 + Math.random() * 600, easing: 'cubic-bezier(.15,.6,.4,1)' }).onfinish = () => c.remove();
    }
  }

  function advance(suffix, round, turnHost) {
    round.i++;
    beginRound(suffix, round, turnHost);
  }

  function fillCard(card, title, a) {
    card.innerHTML = '';
    if (!a) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    const t = document.createElement('div'); t.className = 'ec-title'; t.textContent = title;
    const qd = document.createElement('div'); qd.className = 'ec-q'; qd.textContent = a.q.prompt;
    const dd = document.createElement('div'); dd.className = 'ec-detail';
    dd.textContent = (G.mode === 'teams' ? a.team + ' — ' : '') + 'guessed ' + withUnits(a.guess, a.q.units) +
      ', truth ' + withUnits(a.q.value, a.q.units) + ' (' + a.offBy + ', ' + BANDS[a.band].label.toLowerCase() + ')';
    card.appendChild(t); card.appendChild(qd); card.appendChild(dd);
  }

  function renderScoreList(host, scoreField) {
    host.innerHTML = '';
    if (G.mode === 'solo') {
      const max = (scoreField === 'linearScore' ? G.linear.deck.length : G.log.deck.length) * 100;
      const d = document.createElement('div'); d.className = 'solo-final';
      d.innerHTML = G.teams[0][scoreField] + '<small>OUT OF ' + max + ' POINTS</small>';
      host.appendChild(d);
    } else {
      const ranked = G.teams.slice().sort((a, b) => b[scoreField] - a[scoreField]);
      const top = ranked[0][scoreField];
      ranked.forEach(t => {
        const row = document.createElement('div');
        row.className = 'score-row' + (t[scoreField] === top ? ' win' : '');
        const nm = document.createElement('span'); nm.textContent = t.name;
        if (t[scoreField] === top) {
          const w = document.createElement('span'); w.className = 'wintag';
          w.textContent = ranked.filter(x => x[scoreField] === top).length > 1 ? 'TIE' : 'WINNER';
          nm.appendChild(w);
        }
        const sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = t[scoreField] + ' pts';
        row.appendChild(nm); row.appendChild(sc);
        host.appendChild(row);
      });
    }
  }

  function finishRound(suffix) {
    clearTimers();
    if (suffix === '1') {
      renderScoreList($('end-scores-1'), 'linearScore');
      const byErr = G.linear.answers.slice().sort((a, b) => a.normErr - b.normErr);
      fillCard($('best-card-1'), 'SHARPEST GUESS (LINEAR)', byErr[0]);
      fillCard($('worst-card-1'), 'SHOULD HAVE KNOWN THAT', byErr[byErr.length - 1]);
      $('tv-play-1').classList.add('hidden');
      $('tv-turn').classList.add('hidden');
      $('stage1-done').classList.remove('hidden');
      unlockStage(1);
    } else {
      renderScoreList($('end-scores-2'), 'logScore');
      const byErr = G.log.answers.slice().sort((a, b) => a.normErr - b.normErr);
      fillCard($('best-card-2'), 'SHARPEST GUESS (LOG)', byErr[0]);
      fillCard($('worst-card-2'), 'SHOULD HAVE KNOWN THAT', byErr[byErr.length - 1]);
      $('tv-play-2').classList.add('hidden');
      $('tv-turn-2').classList.add('hidden');
      $('stage2-done').classList.remove('hidden');
      unlockStage(2);
    }
  }

  /* Unlocks the NEXT stage tab and re-marks the CURRENT tab complete — the
     kit restores both of these from its first-load snapshot on Reset, so
     nothing here needs its own reset-time mirror. */
  function unlockStage(fromIndex) {
    const tabs = document.querySelectorAll('.stage-tab');
    const doneTab = tabs[fromIndex - 1];
    doneTab.classList.add('complete');
    const mark = doneTab.querySelector('.stage-mark');
    if (mark) mark.textContent = '✓';
    const nextTab = tabs[fromIndex];
    if (nextTab) nextTab.disabled = false;
  }

  /* ---------- stage 1: start / begin ---------- */
  function startLinear() {
    const pool = shuffle(LINEAR_QUESTIONS.filter(q => sel.cats.has(q.category)));
    const nTeams = sel.mode === 'teams' ? sel.teamCount : 1;
    const per = Math.min(sel.len, Math.floor(pool.length / nTeams));
    if (per === 0) return;
    const teams = [];
    for (let i = 0; i < nTeams; i++) {
      teams.push({ name: sel.mode === 'teams' ? (teamNameDefaults[i].trim() || 'Team ' + (i + 1)) : 'You', linearScore: 0, logScore: 0 });
    }
    G = { mode: sel.mode, teams, linear: { deck: pool.slice(0, per * nTeams), i: 0, answers: [] }, log: null };
    $('tv-setup').classList.add('hidden');
    $('stage1-done').classList.add('hidden');
    beginRound('1', G.linear, '');
  }

  /* ---------- stage 2: built automatically once reached ---------- */
  function startLog() {
    if (!G || G.log) return; // already built, or stage 1 not played yet
    const nTeams = G.teams.length;
    const per = Math.min(LOG_QUESTIONS.length, Math.floor(LOG_QUESTIONS.length / nTeams) || LOG_QUESTIONS.length);
    const deck = shuffle(LOG_QUESTIONS).slice(0, Math.max(per * nTeams, Math.min(nTeams, LOG_QUESTIONS.length)));
    G.log = { deck, i: 0, answers: [] };
    beginRound('2', G.log, '-2');
  }

  /* ---------- stage 3: debrief ---------- */
  function renderDebrief() {
    if (!G || !G.log || G.log.i < G.log.deck.length) return; // not ready yet
    const combined = document.getElementById('debrief-scores');
    combined.innerHTML = '';
    if (G.mode === 'solo') {
      const total = G.teams[0].linearScore + G.teams[0].logScore;
      const max = (G.linear.deck.length + G.log.deck.length) * 100;
      const d = document.createElement('div'); d.className = 'solo-final';
      d.innerHTML = total + '<small>OUT OF ' + max + ' POINTS</small>';
      combined.appendChild(d);
    } else {
      const ranked = G.teams.slice().map(t => ({ ...t, total: t.linearScore + t.logScore })).sort((a, b) => b.total - a.total);
      const top = ranked[0].total;
      ranked.forEach(t => {
        const row = document.createElement('div');
        row.className = 'score-row' + (t.total === top ? ' win' : '');
        const nm = document.createElement('span'); nm.textContent = t.name;
        if (t.total === top) {
          const w = document.createElement('span'); w.className = 'wintag';
          w.textContent = ranked.filter(x => x.total === top).length > 1 ? 'TIE' : 'WINNER';
          nm.appendChild(w);
        }
        const sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = t.total + ' pts';
        row.appendChild(nm); row.appendChild(sc);
        combined.appendChild(row);
      });
    }
    const allAnswers = G.linear.answers.concat(G.log.answers);
    const byErr = allAnswers.slice().sort((a, b) => a.normErr - b.normErr);
    fillCard($('best-card-3'), 'SHARPEST GUESS OF THE GAME', byErr[0]);
    fillCard($('worst-card-3'), 'SHOULD HAVE KNOWN THAT', byErr[byErr.length - 1]);

    /* A6 calibration comparison — average POINTS per question on each deck,
       which is the fair comparison the bank's own scoring bands already set
       up (see the Details drawer's stage-3 section for why raw percent and
       raw decades-off are not directly comparable but points are). */
    const avg = (arr) => arr.length ? arr.reduce((s, a) => s + a.pts, 0) / arr.length : null;
    const linAvg = avg(G.linear.answers), logAvg = avg(G.log.answers);
    const calText = $('calibration-text');
    if (linAvg === null || logAvg === null) {
      calText.textContent = 'Play both stages first — this fills in once you have answers on both decks.';
    } else {
      /* The control the verdict needs: what a knowledge-free guess earns on
         each deck YOU played, computed here by scoring every one of the
         1,001 slider positions on every question (exact for a uniform
         random slider, no sampling noise). An earlier build asserted that a
         higher log average meant "the log slider was more forgiving"; the
         measured control says the two decks are within a point or two of
         each other for a random guesser, so the gap is what you knew, not
         how the deck is scored. */
      const linRand = randomGuessAvg(G.linear.answers.map(a => a.q));
      const logRand = randomGuessAvg(G.log.answers.map(a => a.q));
      const linRound = Math.round(linAvg), logRound = Math.round(logAvg);
      const gap = Math.round(logRand) - Math.round(linRand);
      const reading = Math.abs(gap) <= 5
        ? 'the two decks are about equally forgiving to a random guess, so a gap between your averages is knowledge, not the scoring. '
        : 'on these particular questions the ' + (gap > 0 ? 'log' : 'linear') + ' deck is ' + Math.abs(gap) +
          ' points more forgiving to a random guess, so discount a gap of that size before reading the rest as knowledge. ';
      const control = 'A guess made by dragging the slider to a random position would average about <b>' +
        Math.round(linRand) + '</b> on your linear questions and <b>' + Math.round(logRand) +
        '</b> on your log ones — ' + reading;
      const verdict = logRound > linRound
        ? 'Your log guesses scored HIGHER on average: you placed the SIZE of those five numbers better than you placed the exact figures on the linear deck.'
        : (logRound < linRound
          ? 'Your linear guesses scored HIGHER on average: the everyday-scale numbers were more familiar to you than the sizes of the five order-of-magnitude ones.'
          : 'The two decks scored about the same on average — a genuine tie.');
      const sample = G.log.answers.length < 5
        ? ' With only ' + G.log.answers.length + ' log answer' + (G.log.answers.length === 1 ? '' : 's') + ', one band step moves that average by 5–60 points, so read the direction loosely.'
        : ' Five log questions is still a small sample — one band step moves that average by up to 20 points.';
      calText.innerHTML = 'Linear average: <b>' + linRound + ' pts/question</b> (' + G.linear.answers.length + ' questions). ' +
        'Log average: <b>' + logRound + ' pts/question</b> (' + G.log.answers.length + ' questions). ' + control + verdict + sample;
    }
    $('cue-3').textContent = 'Debrief computed from ' + allAnswers.length + ' answers this session.';
    echoPrediction();
  }

  /* ---------- stage 3 Predict capture (A2). The card asks "which deck scored
     higher?"; before this existed nothing captured the answer and #echo-3 was
     never written. The two buttons record it, and the echo shows the
     prediction beside the observed direction once the debrief has run. ---- */
  let predict3 = null;
  function echoPrediction() {
    const echo = $('echo-3');
    if (!echo) return;
    if (!predict3) { echo.hidden = true; echo.textContent = ''; return; }
    let observed = '';
    if (G && G.log && G.log.i >= G.log.deck.length && G.linear.answers.length && G.log.answers.length) {
      const avg = arr => arr.reduce((s, a) => s + a.pts, 0) / arr.length;
      const lin = Math.round(avg(G.linear.answers)), lg = Math.round(avg(G.log.answers));
      observed = lin === lg ? ' Observed: a tie.' : ' Observed: ' + (lg > lin ? 'log' : 'linear') + ' scored higher' +
        ((lg > lin) === (predict3 === 'log') ? ' — as you predicted.' : ' — not what you predicted.');
    }
    echo.hidden = false;
    echo.textContent = 'You predicted: ' + predict3 + '.' + observed;
  }
  document.querySelectorAll('.predict-opt').forEach(b => b.addEventListener('click', () => {
    predict3 = b.dataset.deck;
    document.querySelectorAll('.predict-opt').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    echoPrediction();
  }));

  /* ---------- wiring: stage 1 ---------- */
  $('start-btn').addEventListener('click', startLinear);
  $('slider-1').addEventListener('input', () => { if (G && G.linear) updateSliderReadout('1', G.linear); });
  $('lock-btn-1').addEventListener('click', () => { if (G && G.linear) lockIn('1', G.linear); });
  $('next-btn-1').addEventListener('click', () => { if ($('next-btn-1').classList.contains('show')) advance('1', G.linear, ''); });
  $('turn-go').addEventListener('click', () => showQuestion('1', G.linear));
  $('continue-2').addEventListener('click', () => window.lessonShell.selectStage(1));

  /* ---------- wiring: stage 2 ---------- */
  $('slider-2').addEventListener('input', () => { if (G && G.log) updateSliderReadout('2', G.log); });
  $('lock-btn-2').addEventListener('click', () => { if (G && G.log) lockIn('2', G.log); });
  $('next-btn-2').addEventListener('click', () => { if ($('next-btn-2').classList.contains('show')) advance('2', G.log, '-2'); });
  $('turn-go-2').addEventListener('click', () => showQuestion('2', G.log));
  $('continue-3').addEventListener('click', () => window.lessonShell.selectStage(2));

  /* ---------- wiring: stage 3 ---------- */
  $('again-btn').addEventListener('click', () => window.lessonShell.reset());

  /* ---------- stage changes: build/refresh whatever the newly-shown stage
     needs. Per ADOPTING.md's ordering hazard, this NEVER renders from saved
     activity state on the reset-triggered stagechange to 0 — lessonreset
     (below) owns that; here it only reacts to a genuine navigation. -------- */
  document.addEventListener('stagechange', e => {
    const index = e.detail.index;
    if (index === 1) startLog();
    if (index === 2) renderDebrief();
  });

  /* ---- Reset, in place --------------------------------------------------
     ENUMERATION (kit v2 restores stage chrome, check cards, echoes and cues
     from its own snapshot; everything below is the half only this file can
     know about):
       1. G itself, back to null — the entire game state, both decks, both
          rounds, every team's score.
       2. sel — length/categories/mode/team-count back to defaults; typed
          team names reset to the placeholder list.
       3. Stage 1's own chrome: the setup panel shown, the turn banner and
          play/done panels hidden.
       4. Stage 2 and 3's play/turn/done panels, hidden — they will be
          rebuilt from scratch by startLog()/renderDebrief() the next time
          those (now re-locked) stages are actually reached.
       5. The two stage-tab "complete" marks the game itself sets in
          unlockStage() — the shell's own snapshot restores `disabled` and
          the base className, but the checkmark glyph this file writes into
          .stage-mark on completion needs its own explicit put-back, because
          the snapshot's `mark` value already covers that (see below): the
          shell's snapshot already restores .stage-mark.textContent, so
          nothing extra is needed here — listed to say it was checked, not
          because it needs code.
       6. Any pending reveal-animation timers, cancelled — a Reset mid-reveal
          must not let a queued frame write into freshly reset chrome.
       7. Stage 3's captured prediction (predict3) and the two Predict buttons'
          aria-pressed state — the kit's snapshot restores #echo-3 itself. */
  document.addEventListener('lessonreset', () => {
    clearTimers();
    G = null;
    predict3 = null;
    document.querySelectorAll('.predict-opt').forEach(x => x.setAttribute('aria-pressed', 'false'));
    sel.len = 10; sel.mode = 'solo'; sel.teamCount = 2; sel.cats = new Set(CATS);
    teamNameDefaults.splice(0, teamNameDefaults.length, 'Team 1', 'Team 2', 'Team 3', 'Team 4');
    buildSetup();
    $('tv-setup').classList.remove('hidden');
    $('stage1-done').classList.add('hidden');
    $('tv-turn').classList.add('hidden');
    $('tv-play-1').classList.add('hidden');
    $('cue-1').textContent = '';
    $('tv-turn-2').classList.add('hidden');
    $('tv-play-2').classList.add('hidden');
    $('stage2-done').classList.add('hidden');
    $('cue-2').textContent = '';
    $('calibration-text').textContent = 'Play both stages first — this fills in once you have answers on both decks.';
    $('debrief-scores').innerHTML = '';
    fillCard($('best-card-3'), '', null);
    fillCard($('worst-card-3'), '', null);
    $('cue-3').textContent = '';
  });
  /* Nothing here needs to VETO a reset — the enumeration above is complete
     without one, so the hook is left at its default (null), per ADOPTING.md
     "left as null deliberately, not by omission." */

  renderSources();
  buildSetup();
})();
