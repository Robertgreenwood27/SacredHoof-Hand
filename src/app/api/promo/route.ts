import { NextResponse } from "next/server";
import { getServiceById } from "@/lib/data";
import {
  applyBookingPromotion,
  PromotionConfigurationError,
} from "@/lib/promotion";
import { consumeRateLimit } from "@/lib/rate-limit";

type Body = {
  serviceId?: string;
  code?: string;
};

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    request: req,
    scope: "promo",
    limit: 20,
    windowMs: 15 * 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many code attempts. Please wait and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body.serviceId || !body.code?.trim()) {
    return NextResponse.json(
      { error: "Enter a discount code." },
      { status: 400 },
    );
  }

  const service = await getServiceById(body.serviceId);
  if (!service) {
    return NextResponse.json({ error: "Unknown service." }, { status: 404 });
  }

  try {
    const promotion = await applyBookingPromotion(body.code, service);
    return NextResponse.json({
      valid: promotion.applied,
      code: promotion.code,
      discountPercent: promotion.discountPercent,
      originalAmountCents: promotion.originalAmountCents,
      amountCents: promotion.amountCents,
    });
  } catch (error) {
    return NextResponse.json(
      {
        valid: false,
        error: error instanceof Error ? error.message : "Invalid discount code.",
      },
      { status: error instanceof PromotionConfigurationError ? 503 : 400 },
    );
  }
}
