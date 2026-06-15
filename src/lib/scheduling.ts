import { addDays, addMinutes } from "date-fns";
import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";
import type { AvailabilityRule } from "./types";

/** One time option in the picker. `available` controls whether it's selectable. */
export type GridSlot = {
  startsAt: string; // ISO (UTC instant)
  endsAt: string; // ISO
  label: string; // e.g. "5:00 PM" in business timezone
  available: boolean;
};

/** A day's worth of time options. */
export type DayGrid = {
  dateKey: string; // YYYY-MM-DD in business timezone
  dayLabel: string; // "Thursday, June 18"
  shortLabel: string; // "Thu 18"
  slots: GridSlot[];
  hasAvailable: boolean;
};

type GenerateArgs = {
  rules: AvailabilityRule[];
  booked: { starts_at: string; ends_at: string }[];
  durationMinutes: number;
  timeZone: string;
  /** Granularity of offered start times, in minutes. */
  stepMinutes?: number;
  daysAhead?: number;
  /** Minimum lead time before a slot can be booked, in hours. */
  leadHours?: number;
};

const pad = (n: number) => String(n).padStart(2, "0");
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Builds the booking grid for the next `daysAhead` days, anchored to
 * `timeZone`. For each day with availability it produces every candidate start
 * time (at `stepMinutes` granularity) spanning that day's open windows, marking
 * each `available` unless it's outside a window, already booked, or inside the
 * lead-time cutoff. Unavailable slots are kept so the UI can grey them out.
 */
export function generateDayGrid({
  rules,
  booked,
  durationMinutes,
  timeZone,
  stepMinutes = 30,
  daysAhead = 21,
  leadHours = 12,
}: GenerateArgs): DayGrid[] {
  const days: DayGrid[] = [];
  const nowUtc = new Date();
  const earliest = addMinutes(nowUtc, leadHours * 60);
  const nowZoned = toZonedTime(nowUtc, timeZone);

  for (let i = 0; i < daysAhead; i++) {
    const zonedDay = addDays(nowZoned, i);
    const year = zonedDay.getFullYear();
    const month = zonedDay.getMonth() + 1;
    const date = zonedDay.getDate();
    const dow = zonedDay.getDay();

    const dayRules = rules.filter((r) => r.day_of_week === dow);
    if (dayRules.length === 0) continue;

    const dateKey = `${year}-${pad(month)}-${pad(date)}`;
    const startMin = Math.min(...dayRules.map((r) => toMinutes(r.start_time)));
    const endMax = Math.max(...dayRules.map((r) => toMinutes(r.end_time)));

    const slots: GridSlot[] = [];
    for (let t = startMin; t + durationMinutes <= endMax; t += stepMinutes) {
      const hh = Math.floor(t / 60);
      const mm = t % 60;
      // Interpret this wall-clock time in the business timezone -> UTC instant.
      const startUtc = fromZonedTime(
        `${dateKey}T${pad(hh)}:${pad(mm)}:00`,
        timeZone,
      );
      const endUtc = addMinutes(startUtc, durationMinutes);

      const inWindow = dayRules.some(
        (r) =>
          t >= toMinutes(r.start_time) &&
          t + durationMinutes <= toMinutes(r.end_time),
      );
      const conflicts = booked.some((b) =>
        overlaps(startUtc, endUtc, new Date(b.starts_at), new Date(b.ends_at)),
      );
      const future = startUtc > earliest;

      slots.push({
        startsAt: startUtc.toISOString(),
        endsAt: endUtc.toISOString(),
        label: formatInTimeZone(startUtc, timeZone, "h:mm a"),
        available: inWindow && !conflicts && future,
      });
    }

    if (slots.length === 0) continue;

    const noon = fromZonedTime(`${dateKey}T12:00:00`, timeZone);
    days.push({
      dateKey,
      dayLabel: formatInTimeZone(noon, timeZone, "EEEE, MMMM d"),
      shortLabel: formatInTimeZone(noon, timeZone, "EEE d"),
      slots,
      hasAvailable: slots.some((s) => s.available),
    });
  }

  return days;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
