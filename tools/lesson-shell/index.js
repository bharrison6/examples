/* ===========================================================================
   lesson-shell — the shared lesson shell every demo in the tour is built on.

   ONE CANONICAL COPY, POINTED AT. A demo's build.js requires this module and
   injects what it returns; nothing is vendored into the demo folder. That is
   what stops the nine-copies credit-pill problem from coming back: change the
   pill here, rebuild, and every demo has the new pill.

   THIS IS A BUILD-TIME DEPENDENCY, NOT A RUNTIME ONE. The built index.html
   stays a single self-contained file with zero <script src> and zero
   <link href> — the kit's CSS is inlined into it at build time. CONTRACT.md's
   self-containment requirement is about the BUILT FILE, not about where the
   sources live (orchestrator ruling, 2026-09-15; CONTRACT says "the build must
   be reproducible from the committed sources" and does not say the sources
   must sit inside the demo folder).

   ---------------------------------------------------------------------------
   HOW TO ADOPT IT — the five-minute version

   1. Your demo needs `src/` + `build.js` (template part A10). Move your
      sources in: src/template.html, src/app.js, src/styles.css (your ACTIVITY
      styles only — the shell's are here), src/demo-guide.html, plus whatever
      model/engine files you have.

   2. In src/template.html <head>, three style blocks in this order:

          <style> __SHELL_CSS__ </style>   <- tokens.css + shell.css, from here
          <style> __CSS__ </style>         <- your activity CSS
          <style> __GUIDE_CSS__ </style>   <- lifted from your guide

      Placeholder spelling: in a CSS or JS context each name is wrapped in a
      block comment and in an HTML context in an HTML comment — so the four
      markers a template actually carries are the slash-star forms of
      __SHELL_CSS__, __CSS__, __GUIDE_CSS__ and __SHELL_JS__, plus the
      arrow-bracket forms of __SHELL_STAMP__ and __GUIDE__. (They are spelled
      bare here because a slash-star marker inside this comment would end it.)

      Order matters twice. Your CSS comes after the shell's so you can
      override any shell rule without !important. The guide's comes last
      because .guide-scope p and .lesson-dialog-body p have equal specificity,
      so the guide's rules must be the later ones to win inside the notes.

   3. Copy the markup you need from partials.html and fill in every ALL-CAPS
      slot. Keep the class names exactly — a reviewer greps for them, and
      check-shell.js refuses a built file with a placeholder left in it.

   4. In build.js:

          const shell = require('../tools/lesson-shell');
          const gc = require('../tools/lesson-shell/guide-contract');
          ...
          html = gc.injectOnce(html, SHELL_CSS_MARKER, shell.css());
          html = gc.injectOnce(html, STAMP_MARKER, shell.stamp());
          const guide = gc.extractGuide(read('src/demo-guide.html'));
          html = gc.injectOnce(html, GUIDE_CSS_MARKER, guide.css);
          html = gc.injectOnce(html, GUIDE_MARKER, guide.html);
          gc.assertNoExternalRefs(html, ['demo-guide.html']);
          gc.assertNoRuntimeLoads(html);

      ion-flight/build.js is the worked example — copy it and change the file
      list. It names every marker literally.

   5. Wire the shell's behaviour with `shell.behaviourScript()` injected at
      the __SHELL_JS__ marker — dialogs, the stage tablist keyboard,
      presentation mode and the A6 check cards. It needs no configuration
      beyond the ids partials.html already uses. Your own app.js handles the
      activity, and calls `window.lessonShell.selectStage(n)` if it wants to
      drive the tabs itself.

   6. `node build.js && node tools/pdf.mjs && node build.js --check` and then
      `node ../tools/lesson-shell/check-shell.js <slug>`.

   ---------------------------------------------------------------------------
   THE STAMP. `stamp()` returns an HTML comment carrying the kit version AND a
   short hash of the kit's CSS. check-shell.js compares both against the kit on
   disk, so a demo whose index.html was built before a kit change FAILS rather
   than silently drifting. That is the back-propagation guarantee: you cannot
   change the kit and leave fifteen demos on the old one without a check going
   red.
   =========================================================================== */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

