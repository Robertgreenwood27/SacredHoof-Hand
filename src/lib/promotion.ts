import "server-only";
import { env } from "./env";
import { createSupabaseAdminClient } from "./supabase/server";
import type { Service, SessionKind } from "./types";

/**
 * Which sessions a code may be redeemed against. `all` is site-wide; `equine`
 * restricts the code to the horse programme.
 */
export type PromotionScope = "all" | "equine";

export type BookingPromotion = {
  /** Stable identity of a promotion — codes are matched case-insensitively. */
  code: string;
  discountPercent: number;
  appliesTo: PromotionScope;
  enabled: boolean;
};

export type BookingPromotionConfiguration = {
  promotions: BookingPromotion[];
  /** False when the defaults are being used because storage is unavailable. */
  persisted: boolean;
};

export type PromotionResult = {
  applied: boolean;
  code: string | null;
  discountPercent: number;
  originalAmountCents: number;
  amountCents: number;
};

export class PromotionConfigurationError extends Error {}

const DEFAULT_BOOKING_PROMOTIONS: BookingPromotion[] = [
  { code: "SACRED20", discountPercent: 20, appliesTo: "all", enabled: true },
  { code: "SACRED50", discountPercent: 50, appliesTo: "all", enabled: true },
  { code: "SACRED85", discountPercent: 85, appliesTo: "all", enabled: true },
  {
    code: "#rescue&reiki",
    discountPercent: 20,
    appliesTo: "equine",
    enabled: true,
  },
];

/** Human-readable description of what a scope covers. */
export const PROMOTION_SCOPE_LABEL: Record<PromotionScope, string> = {
  all: "Every session",
  equine: "Horse sessions only",
};

function normalizeCode(code: string): string {
  return code.trim().toLocaleUpperCase("en-US");
}

function scopeCovers(scope: PromotionScope, kind: SessionKind): boolean {
  return scope === "all" || scope === kind;
}

/**
 * Loads the server-owned promotion configuration. Defaults keep local preview
 * usable before Supabase is connected; production should persist the seeded
 * rows from supabase/schema.sql so dashboard toggles take effect.
 */
export async function getBookingPromotionConfiguration(): Promise<BookingPromotionConfiguration> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return {
      promotions: DEFAULT_BOOKING_PROMOTIONS,
      persisted: false,
    };
  }

  // `select("*")` rather than naming applies_to: a database that has not run
  // the latest schema yet has no such column, and naming it would fail the
  // whole query and take every discount code offline until the migration runs.
  const { data, error } = await supabase
    .from("booking_promotions")
    .select("*")
    .order("discount_percent", { ascending: true });

  if (error) {
    console.error("[promotions] could not load dashboard configuration", error);
    return {
      promotions: DEFAULT_BOOKING_PROMOTIONS,
      persisted: false,
    };
  }

  return {
    promotions: (data ?? []).map((promotion) => ({
      code: promotion.code,
      discountPercent: promotion.discount_percent,
      // Databases predating scoped codes treat every code as site-wide.
      appliesTo: (promotion.applies_to ?? "all") as PromotionScope,
      enabled: promotion.enabled,
    })),
    persisted: true,
  };
}

/**
 * Validates an enabled booking code against the session it is being applied to
 * and calculates the server-owned total. The browser never supplies a discount
 * or amount, so request tampering cannot change the price — and a code scoped
 * to the horse programme is rejected here, not just hidden in the UI.
 */
export async function applyBookingPromotion(
  submittedCode: string | undefined,
  service: Pick<Service, "priceCents" | "kind">,
): Promise<PromotionResult> {
  const originalAmountCents = service.priceCents;
  const code = submittedCode?.trim() ?? "";
  if (!code) {
    return {
      applied: false,
      code: null,
      discountPercent: 0,
      originalAmountCents,
      amountCents: originalAmountCents,
    };
  }

  const configuration = await getBookingPromotionConfiguration();
  if (!configuration.persisted && process.env.NODE_ENV === "production") {
    throw new PromotionConfigurationError(
      "Discount codes are temporarily unavailable.",
    );
  }

  const { promotions } = configuration;
  const normalizedCode = normalizeCode(code);
  let promotion = promotions.find(
    (candidate) =>
      candidate.enabled && normalizeCode(candidate.code) === normalizedCode,
  );

  // Keep a previously configured private 50% code working as an alias, while
  // still honoring the dashboard's enabled/disabled state for the 50% offer.
  if (!promotion && normalizedCode === normalizeCode(env.bookingDiscountCode)) {
    promotion = promotions.find(
      (candidate) =>
        candidate.enabled &&
        candidate.discountPercent === 50 &&
        candidate.appliesTo === "all",
    );
  }

  if (!promotion) {
    throw new Error("That discount code is not valid.");
  }

  if (!scopeCovers(promotion.appliesTo, service.kind)) {
    throw new Error(
      promotion.appliesTo === "equine"
        ? "That code can only be used for sessions with the horses."
        : "That code cannot be used for this session.",
    );
  }

  // Free services stay free and do not display a redundant discount.
  if (originalAmountCents === 0) {
    return {
      applied: false,
      code: null,
      discountPercent: 0,
      originalAmountCents,
      amountCents: 0,
    };
  }

  return {
    applied: true,
    code:
      normalizedCode === normalizeCode(env.bookingDiscountCode)
        ? env.bookingDiscountCode
        : promotion.code,
    discountPercent: promotion.discountPercent,
    originalAmountCents,
    amountCents: Math.round(
      originalAmountCents * (1 - promotion.discountPercent / 100),
    ),
  };
}
