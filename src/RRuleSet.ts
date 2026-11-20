import { Temporal } from 'temporal-polyfill';

import { QueryMethodsSource } from '@rrulenet/core';
import { DateSource, SetEngine, type SetExpression } from '@rrulenet/core/engine';
import { dateToZdt, zdtToDate } from '@rrulenet/core/time';
import { formatRfcDate } from '@rrulenet/core/rule';
import { describeSetExpression, isSetExpressionFullyConvertible, type ToTextOptions } from '@rrulenet/core/text';

import { RRule } from './RRule.js';
import { cloneDate, collectDateOccurrences, isValidDate } from './dateutil.js';

export class RRuleSet extends RRule {
  public readonly _rrule: RRule[] = [];
  public readonly _rdate: Date[] = [];
  public readonly _exrule: RRule[] = [];
  public readonly _exdate: Date[] = [];

  private _dtstart?: Date | null;
  private dtstartDate?: string;
  private readonly dateTypes = {
    RDATE: new Map<number, Set<string | undefined>>(),
    EXDATE: new Map<number, Set<string | undefined>>(),
  };
  private _tzid?: string;
  private engine = new SetEngine({ kind: 'union', expressions: [] });
  private readonly setNoCache: boolean;
  private setAllCache: Date[] | null = null;

  constructor(_noCache = false) {
    super({}, _noCache);
    this.setNoCache = _noCache;
  }

  static fromExpression(
    expression: SetExpression,
    config: {
      noCache?: boolean;
      dtstart?: Date | null;
      tzid?: string;
      includeRules?: RRule[];
      excludeRules?: RRule[];
      rdates?: Date[];
      exdates?: Date[];
    } = {},
  ): RRuleSet {
    const set = new RRuleSet(config.noCache ?? false);
    if (config.dtstart !== undefined) set._dtstart = config.dtstart ? cloneDate(config.dtstart) : null;
    if (config.tzid !== undefined) set._tzid = config.tzid;
    for (const rule of config.includeRules ?? []) set._rrule.push(rule);
    for (const rule of config.excludeRules ?? []) set._exrule.push(rule);
    for (const date of config.rdates ?? []) set._rdate.push(cloneDate(date));
    for (const date of config.exdates ?? []) set._exdate.push(cloneDate(date));
    set._rdate.sort((a, b) => a.getTime() - b.getTime());
    set._exdate.sort((a, b) => a.getTime() - b.getTime());
    set.engine = new SetEngine(expression);
    set.setAllCache = null;
    return set;
  }

  dtstart(value?: Date | null, plainDate?: string) {
    if (value !== undefined) {
      this._dtstart = value ? cloneDate(value) : null;
      this.dtstartDate = plainDate;
    }
    if (this._dtstart !== undefined) return this._dtstart ? cloneDate(this._dtstart) : null;
    const fallback = this._rrule.find((rule) => rule.origOptions.dtstart)?.origOptions.dtstart;
    return fallback ? cloneDate(fallback) : null;
  }

  tzid(value?: string) {
    if (value !== undefined) this._tzid = value;
    if (this._tzid !== undefined) return this._tzid;
    return this._rrule.find((rule) => rule.origOptions.tzid)?.origOptions.tzid;
  }

  private buildExpression(): SetExpression {
    const tzid = this._tzid ?? 'UTC';
    const include: SetExpression[] = [
      ...this._rrule.map((rule) => ({ kind: 'source' as const, source: adaptRule(rule) })),
    ];
    if (this._rdate.length) {
      include.push({
        kind: 'source',
        source: new DateSource(this._rdate.map((date) => dateToZdt(date, tzid))),
      });
    }

    const exclude: SetExpression[] = [
      ...this._exrule.map((rule) => ({ kind: 'source' as const, source: adaptRule(rule) })),
    ];
    if (this._exdate.length) {
      exclude.push({
        kind: 'source',
        source: new DateSource(this._exdate.map((date) => dateToZdt(date, tzid))),
      });
    }

    const includeExpression: SetExpression = { kind: 'union', expressions: include };
    if (!exclude.length) return includeExpression;
    return {
      kind: 'difference',
      include: includeExpression,
      exclude: { kind: 'union', expressions: exclude },
    };
  }

  private sync() {
    this.engine = new SetEngine(this.buildExpression());
    this.setAllCache = null;
  }

  override all(iterator?: (date: Date, index: number) => boolean): Date[] {
    if (iterator) {
      const out: Date[] = [];
      for (const date of this.iterate()) {
        if (!iterator(date, out.length)) break;
        out.push(date);
      }
      return out;
    }
    const values = !this.setNoCache && this.setAllCache
      ? this.setAllCache
      : this.engine.all().map(zdtToDate);
    if (!this.setNoCache && !this.setAllCache) this.setAllCache = values;
    return values;
  }

