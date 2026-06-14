import { addDays, addMinutes, isBefore, set, startOfDay } from "date-fns";
import type { AvailabilityRule, TimeSlot } from "./types";

type GenerateArgs = {
  rules: AvailabilityRule[];
  booked: { starts_at: string; ends_at: string }[];
  durationMinutes: number;
  daysAhead?: number;
  /** Minimum lead time before a slot can be booked, in hours. */
  leadHours?: number;
};

/**
 * Expands weekly availability rules into concrete bookable slots for the next
 * `daysAhead` days, removing anything that conflicts with existing bookings or
 * falls inside the lead-time window.
 */
export function generateSlots({
  rules,
  booked,
  durationMinutes,
  daysAhead = 21,
  leadHours = 12,
}: GenerateArgs): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const now = new Date();
  const earliest = addMinutes(now, leadHours * 60);

  for (let i = 0; i < daysAhead; i++) {
    const day = startOfDay(addDays(now, i));
    const dow = day.getDay();
    const dayRules = rules.filter((r) => r.day_of_week === dow);

    for (const rule of dayRules) {
      const [sh, sm] = rule.start_time.split(":").map(Number);
      const [eh, em] = rule.end_time.split(":").map(Number);
      let cursor = set(day, { hours: sh, minutes: sm, seconds: 0, milliseconds: 0 });
      const blockEnd = set(day, { hours: eh, minutes: em, seconds: 0, milliseconds: 0 });

      while (!isBefore(blockEnd, addMinutes(cursor, durationMinutes))) {
        const slotStart = cursor;
        const slotEnd = addMinutes(cursor, durationMinutes);

        const conflicts = booked.some((b) =>
          overlaps(slotStart, slotEnd, new Date(b.starts_at), new Date(b.ends_at)),
        );

        if (!conflicts && isBefore(earliest, slotStart)) {
          slots.push({
            startsAt: slotStart.toISOString(),
            endsAt: slotEnd.toISOString(),
          });
        }
        cursor = slotEnd;
      }
    }
  }

  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Groups slots by calendar day for rendering. */
export function groupSlotsByDay(slots: TimeSlot[]): Record<string, TimeSlot[]> {
  return slots.reduce<Record<string, TimeSlot[]>>((acc, slot) => {
    const key = slot.startsAt.slice(0, 10); // YYYY-MM-DD
    (acc[key] ??= []).push(slot);
    return acc;
  }, {});
}
