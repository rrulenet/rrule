export type WeekdayStr = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

const ORDER: WeekdayStr[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export class Weekday {
  constructor(
    public readonly weekday: number,
    public readonly n?: number,
  ) {
    if (n === 0) throw new Error("Can't create weekday with n == 0");
  }

  static fromStr(str: WeekdayStr): Weekday {
    return WEEKDAY_INSTANCES[ORDER.indexOf(str)]!;
  }

  nth(n: number): Weekday {
    return this.n === n ? this : new Weekday(this.weekday, n);
  }

  equals(other: Weekday): boolean {
    return this.weekday === other.weekday && this.n === other.n;
  }

  getJsWeekday(): number {
    return this.weekday === 6 ? 0 : this.weekday + 1;
  }

  toString(): string {
    const token = ORDER[this.weekday]!;
    if (this.n === undefined) return token;
    return `${this.n > 0 ? '+' : ''}${this.n}${token}`;
  }
}

export const ALL_WEEKDAYS = [...ORDER];
export const WEEKDAY_INSTANCES = ORDER.map((_, index) => new Weekday(index));
