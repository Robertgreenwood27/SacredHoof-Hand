"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireDashboardSession } from "@/lib/auth-server";
import {
  cancelAppointment,
  rescheduleAppointment,
} from "@/lib/appointment-management";
import { BOOKING_PROMOTION_PERCENTAGES } from "@/lib/promotion";
import type { AppointmentStatus } from "@/lib/types";

/**
 * Guard + privileged client. Access is protected by the dashboard session
 * (middleware + this check), so writes go through the service/secret key which
 * bypasses Row Level Security.
 */
async function requireAdmin() {
  await requireDashboardSession();
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error(
      "Supabase isn't fully configured (missing URL or secret key).",
    );
  }
  return supabase;
}

export async function updateHero(formData: FormData) {
  const supabase = await requireAdmin();
  const payload = {
    id: 1,
    hero_eyebrow: String(formData.get("eyebrow") ?? ""),
    hero_title: String(formData.get("title") ?? ""),
    hero_subtitle: String(formData.get("subtitle") ?? ""),
    hero_cta_label: String(formData.get("ctaLabel") ?? ""),
    hero_image_url: String(formData.get("imageUrl") ?? ""),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("site_content").upsert(payload);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/dashboard/hero");
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus) {
  if (status === "cancelled") {
    await requireDashboardSession();
    await cancelAppointment(id, "practitioner");
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/appointments/${id}`);
    return;
  }

  // Payment confirmation belongs exclusively to the verified Stripe webhook
  // (or the direct/free booking finalizer). The dashboard may only complete an
  // appointment that is already confirmed.
  if (status !== "completed") {
    throw new Error("This appointment status cannot be changed manually.");
  }

  const supabase = await requireAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "confirmed")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("Only confirmed appointments can be marked complete.");
  }
  const { error: eventError } = await supabase
    .from("appointment_events")
    .insert({
      appointment_id: id,
      event_type: "completed",
      actor: "practitioner",
    });
  if (eventError) {
    console.error("[dashboard] completion audit failed", eventError);
  }
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/appointments/${id}`);
}

export async function rescheduleDashboardAppointment(
  id: string,
  formData: FormData,
) {
  await requireDashboardSession();
  let errorMessage: string | null = null;
  let notificationsDelivered = false;
  try {
    const result = await rescheduleAppointment(
      id,
      String(formData.get("startsAt") ?? ""),
      String(formData.get("endsAt") ?? ""),
      "practitioner",
    );
    notificationsDelivered = result.notificationsDelivered;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Could not reschedule appointment.";
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/appointments/${id}`);
  if (errorMessage) {
    redirect(
      `/dashboard/appointments/${encodeURIComponent(id)}?error=${encodeURIComponent(errorMessage)}`,
    );
  }
  redirect(
    `/dashboard/appointments/${encodeURIComponent(id)}?updated=1${
      notificationsDelivered ? "" : "&delivery=delayed"
    }`,
  );
}

export async function cancelDashboardAppointment(id: string) {
  await requireDashboardSession();
  let errorMessage: string | null = null;
  let notificationsDelivered = false;
  try {
    const result = await cancelAppointment(id, "practitioner");
    notificationsDelivered = result.notificationsDelivered;
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Could not cancel appointment.";
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/appointments/${id}`);
  if (errorMessage) {
    redirect(
      `/dashboard/appointments/${encodeURIComponent(id)}?error=${encodeURIComponent(errorMessage)}`,
    );
  }
  redirect(
    `/dashboard/appointments/${encodeURIComponent(id)}?cancelled=1${
      notificationsDelivered ? "" : "&delivery=delayed"
    }`,
  );
}

export async function addAvailabilityRule(formData: FormData) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("availability_rules").insert({
    day_of_week: Number(formData.get("day_of_week")),
    start_time: String(formData.get("start_time")),
    end_time: String(formData.get("end_time")),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/availability");
}

export async function deleteAvailabilityRule(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("availability_rules").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/availability");
}

export async function blockDay(formData: FormData) {
  const supabase = await requireAdmin();
  const day = String(formData.get("day") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error("Please pick a valid date to block off.");
  }
  const reason = String(formData.get("reason") ?? "").trim();
  // upsert so re-blocking an already-blocked day is a no-op, not an error.
  const { error } = await supabase
    .from("blocked_days")
    .upsert({ day, reason: reason || null });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/availability");
  revalidatePath("/book");
}

export async function unblockDay(day: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("blocked_days").delete().eq("day", day);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/availability");
  revalidatePath("/book");
}

export async function setPromotionEnabled(
  discountPercent: number,
  enabled: boolean,
) {
  if (typeof enabled !== "boolean") {
    throw new Error("The promotion status is invalid.");
  }
  if (
    !BOOKING_PROMOTION_PERCENTAGES.includes(
      discountPercent as (typeof BOOKING_PROMOTION_PERCENTAGES)[number],
    )
  ) {
    throw new Error("That promotion cannot be changed.");
  }

  const supabase = await requireAdmin();
  const { data, error } = await supabase
    .from("booking_promotions")
    .update({
      enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("discount_percent", discountPercent)
    .select("discount_percent")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(
      "That promotion is not configured. Run the latest Supabase schema.",
    );
  }

  revalidatePath("/dashboard/promotions");
}
