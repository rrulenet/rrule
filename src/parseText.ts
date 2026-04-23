import { EN_LOCALE } from '@rrulenet/core/text';

import { Frequency, type ByWeekday, type Options } from './types.js';
import { Weekday } from './weekday.js';

const WEEKDAY_LOOKUP = new Map(
  EN_LOCALE.weekdayNames.map((name, index) => [name.toLowerCase(), new Weekday(index)]),
);
const MONTH_LOOKUP = new Map(
  EN_LOCALE.monthNames.map((name, index) => [name.toLowerCase(), index + 1]),
);

const UNIT_FREQUENCIES = new Map<string, Frequency>([
  ['day', Frequency.DAILY],
  ['days', Frequency.DAILY],
  ['week', Frequency.WEEKLY],
  ['weeks', Frequency.WEEKLY],
  ['month', Frequency.MONTHLY],
  ['months', Frequency.MONTHLY],
  ['year', Frequency.YEARLY],
  ['years', Frequency.YEARLY],
  ['hour', Frequency.HOURLY],
  ['hours', Frequency.HOURLY],
  ['minute', Frequency.MINUTELY],
  ['minutes', Frequency.MINUTELY],
  ['second', Frequency.SECONDLY],
  ['seconds', Frequency.SECONDLY],
]);

const LONG_DATE_PATTERN = '[a-z]+ \\d{1,2}, \\d{4}';
const ISO_DATE_PATTERN = '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z';
const UNTIL_PATTERN = `until (${LONG_DATE_PATTERN}|${ISO_DATE_PATTERN})`;
const DTSTART_PATTERN = `starting from (${LONG_DATE_PATTERN})`;

function parseCount(text: string): number | null {
  const match = text.match(/\bfor (\d+) times?\b/i);
  return match ? Number(match[1]) : null;
}

function parseUntil(text: string): Date | null {
  const match = text.match(new RegExp(`\\b${UNTIL_PATTERN}\\b`, 'i'));
  if (!match) return null;
  const raw = match[1]!.trim();
  const value = /^\d{4}-\d{2}-\d{2}T/i.test(raw)
    ? new Date(raw)
    : new Date(`${raw} UTC`);
  if (Number.isNaN(value.getTime())) {
    throw new Error(`Unsupported until date in text: ${raw}`);
  }
  return value;
}

function parseDtstart(text: string): Date | null {
  const match = text.match(new RegExp(`\\b${DTSTART_PATTERN}\\b`, 'i'));
  if (!match) return null;
  const value = new Date(`${match[1]} UTC`);
  if (Number.isNaN(value.getTime())) {
    throw new Error(`Unsupported DTSTART date in text: ${match[1]}`);
  }
  return value;
}

function parseTimeValue(value: string): { hour: number; minute: number; second: number } {
  const trimmed = value.trim();
  const meridiemMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(AM|PM)$/i);
  if (meridiemMatch) {
    const rawHour = Number(meridiemMatch[1]);
    const minute = Number(meridiemMatch[2] ?? '0');
    const second = Number(meridiemMatch[3] ?? '0');
    const meridiem = meridiemMatch[4]!.toUpperCase();
    const normalizedHour = rawHour % 12 + (meridiem === 'PM' ? 12 : 0);

    return { hour: normalizedHour, minute, second };
  }

  const numericMatch = trimmed.match(/^(\d{1,2})$/);
  if (numericMatch) {
    const hour = Number(numericMatch[1]);
    if (hour >= 0 && hour <= 23) {
      return { hour, minute: 0, second: 0 };
    }
  }

  throw new Error(`Unsupported time in text: ${value}`);
}

