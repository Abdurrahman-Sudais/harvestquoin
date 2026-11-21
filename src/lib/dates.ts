import type { ISODate } from "./types";

/** Day-precision date helpers that operate in UTC to stay deterministic across time zones. */
export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function parseISO(s: ISODate): Date {
  return new Date(`${s}T00:00:00Z`);
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86_400_000);
}

export function localToday(): ISODate {
  const n = new Date();
  return toISO(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function fmtDate(s: ISODate | undefined, opts: { year?: boolean; weekday?: boolean } = {}): string {
  if (!s) return "—";
  const d = parseISO(s);
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  const withYear = opts.year ? `${base} ${d.getUTCFullYear()}` : base;
  return opts.weekday ? `${DAYS[d.getUTCDay()]}, ${withYear}` : withYear;
}

export function weekdayShort(s: ISODate) {
  return DAYS[parseISO(s).getUTCDay()];
}

export function relDays(target: ISODate, today: ISODate): string {
  const d = diffDays(target, today);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}
