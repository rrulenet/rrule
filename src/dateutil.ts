export function datetime(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const date = new Date(Date.UTC(0, month - 1, day, hour, minute, second, 0));
  date.setUTCFullYear(year);
  return date;
}

export function cloneDate(date: Date): Date {
  return new Date(date.getTime());
}

export function isValidDate(date: Date): boolean {
  return date instanceof Date && !Number.isNaN(date.getTime());
}
