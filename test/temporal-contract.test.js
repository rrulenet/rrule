import test from 'node:test';
import assert from 'node:assert/strict';
import { RRule, RRuleSet, rrulestr } from '../dist/index.js';

for (const sample of [
  { start: '20261025T013000', body: 'FREQ=HOURLY;COUNT=4', expected: ['2026-10-24T23:30:00.000Z', '2026-10-25T00:30:00.000Z', '2026-10-25T02:30:00.000Z', '2026-10-25T03:30:00.000Z'] },
  { start: '20260328T023000', body: 'FREQ=DAILY;COUNT=3', expected: ['2026-03-28T01:30:00.000Z', '2026-03-29T01:30:00.000Z', '2026-03-30T00:30:00.000Z'] },
  { start: '20260329T013000', body: 'FREQ=MINUTELY;INTERVAL=40;COUNT=5', expected: ['2026-03-29T00:30:00.000Z', '2026-03-29T01:10:00.000Z', '2026-03-29T01:30:00.000Z', '2026-03-29T01:50:00.000Z', '2026-03-29T02:10:00.000Z'] },
]) {
  test(`public RFC temporal contract ${sample.start} ${sample.body}`, () => {
    const input = `DTSTART;TZID=Europe/Paris:${sample.start}\nRRULE:${sample.body}`;
    for (const rule of [RRule.fromString(input), rrulestr(input)]) {
      assert.deepEqual(rule.all().map(value => value.toISOString()), sample.expected);
      assert.deepEqual(rule.between(new Date(sample.expected[0]), new Date(sample.expected.at(-1)), true).map(value => value.toISOString()), sample.expected);
      for (let i = 0; i + 1 < sample.expected.length; i++) {
        assert.equal(rule.after(new Date(sample.expected[i]), false)?.toISOString(), sample.expected[i + 1]);
        assert.equal(rule.before(new Date(sample.expected[i + 1]), false)?.toISOString(), sample.expected[i]);
      }
    }
  });
}

test('explicit second-passage RDATE and EXDATE survive RFC serialization', () => {
  const set = new RRuleSet();
  set.tzid('Europe/Paris');
  const first = new Date('2026-10-25T00:30:00Z');
  const second = new Date('2026-10-25T01:30:00Z');
  set.rdate(first);
  set.rdate(second);
  assert.deepEqual(rrulestr(set.toString()).all(), [first, second]);
  set.exdate(second);
  assert.deepEqual(rrulestr(set.toString()).all(), [first]);
});

test('public rule rejects COUNT with UNTIL and lossy local DTSTART export', () => {
  assert.throws(() => RRule.fromString('DTSTART:20260101T000000Z\nRRULE:FREQ=DAILY;COUNT=2;UNTIL=20260103T000000Z'), /COUNT.*UNTIL/);
  const rule = new RRule({freq: RRule.DAILY, count: 1, tzid: 'Europe/Paris', dtstart: new Date('2026-10-25T01:30:00Z')});
  assert.throws(() => rule.toString(), /second overlap/);
});

test('a standalone exact DTSTART preserves the second passage on export', () => {
  const set = new RRuleSet();
  set.tzid('Europe/Paris');
  const second = new Date('2026-10-25T01:30:00Z');
  set.dtstart(second);
  set.rdate(second);
  assert.deepEqual(rrulestr(set.toString()).all(), [second]);
});
