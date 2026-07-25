import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import {
  createConfirmedAppointment,
  finalizeBookingHold,
  releaseBookingHold,
} from "@/lib/booking";

// Stripe needs the raw body to verify the signature.
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!stripe || !env.stripeWebhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook not configured." },
      { status: 503 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, env.stripeWebhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata ?? {};
    // Some delayed payment methods emit completed before funds settle. Wait
    // for async_payment_succeeded rather than confirming an unpaid session.
    if (
      session.payment_status !== "paid" &&
      session.payment_status !== "no_payment_required"
    ) {
      return NextResponse.json({ received: true, pending: true });
    }

    try {
      if (meta.appointment_id && meta.manage_token) {
        await finalizeBookingHold(meta.appointment_id, meta.manage_token, {
          stripeSessionId: session.id,
          amountCents: session.amount_total,
        });
      } else {
        // Compatibility for Checkout sessions created before booking holds
        // were introduced.
        await createConfirmedAppointment(
          {
            ...(meta as Record<string, string>),
            ...(typeof session.amount_total === "number"
              ? { amount_cents: String(session.amount_total) }
              : {}),
          },
          session.id,
        );
      }
    } catch (err) {
      console.error("[stripe webhook] failed to create appointment", err);
      // A non-2xx response asks Stripe to retry. A paid booking must never be
      // silently discarded because of a transient database/email failure.
      return NextResponse.json(
        { error: "Could not finalize paid booking." },
        { status: 500 },
      );
    }
  }

  if (
    event.type === "checkout.session.expired" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const appointmentId = session.metadata?.appointment_id;
    if (appointmentId) await releaseBookingHold(appointmentId);
  }

  return NextResponse.json({ received: true });
}
