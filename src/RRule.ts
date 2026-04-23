import { RuleSource, type RuleSpec } from '@rrulenet/core/engine';
import { buildRuleSpecFromResolvedTemporalOptions, normalizeOptions, optionsToString as serializeOptions, parseRuleString } from '@rrulenet/core/rule';
import { toInstant, zdtToDate } from '@rrulenet/core/time';
import {
  isFullyConvertibleToText,
  ruleToText,
  textMergeDescriptorForOptions,
  type TextMergeDescriptor,
  type ToTextOptions,
} from '@rrulenet/core/text';

import { cloneDate, isValidDate } from './dateutil.js';
import { parseText as parseNaturalLanguageText } from './parseText.js';
import type { Options } from './types.js';
import { Frequency } from './types.js';
import { WEEKDAY_INSTANCES } from './weekday.js';

export class RRule {
  public origOptions: Partial<Options>;
  public options: Options;
  protected spec: RuleSpec;
  protected source: RuleSource;
  private noCache: boolean;
  private allCache: Date[] | null = null;

  static readonly FREQUENCIES = ['YEARLY', 'MONTHLY', 'WEEKLY', 'DAILY', 'HOURLY', 'MINUTELY', 'SECONDLY'] as const;
  static readonly YEARLY = Frequency.YEARLY;
  static readonly MONTHLY = Frequency.MONTHLY;
  static readonly WEEKLY = Frequency.WEEKLY;
  static readonly DAILY = Frequency.DAILY;
  static readonly HOURLY = Frequency.HOURLY;
  static readonly MINUTELY = Frequency.MINUTELY;
  static readonly SECONDLY = Frequency.SECONDLY;
  static readonly MO = WEEKDAY_INSTANCES[0]!;
  static readonly TU = WEEKDAY_INSTANCES[1]!;
  static readonly WE = WEEKDAY_INSTANCES[2]!;
  static readonly TH = WEEKDAY_INSTANCES[3]!;
  static readonly FR = WEEKDAY_INSTANCES[4]!;
  static readonly SA = WEEKDAY_INSTANCES[5]!;
  static readonly SU = WEEKDAY_INSTANCES[6]!;

  constructor(options: Partial<Options> = {}, _noCache = false) {
    this.origOptions = { ...options };
    this.options = normalizeOptions(options);
    this.spec = buildRuleSpecFromResolvedTemporalOptions(this.options);
    this.source = new RuleSource(this.spec);
    this.noCache = _noCache;
  }

  static parseString(str: string): Partial<Options> {
    return parseRuleString(str);
  }

  static fromString(str: string): RRule {
    return new RRule(RRule.parseString(str));
  }

  static parseText(text: string, language?: unknown): Partial<Options> {
    return parseNaturalLanguageText(text, language);
  }

  static fromText(text: string, language?: unknown): RRule {
    return new RRule(RRule.parseText(text, language));
  }

  static fromSpec(
    spec: RuleSpec,
    config: {
      origOptions?: Partial<Options>;
      normalizedOptions?: Options;
      noCache?: boolean;
    } = {},
  ): RRule {
    const rule = new RRule({}, config.noCache ?? false);
    rule.origOptions = { ...(config.origOptions ?? {}) };
    rule.options = config.normalizedOptions ?? normalizeOptions(rule.origOptions);
    rule.spec = spec;
    rule.source = new RuleSource(spec);
    rule.noCache = config.noCache ?? false;
    rule.allCache = null;
    return rule;
  }

  static optionsToString(options: Partial<Options>): string {
    return serializeOptions(options);
  }

  all(iterator?: (date: Date, index: number) => boolean): Date[] {
    const values = !this.noCache && this.allCache
      ? this.allCache
      : this.source.all().map(zdtToDate);
    if (!this.noCache && !this.allCache) this.allCache = values;
    return iterator ? applyIterator(values, iterator) : values;
  }

  between(after: Date, before: Date, inc = false, iterator?: (date: Date, index: number) => boolean): Date[] {
    if (!isValidDate(after) || !isValidDate(before)) throw new Error('Invalid date');
    const values = this.source.between(toInstant(after), toInstant(before), inc).map(zdtToDate);
    return iterator ? applyIterator(values, iterator) : values;
  }

  before(date: Date, inc = false): Date | null {
    if (!isValidDate(date)) throw new Error('Invalid date');
    const value = this.source.before(toInstant(date), inc);
    return value ? zdtToDate(value) : null;
  }

  after(date: Date, inc = false): Date | null {
    if (!isValidDate(date)) throw new Error('Invalid date');
    const value = this.source.after(toInstant(date), inc);
    return value ? zdtToDate(value) : null;
  }

  count(): number {
    return this.all().length;
  }

  toString(): string {
    return serializeOptions(this.origOptions);
  }

  toText(options?: ToTextOptions): string {
    return ruleToText(this.options, options);
  }

  isFullyConvertibleToText(options?: ToTextOptions): boolean {
    return isFullyConvertibleToText(this.options, options);
  }

  textMergeDescriptor(options?: ToTextOptions): TextMergeDescriptor | null {
    return textMergeDescriptorForOptions(this.options, options);
  }

  clone(): RRule {
    return new RRule(
      {
        ...this.origOptions,
        dtstart: this.origOptions.dtstart ? cloneDate(this.origOptions.dtstart) : null,
        until: this.origOptions.until ? cloneDate(this.origOptions.until) : null,
      },
      this.noCache,
    );
  }

  toJSON(): Partial<Options> {
    return {
      ...this.origOptions,
      dtstart: this.origOptions.dtstart ? cloneDate(this.origOptions.dtstart) : null,
      until: this.origOptions.until ? cloneDate(this.origOptions.until) : null,
    };
  }

  getSpec() {
    return this.spec;
  }

  getSource() {
    return this.source;
  }
}

function applyIterator(values: Date[], iterator: (date: Date, index: number) => boolean): Date[] {
  const accepted: Date[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (!iterator(value, index)) break;
    accepted.push(value);
  }
  return accepted;
}
