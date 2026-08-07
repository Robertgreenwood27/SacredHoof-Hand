import Link from "next/link";
import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { stripe } from "@/lib/stripe";
import { priceLabel, DONATION } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type ThankYouState = {
  heading: string;
  message: string;
  amountLabel: string | null;
};

/**
 * Confirms the donation against Stripe rather than trusting the redirect, so
 * the page never thanks someone for a payment that did not complete.
 */
async function resolveDonation(sessionId?: string): Promise<ThankYouState> {
  if (!stripe || !sessionId?.startsWith("cs_")) {
    return {
      heading: "We couldn’t verify this donation",
      message:
        "No completed donation was found. If you believe you were charged, please contact us before trying again.",
      amountLabel: null,
    };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (
      session.payment_status !== "paid" &&
      session.payment_status !== "no_payment_required"
    ) {
      return {
        heading: "This donation is not complete",
        message:
          "Checkout was not finished, so nothing was charged. You are welcome to try again whenever you are ready.",
        amountLabel: null,
      };
    }

    return {
      heading: "Thank you",
      message:
        "Your gift goes straight to the herd's care. A receipt is on its way to your inbox from Stripe.",
      amountLabel:
        typeof session.amount_total === "number"
          ? priceLabel(session.amount_total)
          : null,
    };
  } catch (error) {
    console.error("[donate] verification failed", error);
    return {
      heading: "We couldn’t verify this donation",
      message:
        "We could not confirm the payment. If you believe you were charged, please contact us before trying again.",
      amountLabel: null,
    };
  }
}

export default async function DonationThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const state = await resolveDonation(sessionId);

  return (
    <main className="flex min-h-screen items-center justify-center bg-sage/20 px-6">
      <div className="max-w-lg rounded-3xl border border-sage/40 bg-white/80 p-12 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-terracotta/15">
          <Heart className="h-8 w-8 text-terracotta" />
        </div>
        <h1 className="mt-6 text-4xl">{state.heading}</h1>
        {state.amountLabel && (
          <p className="mt-3 font-heading text-3xl text-terracotta">
            {state.amountLabel}
          </p>
        )}
        <p className="mt-4 text-charcoal/70">{state.message}</p>
        <p className="mt-4 text-xs leading-relaxed text-charcoal/50">
          {DONATION.disclaimer}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary">
            Return home
          </Link>
          <Link href="/book" className="btn-secondary">
            Book a session
          </Link>
        </div>
      </div>
    </main>
  );
}
