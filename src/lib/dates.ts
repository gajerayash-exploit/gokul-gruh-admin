import { formatInTimeZone, toZonedTime } from "date-fns-tz";

/**
 * All business dates are anchored to the Asia/Kolkata timezone so that the
 * weekday and "today" always agree with the administrator's wall clock,
 * regardless of server timezone. The weekday is ALWAYS derived from the date —
 * never stored or edited independently (per spec §7, §17).
 */
export const BUSINESS_TZ = "Asia/Kolkata";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** "YYYY-MM-DD" string for the current day in Asia/Kolkata. */
export function todayISODate(): string {
  return formatInTimeZone(new Date(), BUSINESS_TZ, "yyyy-MM-dd");
}

/**
 * Convert a business-day "YYYY-MM-DD" into a stable Date to persist.
 * We store it as midday UTC of that calendar day to avoid any off-by-one
 * caused by timezone conversion at the day boundary.
 */
export function isoDateToStorage(iso: string): Date {
  // iso is yyyy-MM-dd
  return new Date(`${iso}T12:00:00.000Z`);
}

/** Convert a stored Date back to the business-day "YYYY-MM-DD" string. */
export function storageToISODate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // Interpret relative to the business TZ for display consistency.
  return formatInTimeZone(d, BUSINESS_TZ, "yyyy-MM-dd");
}

/** Weekday name derived from a business-day ISO string (never stored). */
export function weekdayFromISO(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  // Use UTC to avoid local-timezone drift; day index is calendar-stable.
  const idx = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEKDAYS[idx] ?? "";
}

/** Weekday from a stored Date value. */
export function weekdayFromDate(date: Date | string): string {
  return weekdayFromISO(storageToISODate(date));
}

/** Display format DD/MM/YYYY (primary date format per spec §2). */
export function formatDisplayDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

/** Format a stored Date for display as DD/MM/YYYY. */
export function formatStoredDate(date: Date | string): string {
  return formatDisplayDate(storageToISODate(date));
}

/** Human-friendly timestamp for "last saved" indicators (Asia/Kolkata). */
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, BUSINESS_TZ, "dd/MM/yyyy, hh:mm:ss a");
}

export function formatClockTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, BUSINESS_TZ, "hh:mm a");
}

export { toZonedTime };
