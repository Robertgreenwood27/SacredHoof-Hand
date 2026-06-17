import "server-only";
import { createSupabaseAdminClient } from "./supabase/server";
import { sendBookingEmails } from "./email";

/**
 * Best-effort check for whether an email has already redeemed the free session.
 * Returns false when Supabase isn't configured (can't enforce, so allow).
 */
export async function hasUsedFreeSession(
  email: string,
  freeServiceId: string,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return false;

  const { data } = await supabase
    .from("appointments")
    .select("id")
    .eq("service_id", freeServiceId)
    .ilike("client_email", email)
    .neq("status", "cancelled")
    .limit(1);

  return Boolean(data && data.length > 0);
}

/**
 * Writes a confirmed appointment and fires both confirmation emails. Shared by
 * the Stripe webhook and the no-Stripe dev fallback in the checkout route.
 * Safe to call without Supabase configured (emails still attempt / log).
 */
export async function createConfirmedAppointment(
  meta: Record<string, string>,
  stripeSessionId: string | null,
) {
  const supabase = createSupabaseAdminClient();
  if (supabase) {
    await supabase.from("appointments").insert({
      service_id: meta.service_id,
      service_name: meta.service_name,
      client_name: meta.client_name,
      client_email: meta.client_email,
      client_phone: meta.client_phone || null,
      client_timezone: meta.client_timezone || null,
      notes: meta.notes || null,
      starts_at: meta.starts_at,
      ends_at: meta.ends_at,
      status: "confirmed",
      amount_cents: Number(meta.amount_cents),
      stripe_session_id: stripeSessionId,
    });
  }

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
