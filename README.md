<p align="center">
  <a href="https://rrule.net">
    <img src="./assets/avatar.svg" alt="rrule.net" width="96" height="96">
  </a>
</p>

<h1 align="center">@rrulenet/rrule</h1>

<p align="center">
  Classic <code>rrule.js</code>-style recurrence API, backed by a maintained engine built for production scheduling.
</p>

<p align="center">
  <a href="https://rrule.net">rrule.net</a> •
  <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal">Temporal API</a> •
  <strong>@rrulenet ecosystem</strong>
</p>

<p align="center">
  <code>@rrulenet/rrule</code> ·
  <code>@rrulenet/recurrence</code> ·
  <code>@rrulenet/core</code> ·
  <code>@rrulenet/cli</code>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rrulenet/rrule"><img src="https://img.shields.io/npm/v/%40rrulenet%2Frrule" alt="npm version"></a>
  <a href="https://rrulenet.github.io/rrule/coverage.json"><img src="https://img.shields.io/endpoint?url=https://rrulenet.github.io/rrule/coverage.json" alt="Coverage"></a>
  <img src="https://img.shields.io/badge/license-MIT-2563EB" alt="MIT License">
</p>

<p align="center">
  <sub><strong>@rrulenet/rrule</strong>: classic API · <strong>@rrulenet/recurrence</strong>: Temporal-first API · <strong>@rrulenet/core</strong>: engine · <strong>@rrulenet/cli</strong>: workflows</sub>
</p>

`@rrulenet/rrule` provides the classic `rrule.js`-style API in the ecosystem. It is designed for compatibility-focused applications that want familiar classes, stable recurrence behavior, timezone-aware queries, set composition, and text rendering.

Use `@rrulenet/rrule` when you want the familiar class-based compat surface. Use `@rrulenet/recurrence` when your application boundary is already built around the Temporal API and a single `Recurrence` type.

## Table of Contents

- [Install](#install)
- [Why RRule](#why-rrule)
- [API](#api)
- [Getting Started](#getting-started)
- [Examples](#examples)
  - [RRule](#rrule)
  - [RRuleSet](#rruleset)
  - [SetAlgebra](#setalgebra)
  - [rrulestr()](#rrulestr)
- [Notes](#notes)
- [Development](#development)

## Install

```bash
npm install @rrulenet/rrule
```

## Why RRule

`@rrulenet/rrule` exists for applications that want the classic recurrence model:
- `RRule` for one rule
- `RRuleSet` for composed include/exclude schedules
- `rrulestr()` for parsing and round-tripping RFC-style strings
- `Date` values at the API boundary

That makes it a good fit for:
- migrations from `rrule.js`
- existing codebases built around `Date`
- applications that want a familiar class-based API without moving their boundary to `Temporal`

See also:
- [Comparisons](./docs/COMPARISONS.md)

## API

```js
import {
  RRule,
  RRuleSet,
  SetAlgebra,
  rrulestr,
  Frequency,
  Weekday,
  ALL_WEEKDAYS,
  datetime,
  getToTextLocale,
  listToTextLocales,
  registerToTextLocale,
} from '@rrulenet/rrule';
```

Main exports:
- `RRule`
- `RRuleSet`
- `SetAlgebra`
- `rrulestr`
- `Frequency`
- `Weekday`
- `ALL_WEEKDAYS`
- `datetime`
- `getToTextLocale`
- `listToTextLocales`
- `registerToTextLocale`

Recommended usage:
- choose `@rrulenet/rrule` when you want the familiar class-based compat surface
- choose `@rrulenet/recurrence` when your app boundary is built around the Temporal API
- avoid importing from `@rrulenet/core` directly in application code

## Getting Started

```js
import { RRule, Frequency, datetime } from '@rrulenet/rrule';

const rule = new RRule({
  freq: Frequency.WEEKLY,
  count: 4,
  byweekday: [RRule.MO, RRule.WE],
  dtstart: datetime(2026, 4, 13, 9, 0, 0),
});

console.log(rule.all().map((value) => value.toISOString()));
// [
//   '2026-04-13T09:00:00.000Z',
//   '2026-04-15T09:00:00.000Z',
//   '2026-04-20T09:00:00.000Z',
//   '2026-04-22T09:00:00.000Z'
// ]
```

## Examples

### `RRule`

```js
import { RRule, Frequency, datetime } from '@rrulenet/rrule';

const rule = new RRule({
  freq: Frequency.MONTHLY,
  bymonthday: [1, 15],
  count: 4,
  dtstart: datetime(2026, 1, 1, 9, 0, 0),
});

console.log(rule.toString());
// DTSTART:20260101T090000Z
// RRULE:FREQ=MONTHLY;COUNT=4;BYMONTHDAY=1,15

console.log(rule.toText());
// every month on the 1st and 15th day of the month at 9 AM UTC for 4 times
```

### `RRuleSet`

```js
import { RRule, RRuleSet, Frequency, datetime } from '@rrulenet/rrule';

const set = new RRuleSet();
set.tzid('UTC');
set.rrule(new RRule({
  freq: Frequency.DAILY,
  count: 4,
  dtstart: datetime(2026, 4, 11, 9, 0, 0),
}));
set.exdate(new Date('2026-04-12T09:00:00.000Z'));
set.rdate(new Date('2026-04-20T09:00:00.000Z'));

console.log(set.all().map((value) => value.toISOString()));
// [
//   '2026-04-11T09:00:00.000Z',
//   '2026-04-13T09:00:00.000Z',
//   '2026-04-14T09:00:00.000Z',
//   '2026-04-20T09:00:00.000Z'
// ]

console.log(set.toString());
// DTSTART:20260411T090000Z
// RRULE:FREQ=DAILY;COUNT=4
// RDATE:20260420T090000Z
// EXDATE:20260412T090000Z
```

### `SetAlgebra`

```js
import { RRule, SetAlgebra, Frequency, datetime } from '@rrulenet/rrule';

const expression = SetAlgebra.union(
  new RRule({
    freq: Frequency.WEEKLY,
    count: 3,
    byweekday: [RRule.MO],
    dtstart: datetime(2026, 4, 13, 9, 0, 0),
  }),
  new RRule({
    freq: Frequency.WEEKLY,
    count: 3,
    byweekday: [RRule.WE],
    dtstart: datetime(2026, 4, 15, 9, 0, 0),
  }),
);

console.log(expression.all().map((value) => value.toISOString()));
// [
//   '2026-04-13T09:00:00.000Z',
//   '2026-04-15T09:00:00.000Z',
//   '2026-04-20T09:00:00.000Z',
//   '2026-04-22T09:00:00.000Z',
//   '2026-04-27T09:00:00.000Z',
//   '2026-04-29T09:00:00.000Z'
// ]
```

### `rrulestr()`

```js
import { RRuleSet, rrulestr } from '@rrulenet/rrule';

const parsed = rrulestr([
  'DTSTART;TZID=UTC:20260411T090000',
  'RRULE:FREQ=DAILY;COUNT=2',
  'RDATE:20260415T090000Z',
  'EXDATE:20260412T090000Z',
].join('\n'));

console.log(parsed instanceof RRuleSet);
// true

console.log(parsed.toString());
// DTSTART:20260411T090000Z
// RRULE:FREQ=DAILY;COUNT=2
// RDATE:20260415T090000Z
// EXDATE:20260412T090000Z
```

## Notes

- `RSCALE` and `SKIP` are part of the compat rule model.
- `toText()` and locale registry helpers are available here.
- The same engine also powers the Temporal-first API exposed by `@rrulenet/recurrence`.

## Development

```bash
npm install
npm test
```
