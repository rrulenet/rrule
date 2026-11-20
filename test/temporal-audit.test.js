import test from 'node:test';
import assert from 'node:assert/strict';
import { RRule, RRuleSet, rrulestr } from '../dist/index.js';

test('classic facade parses quoted TZID with VALUE parameters and preserves leap-day anchors', () => {
  const text = 'DTSTART;VALUE=DATE-TIME;TZID="America/New_York":20240229T090000\nRRULE:FREQ=YEARLY;COUNT=2';
  assert.deepEqual(rrulestr(text).all().map(date => date.toISOString()), ['2024-02-29T14:00:00.000Z', '2028-02-29T14:00:00.000Z']);
});

test('classic callbacks stop dense rules and stream more than the default preview', () => {
  const options = { freq: RRule.YEARLY, dtstart: new Date('2025-01-01T00:00:00Z'),
    bymonth: Array.from({ length: 12 }, (_, i) => i + 1), bymonthday: Array.from({ length: 31 }, (_, i) => i + 1),
    byhour: Array.from({ length: 24 }, (_, i) => i), byminute: Array.from({ length: 60 }, (_, i) => i),
    bysecond: Array.from({ length: 60 }, (_, i) => i) };
  assert.deepEqual(new RRule(options).all((_, index) => index < 1).map(date => date.toISOString()), ['2025-01-01T00:00:00.000Z']);
  const set = new RRuleSet();
  set.rrule(new RRule({ freq: RRule.DAILY, dtstart: options.dtstart }));
  set.rdate(options.dtstart);
  set.exdate(new Date('2025-01-02T00:00:00Z'));
  assert.equal(set.all((_, index) => index < 1000).length, 1000);
  assert.equal(set.before(new Date('2050-01-01T00:00:00Z'), true).toISOString(), '2050-01-01T00:00:00.000Z');
});

test('classic yearly week numbers expand the week before applying day filters', () => {
  const rule = rrulestr('DTSTART:20250101T090000Z\nRRULE:FREQ=YEARLY;BYWEEKNO=20;BYMONTHDAY=15;COUNT=4');
  const expected = ['2025-05-15', '2026-05-15', '2028-05-15', '2029-05-15'];
  const days = values => values.map(value => value.toISOString().slice(0, 10));
  assert.deepEqual(days(rule.all()), expected);
  assert.deepEqual(days(rule.between(new Date('2026-01-01'), new Date('2029-01-01'))), expected.slice(1, 3));
  assert.deepEqual(days([rule.after(new Date('2025-06-01')), rule.before(new Date('2029-01-01'))]), expected.slice(1, 3));

  const positional = rrulestr('DTSTART:20250101T090000Z\nRRULE:FREQ=YEARLY;BYWEEKNO=20;BYMONTHDAY=12,13,14,15,16,17,18;BYSETPOS=-1;COUNT=3');
  assert.deepEqual(days(positional.all()), ['2025-05-18', '2026-05-17', '2027-05-18']);
});

test('classic round trips RFC DATE properties and keeps timed midnight exceptions', () => {
  const text = [
    'DTSTART;VALUE=DATE:20250101',
    'RRULE:FREQ=DAILY;UNTIL=20250104',
    'RDATE;VALUE=DATE:20250106',
    'RDATE:20250106T000000Z',
    'EXDATE;VALUE=DATE:20250102',
    'EXDATE:20250103T000000Z',
  ].join('\n');
  const rule = rrulestr(text);
  for (const restored of [rule, rule.clone(), rrulestr(rule.toString())]) {
    assert.equal(restored.toString(), text);
    assert.deepEqual(restored.all().map(value => value.toISOString().slice(0, 10)), ['2025-01-01', '2025-01-04', '2025-01-06']);
  }
  assert.equal(RRule.fromString('DTSTART:20250101\nRRULE:FREQ=DAILY;COUNT=1').toString(),
    'DTSTART;VALUE=DATE:20250101\nRRULE:FREQ=DAILY;COUNT=1');
  assert.equal(rrulestr('DTSTART;VALUE=DATE:20250101').toString(), 'DTSTART;VALUE=DATE:20250101');
});

test('classic range callbacks stop within dense rules and sets', () => {
  const start = new Date('2025-01-01T00:00:00Z');
  const end = new Date('2025-01-21T00:00:00Z');
  const rule = new RRule({ freq: RRule.SECONDLY, dtstart: start, count: 10_000_000 });
  const set = new RRuleSet();
  set.rrule(rule);
  set.rdate(start);
  set.exdate(start);
  for (const [source, first] of [[rule, start.getTime()], [set, start.getTime() + 1000]]) {
    const calls = [];
    const values = source.between(start, end, true, (value, index) => {
      calls.push([value.getTime(), index]);
      return index < 1;
    });
    assert.deepEqual(values.map(value => value.getTime()), [first]);
    assert.deepEqual(calls, [[first, 0], [first + 1000, 1]]);
  }
});
