import "server-only";
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "./supabase/server";
import {
  DEFAULT_EVENT_SLOTS,
  DEFAULT_HERO,
  DEFAULT_SERVICES,
  FREE_SESSION_OFFER,
  isFreeSessionActive,
} from "./content";
import type {
  AvailabilityRule,
  BlockedDay,
  EventSlot,
  HeroContent,
  Service,
  SessionKind,
  Appointment,
} from "./types";

const isProduction = process.env.NODE_ENV === "production";

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
  if (!supabase) {
    if (isProduction) {
      throw new Error("Service catalog storage is not configured.");
    }
    return [...freeSession, ...DEFAULT_SERVICES];
  }

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("active", true)
    .order("price_cents", { ascending: true });

  if (error) {
    if (isProduction) {
      throw new Error(`Could not load the service catalog: ${error.message}`);
    }
    return [...freeSession, ...DEFAULT_SERVICES];
  }
  if (!data || data.length === 0) {
    return isProduction ? freeSession : [...freeSession, ...DEFAULT_SERVICES];
  }

  const paid = data.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.duration_minutes,
    priceCents: s.price_cents,
    location: s.location,
    // Databases that predate the equine programme have no session_kind column.
    kind: (s.session_kind ?? "standard") as SessionKind,
    active: s.active,
  }));

  return [...freeSession, ...paid];
}

export async function getServiceById(id: string): Promise<Service | null> {
  const services = await getServices();
  return services.find((s) => s.id === id) ?? null;
}

/**
 * Explicitly scheduled event slots (the horse days). Unlike the weekly rules
 * these are dated, so past rows are filtered out rather than repeating.
 */
export async function getEventSlots(
  sessionKind: SessionKind = "equine",
): Promise<EventSlot[]> {
  const fallback = DEFAULT_EVENT_SLOTS.filter(
    (slot) => slot.session_kind === sessionKind,
  ).map((slot, index) => ({ id: `default-${index}`, ...slot }));

  const supabase = await createSupabaseServerClient();
  if (!supabase) return isProduction ? [] : fallback;

  const { data, error } = await supabase
    .from("event_slots")
    .select("id, session_kind, day, start_time, duration_minutes")
    .eq("session_kind", sessionKind)
    .order("day", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error("[event slots] could not load schedule", error);
    return isProduction ? [] : fallback;
  }
  if (!data || data.length === 0) {
    return isProduction ? [] : fallback;
  }
  return data as EventSlot[];
}

/** Weekly availability rules. Empty array if not configured. */
export async function getAvailabilityRules(): Promise<AvailabilityRule[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return isProduction ? [] : DEFAULT_AVAILABILITY;

  const { data, error } = await supabase
    .from("availability_rules")
    .select("*")
    .order("day_of_week", { ascending: true });

  if (error) {
    if (isProduction) {
      console.error("[availability] could not load rules", error);
      return [];
    }
    return DEFAULT_AVAILABILITY;
  }
  if (!data || data.length === 0) {
    return isProduction ? [] : DEFAULT_AVAILABILITY;
  }
  return data;
}

/**
 * Full days the practitioner has blocked off (taken as days off), each a
 * "YYYY-MM-DD" date key in the business timezone, ordered ascending. Empty
 * array if not configured or if Supabase isn't set up.
 */
export async function getBlockedDays(): Promise<BlockedDay[]> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    if (isProduction) {
      throw new Error("Private schedule storage is not configured.");
    }
    return [];
  }

  const { data, error } = await supabase
    .from("blocked_days")
    .select("day, reason")
    .order("day", { ascending: true });

  if (error || !data) {
    if (isProduction) {
      throw new Error(
        `Could not verify blocked schedule days: ${error?.message ?? "unknown error"}`,
      );
    }
    return [];
  }
  return data;
}

/**
 * Booked (non-cancelled) appointments within a window, for slot conflicts.
 * Uses the secret/admin client because RLS keeps the appointments table private
 * — only the times are returned here, never client details, and this runs
 * server-side so the secret key never reaches the browser.
 */
export async function getBookedAppointments(
  fromIso: string,
  toIso: string,
  excludeAppointmentId?: string,
): Promise<Pick<Appointment, "starts_at" | "ends_at">[]> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    if (isProduction) {
      throw new Error("Private appointment storage is not configured.");
    }
    return [];
  }

  let query = supabase
    .from("appointments")
    .select("id, starts_at, ends_at, status, hold_expires_at")
    .neq("status", "cancelled")
    // Any appointment whose range overlaps the requested window.
    .lt("starts_at", toIso)
    .gt("ends_at", fromIso);

  if (excludeAppointmentId) {
    query = query.neq("id", excludeAppointmentId);
  }

  const { data, error } = await query;
  if (error || !data) {
    throw new Error(
      `Could not verify booked appointments: ${error?.message ?? "unknown error"}`,
    );
  }

  const now = Date.now();
  return data
    .filter(
      (appointment) =>
        appointment.status !== "pending" ||
        (appointment.hold_expires_at &&
          new Date(appointment.hold_expires_at).getTime() > now),
    )
    .map(({ starts_at, ends_at }) => ({ starts_at, ends_at }));
}

/**
 * Default open hours so the booking calendar isn't empty pre-config.
 * Sun & Mon: all day. Tue–Sat: 5pm–midnight. ("24:00" = midnight end of day.)
 */
const DEFAULT_AVAILABILITY: AvailabilityRule[] = [
  { id: "d0", day_of_week: 0, start_time: "00:00", end_time: "24:00" }, // Sunday
  { id: "d1", day_of_week: 1, start_time: "00:00", end_time: "24:00" }, // Monday
  { id: "d2", day_of_week: 2, start_time: "17:00", end_time: "24:00" }, // Tuesday
  { id: "d3", day_of_week: 3, start_time: "17:00", end_time: "24:00" }, // Wednesday
  { id: "d4", day_of_week: 4, start_time: "17:00", end_time: "24:00" }, // Thursday
  { id: "d5", day_of_week: 5, start_time: "17:00", end_time: "24:00" }, // Friday
  { id: "d6", day_of_week: 6, start_time: "17:00", end_time: "24:00" }, // Saturday
];
