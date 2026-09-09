// Render teacher-guide.html to teacher-guide.pdf.
// Dependency-free: drives an installed Chrome/Edge headless rather than pulling
// playwright, so the guide can be re-rendered on a bare checkout. The guide sets
// its own @page (letter, 0.55in), so no margins are passed here.
//
// teacher-guide.html is the same file build.js injects into index.html as the
// in-app presenter notes, so the printed PDF and the on-screen notes are one
// document. Re-run this after editing the guide, alongside `node build.js`.
//
//   node tools/pdf.mjs           writes teacher-guide.pdf
//   node tools/pdf.mjs --check   verifies the guide is the guide and the PDF exists
import { fileURLToPath, pathToFileURL } from 'url';
import { execFileSync } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', 'teacher-guide.html');
const out = path.join(here, '..', 'teacher-guide.pdf');
const check = process.argv.includes('--check');

if (!fs.existsSync(src)) {
  console.error(`the canonical guide is missing: ${src}`);
  process.exit(1);
}
if (!fs.readFileSync(src, 'utf8').includes('<title>Time-of-Flight Mass Spectrometer — Teacher Guide</title>')) {
  console.error('unexpected guide title; refusing to render a file that is not the guide.');
  process.exit(1);
}

if (check) {
  if (!fs.existsSync(out)) {
    console.error('teacher-guide.pdf is missing; run: node tools/pdf.mjs');
    process.exit(1);
  }
  const bytes = fs.statSync(out).size;
  if (bytes < 8192) {
    console.error(`teacher-guide.pdf is only ${bytes} bytes; run: node tools/pdf.mjs`);
    process.exit(1);
  }
  console.log(`PDF check: guide parses and teacher-guide.pdf exists (${(bytes / 1024).toFixed(0)} KB); no files written.`);
  process.exit(0);
}

const browser = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(p => p && fs.existsSync(p));

if (!browser) {
  console.error('No Chrome/Edge found. Set CHROME_PATH to a Chromium-based browser.');
  process.exit(1);
}

// A throwaway profile keeps this off the user's running browser, which would
// otherwise refuse the headless print with a profile lock.
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ion-flight-pdf-'));
try {
  execFileSync(browser, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profile}`,
    '--no-pdf-header-footer',
    `--print-to-pdf=${out}`,
    pathToFileURL(src).href,
  ], { stdio: 'ignore' });
} finally {
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
}

if (!fs.existsSync(out)) { console.error('render produced no file'); process.exit(1); }
console.log('teacher-guide.pdf rendered:', (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
