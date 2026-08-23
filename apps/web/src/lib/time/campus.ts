export const CAMPUS_TIMEZONE = "America/Los_Angeles";

function part(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  return parts.find((item) => item.type === type)?.value ?? "";
}

export function isoDateInTimeZone(
  date: Date = new Date(),
  timeZone: string = CAMPUS_TIMEZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`;
}

export function clockInTimeZone(
  date: Date = new Date(),
  timeZone: string = CAMPUS_TIMEZONE,
): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return {
    hour: Number(part(parts, "hour")),
    minute: Number(part(parts, "minute")),
  };
}

export function todayInTimeZone(timeZone: string = CAMPUS_TIMEZONE): string {
  return isoDateInTimeZone(new Date(), timeZone);
}

/** True around 7:30 AM Pacific so a slightly late Vercel tick still sends. */
export function isCampusNotifyWindow(date: Date = new Date()): boolean {
  const { hour, minute } = clockInTimeZone(date);
  return hour === 7 && minute >= 25 && minute <= 40;
}
