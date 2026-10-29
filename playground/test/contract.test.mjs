import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import * as net from 'rrulenet-published';
import * as temporal from 'rrule-temporal';
import { cases, assess, findCase, canonical } from '../../comparison/cases.mjs';
import { execute, snippet } from '../../comparison/execute.mjs';
import { verifyInstall } from '../scripts/verify-install.mjs';
const libs = { upstream: createRequire(import.meta.url)('rrule'), temporal, rrulenet: net };
const request = fixture => ({ text: fixture.text, maximum: 10 });

test('all three comparison packages and core resolve from the pinned registry install', () => {
  const proof = verifyInstall();
  assert.equal(proof['rrule-temporal'].version, '2.2.8');
  assert.equal(proof['rrulenet-published'].version, '0.2.1');
  assert.equal(proof['@rrulenet/core'].version, '0.2.1');
});

test('practical control schedules match their independent reference in all engines', () => {
  for (const fixture of cases.filter(value => value.control)) for (const [engine, lib] of Object.entries(libs)) {
    assert.equal(assess(execute(engine, lib, request(fixture)), fixture.expected).kind, 'correct', `${fixture.id} ${engine}`);
  }
});

test('out-of-range rejection is distinguished from silently dropping the constraint, including strict mode', () => {
  const fixture = cases.find(value => value.id === '676-byhour');
  assert.equal(assess(execute('rrulenet', net, request(fixture)), fixture.expected).kind, 'correct');
  assert.equal(assess(execute('temporal', temporal, request(fixture)), fixture.expected).label, 'Invalid input accepted');
  const strict = new temporal.RRuleTemporal({ rruleString: fixture.text, strict: true });
  assert.deepEqual(strict.all().map(value => new Date(value.epochMilliseconds).toISOString()), ['2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z']);
  assert.equal(assess({ status: 'error', stage: 'query', error: { message: 'Maximum iterations exceeded' } }, fixture.expected).kind, 'limited');
});

test('composition support is labelled separately and preserves the actual single-rule output', () => {
  const fixture = cases.find(value => value.id === 'combined-schedules');
  const actual = execute('temporal', temporal, request(fixture));
  assert.equal(actual.status, 'ok'); assert.equal(actual.values.length, 3);
  assert.equal(assess(actual, fixture.expected).kind, 'unsupported');
  assert.equal(assess(execute('rrulenet', net, request(fixture)), fixture.expected).kind, 'correct');
});

test('the known leap-day DTSTART limitation is visible rather than graded as success', () => {
  const fixture = cases.find(value => value.id === 'leap-birthday');
  const actual = execute('rrulenet', net, request(fixture));
  assert.equal(actual.values[0], '2017-02-28T12:00:00.000Z');
  assert.equal(assess(actual, fixture.expected).kind, 'incorrect');
  assert.equal(assess(execute('temporal', temporal, request(fixture)), fixture.expected).kind, 'correct');
  assert.equal(assess(execute('upstream', libs.upstream, request(fixture)), fixture.expected).kind, 'unsupported');
});

test('open-ended previews return only the requested prefix without adding COUNT to the rule', () => {
  const text = 'DTSTART:20260101T090000Z\nRRULE:FREQ=DAILY';
  for (const [engine, lib] of Object.entries(libs)) {
    const actual = execute(engine, lib, { text, maximum: 3 });
    assert.deepEqual(actual.values, ['2026-01-01T09:00:00.000Z', '2026-01-02T09:00:00.000Z', '2026-01-03T09:00:00.000Z']);
    assert.equal(actual.more, true); assert(!actual.serialized.includes('COUNT='));
  }
});

test('arbitrary input remains unscored and demo restrictions are not attributed to engines', () => {
  const actual = execute('rrulenet', net, { text: 'FREQ=DAILY', maximum: 10 });
  assert.equal(actual.stage, 'input'); assert.equal(actual.error.name, 'PlaygroundInputError');
  assert.equal(assess(actual, { kind: 'reject' }).kind, 'unscored');
  assert.equal(assess({ status: 'ok', values: [] }, undefined).kind, 'unscored');
  assert.equal(assess({ status: 'timeout' }, { kind: 'dates', values: [] }).kind, 'timeout');
});

test('curated matching tolerates newline conventions, but never claims to understand a changed rule', () => {
  assert.equal(findCase(cases[0].text.replaceAll('\n', '\r\n')).id, cases[0].id);
  assert.equal(findCase(cases[0].text.replace('COUNT=4', 'COUNT=6')), undefined);
  assert.equal(canonical('\n RRULE:FREQ=DAILY \n'), 'RRULE:FREQ=DAILY');
});

test('package-specific reproduction snippets execute using each library public API', () => {
  const fixture = cases[0];
  for (const engine of ['upstream', 'temporal', 'rrulenet']) {
    const code = snippet(fixture.text, engine).replace("from '@rrulenet/rrule'", "from 'rrulenet-published'")
      .replace('console.log(dates);', 'console.log(JSON.stringify(dates.map(value => new Date(value.epochMilliseconds ?? value.getTime()).toISOString())));');
    const output = execFileSync(process.execPath, ['--input-type=module', '--eval', code], { cwd: new URL('../', import.meta.url), encoding: 'utf8', timeout: 5000 });
    assert.deepEqual(JSON.parse(output), fixture.expected.values);
  }
});

test('shared text remains data in copyable code', () => {
  const text = 'DTSTART:20260101T090000Z\nRRULE:FREQ=DAILY;COUNT=2\n"; globalThis.injected = true; //';
  let captured; const context = { rrule: { rrulestr(value) { captured = value; return { all() { return []; } }; } }, console: { log() {} } };
  runInNewContext(snippet(text, 'upstream').replace(/^import[^\n]+\n/, ''), context);
  assert.equal(context.injected, undefined); assert.equal(captured, text);
});