  override *iterate(): Generator<Date> {
    for (const value of this.engine.iterate()) yield zdtToDate(value);
  }

  override between(after: Date, before: Date, inc = false, iterator?: (date: Date, index: number) => boolean): Date[] {
    if (!isValidDate(after) || !isValidDate(before)) throw new Error('Invalid date');
    const lower = Temporal.Instant.from(after.toISOString());
    const upper = Temporal.Instant.from(before.toISOString());
    return iterator
      ? collectDateOccurrences(this.engine.iterateWindow({ after: lower, before: upper, inc }), iterator)
      : this.engine.between(lower, upper, inc).map(zdtToDate);
  }

  override before(date: Date, inc = false): Date | null {
    if (!isValidDate(date)) throw new Error('Invalid date');
    const value = this.engine.before(Temporal.Instant.from(date.toISOString()), inc);
    return value ? zdtToDate(value) : null;
  }

  override after(date: Date, inc = false): Date | null {
    if (!isValidDate(date)) throw new Error('Invalid date');
    const value = this.engine.after(Temporal.Instant.from(date.toISOString()), inc);
    return value ? zdtToDate(value) : null;
  }

  override count(): number {
    return this.all().length;
  }

  rrule(rule: RRule) {
    if (!(rule instanceof RRule)) throw new TypeError(`${String(rule)} is not RRule instance`);
    if (!this._rrule.some((entry) => entry.toString() === rule.toString())) {
      this._rrule.push(rule);
      this.sync();
    }
  }

  exrule(rule: RRule) {
    if (!(rule instanceof RRule)) throw new TypeError(`${String(rule)} is not RRule instance`);
    if (!this._exrule.some((entry) => entry.toString() === rule.toString())) {
      this._exrule.push(rule);
      this.sync();
    }
  }

  private addDate(kind: 'RDATE' | 'EXDATE', date: Date, plainDate?: string) {
    if (!(date instanceof Date)) throw new TypeError(`${String(date)} is not Date instance`);
    const values = kind === 'RDATE' ? this._rdate : this._exdate;
    const stamp = date.getTime();
    const exists = values.some((entry) => entry.getTime() === stamp);
    const types = this.dateTypes[kind].get(stamp) ?? new Set(exists ? [undefined] : []);
    types.add(plainDate);
    this.dateTypes[kind].set(stamp, types);
    if (!exists) {
      values.push(cloneDate(date));
      values.sort((a, b) => a.getTime() - b.getTime());
      this.sync();
    }
  }

  rdate(date: Date, plainDate?: string) {
    this.addDate('RDATE', date, plainDate);
  }

  exdate(date: Date, plainDate?: string) {
    this.addDate('EXDATE', date, plainDate);
  }

  private renderDates(kind: 'RDATE' | 'EXDATE', values: Date[]): string[] {
    const dates = new Set<string>();
    const times: Date[] = [];
    for (const value of values) {
      for (const type of this.dateTypes[kind].get(value.getTime()) ?? [undefined]) {
        if (type === undefined) times.push(value);
        else dates.add(formatRfcDate(type));
      }
    }
    const lines: string[] = [];
    if (dates.size) lines.push(`${kind};VALUE=DATE:${[...dates].sort().join(',')}`);
    if (times.length) lines.push(renderDateList(kind, times, this.tzid() ?? undefined));
    return lines;
  }

  rrules() {
    return this._rrule.map((rule) => rule.clone());
  }

  exrules() {
    return this._exrule.map((rule) => rule.clone());
  }

  rdates() {
    return this._rdate.map(cloneDate);
  }

  exdates() {
    return this._exdate.map(cloneDate);
  }

  valueOf() {
    const parts: string[] = [];
    const isDtstartSingleton =
      !this._rrule.length &&
      !this._exrule.length &&
      !this._exdate.length &&
      !!this._dtstart &&
      this._rdate.length === 1 &&
      this._rdate[0]!.getTime() === this._dtstart.getTime() &&
      [...(this.dateTypes.RDATE.get(this._dtstart.getTime()) ?? [undefined])].every(type => type === this.dtstartDate);

    if (!this._rrule.length && this._dtstart) {
      parts.push(this.dtstartDate
        ? `DTSTART;VALUE=DATE:${formatRfcDate(this.dtstartDate)}`
        : renderDateProperty('DTSTART', this._dtstart, this.tzid() ?? undefined));
    }

    for (const rule of this._rrule) {
      parts.push(...rule.toString().split('\n'));
    }

    for (const rule of this._exrule) {
      parts.push(
        ...rule
          .toString()
          .split('\n')
          .map((line) => line.replace(/^RRULE:/, 'EXRULE:'))
          .filter((line) => !line.startsWith('DTSTART')),
      );
    }

    if (this._rdate.length && !isDtstartSingleton) {
      parts.push(...this.renderDates('RDATE', this._rdate));
    }

    if (this._exdate.length) {
      parts.push(...this.renderDates('EXDATE', this._exdate));
    }

    return parts;
  }

