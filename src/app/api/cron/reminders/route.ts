import { NextResponse } from "next/server";
import { subMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { env, emailConfigured } from "@/lib/env";
import { BUSINESS_TIMEZONE } from "@/lib/content";
import {
  sendReminderEmails,
  type EmailRecipients,
} from "@/lib/email";
import { expirePendingBookingHolds } from "@/lib/booking";
import type { Appointment } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
type Recipient = "client" | "practitioner";

const REMINDER_LEASE_MINUTES = 15;
const recipientColumns = {
  client: {
    claimed: "client_reminder_claimed_at",
    sent: "client_reminder_sent_at",
  },
  practitioner: {
    claimed: "practitioner_reminder_claimed_at",
    sent: "practitioner_reminder_sent_at",
  },
} as const;

function addCalendarDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function authorized(request: Request): boolean {
  if (!env.cronSecret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${env.cronSecret}`;
}

async function releaseClaim(
  supabase: AdminClient,
  appointmentId: string,
  recipient: Recipient,
  claimAt: string,
): Promise<void> {
  const claimColumn = recipientColumns[recipient].claimed;
  const { error } = await supabase
    .from("appointments")
    .update({ [claimColumn]: null })
    .eq("id", appointmentId)
    .eq(claimColumn, claimAt);
  if (error) {
    console.error(
      `[reminders] could not release ${recipient} claim for ${appointmentId}`,
      error,
    );
  }
}

/**
 * Claims one recipient before sending. The status + start-time predicates stop
 * an old cron snapshot from claiming a rescheduled or cancelled appointment.
 * Stale leases are reclaimable after a crashed invocation.
 */
async function claimRecipient(
  supabase: AdminClient,
  appointment: Appointment,
  recipient: Recipient,
): Promise<string | null> {
  const { claimed: claimColumn, sent: sentColumn } =
    recipientColumns[recipient];
  const claimAt = new Date().toISOString();
  const staleBefore = subMinutes(
    new Date(),
    REMINDER_LEASE_MINUTES,
  ).toISOString();
  const { data, error } = await supabase
    .from("appointments")
    .update({ [claimColumn]: claimAt })
    .eq("id", appointment.id)
    .eq("status", "confirmed")
    .eq("starts_at", appointment.starts_at)
    .is(sentColumn, null)
    .or(`${claimColumn}.is.null,${claimColumn}.lt.${staleBefore}`)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not claim ${recipient} reminder: ${error.message}`);
  }
  if (!data) return null;

  // Re-check immediately before delivery in case a management action raced the
  // claim. A later reschedule uses a different provider idempotency key.
  const { data: current, error: currentError } = await supabase
    .from("appointments")
    .select("status, starts_at")
    .eq("id", appointment.id)
    .maybeSingle();
  if (
    currentError ||
    !current ||
    current.status !== "confirmed" ||
    current.starts_at !== appointment.starts_at
  ) {
    await releaseClaim(supabase, appointment.id, recipient, claimAt);
    if (currentError) {
      throw new Error(
        `Could not re-check ${recipient} reminder: ${currentError.message}`,
      );
    }
    return null;
  }

  return claimAt;
}

async function sendToRecipient(
  supabase: AdminClient,
  appointment: Appointment,
  recipient: Recipient,
): Promise<"sent" | "skipped" | "failed"> {
  const claimAt = await claimRecipient(supabase, appointment, recipient);
  if (!claimAt) return "skipped";

  const recipients: EmailRecipients = {
    client: recipient === "client",
    practitioner: recipient === "practitioner",
  };
  const delivery = await sendReminderEmails(
    {
      appointment_id: appointment.id,
      client_name: appointment.client_name,
      client_email: appointment.client_email,
      service_name: appointment.service_name,
      starts_at: appointment.starts_at,
      ends_at: appointment.ends_at,
      amount_cents: appointment.amount_cents,
      notes: appointment.notes,
      client_timezone: appointment.client_timezone,
    },
    recipients,
  );
  const delivered =
    recipient === "client"
      ? delivery.clientSent
      : delivery.practitionerSent;

  if (!delivered) {
    await releaseClaim(supabase, appointment.id, recipient, claimAt);
    return "failed";
  }

  const { claimed: claimColumn, sent: sentColumn } =
    recipientColumns[recipient];
  const sentAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("appointments")
    .update({
      [sentColumn]: sentAt,
      [claimColumn]: null,
    })
    .eq("id", appointment.id)
    .eq("status", "confirmed")
    .eq("starts_at", appointment.starts_at)
    .eq(claimColumn, claimAt)
    .is(sentColumn, null)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    // Resend receives a stable idempotency key, so a later retry will not send
    // this same appointment/start/recipient twice even if persistence failed.
    throw new Error(
      `Could not record ${recipient} reminder delivery: ${
        error?.message ?? "appointment changed during delivery"
      }`,
    );
  }
  return "sent";
}

