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
  getEventSlots,
  getServiceById,
} from "./data";
import {
  generateDayGrid,
  generateEventGrid,
  type GridSlot,
} from "./scheduling";
import type { Appointment, Service } from "./types";

type SlotRequest = {
  service: Pick<Service, "durationMinutes" | "kind">;
  startsAt: string;
  endsAt: string;
  excludeAppointmentId?: string;
};

/**
 * Rebuilds the offered slots for one service. Equine sessions come from the
 * dated event schedule; everything else from the weekly availability rules.
 * Both are checked against the same booked-appointment list, so a horse day
 * and a virtual session can never be sold for the same hour.
 */
async function offeredSlots({
  kind,
  durationMinutes,
  excludeAppointmentId,
  from,
  to,
}: {
  kind: Service["kind"];
  durationMinutes: number;
  excludeAppointmentId?: string;
  from: Date;
  to: Date;
}): Promise<GridSlot[]> {
  const daysAhead =
    Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60_000)) + 1;

  const [blockedDays, booked] = await Promise.all([
    getBlockedDays(),
    getBookedAppointments(
      from.toISOString(),
      to.toISOString(),
      excludeAppointmentId,
    ),
  ]);
  const blockedDayKeys = blockedDays.map((day) => day.day);

  if (kind === "equine") {
    const slots = await getEventSlots("equine");
    return generateEventGrid({
      slots,
      booked,
      blockedDays: blockedDayKeys,
      durationMinutes,
      timeZone: BUSINESS_TIMEZONE,
      leadHours: BOOKING_LEAD_HOURS,
    }).flatMap((day) => day.slots);
  }

  const rules = await getAvailabilityRules();
  return generateDayGrid({
    rules,
    booked,
    blockedDays: blockedDayKeys,
    durationMinutes,
    timeZone: BUSINESS_TIMEZONE,
    leadHours: BOOKING_LEAD_HOURS,
    daysAhead,
  }).flatMap((day) => day.slots);
}

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

  const normalizedStart = start.toISOString();
  const normalizedEnd = end.toISOString();
  const candidate = (
    await offeredSlots({
      kind: service.kind,
      durationMinutes: service.durationMinutes,
      excludeAppointmentId,
      from: now,
      to: horizon,
    })
  ).find(
    (slot) => slot.startsAt === normalizedStart && slot.endsAt === normalizedEnd,
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
    "id" | "service_id" | "starts_at" | "ends_at"
  >,
): Promise<GridSlot[]> {
  const durationMinutes = Math.round(
    (new Date(appointment.ends_at).getTime() -
      new Date(appointment.starts_at).getTime()) /
      60_000,
  );
  const now = new Date();
  const horizon = addDays(now, 31);
  // A horse session can only move to another horse slot, so offer the same
  // programme's schedule the booking was made from.
  const service = appointment.service_id
    ? await getServiceById(appointment.service_id)
    : null;

  return offeredSlots({
    kind: service?.kind ?? "standard",
    durationMinutes,
    excludeAppointmentId: appointment.id,
    from: now,
    to: horizon,
  });
}
