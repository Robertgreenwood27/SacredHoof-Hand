import type { EventSlot, HeroContent, Service, SessionKind } from "./types";

/**
 * The practitioner's timezone. Availability hours are AUTHORED in this zone and
 * each slot is stored as a timezone-neutral UTC instant. Clients see times
 * converted to their OWN browser timezone (scheduler + their confirmation
 * email); the practitioner's view (dashboard + her notification email) stays in
 * this zone. Change this if she relocates.
 */
export const BUSINESS_TIMEZONE = "America/Denver"; // Mountain Time
/** Short label for the practitioner-facing (Mountain) views. */
export const BUSINESS_TZ_LABEL = "Mountain Time";

/**
 * Minimum notice before a session can be booked, in hours. Slots starting
 * sooner than this are hidden. Set to 2 so same-day booking works while still
 * giving a little lead time — set to 0 to allow booking right up to the slot.
 */
export const BOOKING_LEAD_HOURS = 2;

/**
 * Default content shipped with the site. The hero is overridable from the
 * dashboard (stored in Supabase `site_content`); these values are the fallback
 * shown before anything is customized or if Supabase isn't configured yet.
 */
export const DEFAULT_HERO: HeroContent = {
  eyebrow: "Reiki · Horses · Sacred Sanctuary",
  title: "Reconnect. Restore. Remember.",
  subtitle:
    "Reiki with Shelby — virtual, in person, and out in the field alongside the horses. A quiet place to set down what you are carrying and remember who you are.",
  ctaLabel: "Book Your Session",
  imageUrl: "/horse-hero.webp",
};

/**
 * Service catalog. Prices are in cents (USD) and seed the Stripe Checkout
 * amounts. `kind` decides how a session is scheduled: `standard` sessions use
 * the weekly availability rules, `equine` sessions are only offered on the
 * dates in `DEFAULT_EVENT_SLOTS` / the `event_slots` table.
 *
 * These are the founding rates. Production reads the `services` table, so
 * changing a price here also needs the matching update in supabase/schema.sql.
 */
export const DEFAULT_SERVICES: Service[] = [
  {
    id: "reiki-30",
    name: "30-Minute Reiki",
    description:
      "A focused half-hour of energy work — enough to settle the nervous system, release what you are holding, and come back to center.",
    durationMinutes: 30,
    priceCents: 3300,
    location: "both",
    kind: "standard",
    active: true,
  },
  {
    id: "reiki-60",
    name: "60-Minute Reiki",
    description:
      "The full session. We begin by setting intentions together, then move into unhurried Reiki with time afterward to land before you go back out into your day.",
    durationMinutes: 60,
    priceCents: 5500,
    location: "both",
    kind: "standard",
    active: true,
  },
  {
    id: "reiki-90",
    name: "90-Minute Reiki",
    description:
      "A longer, deeper session for when you need more room — space to work slowly through what has been stored, without watching the clock.",
    durationMinutes: 90,
    priceCents: 11100,
    location: "both",
    kind: "standard",
    active: true,
  },
  {
    id: "equine-30",
    name: "30 Minutes with the Horses",
    description:
      "A half hour of Reiki in the field alongside the herd. Horses regulate the people around them — being near them does part of the work before the session even begins.",
    durationMinutes: 30,
    priceCents: 7700,
    location: "in-person",
    kind: "equine",
    active: true,
  },
  {
    id: "equine-60",
    name: "60 Minutes with the Horses",
    description:
      "An hour of equine-assisted Reiki. Time to meet the herd, let your body settle into their pace, and receive energy work in their presence.",
    durationMinutes: 60,
    priceCents: 9900,
    location: "in-person",
    kind: "equine",
    active: true,
  },
  {
    id: "equine-90",
    name: "90 Minutes with the Horses",
    description:
      "The longest session on the land. Unhurried time with the herd — enough that the horses stop reading you as a visitor and the work can go somewhere deeper.",
    durationMinutes: 90,
    priceCents: 11100,
    location: "in-person",
    kind: "equine",
    active: true,
  },
];

