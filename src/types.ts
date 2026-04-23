import type { Weekday, WeekdayStr } from './weekday.js';

export interface QueryMethods {
  all(iterator?: (date: Date, index: number) => boolean): Date[];
  between(after: Date, before: Date, inc?: boolean, iterator?: (date: Date, index: number) => boolean): Date[];
  before(date: Date, inc?: boolean): Date | null;
  after(date: Date, inc?: boolean): Date | null;
}

export enum Frequency {
  YEARLY = 0,
  MONTHLY = 1,
  WEEKLY = 2,
  DAILY = 3,
  HOURLY = 4,
  MINUTELY = 5,
  SECONDLY = 6,
}

export type ByWeekday = WeekdayStr | number | Weekday;
export type ByMonth = number | string;
export type Skip = 'OMIT' | 'BACKWARD' | 'FORWARD';

export interface Options {
  freq: Frequency;
  dtstart: Date | null;
  interval: number;
  wkst: Weekday | number | null;
  count: number | null;
  until: Date | null;
  tzid: string | null;
  bysetpos: number | number[] | null;
  bymonth: ByMonth | ByMonth[] | null;
  bymonthday: number | number[] | null;
  bynmonthday: number[] | null;
  byyearday: number | number[] | null;
  byweekno: number | number[] | null;
  byweekday: ByWeekday | ByWeekday[] | null;
  bynweekday: number[][] | null;
  byhour: number | number[] | null;
  byminute: number | number[] | null;
  bysecond: number | number[] | null;
  byeaster: number | null;
  rscale: string | null;
  skip: Skip | null;
}
