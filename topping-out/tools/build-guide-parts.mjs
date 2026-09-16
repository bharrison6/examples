#!/usr/bin/env node
/* One-shot assembler used during the lesson-shell retrofit to build
   src/demo-guide.html and src/appendix.html out of the pre-split
   src/teacher-guide.html head plus the new bodies in tools/guide-src/.

   Why a script rather than hand-editing: the guide's scoped stylesheet is
   136 lines that both new documents must carry BYTE-IDENTICALLY, because the
   session guide's copy is what build.js injects and the appendix's copy is
   what makes the linked page look like the same document. Retyping it twice
   is how they drift. This lifts it once.

   Run: node tools/build-guide-parts.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const DEMO = path.join(HERE, '..');
const SRC = path.join(DEMO, 'src');

const legacy = fs.readFileSync(path.join(SRC, 'teacher-guide.html'), 'utf8');
const lines = legacy.split('\n');

/* The scoped stylesheet: from the line that opens `<style id="guide-css">`
   to the matching `</style>`, found by scanning rather than by a hardcoded
   line number so an edit above it cannot silently shift the slice. */
const cssOpen = lines.findIndex(l => l.startsWith('<style id="guide-css">'));
if (cssOpen < 0) throw new Error('guide-css open marker not found');
let cssClose = -1;
for (let i = cssOpen + 1; i < lines.length; i++) {
  if (lines[i].trim() === '</style>') { cssClose = i; break; }
}
if (cssClose < 0) throw new Error('guide-css close marker not found');

/* Everything before the scoped block — the doctype, head, and the
   NON-injected page-chrome stylesheet. Reused verbatim by both documents. */
let preamble = lines.slice(0, cssOpen).join('\n');
/* The scoped rules themselves, without their own <style> tags. */
let scopedRules = lines.slice(cssOpen + 1, cssClose).join('\n');

/* ---- the kit's guide contract is STRICTER than the old build.js ---------
   The demo's previous build refused only page-level SELECTORS and @page in
   the injectable block. The kit's guide-contract.js refuses `@media` there
   too, and it is right to: an @media block inside the injected stylesheet
   is evaluated against the APP's viewport, not a sheet of paper, so the
   guide's narrow-width and print rules were quietly reformatting the notes
   overlay at phone width.

   So they move to the NON-injected page-chrome block, which is where they
   were always supposed to live. Extracted by brace-matching rather than by
   regex, because these blocks nest rules inside them. */
function extractAtMedia(source) {
  const moved = [];
  let out = '';
  let i = 0;
  while (i < source.length) {
    const at = source.indexOf('@media', i);
    if (at < 0) { out += source.slice(i); break; }
    out += source.slice(i, at);
    const open = source.indexOf('{', at);
    if (open < 0) { out += source.slice(at); break; }
    let depth = 0, j = open;
    for (; j < source.length; j++) {
      if (source[j] === '{') depth++;
      else if (source[j] === '}') { depth--; if (depth === 0) { j++; break; } }
    }
    moved.push(source.slice(at, j));
    i = j;
  }
  return { rules: out, moved };
}

const split = extractAtMedia(scopedRules);
scopedRules = split.rules;
if (split.moved.length) {
  /* Appended inside the existing page-chrome <style id="guide-page">, so the
     standalone printable sheet keeps every rule it had. */
  const pageClose = '</style>';
  const at = preamble.lastIndexOf(pageClose);
  if (at < 0) throw new Error('could not find the page-chrome stylesheet to rehome @media into');
  preamble = preamble.slice(0, at) +
    '\n  /* ---- rehomed from the injectable block (lesson-shell retrofit) ----\n' +
    '     The kit refuses @media inside the stylesheet it injects, because\n' +
    '     that block is evaluated against the app viewport rather than a\n' +
    '     sheet of paper. These are page chrome and belong here. */\n' +
    split.moved.join('\n\n') + '\n' +
    preamble.slice(at);
  console.log(`rehomed ${split.moved.length} @media block(s) out of the injectable stylesheet`);
}

/* Rules part A9 needs that the pre-split guide never had: it carried no
   .mis cards (the plan noted D2 styles .mis and never uses it) and no .say
   quote. Scoped, like everything else in this block. */
const ADDED = `
  /* ---- added for template part A9 (lesson-shell retrofit) ----
     .goals  the stage Takeaways, verbatim, as goal sentences
     .say    a line to read out loud
     .mis    a misconception card: the claim, then the correction
     Refutation is the method here, so .mis always renders the flawed
     model first and the correction under it — never the correction alone. */
  .guide-scope .goals { padding-left: 1.5em; margin: 4px 0 10px; }
  .guide-scope .goals li { margin-bottom: 7px; }
  .guide-scope .say {
    border-left: 3px solid #ECAC00; padding: 2px 0 2px 11px;
    margin: 0 0 .7em; font-style: italic;
  }
  .guide-scope .mis {
    border-left: 3px solid #8c6ea8; padding: 7px 11px; margin: 0 0 9px;
    background: #f4f1f7;
  }
  .guide-scope .mis b { display: block; color: #4d3566; }
  .guide-scope .mis span { display: block; margin-top: 3px; }
  .guide-scope .prov {
    font-family: "Roboto Condensed", Arial, sans-serif;
    font-size: 8.2pt; letter-spacing: .08em; text-transform: uppercase;
    color: #555; display: inline-block; margin-right: 6px;
  }
  /* No @media here: the kit refuses it in the injectable block. The
     print-avoid hints for these two cards are unconditional instead, which
     costs nothing on screen — break-inside has no effect outside paged
     media. */
  .guide-scope .mis, .guide-scope .say { break-inside: avoid; page-break-inside: avoid; }
`;

function assemble(bodyFile, title, outFile) {
  const body = fs.readFileSync(path.join(HERE, 'guide-src', bodyFile), 'utf8').trimEnd();
  const head = preamble.replace(
    '<title>Construction Scheduling — Instructor Guide</title>',
    `<title>${title}</title>`
  );
  const out = [
    head,
    '<style id="guide-css">',
    scopedRules,
    ADDED.trimEnd(),
    '</style>',
    '</head>',
    '<body>',
    '',
    '<button class="printbtn" onclick="window.print()">Print</button>',
    '',
    body,
    '',
    '</body>',
    '</html>',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(SRC, outFile), out);
  console.log(`${outFile}: ${(out.length / 1024).toFixed(1)} KB`);
}

assemble('session-body.html', 'Construction Scheduling — Session Guide', 'demo-guide.html');
assemble('appendix-body.html', 'Construction Scheduling — CPM Appendix', 'appendix.html');