/** Service ids whose sessions happen out at the herd. */
export function isEquineServiceId(serviceId: string | null | undefined): boolean {
  if (!serviceId) return false;
  const service = DEFAULT_SERVICES.find((s) => s.id === serviceId);
  if (service) return service.kind === "equine";
  // Services added later in Supabase follow the same id convention.
  return serviceId.startsWith("equine-");
}

/**
 * The full slate of starts on a herd day, in the business timezone.
 *
 * The 60 and the 90 at each of the first two starts are ALTERNATIVES, not extra
 * capacity: they overlap, so booking either one removes the other from the
 * calendar. Each 90 uses only the buffer that already followed its 60 (08:00
 * ends at 09:30, 09:30 ends at 11:00), so choosing the longer session never
 * moves anything later in the day.
 */
const HERD_DAY_STARTS = [
  ["08:00", 60],
  ["08:00", 90],
  ["09:30", 60],
  ["09:30", 90],
  ["11:00", 30],
  ["12:00", 60],
  ["13:40", 60],
  ["15:00", 30],
] as const;

/**
 * The horse days. Equine sessions are NOT offered on the weekly schedule — each
 * one is a specific start time on a specific date, and a slot can only be
 * booked by a service of exactly that length.
 *
 * Only CONFIRMED dates belong here. A date the practitioner has not locked in
 * with the herd owner stays commented out below: anything listed is publicly
 * bookable, and taking a booking back is far worse than opening a date late.
 * Confirming one is uncommenting a line here and running the matching insert in
 * supabase/schema.sql — production reads that table, never this list.
 *
 * `notBefore` trims a day the practitioner only has the herd for part of.
 */
const HERD_DAYS: { day: string; notBefore?: string }[] = [
  // Confirmed, but the herd is not available first thing — 08:00 starts are out.
  { day: "2026-09-27", notBefore: "09:00" },

  // Penciled in, NOT yet confirmed. Uncomment as each is agreed:
  // { day: "2026-10-25" },
  // { day: "2026-11-21" },
  // { day: "2026-12-19" },
];

export const DEFAULT_EVENT_SLOTS: Omit<EventSlot, "id">[] = HERD_DAYS.flatMap(
  ({ day, notBefore }) =>
    HERD_DAY_STARTS
      // Zero-padded "HH:MM" compares correctly as a string.
      .filter(([start_time]) => !notBefore || start_time >= notBefore)
      .map(([start_time, duration_minutes]) => ({
        session_kind: "equine" as SessionKind,
        day,
        start_time,
        duration_minutes,
      })),
);

/**
 * Where the horse sessions happen. This is a private property, so it is only
 * shown after a booking is confirmed — the manage-booking page, the
 * confirmation email, and the reminder email. Never render it on a public page.
 */
export const EQUINE_LOCATION = {
  name: "Sacred Hoof & Hand — Fairplay",
  address: "186 Wooly Worm Ln, Fairplay, CO 80440",
  /** Shown publicly in place of the street address. */
  publicLabel: "Fairplay, Colorado",
  directions:
    "Pull straight down the entrance, then veer left and park up by the red indoor arena, in front of the horse trailers.",
  arrival:
    "Come as you are, in clothes and closed-toe shoes you do not mind getting dusty. Arriving ten minutes early gives you time to meet the herd before we begin.",
};

/**
 * FREE intro session promotion.
 *
 * To REMOVE the offer entirely, set `enabled: false` (the banner disappears and
 * it stops being bookable). You can also let it auto-expire by setting
 * `endsOn` to a date — after that date it turns itself off.
 */
