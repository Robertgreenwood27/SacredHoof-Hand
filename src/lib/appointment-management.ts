import "server-only";
import { createSupabaseAdminClient } from "./supabase/server";
import {
  sendAppointmentCancelledEmails,
  sendAppointmentChangedEmails,
} from "./email";
import { env } from "./env";
import { expirePendingBookingHolds, hashManageToken } from "./booking";
import { getServiceById } from "./data";
import { validateRequestedSlot } from "./slot-validation";
import type { Appointment, BookingAgreement } from "./types";

export type AppointmentActor = "client" | "practitioner" | "system";

export class AppointmentNotFoundError extends Error {}
export class AppointmentChangeError extends Error {}

export type AppointmentMutationResult = {
  appointment: Appointment;
  notificationsDelivered: boolean;
};

function durationMinutes(appointment: Appointment): number {
  return Math.round(
    (new Date(appointment.ends_at).getTime() -
      new Date(appointment.starts_at).getTime()) /
      60_000,
  );
}

function appointmentEmailInput(
  appointment: Appointment,
  manageToken?: string,
  notificationKey?: string,
) {
  return {
    appointment_id: appointment.id,
    client_name: appointment.client_name,
    client_email: appointment.client_email,
    service_id: appointment.service_id,
    service_name: appointment.service_name,
    starts_at: appointment.starts_at,
    ends_at: appointment.ends_at,
    amount_cents: appointment.amount_cents,
    notes: appointment.notes,
    client_timezone: appointment.client_timezone,
    manage_url: manageToken
      ? `${env.siteUrl.replace(/\/$/, "")}/manage/${encodeURIComponent(manageToken)}`
      : undefined,
    notification_key: notificationKey,
  };
}

export async function getAppointmentByManageToken(
  token: string,
): Promise<Appointment | null> {
  if (token.length < 32 || token.length > 200) return null;
  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("manage_token_hash", hashManageToken(token))
    .maybeSingle();
  if (error) throw new Error(`Could not load appointment: ${error.message}`);
  return (data as Appointment | null) ?? null;
}

export async function getAppointmentById(
  id: string,
): Promise<Appointment | null> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load appointment: ${error.message}`);
  return (data as Appointment | null) ?? null;
}

export async function getAgreementById(
  id: string | null,
): Promise<BookingAgreement | null> {
  if (!id) return null;
  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("booking_agreements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load signed agreement: ${error.message}`);
  return (data as BookingAgreement | null) ?? null;
}

export async function rescheduleAppointment(
  appointmentId: string,
  startsAt: string,
  endsAt: string,
  actor: AppointmentActor,
  manageToken?: string,
): Promise<AppointmentMutationResult> {
  await expirePendingBookingHolds();
  const existing = await getAppointmentById(appointmentId);
  if (!existing) throw new AppointmentNotFoundError("Appointment not found.");
  if (existing.status !== "confirmed") {
    throw new AppointmentChangeError(
      "Only confirmed upcoming appointments can be rescheduled.",
    );
  }
  if (new Date(existing.starts_at) <= new Date()) {
    throw new AppointmentChangeError("Past appointments cannot be rescheduled.");
  }
  if (
    new Date(startsAt).getTime() === new Date(existing.starts_at).getTime() &&
    new Date(endsAt).getTime() === new Date(existing.ends_at).getTime()
  ) {
    throw new AppointmentChangeError(
      "Choose a different time before confirming the change.",
    );
  }

  // Reschedules stay inside the programme the session was booked from — a
  // horse session may only move to another scheduled horse slot.
  const service = existing.service_id
    ? await getServiceById(existing.service_id)
    : null;
  const slot = await validateRequestedSlot({
    service: {
      durationMinutes: durationMinutes(existing),
      kind: service?.kind ?? "standard",
    },
    startsAt,
    endsAt,
    excludeAppointmentId: existing.id,
  });
  if (!slot.ok) throw new AppointmentChangeError(slot.error);

  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new AppointmentChangeError("Booking storage is not configured.");
  const changedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("appointments")
    .update({
      starts_at: slot.startsAt,
      ends_at: slot.endsAt,
      rescheduled_at: changedAt,
      reminder_sent_at: null,
      client_reminder_sent_at: null,
      practitioner_reminder_sent_at: null,
      client_reminder_claimed_at: null,
      practitioner_reminder_claimed_at: null,
      updated_at: changedAt,
    })
    .eq("id", existing.id)
    .eq("status", "confirmed")
    .eq("updated_at", existing.updated_at)
    .select("*")
    .single();
  if (error || !data) {
    if (
      error?.code === "23P01" ||
      error?.message?.toLowerCase().includes("overlap")
    ) {
      throw new AppointmentChangeError(
        "That time was just taken. Please choose another.",
      );
    }
    console.error("[appointments] reschedule update failed", error);
    throw new AppointmentChangeError(
      "The appointment could not be rescheduled. Please try again.",
    );
  }

  const updated = data as Appointment;
  const { error: eventError } = await supabase.from("appointment_events").insert({
    appointment_id: existing.id,
    event_type: "rescheduled",
    actor,
    old_starts_at: existing.starts_at,
    old_ends_at: existing.ends_at,
    new_starts_at: updated.starts_at,
    new_ends_at: updated.ends_at,
  });
  if (eventError) console.error("[appointments] reschedule audit failed", eventError);

  const delivery = await sendAppointmentChangedEmails(
    appointmentEmailInput(updated, manageToken, changedAt),
  );
  return {
    appointment: updated,
    notificationsDelivered:
      delivery.clientSent && delivery.practitionerSent,
  };
}

export async function cancelAppointment(
  appointmentId: string,
  actor: AppointmentActor,
  manageToken?: string,
): Promise<AppointmentMutationResult> {
  const existing = await getAppointmentById(appointmentId);
  if (!existing) throw new AppointmentNotFoundError("Appointment not found.");
  if (existing.status === "cancelled") {
    return { appointment: existing, notificationsDelivered: true };
  }
  if (existing.status === "completed") {
    throw new AppointmentChangeError("Completed appointments cannot be cancelled.");
  }
  if (
    actor === "client" &&
    (existing.status !== "confirmed" ||
      new Date(existing.starts_at).getTime() <= Date.now())
  ) {
    throw new AppointmentChangeError(
      "This appointment can no longer be cancelled online.",
    );
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new AppointmentChangeError("Booking storage is not configured.");
  const changedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("appointments")
    .update({
      status: "cancelled",
      hold_expires_at: null,
      client_reminder_claimed_at: null,
      practitioner_reminder_claimed_at: null,
      updated_at: changedAt,
    })
    .eq("id", existing.id)
    .eq("status", existing.status)
    .eq("updated_at", existing.updated_at)
    .select("*")
    .single();
  if (error || !data) {
    console.error("[appointments] cancellation update failed", error);
    throw new AppointmentChangeError(
      "The appointment could not be cancelled. Please try again.",
    );
  }

  const updated = data as Appointment;
  const { error: eventError } = await supabase.from("appointment_events").insert({
    appointment_id: existing.id,
    event_type: "cancelled",
    actor,
    old_starts_at: existing.starts_at,
    old_ends_at: existing.ends_at,
  });
  if (eventError) console.error("[appointments] cancellation audit failed", eventError);

  if (existing.status === "pending") {
    return { appointment: updated, notificationsDelivered: true };
  }

  const delivery = await sendAppointmentCancelledEmails(
    appointmentEmailInput(updated, manageToken, changedAt),
  );
  return {
    appointment: updated,
    notificationsDelivered:
      delivery.clientSent && delivery.practitionerSent,
  };
}
