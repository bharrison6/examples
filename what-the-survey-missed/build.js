'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const template = fs.readFileSync(path.join(root, 'app.template.html'), 'utf8');
const model = fs.readFileSync(path.join(root, 'model.js'), 'utf8').replace(/\r\n/g, '\n');
const marker = '/* OCCUPANCY_MODEL */';
if (!template.includes(marker)) throw new Error('Model injection marker is missing.');
const output = template.replace(marker, '/* OCCUPANCY_MODEL: BEGIN */\n' + model + '\n/* OCCUPANCY_MODEL: END */');
const target = path.join(root, 'index.html');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== output) throw new Error('index.html is stale. Run: node build.js');
  console.log('PASS  index.html is reproducibly built from app.template.html + model.js');
} else { fs.writeFileSync(target, output); console.log('Built what-the-survey-missed/index.html from source.'); }