/* Bump on any change to tokens.css, shell.css or behaviourScript(). The css
   hash catches the change even if this is forgotten; the version is what a
   human reads in a diff. */
const VERSION = '1';

const DIR = __dirname;
const read = file => fs.readFileSync(path.join(DIR, file), 'utf8');

/* The canonical marker spellings, built here rather than written literally so
   that no source file has to contain a slash-star sequence that would end its
   own explanatory comment. Every demo's build.js imports these instead of
   typing the strings, so the fleet cannot drift into six spellings. */
const C0 = '/' + '*';
const C1 = '*' + '/';
const MARKERS = Object.freeze({
  shellCss: C0 + '__SHELL_CSS__' + C1,
  shellJs: C0 + '__SHELL_JS__' + C1,
  appCss: C0 + '__CSS__' + C1,
  guideCss: C0 + '__GUIDE_CSS__' + C1,
  app: C0 + '__APP__' + C1,
  stamp: '<!--__SHELL_STAMP__-->',
  guide: '<!--__GUIDE__-->'
});

/* The A0 required token names. check-shell.js greps a built index.html for
   every one and fails if any is missing, so this list IS the A0 pass
   criterion. Derived tokens live in tokens.css but are not required here. */
const REQUIRED_TOKENS = Object.freeze([
  '--u', '--navy', '--gold', '--lite', '--warm',
  '--paper', '--cream', '--ink', '--ink-2', '--ink-3', '--line'
]);

/* The class vocabulary a demo must actually use for the template parts to be
   present. One entry per part, so a failure names the part that is missing. */
const REQUIRED_CLASSES = Object.freeze([
  { part: 'A0 header', needle: 'brand-kicker' },
  { part: 'A0 credit pill', needle: 'bh-credit' },
  { part: 'A1 stage tablist', needle: 'role="tablist"' },
  { part: 'A1 stage tabs', needle: 'stage-tab' },
  { part: 'A2 stage intro', needle: 'stage-intro' },
  { part: 'A2 stage question', needle: 'stage-question' },
  { part: 'A2 prerequisite refresh', needle: 'class="refresh"' },
  { part: 'A2 lesson strip', needle: 'lesson-strip' },
  { part: 'A4 observation cue', needle: 'obs-cue' },
  { part: 'A5 Details drawer', needle: 'details-drawer' },
  { part: 'A5 Boundary card', needle: 'evidence-card' },
  { part: 'A6 check yourself', needle: 'check-options' }
]);

/* The six provenance words, and nothing else, are the kicker vocabulary.
   Reasoned joined on orchestrator ruling 2026-09-15 (front-doors audit
   evidence): Scripted stands in for what a live system would have produced,
   Reasoned is the authors' judgement from criteria the page states. Folding
   them forced an honest "could not confirm" to render as Illustrative, i.e.
   as invented. "unconfirmed" is a CONFIDENCE QUALIFIER (.k-qual) that attaches
   to one of these six; it is never a label of its own. */
const KICKERS = Object.freeze([
  'k-live', 'k-measured', 'k-sourced', 'k-reasoned', 'k-scripted', 'k-illustrative'
]);
const QUALIFIER_CLASS = 'k-qual';

function css() {
  return '\n/* ---- lesson-shell/tokens.css ---- */\n' + read('tokens.css') +
         '\n/* ---- lesson-shell/shell.css ---- */\n' + read('shell.css') + '\n';
}

function cssHash() {
  return crypto.createHash('sha256').update(css(), 'utf8').digest('hex').slice(0, 12);
}

function stamp() {
  return `<!-- lesson-shell v${VERSION} css:${cssHash()} -->`;
}

