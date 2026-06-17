import { NextResponse } from "next/server";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { getServiceById } from "@/lib/data";
import { createConfirmedAppointment, hasUsedFreeSession } from "@/lib/booking";
import { FREE_SESSION_OFFER, isFreeSessionActive } from "@/lib/content";
import { env } from "@/lib/env";

type Body = {
  serviceId: string;
  startsAt: string;
  endsAt: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  clientTimezone?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { serviceId, startsAt, endsAt, name, email, phone, notes, clientTimezone } = body;
  if (!serviceId || !startsAt || !endsAt || !name || !email) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const service = await getServiceById(serviceId);
  if (!service) {
    return NextResponse.json({ error: "Unknown service." }, { status: 404 });
  }

  // Return to whatever origin the booking came from (e.g. the live domain),
  // falling back to the configured site URL. Avoids hard-coding localhost.
  const baseUrl = req.headers.get("origin") ?? env.siteUrl;

  const metadata = {
    service_id: service.id,
    service_name: service.name,
    starts_at: startsAt,
    ends_at: endsAt,
    client_name: name,
    client_email: email,
    client_phone: phone ?? "",
    client_timezone: clientTimezone ?? "",
    notes: notes ?? "",
    amount_cents: String(service.priceCents),
  };

  // --- Free session: no payment, book directly ------------------------------
  if (service.priceCents === 0) {
    if (!isFreeSessionActive()) {
      return NextResponse.json(
        { error: "This offer is no longer available." },
        { status: 410 },
      );
    }
    if (FREE_SESSION_OFFER.onePerClient && (await hasUsedFreeSession(email, service.id))) {
      return NextResponse.json(
        { error: "It looks like you've already booked your complimentary session." },
        { status: 409 },
      );
    }
    await createConfirmedAppointment(metadata, null);
    return NextResponse.json({ url: `${baseUrl}/book/success?free=1` });
  }

  // --- Dev fallback: no Stripe configured yet -------------------------------
  // Lets the team test the full booking + email flow before wiring payments.
  if (!stripeConfigured || !stripe) {
    await createConfirmedAppointment(metadata, null);
    return NextResponse.json({
      url: `${baseUrl}/book/success?dev=1`,
    });
  }

  // --- Real Stripe Checkout -------------------------------------------------
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: service.priceCents,
          product_data: {
            name: service.name,
            description: `${service.durationMinutes} min Reiki session`,
          },
        },
      },
    ],
    metadata,
    success_url: `${baseUrl}/book/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/book?service=${service.id}`,
  });

  return NextResponse.json({ url: session.url });
}
