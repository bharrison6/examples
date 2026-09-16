#!/usr/bin/env node
/* One-shot surgery on src/styles.css for the lesson-shell retrofit.

   ADOPTING.md §2: "Every CSS rule for chrome the shell now draws — header,
   act nav, stage intro, lesson strip, eyebrow, overlay/sheet/dialog, generic
   button and focus resets. Leaving them in means two rules fighting, and the
   one that wins is the one that happens to be later." The demo's stylesheet
   is injected AFTER the shell's, so every one of these would win.

   Written as a script rather than done by hand so the exact set of removals
   is reviewable in the diff and reproducible. Each removal asserts it matched
   exactly once — a silent no-op here would leave a fighting rule in place and
   nothing downstream would catch it.

   Run once: node tools/css-retrofit.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const FILE = path.join(HERE, '..', 'src', 'styles.css');
let css = fs.readFileSync(FILE, 'utf8');

let cuts = 0;
function cut(snippet, why) {
  const n = css.split(snippet).length - 1;
  if (n !== 1) throw new Error(`expected exactly 1 match for [${why}], found ${n}`);
  css = css.replace(snippet, '');
  cuts++;
}
function sub(from, to, why) {
  const n = css.split(from).length - 1;
  if (n !== 1) throw new Error(`expected exactly 1 match for [${why}], found ${n}`);
  css = css.replace(from, to);
  cuts++;
}

/* ---- 1. THE PAGE NO LONGER OWNS THE VIEWPORT ---------------------------
   The demo used to BE the page: a full-height flex column with the document
   scroll switched off. Under the shell the demo is one section inside a
   scrolling lesson, and `overflow: hidden` on body would make the stage
   intro, the check card and the footer unreachable. This is the single most
   important change in this file. */
sub(`html, body { height: 100%; }
body {
  margin: 0;
  font-family: var(--sans);
  font-size: var(--fs);
  color: var(--ink);
  background: var(--paper);
  -webkit-text-size-adjust: 100%;
  overflow: hidden;
}`,
`/* The page scrolls now: the demo is a section inside the lesson, not the
   whole viewport. The old "height: 100%" and "overflow: hidden" are
   deliberately gone — with them the stage intro, the check card and the
   footer are unreachable. Background and colour are the shell's; only the
   activity's own type scale is set here. */
body {
  font-family: var(--sans);
  font-size: var(--fs);
}`, 'body owns the viewport');

sub(`#app { display: flex; flex-direction: column; height: 100vh; }`,
`/* The board is a block inside a stage panel now, not a full-height page.
   A fixed 100vh here would push the check card a screen down and pin the
   meeting panel to a height nothing asked for. It gets a comfortable
   working height instead and lets the lesson scroll around it. */
#app { display: flex; flex-direction: column; min-height: 62vh; }`, '#app height');

/* ---- 2. THE HEADER THE SHELL NOW DRAWS ---------------------------------
   #brand and #topbar-actions have no markup left in template.html; the
   brand kicker, the title and the Guide/Settings/Notes buttons are the
   shell's. What survives is #topbar as a thin activity strip holding
   #project-block and #hud, which ARE activity readout. */
cut(`#brand {
  padding: 7px 16px; border-right: 1px solid var(--line);
  display: flex; flex-direction: column; justify-content: center; min-width: 170px;
  background: var(--blue);
}
#brand .msu {
  display: flex; align-items: center; gap: 5px;
  font-family: var(--mono); font-size: .6rem; font-weight: 700;
  letter-spacing: .22em; color: var(--gold);
}
#brand .msu svg { flex: 0 0 auto; }
#brand .t1 {
  font-weight: 800; letter-spacing: .13em; font-size: 1.02rem; line-height: 1.15;
  color: #fff;
}
#brand .t2 {
  font-family: var(--mono); font-size: .56rem; letter-spacing: .18em;
  color: #8fa8c4; margin-top: 1px;
}
`, '#brand block');

