import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { DONATION } from "@/lib/content";
import { consumeRateLimit } from "@/lib/rate-limit";

type Body = {
  amountCents?: number;
};

/**
 * Starts a one-time donation Checkout session for the equine programme.
 *
 * The amount is chosen by the donor but validated and set here — the browser's
 * number only survives if it is a whole number of cents inside the configured
 * range. Sessions are tagged `kind: "donation"` so the Stripe webhook knows not
 * to treat them as a booking.
 */
export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    request: req,
    scope: "donate",
    limit: 10,
    windowMs: 15 * 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait and try again." },
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

  // Validate the donor's input before reporting on service availability, so a
  // mistyped amount gets the specific message rather than a generic outage.
  const amountCents = Number(body.amountCents);
  if (
    !Number.isInteger(amountCents) ||
    amountCents < DONATION.minCents ||
    amountCents > DONATION.maxCents
  ) {
    return NextResponse.json(
      {
        error: `Please enter an amount between $${DONATION.minCents / 100} and $${(
          DONATION.maxCents / 100
        ).toLocaleString("en-US")}.`,
      },
      { status: 400 },
    );
  }

  if (!stripe) {
    return NextResponse.json(
      { error: "Donations are temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }

  const baseUrl = new URL(req.url).origin;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      submit_type: "donate",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: "Donation — Sacred Hoof & Hand equine programme",
              description:
                "Supports the horses' care and keeps equine-assisted sessions available.",
            },
          },
        },
      ],
      metadata: { kind: "donation" },
      success_url: `${baseUrl}/donate/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/donate`,
    });

    if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[donate] Stripe session creation failed", error);
    return NextResponse.json(
      { error: "The donation could not be started. Please try again." },
      { status: 503 },
    );
  }
}
