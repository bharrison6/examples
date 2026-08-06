// Render demo-guide.html to Glass-Box-Demo-Guide.pdf
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const browserPath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => p && fs.existsSync(p));
const browser = await chromium.launch(browserPath ? { executablePath: browserPath } : {});
const page = await browser.newPage();
await page.goto('file://' + path.join(here, '..', 'demo-guide.html'));
await page.pdf({
  path: path.join(here, '..', 'Glass-Box-Demo-Guide.pdf'),
  format: 'A4',
  printBackground: true,
  margin: { top: '10mm', bottom: '10mm', left: '9mm', right: '9mm' },
});
await browser.close();
console.log('Glass-Box-Demo-Guide.pdf rendered');