/* Parse a stamp back out of a built file. Returns null when absent. */
function readStamp(html) {
  const m = html.match(/<!--\s*lesson-shell v([0-9a-zA-Z.]+) css:([0-9a-f]{12})\s*-->/);
  return m ? { version: m[1], cssHash: m[2] } : null;
}

/* ---------------------------------------------------------------------------
   The shell's own behaviour. Kept here rather than in a .js file the demo
   copies, for the same reason the CSS is: one copy, pointed at.

   What it owns:
     * the three dialogs (Guide, Settings, Details) and the presenter notes,
       with swap-not-stack, Escape, backdrop click and focus return;
     * the Guide opening on load, unless the page arrived from a Reset;
     * the stage tablist: click, Arrow/Home/End with roving tabindex, and the
       URL hash (#stage-2). A disabled tab is skipped by the keyboard and
       clamped to by the hash — see the note in selectStage;
     * presentation mode (body.presenter) and the header Notes button;
     * the A6 check cards: aria-pressed, per-option feedback from
       data-feedback, and nothing scored.

   What it does NOT own: the activity. A demo's app.js listens for the
   `stagechange` event on document to react to a tab change.

   It exposes window.lessonShell = { selectStage, setPresentation, flags }.
   --------------------------------------------------------------------------- */
