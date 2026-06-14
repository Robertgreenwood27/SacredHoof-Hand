import "server-only";
import { createSupabaseServerClient } from "./supabase/server";
import {
  DEFAULT_HERO,
  DEFAULT_SERVICES,
  FREE_SESSION_OFFER,
  isFreeSessionActive,
} from "./content";
import type {
  AvailabilityRule,
  HeroContent,
  Service,
  Appointment,
} from "./types";

/**
 * Hero content from Supabase `site_content` (singleton row id=1), falling back
 * to DEFAULT_HERO when Supabase isn't configured or the row doesn't exist yet.
 */
export async function getHeroContent(): Promise<HeroContent> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return DEFAULT_HERO;

  const { data, error } = await supabase
    .from("site_content")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return DEFAULT_HERO;

  return {
    eyebrow: data.hero_eyebrow ?? DEFAULT_HERO.eyebrow,
    title: data.hero_title ?? DEFAULT_HERO.title,
    subtitle: data.hero_subtitle ?? DEFAULT_HERO.subtitle,
    ctaLabel: data.hero_cta_label ?? DEFAULT_HERO.ctaLabel,
    imageUrl: data.hero_image_url ?? DEFAULT_HERO.imageUrl,
  };
}

/**
 * Active services. The limited-time free session (when active) is prepended so
 * it's always bookable regardless of what's in the DB. Paid services come from
 * Supabase, falling back to the seeded catalog.
 */
export async function getServices(): Promise<Service[]> {
  const freeSession = isFreeSessionActive() ? [FREE_SESSION_OFFER.service] : [];

  const supabase = await createSupabaseServerClient();
  if (!supabase) return [...freeSession, ...DEFAULT_SERVICES];

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("active", true)
    .order("price_cents", { ascending: true });

  if (error || !data || data.length === 0) {
    return [...freeSession, ...DEFAULT_SERVICES];
  }

  const paid = data.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.duration_minutes,
    priceCents: s.price_cents,
    location: s.location,
    active: s.active,
  }));

  return [...freeSession, ...paid];
}

export async function getServiceById(id: string): Promise<Service | null> {
  const services = await getServices();
  return services.find((s) => s.id === id) ?? null;
}

/** Weekly availability rules. Empty array if not configured. */
export async function getAvailabilityRules(): Promise<AvailabilityRule[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return DEFAULT_AVAILABILITY;

  const { data, error } = await supabase
    .from("availability_rules")
    .select("*")
    .order("day_of_week", { ascending: true });

  if (error || !data || data.length === 0) return DEFAULT_AVAILABILITY;
  return data;
}

/** Booked (non-cancelled) appointments within a window, for slot conflicts. */
export async function getBookedAppointments(
  fromIso: string,
  toIso: string,
): Promise<Pick<Appointment, "starts_at" | "ends_at">[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("appointments")
    .select("starts_at, ends_at")
    .neq("status", "cancelled")
    .gte("starts_at", fromIso)
    .lte("starts_at", toIso);

  if (error || !data) return [];
  return data;
}

/** Sensible default open hours so the booking calendar isn't empty pre-config. */
const DEFAULT_AVAILABILITY: AvailabilityRule[] = [
  { id: "d1", day_of_week: 1, start_time: "10:00", end_time: "16:00" },
  { id: "d2", day_of_week: 2, start_time: "10:00", end_time: "16:00" },
  { id: "d3", day_of_week: 3, start_time: "10:00", end_time: "16:00" },
  { id: "d4", day_of_week: 4, start_time: "10:00", end_time: "16:00" },
  { id: "d5", day_of_week: 5, start_time: "10:00", end_time: "14:00" },
];
