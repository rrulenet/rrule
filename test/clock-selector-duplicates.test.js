import test from 'node:test';
import assert from 'node:assert/strict';
import { RRule, rrulestr } from '../dist/index.js';

test('classic facade: duplicate hours and minutes do not shift BYSETPOS and survive RFC roundtrip', () => {
  const byhour = Object.freeze([10, 9, 9]);
  const byminute = Object.freeze([30, 0, 0]);
  const rule = new RRule({ freq: RRule.DAILY, dtstart: new Date('2026-01-01T09:00:00Z'), count: 4,
    byhour, byminute, bysetpos: [3, -3] });
  const expected = ['2026-01-01T09:30:00.000Z', '2026-01-01T10:00:00.000Z',
    '2026-01-02T09:30:00.000Z', '2026-01-02T10:00:00.000Z'];
  for (const value of [rule, rrulestr(rule.toString()), rrulestr(rule.toString(), { forceset: true })]) {
    assert.deepEqual(value.all().map(date => date.toISOString()), expected);
    assert.equal(value.after(new Date(expected[1]), false)?.toISOString(), expected[2]);
    assert.equal(value.before(new Date(expected[2]), false)?.toISOString(), expected[1]);
  }
  assert.deepEqual(RRule.parseString(rule.toString()).byhour, [10, 9, 9]);
  assert.deepEqual(RRule.parseString(rule.toString()).byminute, [30, 0, 0]);
  assert.deepEqual(byhour, [10, 9, 9]);
  assert.deepEqual(byminute, [30, 0, 0]);
});
