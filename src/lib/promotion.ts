import "server-only";
import { env } from "./env";
import { createSupabaseAdminClient } from "./supabase/server";

export const BOOKING_PROMOTION_PERCENTAGES = [20, 50, 85] as const;
export type BookingPromotionPercent =
  (typeof BOOKING_PROMOTION_PERCENTAGES)[number];

export type BookingPromotion = {
  discountPercent: BookingPromotionPercent;
  code: string;
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
  { discountPercent: 20, code: "SACRED20", enabled: true },
  { discountPercent: 50, code: "SACRED50", enabled: true },
  { discountPercent: 85, code: "SACRED85", enabled: true },
];

function normalizeCode(code: string): string {
  return code.trim().toLocaleUpperCase("en-US");
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

  const { data, error } = await supabase
    .from("booking_promotions")
    .select("discount_percent, code, enabled")
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
      discountPercent: promotion.discount_percent as BookingPromotionPercent,
      code: promotion.code,
      enabled: promotion.enabled,
    })),
    persisted: true,
  };
}

/**
 * Validates an enabled booking code and calculates the server-owned total. The
 * browser never supplies a discount or amount, so request tampering cannot
 * change the price.
 */
export async function applyBookingPromotion(
  submittedCode: string | undefined,
  originalAmountCents: number,
): Promise<PromotionResult> {
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
  if (
    !promotion &&
    normalizedCode === normalizeCode(env.bookingDiscountCode)
  ) {
    promotion = promotions.find(
      (candidate) => candidate.enabled && candidate.discountPercent === 50,
    );
  }

  if (!promotion) {
    throw new Error("That discount code is not valid.");
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