async function completeReminder(
  supabase: AdminClient,
  appointment: Appointment,
): Promise<boolean> {
  const completedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("appointments")
    .update({ reminder_sent_at: completedAt })
    .eq("id", appointment.id)
    .eq("status", "confirmed")
    .eq("starts_at", appointment.starts_at)
    .is("reminder_sent_at", null)
    .not("client_reminder_sent_at", "is", null)
    .not("practitioner_reminder_sent_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error) {
    throw new Error(`Could not complete reminder: ${error.message}`);
  }
  if (!data) return false;

  const { error: eventError } = await supabase
    .from("appointment_events")
    .insert({
      appointment_id: appointment.id,
      event_type: "reminder_sent",
      actor: "system",
      new_starts_at: appointment.starts_at,
      new_ends_at: appointment.ends_at,
    });
  if (eventError) {
    console.error("[reminders] could not write reminder audit event", eventError);
  }
  return true;
}

/**
 * Runs once each morning and includes every unsent confirmed appointment on
 * tomorrow's calendar date in the practitioner's timezone. Per-recipient
 * leases plus Resend idempotency keys make retries safe and allow partial
 * delivery recovery.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!emailConfigured) {
    return NextResponse.json(
      { error: "Email delivery is not configured." },
      { status: 503 },
    );
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Booking storage is not configured." },
      { status: 503 },
    );
  }

  await expirePendingBookingHolds();

  const now = new Date();
  const today = formatInTimeZone(
    now,
    BUSINESS_TIMEZONE,
    "yyyy-MM-dd",
  );
  const reminderDay = addCalendarDays(today, 1);
  const dayAfterReminder = addCalendarDays(today, 2);
  const from = fromZonedTime(
    `${reminderDay}T00:00:00`,
    BUSINESS_TIMEZONE,
  ).toISOString();
  const to = fromZonedTime(
    `${dayAfterReminder}T00:00:00`,
    BUSINESS_TIMEZONE,
  ).toISOString();
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("status", "confirmed")
    .gte("starts_at", from)
    .lt("starts_at", to)
    .or(
      "client_reminder_sent_at.is.null,practitioner_reminder_sent_at.is.null",
    )
    .order("starts_at", { ascending: true })
    .limit(100);

  if (error) {
    console.error("[reminders] could not load appointments", error);
    return NextResponse.json(
      { error: "Could not load reminders." },
      { status: 500 },
    );
  }

  let recipientDeliveries = 0;
  let completed = 0;
  const failures: string[] = [];
  for (const raw of data ?? []) {
    const appointment = raw as Appointment;
    for (const recipient of ["client", "practitioner"] as const) {
      const sentColumn = recipientColumns[recipient].sent;
      if (appointment[sentColumn]) continue;
      try {
        const result = await sendToRecipient(
          supabase,
          appointment,
          recipient,
        );
        if (result === "sent") recipientDeliveries += 1;
        if (result === "failed") failures.push(`${appointment.id}:${recipient}`);
      } catch (reminderError) {
        console.error(
          `[reminders] ${recipient} failed for appointment ${appointment.id}`,
          reminderError,
        );
        failures.push(`${appointment.id}:${recipient}`);
      }
    }

    try {
      if (await completeReminder(supabase, appointment)) completed += 1;
    } catch (completionError) {
      console.error(
        `[reminders] completion failed for appointment ${appointment.id}`,
        completionError,
      );
      failures.push(`${appointment.id}:completion`);
    }
  }

  return NextResponse.json({
    checked: data?.length ?? 0,
    recipientDeliveries,
    completed,
    failures,
    window: {
      businessDate: reminderDay,
      timeZone: BUSINESS_TIMEZONE,
      from,
      to,
    },
  });
}
