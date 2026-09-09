/* ==========================================================================
   Undershoot — Act II, the cadence.

   A time axis from ChatGPT to now. Drag the scrubber and the releases land
   as they actually landed. The vertical axis is deliberately NOT a benchmark
   score — it is a coarse generation band, and the UI says so, because a
   single "intelligence" number across labs and years would be the exact kind
   of confident nonsense this demo is arguing against.
   ========================================================================== */

const Timeline = (() => {

const E = ENGINE;
const C = Chart.C;

function create(canvas, data) {
  const st = {
    canvas, ctx: canvas.getContext('2d'),
    models: data.MODELS.map(m => ({ ...m, at: E.t(m.d) })).sort((a, b) => a.at - b.at),
    labs: data.LABS,
    unlocks: data.UNLOCKS.map(u => ({ ...u, at: E.t(u.d) })).sort((a, b) => a.at - b.at),
    cursor: 1,          /* 0..1 through the window */
    filter: 'all',      /* all | open | closed */
    region: 'all',      /* all | US | China | Europe | Other */
    hover: null,
    w: 0, h: 0, dpr: 1, big: false,
    pad: { l: 58, r: 16, t: 26, b: 50 }
  };
  st.t0 = E.t('2022-11-01');
  st.t1 = Math.max(...st.models.map(m => m.at)) + 20 * E.DAY;
  st.lanes = [...new Set(st.models.map(m=>m.lab))].sort();
  bind(st);
  return {
    resize: () => resize(st),
    render: () => render(st),
    setCursor: v => { st.cursor = E.clamp(v, 0, 1); clearExcluded(st); render(st); },
    setFilter: f => { st.filter = f; clearExcluded(st); render(st); },
    setRegion: r => { st.region = r; clearExcluded(st); render(st); },
    setBig: b => { st.big = b; resize(st); },
    cursorDate: () => st.t0 + st.cursor * (st.t1 - st.t0),
    visible: () => visible(st),
    latestUnlock: () => {
      const at = st.t0 + st.cursor * (st.t1 - st.t0);
      const past = st.unlocks.filter(u => u.at <= at);
      return past.length ? past[past.length - 1] : null;
    },
    stats: () => stats(st),
    onHover: cb => { st.onHover = cb; },
    select: m => setHover(st, m && visible(st).includes(m) ? m : null),
    selected: () => st.hover,
    pointFor: m => m ? { x:px(st, m.at), y:py(st, m) } : null
  };
}

function setHover(st, model) {
  if (st.hover === model) return;
  st.hover = model;
  render(st);
  if (st.onHover) st.onHover(model);
}

function clearExcluded(st) {
  if (st.hover && !visible(st).includes(st.hover)) setHover(st, null);
}

function visible(st) {
  const at = st.t0 + st.cursor * (st.t1 - st.t0);
  return st.models.filter(m => m.at <= at && passes(st, m));
}

function passes(st, m) {
  const byOpen = st.filter === 'all' || (st.filter === 'open' ? m.open : !m.open);
  const lab = st.labs[m.lab] || st.labs.other;
  const byRegion = st.region === 'all' || lab.region === st.region;
  return byOpen && byRegion;
}

/** Releases in the trailing year, and the open-weight share of them. Computed,
 *  not asserted — the claim on screen is whatever these numbers say. */
function stats(st) {
  const at = st.t0 + st.cursor * (st.t1 - st.t0);
  const yearAgo = at - 365 * E.DAY;
  /* Counters describe what is actually visible, filters included — a stat that
     disagrees with the dots above it is worse than no stat. */
  const shown = st.models.filter(m => m.at <= at && passes(st, m));
  const win = shown.filter(m => m.at > yearAgo);
  const open = win.filter(m => m.open).length;
  return { total: shown.length, year: win.length, open, closed: win.length - open };
}

function resize(st) {
  const rect = st.canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  st.w = Math.max(1, rect.width); st.h = Math.max(1, rect.height); st.dpr = dpr;
  st.canvas.width = Math.round(st.w * dpr);
  st.canvas.height = Math.round(st.h * dpr);
  st.fs = st.big ? 14 : 11;
  const k = st.big ? 1.3 : 1;
  st.pad = { l: 58 * k, r: 16 * k, t: 26 * k, b: 50 * k };
  render(st);
}

const px = (st, ms) => st.pad.l + (ms - st.t0) / (st.t1 - st.t0) * pw(st);
const pw = st => Math.max(1, st.w - st.pad.l - st.pad.r);
const ph = st => Math.max(1, st.h - st.pad.t - st.pad.b);
const py = (st, model) => st.pad.t + ph(st) * ((st.lanes.indexOf(model.lab) + .5) / st.lanes.length);

function bind(st) {
  st.canvas.addEventListener('pointermove', ev => {
    const r = st.canvas.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    let best = null, bd = 1e9;
    for (const m of visible(st)) {
      const d = Math.hypot(px(st, m.at) - x, py(st, m) - y);
      if (d < bd) { bd = d; best = m; }
    }
    const hit = bd < (st.big ? 22 : 16) ? best : null;
    if (hit !== st.hover) setHover(st, hit);
  });
  st.canvas.addEventListener('pointerleave', () => {
    if (st.hover) setHover(st, null);
  });
  st.canvas.addEventListener('pointerdown', ev => {
    const r = st.canvas.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    let best = null, bd = Infinity;
    for (const m of visible(st)) {
      const d = Math.hypot(px(st, m.at) - x, py(st, m) - y);
      if (d < bd) { bd = d; best = m; }
    }
    setHover(st, bd < (st.big ? 26 : 22) ? best : null);
  });
}

/* Act II shipped with no axis labels at all: the dots sat at meaningful
   heights and nothing on the chart said what the height meant. The prose above
   explained it, but a chart has to survive being read on its own — someone
   photographs the screen, or glances up mid-sentence. The wording is
   deliberately hedged, because the height IS a coarse band and calling it a
   score would be the exact overclaim this demo argues against. */
const AXIS_Y = 'Company lanes';
const AXIS_Y_SUB = 'height is not capability';
const AXIS_X = 'When it was released';

function axisTitles(st) {
  const { ctx } = st;
  const ts = st.fs + 1;

  ctx.font = `700 ${ts}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = 'rgba(232,237,245,0.62)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(AXIS_X, st.pad.l + pw(st) / 2, st.h - 4);

  if (ph(st) > 150) {
    ctx.save();
    ctx.translate(13, st.pad.t + ph(st) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = `700 ${ts}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(232,237,245,0.62)';
    ctx.fillText(AXIS_Y, 0, 0);
    ctx.font = `500 ${st.fs - 0.5}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(143,163,192,0.8)';
    ctx.fillText(AXIS_Y_SUB, 0, ts + 3);
    ctx.restore();
  }

  /* Which way is up, said once, in the two corners the dots do not reach:
     nothing early sits on the right of the axis, and nothing advanced sits on
     the left of it. Both labels started bottom-left and the lower one landed
     on top of the 2023 releases. */
  ctx.font = `600 ${st.fs - 1}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(143,163,192,0.55)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  
}

function render(st) {
  const { ctx } = st;
  ctx.save();
  ctx.scale(st.dpr, st.dpr);
  ctx.clearRect(0, 0, st.w, st.h);

  const at = st.t0 + st.cursor * (st.t1 - st.t0);

  /* year rules */
  ctx.font = `500 ${st.fs}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let y = 2023; y <= 2026; y++) {
    const x = px(st, Date.UTC(y, 0, 1));
    ctx.strokeStyle = 'rgba(143,163,192,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, st.pad.t - 6); ctx.lineTo(x, st.pad.t + ph(st)); ctx.stroke();
    ctx.fillStyle = 'rgba(143,163,192,0.75)';
    ctx.fillText(String(y), x, st.pad.t + ph(st) + 7);
  }

  /* the moving edge */
  const cx = px(st, at);
  ctx.strokeStyle = 'rgba(0,164,227,0.75)'; ctx.lineWidth = st.big ? 2.5 : 2;
  ctx.beginPath(); ctx.moveTo(cx, st.pad.t - 10); ctx.lineTo(cx, st.pad.t + ph(st) + 4); ctx.stroke();
  ctx.fillStyle = 'rgba(0,164,227,0.95)';
  ctx.font = `700 ${st.fs + 1}px system-ui, sans-serif`;
  ctx.textAlign = cx > st.w - 70 ? 'right' : 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText(E.fmtDate(at, 'short'), cx + (cx > st.w - 70 ? -6 : 6), st.pad.t - 8);

  /* dots */
  for (const m of st.models) {
    if (m.at > at) continue;
    const on = passes(st, m);
    const x = px(st, m.at), y = py(st, m);
    const age = E.clamp((at - m.at) / (200 * E.DAY), 0, 1);
    const fresh = 1 - age;
    const lab = st.labs[m.lab] || st.labs.other;
    const alpha = on ? 0.55 + 0.45 * fresh : 0.10;
    const r = (st.big ? 6.5 : 5) * (on ? 1 + 0.5 * fresh : 0.7);

    if (on && fresh > 0.05) {
      ctx.beginPath();
      ctx.fillStyle = `hsla(${lab.hue},70%,58%,${0.16 * fresh})`;
      ctx.arc(x, y, r * 3.2, 0, 7); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
    if (m.open) {
      /* open weights read as a ring, closed as a filled disc */
      ctx.strokeStyle = `hsla(${lab.hue},72%,62%,${alpha})`;
      ctx.lineWidth = st.big ? 3 : 2.2;
      ctx.stroke();
    } else {
      ctx.fillStyle = `hsla(${lab.hue},68%,58%,${alpha})`;
      ctx.fill();
    }
    if (st.hover === m) {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r + 4, 0, 7); ctx.stroke();
    }
  }

  /* axis frame + titles */
  ctx.strokeStyle = 'rgba(143,163,192,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(st.pad.l, st.pad.t);
  ctx.lineTo(st.pad.l, st.pad.t + ph(st));
  ctx.lineTo(st.w - st.pad.r, st.pad.t + ph(st));
  ctx.stroke();
  axisTitles(st);

  ctx.restore();
}

return { create, labels: () => ({ y: AXIS_Y, ySub: AXIS_Y_SUB, x: AXIS_X }) };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Timeline;
