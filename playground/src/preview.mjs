import { RRuleSet, rrulestr } from '@rrulenet/rrule';
import { Temporal } from 'temporal-polyfill';
import { maximumInput, previewSizes, unfold } from './model.mjs';

function boundary(value, zone) {
  if (!value) throw new Error('Choose a query date and time.');
  const instant = Temporal.PlainDateTime.from(value).toZonedDateTime(zone).toInstant();
  return new Date(instant.epochMilliseconds);
}

function serializeOccurrence(date, zone, allDay) {
  const local = Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO(zone);
  return {
    day: local.toPlainDate().toString(),
    time: allDay ? null : local.toPlainTime().toString({ smallestUnit: 'second' }),
    offset: allDay ? null : local.offset,
    utc: date.toISOString(),
  };
}

export function getPreview({ text, limit, locale = 'en', display = 'rule', browserZone = 'UTC', query = null }) {
  if (typeof text !== 'string' || text.length > maximumInput) throw new Error('The rule is too long to preview.');
  if (!Number.isInteger(limit) || limit < 1 || limit > previewSizes.at(-1)) throw new Error('Choose a supported preview size.');
  const rule = rrulestr(text);
  const ruleOptions = rule instanceof RRuleSet ? rule.rrules().map(entry => entry.origOptions) : [rule.origOptions];
  const ruleZone = (rule instanceof RRuleSet ? rule.tzid() : rule.origOptions.tzid) || 'UTC';
  const dateProperties = unfold(text).filter(line => /^(?:DTSTART|RDATE)[;:]/i.test(line));
  const allDay = (ruleOptions.length ? ruleOptions.every(option => option.dtstartDate) : dateProperties.length > 0) &&
    !dateProperties.some(line => /[:,]\s*\d{8}T\d{6}/i.test(line));
  const zone = display === 'utc' ? 'UTC' : display === 'browser' ? browserZone : ruleZone;
  const stop = (_, index) => index <= limit;
  let dates;
  if (!query) dates = rule.all(stop);
  else {
    const start = boundary(query.start, zone);
    const end = query.operation === 'between' ? boundary(query.end, zone) : null;
    if (end && end < start) throw new Error('The query end must be on or after its start.');
    if (end) dates = rule.between(start, end, query.inclusive, stop);
    else {
      const value = query.operation === 'before' ? rule.before(start, query.inclusive) : rule.after(start, query.inclusive);
      dates = value ? [value] : [];
    }
  }
  let description = '';
  let exactDescription = false;
  try {
    description = rule.toText({ locale });
    exactDescription = rule.isFullyConvertibleToText({ locale });
  } catch { /* Some rule shapes cannot be described in natural language. */ }
  return {
    description,
    exactDescription,
    ruleZone,
    zone,
    allDay,
    occurrences: dates.slice(0, limit).map(date => serializeOccurrence(date, allDay ? ruleZone : zone, allDay)),
    hasMore: dates.length > limit,
  };
}
