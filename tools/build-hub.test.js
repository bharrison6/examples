'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('generated launcher cards match the tour and concise manifest copy', () => {
  const check = spawnSync(process.execPath, [path.join(__dirname, 'build-hub.js'), '--check'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(check.status, 0, `${check.stdout}\n${check.stderr}`);

  const tour = JSON.parse(read('tours/zero-to-takeoff.json'));
  const expected = tour.sections.flatMap(section => section.demos);
  const index = read('index.html');
  const cards = [...index.matchAll(/<a class="card" href="([a-z0-9-]+)\/index\.html">([\s\S]*?)<\/a>/g)];

  assert.deepEqual(cards.map(match => match[1]), expected);
  for (const [, slug, body] of cards) {
    const manifest = JSON.parse(read(`${slug}/demo.json`));
    const blurb = manifest.hub_blurb || manifest.card_blurb;
    assert.match(body, new RegExp(`<p>${escapeRegExp(blurb)}</p>`), `${slug} uses its hub copy`);
  }
});

test('README keeps detailed descriptions and the tour closes with both Fellow demos', () => {
  const tour = JSON.parse(read('tours/zero-to-takeoff.json'));
  const order = tour.sections.flatMap(section => section.demos);
  assert.deepEqual(order.slice(-2), ['missing-time', 'what-the-survey-missed']);

  const readme = read('README.md');
  for (const slug of order) {
    const manifest = JSON.parse(read(`${slug}/demo.json`));
    assert.ok(readme.includes(manifest.description), `${slug} keeps its detailed README description`);
  }
});

test('the promised-demo completeness guard remains in the generator', () => {
  const source = read('tools/build-hub.js');
  assert.match(source, /promised by a tour but incomplete/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
