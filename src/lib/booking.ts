import "server-only";
import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { createSupabaseAdminClient } from "./supabase/server";
import { sendBookingEmails } from "./email";
import { env } from "./env";
import type { Appointment } from "./types";

// Stripe Checkout requires at least a 30-minute expiry. A small buffer keeps
// network/processing time from making the requested expiry invalid.
const HOLD_MINUTES = 35;
const MAX_ACTIVE_HOLDS_PER_EMAIL = 2;

export class BookingConflictError extends Error {}
export class BookingConfigurationError extends Error {}
export class BookingNotificationError extends Error {}

export type BookingHoldInput = {
  service_id: string;
  service_name: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_timezone?: string;
  notes?: string;
  starts_at: string;
  ends_at: string;
  amount_cents: number;
  original_amount_cents: number;
  discount_code?: string | null;
  discount_percent?: number;
  agreement_id: string;
};

export type BookingHold = {
  appointment: Appointment;
  manageToken: string;
  holdExpiresAt: string;
};

export function hashManageToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokenMatches(token: string, expectedHash: string | null): boolean {
  if (!expectedHash) return false;
  const actual = Buffer.from(hashManageToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function manageUrl(token: string): string {
  return `${env.siteUrl.replace(/\/$/, "")}/manage/${encodeURIComponent(token)}`;
}

async function deliverBookingConfirmation(
  appointment: Appointment,
  manageToken?: string,
): Promise<void> {
  await sendBookingEmails({
    appointment_id: appointment.id,
    client_name: appointment.client_name,
    client_email: appointment.client_email,
    service_name: appointment.service_name,
    starts_at: appointment.starts_at,
    ends_at: appointment.ends_at,
    amount_cents: appointment.amount_cents,
    notes: appointment.notes,
    client_timezone: appointment.client_timezone,
    manage_url: manageToken ? manageUrl(manageToken) : undefined,
  });

  const supabase = createSupabaseAdminClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("appointments")
    .update({ confirmation_sent_at: new Date().toISOString() })
    .eq("id", appointment.id);
  if (error) {
    throw new Error(`Could not record confirmation delivery: ${error.message}`);
  }
}

function isOverlapError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "23P01" ||
    Boolean(error.message?.toLowerCase().includes("overlap"))
  );
}

/** Releases abandoned Stripe holds so a new checkout can reserve the time. */
export async function expirePendingBookingHolds(): Promise<number> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return 0;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "cancelled", updated_at: now })
    .eq("status", "pending")
    .lt("hold_expires_at", now)
    .select("id");
  if (error) throw new Error(`Could not release expired booking holds: ${error.message}`);
  return data?.length ?? 0;
}

export async function assertBookingHoldQuota(email: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new BookingConfigurationError(
      "Booking storage is not configured. Please contact Sacred Hoof & Hand.",
    );
  }
  await expirePendingBookingHolds();

  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date().toISOString();
  const { count: activeHoldCount, error } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("client_email", normalizedEmail)
    .eq("status", "pending")
    .gt("hold_expires_at", now);
  if (error) {
    throw new Error(`Could not verify active booking holds: ${error.message}`);
  }
  if ((activeHoldCount ?? 0) >= MAX_ACTIVE_HOLDS_PER_EMAIL) {
    throw new BookingConflictError(
      "You already have active checkout reservations. Complete or cancel one before choosing another time.",
    );
  }
}

/**
 * Reserves a slot before redirecting to Stripe. The database exclusion
 * constraint makes concurrent attempts deterministic: one hold wins and the
 * other receives a friendly conflict response.
 */
export async function createBookingHold(
  input: BookingHoldInput,
): Promise<BookingHold> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new BookingConfigurationError(
      "Booking storage is not configured. Please contact Sacred Hoof & Hand.",
    );
  }

  const normalizedEmail = input.client_email.trim().toLowerCase();
  await assertBookingHoldQuota(normalizedEmail);

  const manageToken = randomBytes(32).toString("base64url");
  const holdExpiresAt = new Date(
    Date.now() + HOLD_MINUTES * 60_000,
  ).toISOString();
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      service_id: input.service_id,
      service_name: input.service_name,
      client_name: input.client_name,
      client_email: normalizedEmail,
      client_phone: input.client_phone || null,
      client_timezone: input.client_timezone || null,
      notes: input.notes || null,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      status: "pending",
      amount_cents: input.amount_cents,
      original_amount_cents: input.original_amount_cents,
      discount_code: input.discount_code || null,
      discount_percent: input.discount_percent ?? 0,
      agreement_id: input.agreement_id,
      manage_token_hash: hashManageToken(manageToken),
      hold_expires_at: holdExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    if (isOverlapError(error)) {
      throw new BookingConflictError(
        "That time was just reserved by someone else. Please choose another.",
      );
    }
    throw new Error(`Could not reserve appointment: ${error.message}`);
  }

  return {
    appointment: data as Appointment,
    manageToken,
    holdExpiresAt,
  };
}