cut(`#topbar-actions { display: flex; align-items: center; gap: 6px; padding: 0 12px; }

`, '#topbar-actions');

/* The presenter-notes shortcut is the shell's header Notes button now, and
   `body.presenting` was this demo's name for what the shell calls
   `body.presenter`. Both go. */
cut(`/* a single-glyph control — kept square so it stays a 34px touch target */
.btn.icon {
  min-width: 34px; min-height: 34px; padding: 4px 8px; font-size: .95rem; font-weight: 700;
  line-height: 1; display: inline-flex; align-items: center; justify-content: center;
}
/* the presenter's-notes shortcut only exists while presenting */
#btn-notes-top { display: none; }
body.presenting #btn-notes-top { display: inline-flex; }
`, 'icon button + presenting shortcut');

/* ---- 3. THE OVERLAY AND MODAL SYSTEM -----------------------------------
   All of it. The shell's four dialogs and this demo's own two are native
   <dialog> elements styled by shell.css. Not one .overlay or .modal element
   is left in template.html, so every rule from the "overlays" comment to the
   end of the presenter-notes block is dead — and `.overlay[hidden]` in
   particular would be a second, weaker answer to a question shell.css:38
   already answers with `[hidden] { display: none !important }`. */
const overlayStart = css.indexOf('/* ---------- overlays ----------');
const setupStart = css.indexOf('/* ---------- setup screen ---------- */');
if (overlayStart < 0 || setupStart < 0 || setupStart < overlayStart) {
  throw new Error('could not bound the overlay/modal region');
}
const removed = css.slice(overlayStart, setupStart);
if (!/\.modal\.notes/.test(removed) || !/\.overlay\[hidden\]/.test(removed)) {
  throw new Error('the bounded region is not the overlay/modal region');
}
css = css.slice(0, overlayStart) +
`/* ---------- the guide inside the shell's notes dialog ----------
   The overlay/modal system that used to live here is DELETED — the shell's
   dialogs are native <dialog> and do backdrop, Escape and focus return
   themselves. What is still needed is the two adaptations that made the
   printable guide readable inside a dialog, rehomed from the demo's old
   ".notes" onto the shell's ".guide-host".

   The guide sizes itself for a 7.1in sheet when opened as a file; in the
   dialog the dialog owns the width instead. */
.guide-host .guide-scope { max-width: none; margin: 0; padding: 4px 2px 8px; }
/* Its tables are drawn for that sheet too — wrap them rather than let the
   document push sideways inside a dialog that does not scroll horizontally.
   This is load-bearing at 320px, where the appendix's wide tables are the
   demo's only overflow risk. */
.guide-host .guide-scope td, .guide-host .guide-scope th { overflow-wrap: break-word; }
.guide-host .guide-scope .act { white-space: normal; }
.guide-host .guide-scope table { display: block; overflow-x: auto; max-width: 100%; }

/* ---------- A2 prediction capture ----------
   The Predict card's input, echoed beside the observed result. Sits inside
   the shell's .lesson-strip, so it inherits that card's type and only needs
   layout. */
.predict-slot:empty { display: none; }
.predict-slot { margin-top: 8px; }
.predict-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 4px; }
.predict-row input, .predict-row select {
  border: 1px solid var(--ink-3); border-radius: 3px; padding: 5px 8px;
  font-size: .85rem; background: var(--paper); min-width: 0; max-width: 100%;
}
.predict-row input[type="number"] { width: 7.5em; }
.predict-row select { max-width: 15em; }
.predict-row .btn { flex: 0 0 auto; }

/* The stage-level action button (stage 4's "Open the debrief"). */
.stage-action { margin: 10px 0 4px; display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.stage-action .why { font-size: .82rem; color: var(--ink-2); }

` + css.slice(setupStart);
cuts++;

fs.writeFileSync(FILE, css);
console.log(`styles.css retrofit: ${cuts} edits applied, ${css.split('\n').length} lines`);
