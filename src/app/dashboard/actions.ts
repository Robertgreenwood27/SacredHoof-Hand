"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireDashboardSession } from "@/lib/auth-server";
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
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
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
