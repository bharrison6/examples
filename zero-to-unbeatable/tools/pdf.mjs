/* Render the printable demo guide to PDF.  node tools/pdf.mjs */
import { createRequire } from 'module';
import path from 'path'; import fs from 'fs';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome'
]
  .find(p => { try { return fs.existsSync(p); } catch { return false; } });
const browser = await chromium.launch({ headless: true, ...(LOCAL ? { executablePath: LOCAL } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.goto('file://' + path.join(__dirname, '..', 'demo-guide.html'));
await page.emulateMedia({ media: 'print' });
const out = path.join(__dirname, '..', 'Zero-to-Unbeatable-Demo-Guide.pdf');
await page.pdf({ path: out, format: 'A4', printBackground: true,
  margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' } });
await browser.close();
console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
