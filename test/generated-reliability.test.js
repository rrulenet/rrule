import test from 'node:test';
import assert from 'node:assert/strict';
import { RRule, RRuleSet, rrulestr } from '../dist/index.js';

test('generated classic set mutations invalidate cached results and preserve RFC membership', () => {
  const start = Date.parse('2026-01-01T09:00:00Z'), day = 86400000;
  let state = 0x55457529;
  const random = max => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return (state >>> 8) % max; };
  for (const noCache of [false, true]) {
    for (let index = 0; index < 32; index++) {
      const set = new RRuleSet(noCache);
      set.rrule(new RRule({ freq: RRule.DAILY, dtstart: new Date(start), count: 4 }));
      const included = new Set([0, 1, 2, 3].map(value => start + value * day));
      const excluded = new Set();
      for (let mutation = 0; mutation < 8; mutation++) {
        set.all();
        const time = start + random(8) * day;
        if (random(2)) { set.rdate(new Date(time)); included.add(time); }
        else { set.exdate(new Date(time)); excluded.add(time); }
        const expected = [...included].filter(value => !excluded.has(value)).sort((a, b) => a - b);
        assert.deepEqual(set.all().map(date => +date), expected, `case=${index}; mutation=${mutation}; noCache=${noCache}`);
        assert.deepEqual(rrulestr(set.toString()).all().map(date => +date), expected);
      }
    }
  }
});
