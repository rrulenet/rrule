import { performance } from 'node:perf_hooks';
import process from 'node:process';

import { RRule, RRuleSet, rrulestr } from '../dist/index.js';

const WARMUP_RUNS = 10;
const COLD_RUNS = 80;
const WARM_RUNS = 400;

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMs(value) {
  return value.toFixed(4);
}

function measureCold(setUp, execute, runs) {
  const samples = [];
  let lastCount = 0;
  for (let i = 0; i < runs; i += 1) {
    const state = setUp();
    const start = performance.now();
    const result = execute(state);
    const end = performance.now();
    samples.push(end - start);
    lastCount = result.length;
  }
  return { meanMs: mean(samples), count: lastCount };
}

function measureWarm(setUp, execute, warmupRuns, runs) {
  const state = setUp();
  let lastCount = 0;
  for (let i = 0; i < warmupRuns; i += 1) {
    lastCount = execute(state).length;
  }
  const samples = [];
  for (let i = 0; i < runs; i += 1) {
    const start = performance.now();
    const result = execute(state);
    const end = performance.now();
    samples.push(end - start);
    lastCount = result.length;
  }
  return { meanMs: mean(samples), count: lastCount };
}

function measureSetupOnly(setUp, runs) {
  const samples = [];
  let lastCount = 0;
  for (let i = 0; i < runs; i += 1) {
    const start = performance.now();
    const state = setUp();
    const end = performance.now();
    samples.push(end - start);
    lastCount = state.resultCount ?? 0;
  }
  return { meanMs: mean(samples), count: lastCount };
}

function measureQueryOnly(setUp, execute, runs) {
  const samples = [];
  let lastCount = 0;
  for (let i = 0; i < runs; i += 1) {
    const state = setUp();
    const start = performance.now();
    const result = execute(state);
    const end = performance.now();
    samples.push(end - start);
    lastCount = result.length;
  }
  return { meanMs: mean(samples), count: lastCount };
}