export const FREE_SESSION_OFFER = {
  enabled: true,
  /** Set to an ISO date string (e.g. "2026-07-31") to auto-expire, or null for no end date. */
  endsOn: null as string | null,
  /** Small label shown on the badge. */
  badge: "Complimentary · 20 minutes",
  service: {
    id: "free-intro",
    name: "Complimentary Intro Session",
    description:
      "Enjoy a gentle 20-minute Reiki session on the house to experience the practice and feel into what resonates. Come back for another complimentary intro whenever you would like. No payment needed.",
    durationMinutes: 20,
    priceCents: 0,
    location: "both" as const,
    kind: "standard" as SessionKind,
    active: true,
  },
};

/** Whether the free-session promo is currently live (enabled and not expired). */
export function isFreeSessionActive(): boolean {
  if (!FREE_SESSION_OFFER.enabled) return false;
  if (FREE_SESSION_OFFER.endsOn) {
    return new Date() <= new Date(FREE_SESSION_OFFER.endsOn + "T23:59:59");
  }
  return true;
}

/** Services that are part of the future vision (shown but not yet bookable). */
export const FUTURE_OFFERINGS = [
  {
    title: "Sound Healing",
    description:
      "Immersive sound experiences that use vibration and resonance to quiet the mind and restore the nervous system.",
  },
  {
    title: "Retreat Offerings",
    description:
      "Multi-day gatherings woven from Reiki, ritual, and nature — space to slow down and remember yourself.",
  },
];

/**
 * The equine programme's mission. The nonprofit filing is in progress, so this
 * copy says "nonprofit in formation" and makes no claim about tax-deductible
 * gifts — see DONATION.disclaimer. Update both once the IRS determination
 * letter arrives.
 */
export const EQUINE_PROGRAM = {
  eyebrow: "A nonprofit in formation",
  title: "Where the horses do the teaching",
  lead:
    "The horse programme at Sacred Hoof & Hand is being organized as a nonprofit — holistic ecological connection alongside equine-assisted wellness, on land shared with the herd.",
  body:
    "Horses read what we carry before we have language for it. Standing with them slows the breath and softens the guard, and Reiki meets people in that opening. What the sessions raise goes back into the horses' care and into keeping this work available to the people who need it.",
  pillars: [
    {
      title: "Stress reduction",
      description:
        "Time alongside the herd settles an overworked nervous system. Reiki deepens that regulation into something you can carry home.",
    },
    {
      title: "Animal rehabilitation",
      description:
        "Horses arrive here needing their own healing. Gentle handling, patient rehabilitation, and a herd that teaches them safety again.",
    },
    {
      title: "Alternative wellness",
      description:
        "Reiki, presence, and ecological connection as a complement to the care you already receive — never a replacement for it.",
    },
  ],
};

/**
 * Donation configuration. Amounts are USD cents. Because the nonprofit
 * application has not yet been determined, the copy must not promise
 * tax deductibility.
 */
export const DONATION = {
  minCents: 500,
  maxCents: 1_000_000,
  presetsCents: [2500, 5000, 11100, 25000],
  defaultCents: 5000,
  disclaimer:
    "Sacred Hoof & Hand's equine programme is in the process of applying for nonprofit status. Gifts are not tax-deductible at this time, and we will say so plainly here the moment that changes.",
};

/**
 * Aftercare guidance included in the client's confirmation email. Edit the
 * wording here freely — it's her copy.
 */
export const AFTERCARE = {
  heading: "Caring for yourself after your session",
  body:
    "Reiki can start a cleansing process that affects the physical body as well " +
    "as the mind and emotions. Stored toxins may be released along with feels " +
    "and thought patterns that are no longer useful. Physical experiences to be " +
    "aware of include a headache, stomachache, weakness, or aches and pains. " +
    "These are effects of toxins being drawn out from stored areas in the body.",
  supportsIntro: "In the days that follow, be gentle with yourself. What can help:",
  supports: ["More rest", "Plenty of water", "Journaling", "Meditating", "Time in nature"],
};

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** Like formatPrice, but renders a free session as "Free". */
export function priceLabel(cents: number): string {
  return cents === 0 ? "Free" : formatPrice(cents);
}
