import "server-only";
import { addDays } from "date-fns";
import {
  BOOKING_LEAD_HOURS,
  BUSINESS_TIMEZONE,
} from "./content";
import {
  getAvailabilityRules,
  getBlockedDays,
  getBookedAppointments,
} from "./data";
import { generateDayGrid, type GridSlot } from "./scheduling";
import type { Appointment, Service } from "./types";

type SlotRequest = {
  service: Pick<Service, "durationMinutes">;
  startsAt: string;
  endsAt: string;
  excludeAppointmentId?: string;
};

export type SlotValidation =
  | { ok: true; startsAt: string; endsAt: string }
  | { ok: false; error: string };

function parseInstant(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

/**
 * Rebuilds the authoritative schedule on the server and ensures the submitted
 * slot is one of the options currently offered. The database overlap
 * constraint remains the final race-condition guard.
 */
export async function validateRequestedSlot({
  service,
  startsAt,
  endsAt,
  excludeAppointmentId,
}: SlotRequest): Promise<SlotValidation> {
  const start = parseInstant(startsAt);
  const end = parseInstant(endsAt);
  if (!start || !end || end <= start) {
    return { ok: false, error: "Please choose a valid appointment time." };
  }

  if (
    end.getTime() - start.getTime() !==
    service.durationMinutes * 60 * 1000
  ) {
    return {
      ok: false,
      error: "That time does not match the selected session length.",
    };
  }

  const now = new Date();
  const horizon = addDays(now, 31);
  if (start < now || start > horizon) {
    return {
      ok: false,
      error: "Please choose an available time in the next 30 days.",
    };
  }

  const [rules, blockedDays, booked] = await Promise.all([
    getAvailabilityRules(),
    getBlockedDays(),
    getBookedAppointments(
      now.toISOString(),
      horizon.toISOString(),
      excludeAppointmentId,
    ),
  ]);

  const normalizedStart = start.toISOString();
  const normalizedEnd = end.toISOString();
  const candidate = generateDayGrid({
    rules,
    booked,
    blockedDays: blockedDays.map((day) => day.day),
    durationMinutes: service.durationMinutes,
    timeZone: BUSINESS_TIMEZONE,
    leadHours: BOOKING_LEAD_HOURS,
    daysAhead: 31,
  })
    .flatMap((day) => day.slots)
    .find(
      (slot) =>
        slot.startsAt === normalizedStart && slot.endsAt === normalizedEnd,
    );

  if (!candidate?.available) {
    return {
      ok: false,
      error: "That time is no longer available. Please choose another.",
    };
  }

  return { ok: true, startsAt: normalizedStart, endsAt: normalizedEnd };
}

/**
 * Returns all reschedule candidates while excluding the current appointment
 * from conflict checks.
 */
export async function getRescheduleSlots(
  appointment: Pick<
    Appointment,
    "id" | "starts_at" | "ends_at"
  >,
): Promise<GridSlot[]> {
  const durationMinutes = Math.round(
    (new Date(appointment.ends_at).getTime() -
      new Date(appointment.starts_at).getTime()) /
      60_000,
  );
  const now = new Date();
  const horizon = addDays(now, 31);
  const [rules, blockedDays, booked] = await Promise.all([
    getAvailabilityRules(),
    getBlockedDays(),
    getBookedAppointments(
      now.toISOString(),
      horizon.toISOString(),
      appointment.id,
    ),
  ]);

  return generateDayGrid({
    rules,
    booked,
    blockedDays: blockedDays.map((day) => day.day),
    durationMinutes,
    timeZone: BUSINESS_TIMEZONE,
    leadHours: BOOKING_LEAD_HOURS,
    daysAhead: 31,
  }).flatMap((day) => day.slots);
}
