import { DateTime } from "luxon";

import { createDomainError } from "../domain/errors.js";

export const PT_ZONE = "America/Los_Angeles";

export function normalizePtDate(input: string): string {
  const dt = DateTime.fromFormat(input, "yyyy-MM-dd", { zone: PT_ZONE });
  if (!dt.isValid) {
    throw createDomainError("INVALID_ARGUMENT", `Invalid PT date: ${input}`);
  }
  return dt.toFormat("yyyy-MM-dd");
}

export function diffDaysInclusive(startDate: string, endDate: string): number {
  const start = DateTime.fromFormat(normalizePtDate(startDate), "yyyy-MM-dd", { zone: PT_ZONE });
  const end = DateTime.fromFormat(normalizePtDate(endDate), "yyyy-MM-dd", { zone: PT_ZONE });
  if (end < start) {
    throw createDomainError("INVALID_ARGUMENT", "endDate must be on or after startDate");
  }
  return Math.floor(end.diff(start, "days").days) + 1;
}

export function enumeratePtDates(startDate: string, endDate: string): string[] {
  const start = DateTime.fromFormat(normalizePtDate(startDate), "yyyy-MM-dd", { zone: PT_ZONE });
  const end = DateTime.fromFormat(normalizePtDate(endDate), "yyyy-MM-dd", { zone: PT_ZONE });
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor.toFormat("yyyy-MM-dd"));
    cursor = cursor.plus({ days: 1 });
  }
  return dates;
}