function behaviourScript() {
  return `
/* lesson-shell v${VERSION} behaviour — dialogs, stage tablist, presentation
   mode, check cards. Injected by build.js; do not edit in the built file. */
(() => {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const flags = new Set(location.hash.replace(/^#/, '').split(',').filter(Boolean));
  const hashStage = (() => {
    for (const f of flags) { const m = /^stage-(\\d+)$/.exec(f); if (m) return Number(m[1]) - 1; }
    return null;
  })();
  /* Presentation mode has to be on the body before the activity initialises,
     so it is read here and not after. The fragment is stripped on arrival so a
     later manual refresh is an ordinary fresh load. */
  if (flags.has('presenting')) document.body.classList.add('presenter');
  if (flags.size) { try { history.replaceState(null, '', location.href.split('#')[0]); } catch (e) { /* some hosts refuse replaceState on file://; a visible fragment is cosmetic */ } }

  /* ---- dialogs ---------------------------------------------------------- */
  const guide = $('#guide'), settings = $('#settings'), notes = $('#presenter-notes'), details = $('#details');
  let opener = null;
  /* Opening a card from inside another one SWAPS them: nesting two modal
     dialogs stacks backdrops and makes Escape ambiguous. */
  const open = (dialog, from) => {
    if (!dialog) return;
    const host = from && from.closest && from.closest('dialog[open]');
    opener = host ? $('#settings-open') : from;
    if (host) host.close();
    dialog.showModal();
    const head = $('.lesson-dialog-head button', dialog);
    if (head) head.focus();
  };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.guide-open');
    if (!b) return; e.preventDefault(); open(guide, b);
  });
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.notes-open');
    if (!b) return; e.preventDefault(); open(notes, b);
  });
  const settingsOpen = $('#settings-open');
  if (settingsOpen) settingsOpen.addEventListener('click', e => open(settings, e.currentTarget));
  [guide, settings, notes, details].filter(Boolean).forEach(d => {
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => { if (opener && opener.isConnected) opener.focus(); });
  });
  /* A5: the Details trigger in the stage intro, and reopenable from anywhere. */
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.details-trigger');
    if (!b || !details) return;
    e.preventDefault();
    const k = b.dataset.details || '0';
    $$('.details-stage', details).forEach(s => {
      const on = s.dataset.detailsStage === k;
      s.classList.toggle('on', on); s.hidden = !on;
    });
    const sub = $('#details-subtitle');
    const tab = $$('.stage-tab')[Number(k)];
    if (sub && tab) sub.textContent = ($('span:not(.stage-mark)', tab) || {}).textContent || '';
    opener = b;
    details.showModal();
    const head = $('.lesson-dialog-head button', details);
    if (head) head.focus();
  });

  /* ---- A1 stage tablist ------------------------------------------------- */
  const tabs = $$('.stage-tab');
  const panels = $$('section.stage');
  function selectStage(index, opts) {
    if (!tabs.length) return;
    /* A gated demo (one that unlocks stage k+1 only after stage k's evidence)
       clamps here rather than unlocking: the prediction-before-evidence gate
       IS the pedagogy, and a hash must not route around it. The clamp is
       silent by design; the tab stays visible and disabled so the learner
       still sees the whole route. */
    let i = Math.max(0, Math.min(tabs.length - 1, index));
    while (i > 0 && tabs[i].disabled) i -= 1;
    tabs.forEach((t, k) => {
      const on = k === i;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p, k) => p.classList.toggle('on', k === i));
    if (opts && opts.focus) tabs[i].focus();
    document.dispatchEvent(new CustomEvent('stagechange', { detail: { index: i } }));
    return i;
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectStage(i));
    tab.addEventListener('keydown', e => {
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (step) {
        e.preventDefault();
        let j = i;
        do { j = (j + step + tabs.length) % tabs.length; } while (tabs[j].disabled && j !== i);
        selectStage(j, { focus: true });
      } else if (e.key === 'Home') { e.preventDefault(); selectStage(0, { focus: true }); }
      else if (e.key === 'End') { e.preventDefault(); selectStage(tabs.length - 1, { focus: true }); }
    });
  });
  if (hashStage !== null) selectStage(hashStage);

  /* ---- A8 presentation mode --------------------------------------------- */
  function setPresentation(on) {
    document.body.classList.toggle('presenter', on);
    $$('#presentation-btn, #presentation-foot').forEach(b => {
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('active', on);
    });
    document.dispatchEvent(new CustomEvent('presentationchange', { detail: { on } }));
  }
  $$('#presentation-btn, #presentation-foot').forEach(b => b.addEventListener('click', () => {
    setPresentation(!document.body.classList.contains('presenter'));
    if (settings && settings.open) settings.close();
  }));
  setPresentation(document.body.classList.contains('presenter'));

  /* ---- A6 check cards: feedback for every option, nothing scored -------- */
  $$('.check').forEach(card => {
    const out = $('.check-feedback', card);
    $$('.check-option', card).forEach(btn => btn.addEventListener('click', () => {
      $$('.check-option', card).forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      if (out) out.innerHTML = (btn.classList.contains('correct') ? '<b>Supported.</b> ' : '<b>Not what the detector showed.</b> ')
        + (btn.dataset.feedback || '');
    }));
  });

  /* ---- Reset: a fresh load, with presentation mode preserved ------------ */
  const resetBtn = $('#reset-btn');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    if (window.lessonShell.onReset && window.lessonShell.onReset() === false) return;
    const f = ['reset'];
    if (document.body.classList.contains('presenter')) f.push('presenting');
    const base = location.href.split('#')[0];
    try { location.replace(base + '#' + f.join(',')); } catch (e) { location.hash = f.join(','); }
    location.reload();
  });

  /* ---- A7: the Guide greets every load; a Reset arrives explained ------- */
  if (guide && !guide.open && !flags.has('reset')) {
    opener = $('#guide-open');
    guide.showModal();
    const cta = $('.lesson-dialog-actions button', guide);
    if (cta) cta.focus();
  }

  window.lessonShell = { selectStage, setPresentation, flags, onReset: null };
})();
`;
}

module.exports = {
  VERSION,
  MARKERS,
  QUALIFIER_CLASS,
  REQUIRED_TOKENS,
  REQUIRED_CLASSES,
  KICKERS,
  css,
  cssHash,
  stamp,
  readStamp,
  behaviourScript
};
