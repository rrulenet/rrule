import test from 'node:test';
import assert from 'node:assert/strict';
import { datetime } from '../dist/index.js';

test('datetime uses the actual year for leap days, short years and field carry', () => {
  for (const year of [0, 4, 96, 400, 1600, 2000, 2016, 2024, 2400]) {
    assert.equal(datetime(year, 2, 29, 12, 34, 56).toISOString(), `${String(year).padStart(4, '0')}-02-29T12:34:56.000Z`);
  }
  for (const [input, expected] of [
    [[2024, 13, 1], '2025-01-01T00:00:00.000Z'],
    [[2024, 0, 1], '2023-12-01T00:00:00.000Z'],
    [[2024, 3, 0], '2024-02-29T00:00:00.000Z'],
    [[2024, 2, 29, 24], '2024-03-01T00:00:00.000Z'],
  ]) assert.equal(datetime(...input).toISOString(), expected);
});
