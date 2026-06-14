import type { HeroContent, Service } from "./types";

/**
 * Default content shipped with the site. The hero is overridable from the
 * dashboard (stored in Supabase `site_content`); these values are the fallback
 * shown before anything is customized or if Supabase isn't configured yet.
 */
export const DEFAULT_HERO: HeroContent = {
  eyebrow: "Reiki · Presence · Compassionate Connection",
  title: "Journey to the Known",
  subtitle:
    "Virtual and in-person Reiki sessions designed to help you reconnect with balance, clarity, and inner peace.",
  ctaLabel: "Book Your Session",
  imageUrl: "/horse-hero.webp",
};

/**
 * Starter service catalog. Swap pricing/durations freely — these also seed the
 * Stripe Checkout amounts. Prices are in cents (USD).
 */
export const DEFAULT_SERVICES: Service[] = [
  {
    id: "virtual-reiki",
    name: "Virtual Reiki Session",
    description:
      "A distance Reiki session from the comfort of your own space. We connect over video to set intentions, then move into guided energy work.",
    durationMinutes: 60,
    priceCents: 9000,
    location: "virtual",
    active: true,
  },
  {
    id: "in-person-reiki",
    name: "In-Person Reiki Session",
    description:
      "A hands-on, in-person Reiki session in a calm, grounded setting designed to help you release tension and reconnect with balance.",
    durationMinutes: 75,
    priceCents: 12000,
    location: "in-person",
    active: true,
  },
  {
    id: "intro-reiki",
    name: "Intro Mini Session",
    description:
      "New to Reiki? A shorter session to experience the practice and feel into what resonates before committing to a full session.",
    durationMinutes: 30,
    priceCents: 5000,
    location: "both",
    active: true,
  },
];

/**
 * Limited-time FREE intro session promotion.
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
  badge: "Limited time · Free",
  /** Allow only one free session per email address (best-effort, needs Supabase). */
  onePerClient: true,
  service: {
    id: "free-intro",
    name: "Complimentary Intro Session",
    description:
      "New here? Enjoy your first Reiki session on the house — a gentle 20-minute introduction to experience the practice and feel into what resonates. No payment needed.",
    durationMinutes: 20,
    priceCents: 0,
    location: "both" as const,
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
    title: "Horse-Assisted Reiki",
    description:
      "Energy work alongside horses — partners whose presence invites deep regulation, trust, and embodied healing.",
  },
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
