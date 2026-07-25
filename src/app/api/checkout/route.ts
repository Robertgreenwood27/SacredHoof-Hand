import { NextResponse } from "next/server";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { getServiceById } from "@/lib/data";
import {
  attachStripeSession,
  assertBookingHoldQuota,
  BookingConflictError,
  BookingNotificationError,
  createBookingHold,
  createConfirmedAppointment,
  finalizeBookingHold,
  releaseBookingHold,
} from "@/lib/booking";
import { isFreeSessionActive } from "@/lib/content";
import {
  env,
  productionEmailConfigured,
  productionSiteConfigured,
  supabaseAdminConfigured,
} from "@/lib/env";
import { isValidEmail } from "@/lib/validation";
import { validateRequestedSlot } from "@/lib/slot-validation";
import {
  applyBookingPromotion,
  PromotionConfigurationError,
} from "@/lib/promotion";
import {
  createAgreementAcceptance,
  CURRENT_AGREEMENT_EVIDENCE,
} from "@/lib/agreements";
import { consumeRateLimit } from "@/lib/rate-limit";

type Body = {
  serviceId?: string;
  startsAt?: string;
  endsAt?: string;
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  clientTimezone?: string;
  promoCode?: string;
  acceptedTerms?: boolean;
  acceptedWaiver?: boolean;
  authorizedSigner?: boolean;
  electronicConsent?: boolean;
  signatureName?: string;
  signerCapacity?: "self" | "parent_or_guardian";
  guardianRelationship?: string;
  termsVersion?: string;
  termsHash?: string;
  waiverVersion?: string;
  waiverHash?: string;
};

function cleanOptional(value: string | undefined, maxLength: number): string {
  return value?.trim().slice(0, maxLength) ?? "";
}