function parseTimeClause(text: string): Pick<Options, 'byhour' | 'byminute' | 'bysecond' | 'tzid'> {
  const match = text.match(new RegExp(`\\bat ([^]+?)(?=\\s+(?:for \\d+ times?|${UNTIL_PATTERN}|${DTSTART_PATTERN})\\b|$)`, 'i'));
  if (!match) {
    return { byhour: null, byminute: null, bysecond: null, tzid: null };
  }

  let clause = match[1]!.trim();
  let tzid: string | null = null;
  if (/\bUTC$/i.test(clause)) {
    tzid = 'UTC';
    clause = clause.replace(/\bUTC$/i, '').trim();
  }

  const parts = clause
    .split(/,\s*|\s+and\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  const times = parts.map(parseTimeValue);
  return {
    byhour: [...new Set(times.map((time) => time.hour))],
    byminute: [...new Set(times.map((time) => time.minute))],
    bysecond: [...new Set(times.map((time) => time.second))],
    tzid,
  };
}

function parseWeekdayList(text: string): ByWeekday[] | null {
  const normalized = text.replace(/\bevery weekday\b/i, '').trim();
  if (!normalized) {
    return [RRuleWeekdays.MO, RRuleWeekdays.TU, RRuleWeekdays.WE, RRuleWeekdays.TH, RRuleWeekdays.FR];
  }

  const match = text.match(new RegExp(`\\bon ([a-z,\\sand]+?)(?=\\s+(?:at |for \\d+ times?|${UNTIL_PATTERN}|${DTSTART_PATTERN})\\b|$)`, 'i'));
  if (!match) return null;

  const values = extractWeekdays(match[1]!);

  return values.length ? values : null;
}

function extractWeekdays(text: string): Weekday[] {
  const values: Weekday[] = [];
  const pattern = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi;
  for (const match of text.matchAll(pattern)) {
    const value = WEEKDAY_LOOKUP.get(match[1]!.toLowerCase());
    if (value) values.push(value);
  }
  return values;
}

function parseOrdinal(text: string): number | null {
  const match = text.match(/^(\d+)(?:st|nd|rd|th)$/i);
  return match ? Number(match[1]) : null;
}

type ParsedEveryClause = {
  freq: Frequency;
  interval?: number;
  byweekday: ByWeekday[] | null;
  bymonthday: number[] | null;
  bymonth: number[] | null;
};

function extractMonths(text: string): number[] {
  const values: number[] = [];
  const pattern = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi;
  for (const match of text.matchAll(pattern)) {
    const value = MONTH_LOOKUP.get(match[1]!.toLowerCase());
    if (value) values.push(value);
  }
  return values;
}

function parseLeadingMonthList(text: string): ParsedEveryClause | null {
  const match = text.match(new RegExp(`^every ([a-z,\\sand]+?)(?=\\s+(?:on |for \\d+ times?|${UNTIL_PATTERN}|${DTSTART_PATTERN})\\b|$)`, 'i'));
  if (!match) return null;
  const months = extractMonths(match[1]!);
  if (!months.length) return null;
  const suffix = text.slice(match[0].length).trim();
  const positionedSuffix = suffix ? parseMonthlyOrYearlyPosition(`every year ${suffix}`) : null;
  const weekdaySuffix = suffix ? parseWeekdayList(`every year ${suffix}`) : null;
  return {
    freq: Frequency.YEARLY,
    byweekday: positionedSuffix?.byweekday ?? weekdaySuffix,
    bymonthday: positionedSuffix?.bymonthday ?? null,
    bymonth: months,
  };
}

function parseMonthlyOrYearlyPosition(text: string): ParsedEveryClause | null {
  const match = text.match(/^every (month|year) on the ([a-z0-9]+)(?: (last))?(?: (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))?\b/i);
  if (!match) return null;

  const unit = match[1]!.toLowerCase();
  const ordinalText = match[2]!;
  const trailingLast = Boolean(match[3]);
  const weekdayName = match[4];
  const ordinal = ordinalText.toLowerCase() === 'last' ? 1 : parseOrdinal(ordinalText);
  if (ordinal === null) return null;
  const sign = trailingLast || ordinalText.toLowerCase() === 'last' ? -1 : 1;

  if (weekdayName) {
    const weekday = WEEKDAY_LOOKUP.get(weekdayName.toLowerCase());
    if (!weekday) return null;
    return {
      freq: unit === 'year' ? Frequency.YEARLY : Frequency.MONTHLY,
      byweekday: [weekday.nth(sign * ordinal)],
      bymonthday: null,
      bymonth: null,
    };
  }

  return {
    freq: Frequency.MONTHLY,
    byweekday: null,
    bymonthday: [sign * ordinal],
    bymonth: null,
  };
}

function parseEveryClause(text: string): ParsedEveryClause {
  const trimmed = text.trim();
  if (/^every weekday\b/i.test(trimmed)) {
    return {
      freq: Frequency.WEEKLY,
      byweekday: [RRuleWeekdays.MO, RRuleWeekdays.TU, RRuleWeekdays.WE, RRuleWeekdays.TH, RRuleWeekdays.FR],
      bymonthday: null,
      bymonth: null,
    };
  }

  const leadingMonths = parseLeadingMonthList(trimmed);
  if (leadingMonths) return leadingMonths;

  const positioned = parseMonthlyOrYearlyPosition(trimmed);
  if (positioned) return positioned;

  const weekdayList = trimmed.match(new RegExp(`^every ([a-z,\\sand]+?)(?=\\s+(?:at |for \\d+ times?|${UNTIL_PATTERN}|${DTSTART_PATTERN})\\b|$)`, 'i'));
  if (weekdayList) {
    const values = extractWeekdays(weekdayList[1]!);
    if (values.length) {
      return {
        freq: Frequency.WEEKLY,
        byweekday: values,
        bymonthday: null,
        bymonth: null,
      };
    }
  }

  const match = trimmed.match(/^every(?: (\d+))? ([a-z]+)\b/i);
  if (!match) throw new Error(`Unsupported text rule: ${text}`);

  const unit = match[2]!.toLowerCase();
  const freq = UNIT_FREQUENCIES.get(unit);
  if (freq === undefined) throw new Error(`Unsupported recurrence unit in text: ${unit}`);
  const explicitInterval = match[1] ? Number(match[1]) : null;

  return {
    freq,
    interval: explicitInterval ?? undefined,
    byweekday: parseWeekdayList(trimmed),
    bymonthday: null,
    bymonth: null,
  };
}

const RRuleWeekdays = {
  MO: new Weekday(0),
  TU: new Weekday(1),
  WE: new Weekday(2),
  TH: new Weekday(3),
  FR: new Weekday(4),
};

export function parseText(text: string, language?: unknown): Partial<Options> {
  if (language && language !== 'en' && language !== 'en-US') {
    throw new Error('parseText currently supports English only');
  }

  const normalized = text.trim().replace(/\s+/g, ' ');
  const every = parseEveryClause(normalized);
  const count = parseCount(normalized);
  const until = parseUntil(normalized);
  const dtstart = parseDtstart(normalized);
  const time = parseTimeClause(normalized);

  return {
    freq: every.freq,
    interval: every.interval,
    bymonth: every.bymonth ?? null,
    byweekday: every.byweekday ?? null,
    bymonthday: every.bymonthday ?? null,
    count,
    until,
    dtstart,
    byhour: time.byhour,
    byminute: time.byminute,
    bysecond: time.bysecond,
    tzid: time.tzid,
  };
}