export async function attachStripeSession(
  appointmentId: string,
  stripeSessionId: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new BookingConfigurationError("Booking storage is not configured.");
  const { error } = await supabase
    .from("appointments")
    .update({
      stripe_session_id: stripeSessionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .eq("status", "pending");
  if (error) throw new Error(`Could not attach payment session: ${error.message}`);
}

export async function releaseBookingHold(appointmentId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("appointments")
    .update({
      status: "cancelled",
      hold_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .eq("status", "pending");
  if (error) console.error("[booking] could not release failed checkout hold", error);
}

type FinalizePayment = {
  stripeSessionId: string | null;
  amountCents?: number | null;
};

/**
 * Converts a pending hold into a confirmed appointment and sends both
 * confirmations. Safe against duplicate Stripe webhook delivery.
 */
export async function finalizeBookingHold(
  appointmentId: string,
  manageToken: string,
  payment: FinalizePayment,
): Promise<{ appointment: Appointment; alreadyConfirmed: boolean }> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new BookingConfigurationError("Booking storage is not configured.");
  }

  const { data: existing, error: fetchError } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .single();
  if (fetchError || !existing) {
    throw new Error(
      `Could not find the reserved appointment: ${fetchError?.message ?? "not found"}`,
    );
  }

  const current = existing as Appointment;
  if (!tokenMatches(manageToken, current.manage_token_hash)) {
    throw new Error("Booking token verification failed.");
  }

  if (current.status === "confirmed" || current.status === "completed") {
    if (!current.confirmation_sent_at) {
      try {
        await deliverBookingConfirmation(current, manageToken);
      } catch (error) {
        console.error("[booking] confirmation delivery failed", error);
        throw new BookingNotificationError(
          "The appointment is confirmed, but its confirmation email is delayed.",
        );
      }
    }
    return { appointment: current, alreadyConfirmed: true };
  }
  if (current.status !== "pending") {
    throw new Error(
      `Reserved appointment cannot be confirmed from status "${current.status}".`,
    );
  }

  const now = new Date().toISOString();
  const finalAmount =
    typeof payment.amountCents === "number"
      ? payment.amountCents
      : current.amount_cents;
  const { data: confirmed, error: updateError } = await supabase
    .from("appointments")
    .update({
      status: "confirmed",
      amount_cents: finalAmount,
      stripe_session_id: payment.stripeSessionId,
      hold_expires_at: null,
      updated_at: now,
    })
    .eq("id", appointmentId)
    .eq("status", "pending")
    .select("*")
    .single();

  if (updateError || !confirmed) {
    if (updateError && isOverlapError(updateError)) {
      throw new BookingConflictError(
        "The paid appointment conflicts with another confirmed booking.",
      );
    }
    throw new Error(
      `Could not confirm appointment: ${updateError?.message ?? "unknown error"}`,
    );
  }

  const appointment = confirmed as Appointment;
  const { error: eventError } = await supabase.from("appointment_events").insert({
    appointment_id: appointment.id,
    event_type: "booked",
    actor: "system",
    new_starts_at: appointment.starts_at,
    new_ends_at: appointment.ends_at,
  });
  if (eventError) {
    console.error("[booking] could not write booking audit event", eventError);
  }

  try {
    await deliverBookingConfirmation(appointment, manageToken);
  } catch (error) {
    console.error("[booking] confirmation delivery failed", error);
    throw new BookingNotificationError(
      "The appointment is confirmed, but its confirmation email is delayed.",
    );
  }

  return { appointment, alreadyConfirmed: false };
}

/**
 * Compatibility path for Stripe sessions created by the previous checkout
 * implementation and for the zero-configuration local demo.
 */
export async function createConfirmedAppointment(
  meta: Record<string, string>,
  stripeSessionId: string | null,
) {
  const supabase = createSupabaseAdminClient();
  const manageToken = randomBytes(32).toString("base64url");
  let appointment: Appointment | null = null;

  if (supabase) {
    if (stripeSessionId) {
      const { data: duplicate } = await supabase
        .from("appointments")
        .select("*")
        .eq("stripe_session_id", stripeSessionId)
        .maybeSingle();
      if (duplicate) {
        const existing = duplicate as Appointment;
        if (!existing.confirmation_sent_at) {
          await deliverBookingConfirmation(existing);
        }
        return existing;
      }
    }

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        service_id: meta.service_id,
        service_name: meta.service_name,
        client_name: meta.client_name,
        client_email: meta.client_email.trim().toLowerCase(),
        client_phone: meta.client_phone || null,
        client_timezone: meta.client_timezone || null,
        notes: meta.notes || null,
        starts_at: meta.starts_at,
        ends_at: meta.ends_at,
        status: "confirmed",
        amount_cents: Number(meta.amount_cents),
        original_amount_cents: Number(
          meta.original_amount_cents ?? meta.amount_cents,
        ),
        discount_code: meta.discount_code || null,
        discount_percent: Number(meta.discount_percent ?? 0),
        stripe_session_id: stripeSessionId,
        manage_token_hash: hashManageToken(manageToken),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) {
      if (isOverlapError(error)) throw new BookingConflictError(error.message);
      throw new Error(`Could not create appointment: ${error.message}`);
    }
    appointment = data as Appointment;
  }

  if (appointment) {
    await deliverBookingConfirmation(appointment, manageToken);
  } else {
    await sendBookingEmails({
      client_name: meta.client_name,
      client_email: meta.client_email,
      service_name: meta.service_name,
      starts_at: meta.starts_at,
      ends_at: meta.ends_at,
      amount_cents: Number(meta.amount_cents),
      notes: meta.notes || null,
      client_timezone: meta.client_timezone || null,
    });
  }

  return appointment;
}