function validTimeZone(value: string | undefined): string {
  if (!value) return "";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    request: req,
    scope: "checkout",
    limit: 8,
    windowMs: 15 * 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many booking attempts. Please wait and try again." },
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

  const cleanName = cleanOptional(body.name, 200);
  const cleanEmail = cleanOptional(body.email, 320).toLowerCase();
  const signatureName = cleanOptional(body.signatureName, 200);
  const guardianRelationship = cleanOptional(
    body.guardianRelationship,
    200,
  );
  if (
    !body.serviceId ||
    !body.startsAt ||
    !body.endsAt ||
    !cleanName ||
    !cleanEmail
  ) {
    return NextResponse.json(
      { error: "Please complete all required booking fields." },
      { status: 400 },
    );
  }

  if (
    body.termsVersion !== CURRENT_AGREEMENT_EVIDENCE.termsVersion ||
    body.termsHash !== CURRENT_AGREEMENT_EVIDENCE.termsHash ||
    body.waiverVersion !== CURRENT_AGREEMENT_EVIDENCE.waiverVersion ||
    body.waiverHash !== CURRENT_AGREEMENT_EVIDENCE.waiverHash
  ) {
    return NextResponse.json(
      {
        error:
          "The Terms or Liability Waiver changed while this page was open. Refresh the page and review the current documents before signing.",
      },
      { status: 409 },
    );
  }
  if (!isValidEmail(cleanEmail)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  // This is the authoritative legal gate. The disabled browser button is only
  // a convenience; direct requests cannot create a booking or payment session.
  if (
    body.acceptedTerms !== true ||
    body.acceptedWaiver !== true ||
    body.authorizedSigner !== true ||
    body.electronicConsent !== true ||
    signatureName.length < 2 ||
    (body.signerCapacity !== "self" &&
      body.signerCapacity !== "parent_or_guardian") ||
    (body.signerCapacity === "parent_or_guardian" &&
      guardianRelationship.length < 2)
  ) {
    return NextResponse.json(
      {
        error:
          "Review and sign the Terms of Service and Liability Waiver before booking.",
      },
      { status: 400 },
    );
  }

  const service = await getServiceById(body.serviceId);
  if (!service) {
    return NextResponse.json({ error: "Unknown service." }, { status: 404 });
  }

  if (process.env.NODE_ENV === "production" && !supabaseAdminConfigured) {
    return NextResponse.json(
      {
        error:
          "Booking storage is temporarily unavailable. No payment was started.",
      },
      { status: 503 },
    );
  }
  if (process.env.NODE_ENV === "production" && !productionEmailConfigured) {
    return NextResponse.json(
      {
        error:
          "Booking notifications are temporarily unavailable. No payment was started.",
      },
      { status: 503 },
    );
  }
  if (process.env.NODE_ENV === "production" && !productionSiteConfigured) {
    return NextResponse.json(
      {
        error:
          "The secure booking URL is not configured. No payment was started.",
      },
      { status: 503 },
    );
  }
  if (
    process.env.NODE_ENV === "production" &&
    service.priceCents > 0 &&
    (!stripeConfigured || !stripe)
  ) {
    return NextResponse.json(
      {
        error:
          "Secure payment is temporarily unavailable. No payment was started.",
      },
      { status: 503 },
    );
  }

  const slot = await validateRequestedSlot({
    service,
    startsAt: body.startsAt,
    endsAt: body.endsAt,
  });
  if (!slot.ok) {
    return NextResponse.json({ error: slot.error }, { status: 409 });
  }

  let promotion;
  try {
    promotion = await applyBookingPromotion(body.promoCode, service.priceCents);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid discount code." },
      { status: error instanceof PromotionConfigurationError ? 503 : 400 },
    );
  }

  if (service.priceCents === 0) {
    if (!isFreeSessionActive()) {
      return NextResponse.json(
        { error: "This offer is no longer available." },
        { status: 410 },
      );
    }
  }

  if (supabaseAdminConfigured) {
    try {
      await assertBookingHoldQuota(cleanEmail);
    } catch (error) {
      const message =
        error instanceof BookingConflictError
          ? error.message
          : "We could not verify active checkout reservations. Please try again.";
      return NextResponse.json(
        { error: message },
        { status: error instanceof BookingConflictError ? 409 : 503 },
      );
    }
  }

  const clientTimezone = validTimeZone(body.clientTimezone);
  let agreementId: string | null;
  try {
    agreementId = await createAgreementAcceptance({
      clientName: cleanName,
      clientEmail: cleanEmail,
      signatureName,
      serviceId: service.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      electronicConsent: true,
      authorizedSigner: true,
      signerCapacity: body.signerCapacity,
      guardianRelationship,
      request: req,
    });
  } catch (error) {
    console.error("[checkout] agreement persistence failed", error);
    return NextResponse.json(
      {
        error:
          "We could not save your signed agreements. No payment was started; please try again.",
      },
      { status: 503 },
    );
  }

  const baseUrl = new URL(req.url).origin || env.siteUrl;
  const shared = {
    service_id: service.id,
    service_name: service.name,
    starts_at: slot.startsAt,
    ends_at: slot.endsAt,
    client_name: cleanName,
    client_email: cleanEmail,
    client_phone: cleanOptional(body.phone, 100),
    client_timezone: clientTimezone,
    notes: cleanOptional(body.notes, 2000),
    amount_cents: promotion.amountCents,
    original_amount_cents: promotion.originalAmountCents,
    discount_code: promotion.code,
    discount_percent: promotion.discountPercent,
  };

  // Preserve the project's zero-configuration local demo, but fail closed in
  // production: real payments/bookings require an immutable agreement record.
  if (!agreementId) {
    if (process.env.NODE_ENV === "production" || stripeConfigured) {
      return NextResponse.json(
        {
          error:
            "Booking storage is not configured. No payment was started; please contact Sacred Hoof & Hand.",
        },
        { status: 503 },
      );
    }
    await createConfirmedAppointment(
      Object.fromEntries(
        Object.entries(shared).map(([key, value]) => [key, String(value ?? "")]),
      ),
      null,
    );
    return NextResponse.json({
      url: `${baseUrl}/book/success?dev=1${service.priceCents === 0 ? "&free=1" : ""}`,
    });
  }

  let hold;
  try {
    hold = await createBookingHold({ ...shared, agreement_id: agreementId });
  } catch (error) {
    const message =
      error instanceof BookingConflictError
        ? error.message
        : "We could not reserve that time. Please choose another.";
    console.error("[checkout] booking hold failed", error);
    return NextResponse.json(
      { error: message },
      { status: error instanceof BookingConflictError ? 409 : 503 },
    );
  }

  if (service.priceCents === 0 || !stripeConfigured || !stripe) {
    let notificationDelayed = false;
    try {
      await finalizeBookingHold(hold.appointment.id, hold.manageToken, {
        stripeSessionId: null,
        amountCents: promotion.amountCents,
      });
    } catch (error) {
      if (error instanceof BookingNotificationError) {
        notificationDelayed = true;
      } else {
        await releaseBookingHold(hold.appointment.id);
        console.error("[checkout] direct booking failed", error);
        return NextResponse.json(
          { error: "We could not confirm your session. Please try another time." },
          { status: 503 },
        );
      }
    }
    const query = new URLSearchParams({
      booked: "1",
      ...(notificationDelayed ? { email: "delayed" } : {}),
    });
    return NextResponse.json({
      url: `${baseUrl}/manage/${encodeURIComponent(hold.manageToken)}?${query}`,
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: cleanEmail,
      client_reference_id: hold.appointment.id,
      // Card-only Checkout avoids delayed settlement after the database hold
      // expires. Stripe closes the session before our 35-minute hold does.
      expires_at: Math.floor((Date.now() + 31 * 60_000) / 1000),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: promotion.amountCents,
            product_data: {
              name: service.name,
              description: `${service.durationMinutes} min Reiki session${
                promotion.applied
                  ? ` · ${promotion.discountPercent}% discount applied`
                  : ""
              }`,
            },
          },
        },
      ],
      metadata: {
        appointment_id: hold.appointment.id,
        manage_token: hold.manageToken,
      },
      success_url: `${baseUrl}/book/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/book?service=${encodeURIComponent(service.id)}`,
    });

    try {
      await attachStripeSession(hold.appointment.id, session.id);
    } catch (error) {
      await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
      throw error;
    }

    if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    await releaseBookingHold(hold.appointment.id);
    console.error("[checkout] Stripe session creation failed", error);
    return NextResponse.json(
      { error: "Secure payment could not be started. Please try again." },
      { status: 503 },
    );
  }
}
