import { RRule } from './RRule.js';
import { RRuleSet } from './RRuleSet.js';
import { groomRuleOptions, parseRRuleStringComponents, type RRuleStrOptions } from '@rrulenet/core';

export type { RRuleStrOptions } from '@rrulenet/core';

export function rrulestr(input: string, rawOptions: Partial<RRuleStrOptions> = {}): RRule | RRuleSet {
  const {
    noCache,
    sawInlineDtstart,
    dtstart,
    tzid,
    rruleValues,
    exruleValues,
    rdateValues,
    exdateValues,
    rawOptions: options,
  } = parseRRuleStringComponents(input, rawOptions);

  const hasSet =
    options.forceset ||
    rruleValues.length > 1 ||
    exruleValues.length > 0 ||
    rdateValues.length > 0 ||
    exdateValues.length > 0;

  if (!rruleValues.length && !exruleValues.length && !rdateValues.length && !exdateValues.length) {
    const set = new RRuleSet(noCache);
    if (tzid) set.tzid(tzid);
    if (dtstart) {
      set.dtstart(dtstart);
      set.rdate(dtstart);
    }
    return set;
  }

  if (!hasSet) {
    const value = rruleValues[0] ?? {};
    return new RRule(
      groomRuleOptions(
        value,
        dtstart,
        tzid,
        options.count,
        options.until,
        Boolean(options.dtstart && !options.tzid && tzid && !sawInlineDtstart),
      ),
      noCache,
    );
  }

  const set = new RRuleSet(noCache);
  if (tzid) set.tzid(tzid);
  if (dtstart) set.dtstart(dtstart);

  for (const value of rruleValues) {
    set.rrule(
      new RRule(
        groomRuleOptions(
          value,
          dtstart,
          tzid,
          options.count,
          options.until,
          Boolean(options.dtstart && !options.tzid && tzid && !sawInlineDtstart),
        ),
        noCache,
      ),
    );
  }

  for (const value of exruleValues) {
    set.exrule(
      new RRule(
        groomRuleOptions(
          value,
          dtstart,
          tzid,
          options.count,
          options.until,
          Boolean(options.dtstart && !options.tzid && tzid && !sawInlineDtstart),
        ),
        noCache,
      ),
    );
  }

  for (const value of rdateValues) {
    set.rdate(value);
  }

  for (const value of exdateValues) {
    set.exdate(value);
  }

  if (options.compatible && dtstart) {
    set.rdate(dtstart);
  }

  return set;
}
