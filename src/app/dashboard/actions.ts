"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/lib/types";

async function requireClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase not configured.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");
  return supabase;
}

export async function updateHero(formData: FormData) {
  const supabase = await requireClient();
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
  const supabase = await requireClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function addAvailabilityRule(formData: FormData) {
  const supabase = await requireClient();
  const { error } = await supabase.from("availability_rules").insert({
    day_of_week: Number(formData.get("day_of_week")),
    start_time: String(formData.get("start_time")),
    end_time: String(formData.get("end_time")),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/availability");
}

export async function deleteAvailabilityRule(id: string) {
  const supabase = await requireClient();
  const { error } = await supabase.from("availability_rules").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/availability");
}