const scenarios = [
  {
    name: 'rrule_between_tzid_setup_only',
    kind: 'cold-setup',
    cache: 'n/a',
    tzid: 'yes',
    description: '#580 shape: parse/setup only with TZID',
    runs: COLD_RUNS,
    measure: () => measureSetupOnly(
      () => {
        const rule = rrulestr('DTSTART;TZID=Europe/Brussels:20210324T110000\nRRULE:INTERVAL=1;FREQ=WEEKLY;BYDAY=WE,TH');
        return { rule, resultCount: 104 };
      },
      COLD_RUNS,
    ),
  },
  {
    name: 'rrule_between_tzid_query_only',
    kind: 'cold-query',
    cache: 'n/a',
    tzid: 'yes',
    description: '#580 shape: query only on fresh TZID rule',
    runs: COLD_RUNS,
    measure: () => measureQueryOnly(
      () => ({
        rule: rrulestr('DTSTART;TZID=Europe/Brussels:20210324T110000\nRRULE:INTERVAL=1;FREQ=WEEKLY;BYDAY=WE,TH'),
        after: new Date('2022-04-04T10:00:00.000Z'),
        before: new Date('2023-04-04T11:00:00.000Z'),
      }),
      ({ rule, after, before }) => rule.between(after, before, true),
      COLD_RUNS,
    ),
  },
  {
    name: 'rrule_between_tzid_cold',
    kind: 'cold',
    cache: 'n/a',
    tzid: 'yes',
    description: '#580 shape: weekly between() with TZID',
    runs: COLD_RUNS,
    measure: () => measureCold(
      () => ({
        rule: rrulestr('DTSTART;TZID=Europe/Brussels:20210324T110000\nRRULE:INTERVAL=1;FREQ=WEEKLY;BYDAY=WE,TH'),
        after: new Date('2022-04-04T10:00:00.000Z'),
        before: new Date('2023-04-04T11:00:00.000Z'),
      }),
      ({ rule, after, before }) => rule.between(after, before, true),
      COLD_RUNS,
    ),
  },
  {
    name: 'rrule_between_tzid_warm',
    kind: 'warm',
    cache: 'implicit-query',
    tzid: 'yes',
    description: '#580 shape: repeated weekly between() with TZID',
    runs: WARM_RUNS,
    measure: () => measureWarm(
      () => ({
        rule: rrulestr('DTSTART;TZID=Europe/Brussels:20210324T110000\nRRULE:INTERVAL=1;FREQ=WEEKLY;BYDAY=WE,TH'),
        after: new Date('2022-04-04T10:00:00.000Z'),
        before: new Date('2023-04-04T11:00:00.000Z'),
      }),
      ({ rule, after, before }) => rule.between(after, before, true),
      WARMUP_RUNS,
      WARM_RUNS,
    ),
  },
  {
    name: 'rrule_between_no_tzid_setup_only',
    kind: 'cold-setup',
    cache: 'n/a',
    tzid: 'no',
    description: 'control: parse/setup only without TZID',
    runs: COLD_RUNS,
    measure: () => measureSetupOnly(
      () => {
        const rule = rrulestr('DTSTART:20210324T100000Z\nRRULE:INTERVAL=1;FREQ=WEEKLY;BYDAY=WE,TH');
        return { rule, resultCount: 104 };
      },
      COLD_RUNS,
    ),
  },
  {
    name: 'rrule_between_no_tzid_query_only',
    kind: 'cold-query',
    cache: 'n/a',
    tzid: 'no',
    description: 'control: query only on fresh non-TZID rule',
    runs: COLD_RUNS,
    measure: () => measureQueryOnly(
      () => ({
        rule: rrulestr('DTSTART:20210324T100000Z\nRRULE:INTERVAL=1;FREQ=WEEKLY;BYDAY=WE,TH'),
        after: new Date('2022-04-04T10:00:00.000Z'),
        before: new Date('2023-04-04T11:00:00.000Z'),
      }),
      ({ rule, after, before }) => rule.between(after, before, true),
      COLD_RUNS,
    ),
  },
  {
    name: 'rrule_between_no_tzid_cold',
    kind: 'cold',
    cache: 'n/a',
    tzid: 'no',
    description: 'control: same weekly between() shape without TZID',
    runs: COLD_RUNS,
    measure: () => measureCold(
      () => ({
        rule: rrulestr('DTSTART:20210324T100000Z\nRRULE:INTERVAL=1;FREQ=WEEKLY;BYDAY=WE,TH'),
        after: new Date('2022-04-04T10:00:00.000Z'),
        before: new Date('2023-04-04T11:00:00.000Z'),
      }),
      ({ rule, after, before }) => rule.between(after, before, true),
      COLD_RUNS,
    ),
  },
  {
    name: 'rrule_between_no_tzid_warm',
    kind: 'warm',
    cache: 'implicit-query',
    tzid: 'no',
    description: 'control: repeated weekly between() shape without TZID',
    runs: WARM_RUNS,
    measure: () => measureWarm(
      () => ({
        rule: rrulestr('DTSTART:20210324T100000Z\nRRULE:INTERVAL=1;FREQ=WEEKLY;BYDAY=WE,TH'),
        after: new Date('2022-04-04T10:00:00.000Z'),
        before: new Date('2023-04-04T11:00:00.000Z'),
      }),
      ({ rule, after, before }) => rule.between(after, before, true),
      WARMUP_RUNS,
      WARM_RUNS,
    ),
  },
  {
    name: 'rrule_all_cache_warm',
    kind: 'warm',
    cache: 'yes',
    tzid: 'yes',
    description: 'repeated all() on cached timezone-aware weekly rule',
    runs: WARM_RUNS,
    measure: () => measureWarm(
      () => ({
        rule: new RRule({
          freq: RRule.WEEKLY,
          dtstart: new Date(Date.UTC(2025, 0, 1, 8, 0, 0)),
          tzid: 'Europe/Paris',
          byweekday: [RRule.MO, RRule.WE, RRule.FR],
          count: 260,
        }),
      }),
      ({ rule }) => rule.all(),
      WARMUP_RUNS,
      WARM_RUNS,
    ),
  },
  {
    name: 'rrule_all_nocache_warm',
    kind: 'warm',
    cache: 'no',
    tzid: 'yes',
    description: 'repeated all() on noCache timezone-aware weekly rule',
    runs: WARM_RUNS,
    measure: () => measureWarm(
      () => ({
        rule: new RRule({
          freq: RRule.WEEKLY,
          dtstart: new Date(Date.UTC(2025, 0, 1, 8, 0, 0)),
          tzid: 'Europe/Paris',
          byweekday: [RRule.MO, RRule.WE, RRule.FR],
          count: 260,
        }, true),
      }),
      ({ rule }) => rule.all(),
      WARMUP_RUNS,
      WARM_RUNS,
    ),
  },
  {
    name: 'rruleset_between_tzid_simple_setup_only',
    kind: 'cold-setup',
    cache: 'n/a',
    tzid: 'yes',
    description: 'timezone-aware monthly set without explicit exclusions: setup only',
    runs: COLD_RUNS,
    measure: () => measureSetupOnly(
      () => {
        const set = rrulestr([
          'DTSTART;TZID=Europe/Amsterdam:20260101T163000',
          'RRULE:FREQ=MONTHLY;INTERVAL=1',
        ].join('\n'), { forceset: true });
        return { set, resultCount: 12 };
      },
      COLD_RUNS,
    ),
  },
  {
    name: 'rruleset_between_tzid_simple_query_only',
    kind: 'cold-query',
    cache: 'n/a',
    tzid: 'yes',
    description: 'timezone-aware monthly set without explicit exclusions: query only',
    runs: COLD_RUNS,
    measure: () => measureQueryOnly(
      () => ({
        set: rrulestr([
          'DTSTART;TZID=Europe/Amsterdam:20260101T163000',
          'RRULE:FREQ=MONTHLY;INTERVAL=1',
        ].join('\n'), { forceset: true }),
        after: new Date('2026-01-01T00:00:00.000Z'),
        before: new Date('2027-01-01T00:00:00.000Z'),
      }),
      ({ set, after, before }) => set.between(after, before, true),
      COLD_RUNS,
    ),
  },
  {
    name: 'rruleset_between_tzid_simple_cold',
    kind: 'cold',
    cache: 'n/a',
    tzid: 'yes',
    description: 'timezone-aware monthly set without explicit exclusions',
    runs: COLD_RUNS,
    measure: () => measureCold(
      () => ({
        set: rrulestr([
          'DTSTART;TZID=Europe/Amsterdam:20260101T163000',
          'RRULE:FREQ=MONTHLY;INTERVAL=1',
        ].join('\n'), { forceset: true }),
        after: new Date('2026-01-01T00:00:00.000Z'),
        before: new Date('2027-01-01T00:00:00.000Z'),
      }),
      ({ set, after, before }) => set.between(after, before, true),
      COLD_RUNS,
    ),
  },
  {
    name: 'rruleset_between_tzid_simple_warm',
    kind: 'warm',
    cache: 'implicit-query',
    tzid: 'yes',
    description: 'repeated timezone-aware monthly set between() without explicit exclusions',
    runs: WARM_RUNS,
    measure: () => measureWarm(
      () => ({
        set: rrulestr([
          'DTSTART;TZID=Europe/Amsterdam:20260101T163000',
          'RRULE:FREQ=MONTHLY;INTERVAL=1',
        ].join('\n'), { forceset: true }),
        after: new Date('2026-01-01T00:00:00.000Z'),
        before: new Date('2027-01-01T00:00:00.000Z'),
      }),
      ({ set, after, before }) => set.between(after, before, true),
      WARMUP_RUNS,
      WARM_RUNS,
    ),
  },
  {
    name: 'rruleset_between_tzid_exclusion_setup_only',
    kind: 'cold-setup',
    cache: 'n/a',
    tzid: 'yes',
    description: 'timezone-aware monthly set with RDATE/EXDATE exclusion: setup only',
    runs: COLD_RUNS,
    measure: () => measureSetupOnly(
      () => {
        const set = rrulestr([
          'DTSTART;TZID=Europe/Amsterdam:20260101T163000',
          'RRULE:FREQ=MONTHLY;INTERVAL=1',
          'RDATE;TZID=Europe/Amsterdam:20260327T093000',
          'EXDATE;TZID=Europe/Amsterdam:20260401T163000',
        ].join('\n'), { forceset: true });
        return { set, resultCount: 12 };
      },
      COLD_RUNS,
    ),
  },
  {
    name: 'rruleset_between_tzid_exclusion_query_only',
    kind: 'cold-query',
    cache: 'n/a',
    tzid: 'yes',
    description: 'timezone-aware monthly set with RDATE/EXDATE exclusion: query only',
    runs: COLD_RUNS,
    measure: () => measureQueryOnly(
      () => ({
        set: rrulestr([
          'DTSTART;TZID=Europe/Amsterdam:20260101T163000',
          'RRULE:FREQ=MONTHLY;INTERVAL=1',
          'RDATE;TZID=Europe/Amsterdam:20260327T093000',
          'EXDATE;TZID=Europe/Amsterdam:20260401T163000',
        ].join('\n'), { forceset: true }),
        after: new Date('2026-01-01T00:00:00.000Z'),
        before: new Date('2027-01-01T00:00:00.000Z'),
      }),
      ({ set, after, before }) => set.between(after, before, true),
      COLD_RUNS,
    ),
  },
  {
    name: 'rruleset_between_tzid_exclusion_cold',
    kind: 'cold',
    cache: 'n/a',
    tzid: 'yes',
    description: 'timezone-aware monthly set with RDATE/EXDATE exclusion',
    runs: COLD_RUNS,
    measure: () => measureCold(
      () => ({
        set: rrulestr([
          'DTSTART;TZID=Europe/Amsterdam:20260101T163000',
          'RRULE:FREQ=MONTHLY;INTERVAL=1',
          'RDATE;TZID=Europe/Amsterdam:20260327T093000',
          'EXDATE;TZID=Europe/Amsterdam:20260401T163000',
        ].join('\n'), { forceset: true }),
        after: new Date('2026-01-01T00:00:00.000Z'),
        before: new Date('2027-01-01T00:00:00.000Z'),
      }),
      ({ set, after, before }) => set.between(after, before, true),
      COLD_RUNS,
    ),
  },
  {
    name: 'rruleset_between_tzid_exclusion_warm',
    kind: 'warm',
    cache: 'implicit-query',
    tzid: 'yes',
    description: 'repeated timezone-aware monthly set between() with exclusion',
    runs: WARM_RUNS,
    measure: () => measureWarm(
      () => ({
        set: rrulestr([
          'DTSTART;TZID=Europe/Amsterdam:20260101T163000',
          'RRULE:FREQ=MONTHLY;INTERVAL=1',
          'RDATE;TZID=Europe/Amsterdam:20260327T093000',
          'EXDATE;TZID=Europe/Amsterdam:20260401T163000',
        ].join('\n'), { forceset: true }),
        after: new Date('2026-01-01T00:00:00.000Z'),
        before: new Date('2027-01-01T00:00:00.000Z'),
      }),
      ({ set, after, before }) => set.between(after, before, true),
      WARMUP_RUNS,
      WARM_RUNS,
    ),
  },
  {
    name: 'rrule_between_open_monthly_far_future_cold',
    kind: 'cold',
    cache: 'n/a',
    tzid: 'yes',
    description: 'open-ended monthly between() far after dtstart in named timezone',
    runs: COLD_RUNS,
    measure: () => measureCold(
      () => ({
        rule: new RRule({
          freq: RRule.MONTHLY,
          interval: 3,
          dtstart: new Date(Date.UTC(2000, 0, 31, 8, 0, 0)),
          tzid: 'America/New_York',
        }),
        after: new Date('2040-01-01T00:00:00.000Z'),
        before: new Date('2041-01-01T00:00:00.000Z'),
      }),
      ({ rule, after, before }) => rule.between(after, before, true),
      COLD_RUNS,
    ),
  },
  {
    name: 'rrule_between_open_monthly_far_future_warm',
    kind: 'warm',
    cache: 'implicit-query',
    tzid: 'yes',
    description: 'repeated open-ended monthly between() far after dtstart in named timezone',
    runs: WARM_RUNS,
    measure: () => measureWarm(
      () => ({
        rule: new RRule({
          freq: RRule.MONTHLY,
          interval: 3,
          dtstart: new Date(Date.UTC(2000, 0, 31, 8, 0, 0)),
          tzid: 'America/New_York',
        }),
        after: new Date('2040-01-01T00:00:00.000Z'),
        before: new Date('2041-01-01T00:00:00.000Z'),
      }),
      ({ rule, after, before }) => rule.between(after, before, true),
      WARMUP_RUNS,
      WARM_RUNS,
    ),
  },
];

const results = scenarios.map((scenario) => {
  const measured = scenario.measure();
  return {
    scenario: scenario.name,
    description: scenario.description,
    kind: scenario.kind,
    cache: scenario.cache,
    tzid: scenario.tzid,
    runs: scenario.runs,
    meanMs: Number(formatMs(measured.meanMs)),
    resultCount: measured.count,
  };
});

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  warmupRuns: WARMUP_RUNS,
  coldRuns: COLD_RUNS,
  warmRuns: WARM_RUNS,
  results,
}, null, 2));
