#!/usr/bin/env node
/* Render the presenter guide to PDF with the same engine the demo runs in. */
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const guide = path.join(HERE, '..', 'presenter-guide.html');
const src = new URL('../presenter-guide.html', import.meta.url).href;
const out = path.join(HERE, '..', 'Takeoff-Presenter-Guide.pdf');
const check = process.argv.includes('--check');
if (!fs.existsSync(guide)) throw new Error(`Canonical presenter guide is missing: ${guide}`);

const candidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);
let b;
try { b = await chromium.launch(); }
catch (managedError) {
  const executablePath = candidates.find(fs.existsSync);
  if (!executablePath) throw new Error(`No Playwright Chromium or system Chrome/Edge found. ${managedError.message}`);
  b = await chromium.launch({ executablePath });
  console.log('FALLBACK: using system browser', executablePath);
}
const p = await b.newPage();
await p.goto(src, { waitUntil: 'load' });
if (check) {
  const title = await p.title();
  await b.close();
  if (!fs.existsSync(out)) throw new Error(`PDF CHECK FAILED: ${path.basename(out)} is missing; run node tools/pdf.mjs`);
  if (title !== 'Takeoff — presenter guide') throw new Error(`PDF CHECK FAILED: unexpected canonical guide title ${title}`);
  console.log('PDF CHECK OK: canonical guide loaded and existing PDF found; no files written.');
  process.exit(0);
}
await p.pdf({ path: out, format: 'Letter', printBackground: true,
              margin: { top: '0.6in', bottom: '0.6in', left: '0.6in', right: '0.6in' } });
await b.close();
console.log('WRITE OK:', path.basename(out));
