// Render teacher-guide.html to teacher-guide.pdf.
// Dependency-free: drives an installed Chrome/Edge headless rather than pulling
// playwright, so the guide can be re-rendered on a bare checkout. The guide sets
// its own @page (letter, 0.55in), so no margins are passed here.
import { fileURLToPath, pathToFileURL } from 'url';
import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', 'teacher-guide.html');
const out = path.join(here, '..', 'teacher-guide.pdf');

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

execFileSync(browser, [
  '--headless=new',
  '--disable-gpu',
  '--no-pdf-header-footer',
  `--print-to-pdf=${out}`,
  pathToFileURL(src).href,
], { stdio: 'ignore' });

if (!fs.existsSync(out)) { console.error('render produced no file'); process.exit(1); }
console.log('teacher-guide.pdf rendered:', (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