  override toString() {
    return this.valueOf().join('\n');
  }

  override toText(options?: ToTextOptions): string {
    return describeSetExpression(this.buildExpression(), options);
  }

  override isFullyConvertibleToText(options?: ToTextOptions): boolean {
    return isSetExpressionFullyConvertible(this.buildExpression(), options);
  }

  override clone() {
    const clone = new RRuleSet(this.setNoCache);
    if (this._dtstart !== undefined) clone.dtstart(this._dtstart, this.dtstartDate);
    if (this._tzid !== undefined) clone.tzid(this._tzid);
    this._rrule.forEach((rule) => clone.rrule(rule.clone()));
    this._exrule.forEach((rule) => clone.exrule(rule.clone()));
    for (const [kind, dates] of [['RDATE', this._rdate], ['EXDATE', this._exdate]] as const) {
      for (const date of dates) {
        for (const type of this.dateTypes[kind].get(date.getTime()) ?? [undefined]) clone.addDate(kind, date, type);
      }
    }
    return clone;
  }

  override toJSON(): Partial<import('./types.js').Options> & {
    rrule?: ReturnType<RRule['toJSON']>[];
    exrule?: ReturnType<RRule['toJSON']>[];
    rdate?: Date[];
    exdate?: Date[];
  } {
    const json: {
      dtstart?: Date | null;
      tzid?: string;
      rrule?: ReturnType<RRule['toJSON']>[];
      exrule?: ReturnType<RRule['toJSON']>[];
      rdate?: Date[];
      exdate?: Date[];
    } = {};

    if (this._dtstart !== undefined) json.dtstart = this._dtstart ? cloneDate(this._dtstart) : null;
    if (this._tzid !== undefined) json.tzid = this._tzid;
    if (this._rrule.length) json.rrule = this._rrule.map((rule) => rule.toJSON());
    if (this._exrule.length) json.exrule = this._exrule.map((rule) => rule.toJSON());
    if (this._rdate.length) json.rdate = this._rdate.map(cloneDate);
    if (this._exdate.length) json.exdate = this._exdate.map(cloneDate);

    return json;
  }
}

function adaptRule(rule: RRule) {
  const spec = rule.getSpec();
  // The classic facade rounds output to milliseconds, even for fromSpec() inputs.
  const source = rule.constructor === RRule && ![spec.dtstart.microsecond, spec.dtstart.nanosecond].some(Boolean)
    ? rule.getSource() : undefined;
  return new QueryMethodsSource(rule, source);
}

function toCompactUtc(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
}

function renderDateProperty(kind: 'DTSTART' | 'RDATE' | 'EXDATE', date: Date, tzid?: string) {
  if (date.getUTCMilliseconds()) throw new RangeError('RFC 5545 cannot preserve fractional seconds');
  if (tzid) {
    const local = dateToZdt(date, tzid);
    if (local.toPlainDateTime().toZonedDateTime(tzid).epochNanoseconds !== local.epochNanoseconds) tzid = 'UTC';
  }
  const isUtc = !tzid || tzid.toUpperCase() === 'UTC';
  const header = isUtc ? `${kind}:` : `${kind};TZID=${tzid}:`;
  if (isUtc) return `${header}${toCompactUtc(date)}`;
  return `${header}${dateToZdt(date, tzid ?? 'UTC').toString({ smallestUnit: 'second' }).replace(/[-:]/g, '').slice(0, 15)}`;
}

function renderDateList(kind: 'RDATE' | 'EXDATE', dates: Date[], tzid?: string) {
  let resolvedTzid = tzid ?? 'UTC';
  if (dates.some(date => date.getUTCMilliseconds())) throw new RangeError('RFC 5545 cannot preserve fractional seconds');
  if (dates.some(date => {
    const local = dateToZdt(date, resolvedTzid);
    return local.toPlainDateTime().toZonedDateTime(resolvedTzid).epochNanoseconds !== local.epochNanoseconds;
  })) resolvedTzid = 'UTC';
  const isUtc = resolvedTzid.toUpperCase() === 'UTC';
  const header = isUtc ? `${kind}:` : `${kind};TZID=${resolvedTzid}:`;
  if (isUtc) {
    return `${header}${dates.map((date) => toCompactUtc(date)).join(',')}`;
  }

  return `${header}${dates
    .map((date) => dateToZdt(date, resolvedTzid).toString({ smallestUnit: 'second' }).replace(/[-:]/g, '').slice(0, 15))
    .join(',')}`;
}
