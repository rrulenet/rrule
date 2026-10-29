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
