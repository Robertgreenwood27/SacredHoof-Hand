import { addDays, addMinutes } from "date-fns";
import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";
import type { AvailabilityRule, EventSlot } from "./types";

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
  /** Date keys (YYYY-MM-DD, business timezone) the practitioner has blocked off. */
  blockedDays?: string[];
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
  blockedDays = [],
  durationMinutes,
  timeZone,
  stepMinutes = 30,
  daysAhead = 21,
  leadHours = 12,
}: GenerateArgs): DayGrid[] {
  const days: DayGrid[] = [];
  const blocked = new Set(blockedDays);
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
    if (blocked.has(dateKey)) continue; // practitioner has the day off

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

type EventGridArgs = {
  /** Every scheduled slot for this programme, of any length. */
  slots: Pick<EventSlot, "day" | "start_time" | "duration_minutes">[];
  booked: { starts_at: string; ends_at: string }[];
  blockedDays?: string[];
  /** Only slots scheduled for exactly this length are offered. */
  durationMinutes: number;
  timeZone: string;
  leadHours?: number;
};

/**
 * Builds the booking grid for an event-based programme (the horse days), where
 * availability is a fixed list of specific start times on specific dates rather
 * than a weekly pattern.
 *
 * Unlike the weekly grid this does NOT slide a window across open hours: each
 * scheduled slot is offered exactly as authored, so a 60-minute slot is never
 * sold as two 30-minute sessions and the gaps between slots stay reserved for
 * settling the herd. Slots in the past, inside the lead-time cutoff, on a
 * blocked day, or already booked are kept but marked unavailable so the UI can
 * grey them out.
 */
export function generateEventGrid({
  slots,
  booked,
  blockedDays = [],
  durationMinutes,
  timeZone,
  leadHours = 12,
}: EventGridArgs): DayGrid[] {
  const blocked = new Set(blockedDays);
  const earliest = addMinutes(new Date(), leadHours * 60);

  const byDay = new Map<string, GridSlot[]>();
  const matching = slots
    .filter((slot) => slot.duration_minutes === durationMinutes)
    .filter((slot) => !blocked.has(slot.day));

  for (const slot of matching) {
    const startUtc = fromZonedTime(`${slot.day}T${slot.start_time}:00`, timeZone);
    if (!Number.isFinite(startUtc.getTime())) continue;
    const endUtc = addMinutes(startUtc, slot.duration_minutes);

    const conflicts = booked.some((b) =>
      overlaps(startUtc, endUtc, new Date(b.starts_at), new Date(b.ends_at)),
    );

    const day = byDay.get(slot.day) ?? [];
    day.push({
      startsAt: startUtc.toISOString(),
      endsAt: endUtc.toISOString(),
      label: formatInTimeZone(startUtc, timeZone, "h:mm a"),
      available: !conflicts && startUtc > earliest,
    });
    byDay.set(slot.day, day);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, daySlots]) => {
      const noon = fromZonedTime(`${dateKey}T12:00:00`, timeZone);
      return {
        dateKey,
        dayLabel: formatInTimeZone(noon, timeZone, "EEEE, MMMM d"),
        shortLabel: formatInTimeZone(noon, timeZone, "EEE d"),
        slots: daySlots.sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
        hasAvailable: daySlots.some((s) => s.available),
      };
    });
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
