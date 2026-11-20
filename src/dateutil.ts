import { zdtToDate } from '@rrulenet/core/time';
import type { Temporal } from 'temporal-polyfill';

export function datetime(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date;
}

export function cloneDate(date: Date): Date {
  return new Date(date.getTime());
}

export function isValidDate(date: Date): boolean {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

export function collectDateOccurrences(
  values: Iterable<Temporal.ZonedDateTime>,
  callback: (value: Date, index: number) => boolean,
): Date[] {
  const accepted: Date[] = [];
  for (const value of values) {
    const date = zdtToDate(value);
    if (!callback(date, accepted.length)) break;
    accepted.push(date);
  }
  return accepted;
}
