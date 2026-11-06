import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { BUSINESS_TIMEZONE } from "./content";

/** Calendar-day arithmetic avoids 23/25-hour DST errors. */
export function notificationWindows(now: Date) {
  const today = formatInTimeZone(now, BUSINESS_TIMEZONE, "yyyy-MM-dd");
  const [year, month, day] = today.split("-").map(Number);
  const midnight = (offset: number) => {
    const key = new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
    return fromZonedTime(`${key}T00:00:00`, BUSINESS_TIMEZONE).toISOString();
  };
  return {
    businessDate: today,
    reminderFrom: now.toISOString(),
    reminderTo: midnight(1),
    // Check in on the second calendar day after the session ended.
    followUpFrom: midnight(-2),
    followUpTo: midnight(-1),
  };
}
