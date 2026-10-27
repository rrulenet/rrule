import test from 'node:test';
import assert from 'node:assert/strict';
import { rrulestr } from '../dist/index.js';

test('classic facade preserves yearly positions and repeated days through RFC and set queries', () => {
  for (const [text, expected] of [
    ['FREQ=YEARLY;BYMONTH=1,2;BYMONTHDAY=1;BYSETPOS=1;COUNT=2', ['2026-01-01T09:00:00.000Z', '2027-01-01T09:00:00.000Z']],
    ['FREQ=WEEKLY;BYDAY=MO,MO,TU;BYSETPOS=2;COUNT=2', ['2026-01-06T09:00:00.000Z', '2026-01-13T09:00:00.000Z']],
  ]) {
    const rule = rrulestr(`DTSTART:20260101T090000Z\nRRULE:${text}`);
    for (const restored of [rule, rrulestr(rule.toString()), rrulestr(rule.toString(), { forceset: true })]) {
      assert.deepEqual(restored.all().map(date => date.toISOString()), expected);
      assert.equal(restored.after(new Date(expected[0]), false)?.toISOString(), expected[1]);
    }
  }
  for (const token of ['9,,10', '0xA', '1e1']) {
    assert.throws(() => rrulestr(`DTSTART:20260101T090000Z\nRRULE:FREQ=DAILY;BYHOUR=${token}`), RangeError);
  }
});

test('classic facade distinguishes impossible clock phases and exhausted calendar search', () => {
  const empty = rrulestr('DTSTART:20260708T082755Z\nRRULE:FREQ=MINUTELY;INTERVAL=10;BYMINUTE=0,10,20,30,40,50');
  assert.equal(empty.after(new Date('2026-07-08T08:27:55Z'), false), null);
  const unresolved = rrulestr('DTSTART:20260101T090000Z\nRRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30;COUNT=1');
  assert.throws(() => unresolved.all(), error => error.code === 'RECURRENCE_SEARCH_LIMIT');
});
