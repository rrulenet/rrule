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
