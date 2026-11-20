import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { after, before, test } from 'node:test';
import manifest from '../../package.json' with { type: 'json' };
import { presets } from '../../src/presets.mjs';

const session = `rrulenet-test-${randomUUID().slice(0, 12)}`;
const fixture = id => presets.find(preset => preset.id === id).text;
let server;
let url;

function browser(...args) {
  return execFileSync('agent-browser', ['--session', session, ...args], {
    encoding: 'utf8',
    env: { ...process.env, AGENT_BROWSER_DEFAULT_TIMEOUT: '8000' },
    timeout: 20000,
  }).trim();
}

function evaluate(expression) {
  return JSON.parse(browser('eval', `JSON.stringify(${expression})`));
}

function waitFor(expression) {
  browser('wait', '--fn', expression);
}

function setDate(selector, value) {
  browser('eval', `(() => {
    const field = document.querySelector(${JSON.stringify(selector)});
    field.value = ${JSON.stringify(value)};
    if (!field.value) throw new Error('Invalid test date');
  })()`);
}

before(async () => {
  server = spawn(process.execPath, ['scripts/serve.mjs', '--port', '0'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const lines = createInterface({ input: server.stdout });
  const [address] = await once(lines, 'line', { signal: AbortSignal.timeout(5000) });
  url = new URL(address.replace(/^Local: /, ''));
  browser('open', url.href);
});

after(() => {
  try {
    if (url) browser('close');
  } finally {
    server?.kill();
  }
});

test('loads the published engine and its default preset', async () => {
  waitFor("document.querySelectorAll('#results li').length === 12");
  assert.equal(browser('get', 'title'), 'RRULE Playground · rrule.net');
  assert.equal(browser('get', 'attr', '#builder-mode', 'aria-pressed'), 'true');
  assert.equal(browser('get', 'text', '#zone-label'), 'America/Chicago');
  assert.match(browser('get', 'text', '#results li:first-child'), /17:00:00/);
  assert.equal(browser('get', 'text', '#engine-version'), `@rrulenet/rrule ${manifest.dependencies['@rrulenet/rrule']}`);
  const metadata = await (await fetch(new URL('versions.json', url))).json();
  assert.deepEqual(Object.keys(metadata.installation), ['@rrulenet/core', '@rrulenet/rrule', 'temporal-polyfill']);
  assert.equal((await fetch(new URL('engine-temporal.js', url))).status, 404);
});

test('edits all-day exceptions and preserves them between editor modes', () => {
  browser('open', url.href);
  browser('select', '#preset', 'school-days');
  assert.equal(browser('is', 'visible', '#start-time-field'), 'false');
  setDate('#exception-date', '2026-09-09');
  browser('click', '#exclude-date');
  waitFor("document.querySelectorAll('#results li').length === 5");
  browser('click', '#text-mode');
  assert.match(browser('get', 'value', '#editor'), /EXDATE;VALUE=DATE:20260909/);
  browser('click', '#builder-mode');
  assert.match(browser('get', 'value', '[name="exceptions"]'), /EXDATE;VALUE=DATE:20260909/);
});

test('opens direct RRULE input from a URL and shares it again', () => {
  const rule = 'DTSTART;TZID="+05:30":20260101T090000\nRRULE:FREQ=DAILY;COUNT=2';
  const link = new URL(url);
  link.search = new URLSearchParams({ rrule: rule, limit: '24' });
  browser('open', link.href);
  waitFor("document.querySelectorAll('#results li').length === 2");
  assert.equal(browser('get', 'value', '#editor'), rule);
  browser('eval', "Object.defineProperty(navigator, 'clipboard', { value: undefined }); true");
  browser('click', '#share');
  waitFor("!document.querySelector('#copy-fallback').hidden");
  const shared = new URL(browser('get', 'value', '#copy-text'));
  assert.equal(shared.searchParams.get('rrule'), rule);
  assert.equal(shared.searchParams.get('limit'), '24');
  browser('open', shared.href);
  waitFor("document.querySelector('#zone-label').textContent === '+05:30'");
  assert.equal(browser('get', 'value', '#editor'), rule);
});

test('syncs preset and builder edits to the URL and restores the builder on reload', () => {
  browser('open', url.href);
  const historyLength = evaluate('history.length');
  browser('select', '#preset', 'school-days');
  let link = new URL(browser('get', 'url'));
  assert.equal(link.searchParams.get('rrule'), fixture('school-days'));
  assert.equal(link.searchParams.get('example'), 'school-days');
  browser('click', '#text-mode');
  assert.equal(browser('get', 'value', '#editor'), fixture('school-days'));
  browser('click', '#builder-mode');
  browser('fill', '[name="COUNT"]', '3');
  waitFor("new URLSearchParams(location.search).get('rrule')?.includes('COUNT=3')");
  browser('select', '#maximum', '24');
  link = new URL(browser('get', 'url'));
  assert.equal(link.searchParams.get('mode'), 'builder');
  assert.equal(link.searchParams.get('limit'), '24');
  assert.equal(link.searchParams.get('example'), null);
  assert.equal(evaluate('history.length'), historyLength);
  browser('reload');
  waitFor("document.querySelector('#builder-mode').getAttribute('aria-pressed') === 'true'");
  assert.equal(browser('get', 'value', '[name="COUNT"]'), '3');
  assert.equal(browser('get', 'value', '#maximum'), '24');
  browser('fill', '[name="COUNT"]', '');
  waitFor("document.querySelector('#error').textContent.includes('occurrence count')");
  assert.equal(browser('get', 'url'), link.href);
});

test('syncs RRULE text before previewing and includes a reproducible DTSTART', () => {
  browser('open', url.href);
  browser('click', '#text-mode');
  browser('fill', '#editor', 'FREQ=DAILY;COUNT=2');
  waitFor("new URLSearchParams(location.search).get('rrule')?.includes('COUNT=2')");
  const link = new URL(browser('get', 'url'));
  assert.match(link.searchParams.get('rrule'), /^DTSTART[^\n]+\nFREQ=DAILY;COUNT=2$/);
  assert.match(browser('get', 'text', '#result-status'), /Preview the edited rule/);
  browser('reload');
  waitFor("document.querySelectorAll('#results li').length === 2");
  assert.equal(browser('get', 'value', '#editor'), link.searchParams.get('rrule'));
  browser('fill', '#editor', '');
  waitFor("new URLSearchParams(location.search).get('rrule') === ''");
});

test('keeps composed schedules editable as text', () => {
  browser('open', new URL('?example=combined-schedules', url).href);
  waitFor("document.querySelectorAll('#results li').length === 7");
  assert.equal(browser('get', 'value', '#editor'), fixture('combined-schedules'));
  browser('click', '#builder-mode');
  assert.match(browser('get', 'text', '#editor-message'), /needs one RRULE/);
  assert.equal(browser('get', 'value', '#editor'), fixture('combined-schedules'));
});

test('reports invalid rules and shows inclusive date queries on the calendar', () => {
  browser('open', url.href);
  browser('click', '#text-mode');
  browser('fill', '#editor', 'FREQ=DAILY;BYHOUR=25');
  browser('click', '#run');
  waitFor("document.querySelector('#error').textContent.includes('BYHOUR')");
  browser('fill', '#editor', 'DTSTART:20260101T090000Z\nRRULE:FREQ=DAILY;COUNT=5');
  browser('click', '#run');
  waitFor("document.querySelectorAll('#results li').length === 5");
  browser('click', '#calendar-view');
  assert.equal(browser('get', 'count', '.calendar-day.has-occurrence'), '5');
  browser('click', '#query-panel summary');
  browser('select', '[name="operation"]', 'between');
  setDate('[name="query-start"]', '2026-01-02T09:00');
  setDate('[name="query-end"]', '2026-01-04T09:00');
  browser('check', '[name="inclusive"]');
  browser('click', '#query-form button[type="submit"]');
  waitFor("document.querySelector('#result-status').textContent === '3 dates'");
  assert.equal(browser('get', 'count', '.calendar-day.has-occurrence'), '3');
});

test('fits a phone viewport and keeps the clock-change preset easy to read', () => {
  browser('set', 'viewport', '390', '844');
  browser('open', url.href);
  waitFor("document.querySelectorAll('#results li').length === 12");
  assert(evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'));
  browser('select', '#preset', 'spring-forward');
  waitFor("document.querySelector('#results li:nth-child(2)')?.textContent.includes('03:30:00')");
});
