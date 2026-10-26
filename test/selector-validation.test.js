import test from 'node:test';
import assert from 'node:assert/strict';
import { RRule, rrulestr } from '../dist/index.js';

const start = new Date('2026-01-01T00:00:00Z');
const invalid = { byhour: 25, byminute: 60, bysecond: 61, bymonth: 13, bymonthday: 32 };

test('classic facade: rejects invalid selectors before construction, parsing or set inclusion', () => {
  for (const [key, value] of Object.entries(invalid)) {
    const text = `DTSTART:20260101T000000Z\nRRULE:FREQ=DAILY;COUNT=2;${key.toUpperCase()}=${value}`;
    for (const create of [
      () => new RRule({ freq: RRule.DAILY, count: 2, dtstart: start, [key]: value }),
      () => RRule.parseString(text),
      () => RRule.fromString(text),
      () => rrulestr(text),
      () => rrulestr(text, { forceset: true }),
      () => rrulestr(`DTSTART:20260101T000000Z\nRRULE:FREQ=DAILY;COUNT=2\nEXRULE:FREQ=DAILY;${key.toUpperCase()}=${value}`),
    ]) assert.throws(create, error => error instanceof RangeError && error.message.includes(key.toUpperCase()));
  }
});

test('classic facade: leap-second fallback is queryable and roundtrips the original selector', () => {
  const text = 'DTSTART:20260101T000059Z\nRRULE:FREQ=MINUTELY;COUNT=2;BYSECOND=60';
  const rule = rrulestr(text);
  const expected = ['2026-01-01T00:00:59.000Z', '2026-01-01T00:01:59.000Z'];
  assert.deepEqual(rule.all().map(date => date.toISOString()), expected);
  assert.equal(rule.after(new Date(expected[0]), false)?.toISOString(), expected[1]);
  assert.deepEqual(rrulestr(rule.toString()).all().map(date => date.toISOString()), expected);
});
