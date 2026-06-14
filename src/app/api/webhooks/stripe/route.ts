import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { createConfirmedAppointment } from "@/lib/booking";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata ?? {};
    try {
      await createConfirmedAppointment(meta as Record<string, string>, session.id);
    } catch (err) {
      console.error("[stripe webhook] failed to create appointment", err);
      // Return 200 anyway so Stripe doesn't retry forever on a logic error;
      // surface in logs/monitoring instead.
    }
  }

  return NextResponse.json({ received: true });
}
