import { createHash } from "node:crypto";
import Link from "next/link";
import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { stripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type SuccessState = (
  | {
      kind: "confirmed";
      heading: string;
      message: string;
    }
  | {
      kind: "processing";
      heading: string;
      message: string;
    }
  | {
      kind: "failure";
      heading: string;
      message: string;
    }
) & { manageToken?: string };

async function resolvePaidCheckout(sessionId: string): Promise<SuccessState> {
  if (!stripe || !sessionId.startsWith("cs_")) {
    return {
      kind: "failure",
      heading: "We couldn’t verify this checkout",
      message:
        "No confirmed payment or booking was found. Please return to booking, or contact us before trying another payment if you believe you were charged.",
    };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paymentReceived =
      session.payment_status === "paid" ||
      session.payment_status === "no_payment_required";

    if (!paymentReceived) {
      return {
        kind: session.status === "open" ? "processing" : "failure",
        heading:
          session.status === "open"
            ? "Checkout is not complete"
            : "Payment was not completed",
        message:
          session.status === "open"
            ? "This Checkout session is still open, so your appointment is not confirmed yet. Complete Checkout or return to booking."
            : "Your appointment was not confirmed. If you believe you were charged, contact us before trying another payment.",
      };
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return {
        kind: "processing",
        heading: "Payment received — confirmation is processing",
        message:
          "Stripe verified your payment, but we are still checking the appointment record. Please wait a moment and refresh this page. Do not submit another payment.",
      };
    }

    const { data, error } = await supabase
      .from("appointments")
      .select("id, status")
      .eq("stripe_session_id", session.id)
      .maybeSingle();

    if (error) {
      console.error("[booking success] appointment verification failed", error);
      return {
        kind: "processing",
        heading: "Payment received — confirmation is processing",
        message:
          "Stripe verified your payment, but we could not yet verify the appointment record. Please wait a moment and refresh this page. Do not submit another payment.",
      };
    }

    const expectedAppointmentId =
      session.metadata?.appointment_id ?? session.client_reference_id;
    if (
      data &&
      expectedAppointmentId &&
      data.id !== expectedAppointmentId
    ) {
      console.error("[booking success] Checkout appointment reference mismatch", {
        sessionId: session.id,
        expectedAppointmentId,
        appointmentId: data.id,
      });
      return {
        kind: "failure",
        heading: "This booking needs attention",
        message:
          "Your payment was received, but the appointment reference could not be verified. Please contact us and do not submit another payment.",
      };
    }

    if (data?.status === "confirmed" || data?.status === "completed") {
      return {
        kind: "confirmed",
        heading: "Your session is booked",
        message:
          "Your payment and appointment are confirmed. A confirmation is on its way to your inbox with all the details.",
        manageToken: session.metadata?.manage_token,
      };
    }

    if (!data || data.status === "pending") {
      return {
        kind: "processing",
        heading: "Payment received — confirmation is processing",
        message:
          "Stripe verified your payment, and the booking confirmation is still processing. Please wait a moment and refresh this page. Do not submit another payment.",
        manageToken: session.metadata?.manage_token,
      };
    }

    return {
      kind: "failure",
      heading: "This booking needs attention",
      message:
        "Your payment was received, but the appointment is not confirmed. Please contact us and do not submit another payment.",
    };
  } catch (error) {
    console.error("[booking success] Stripe verification failed", error);
    return {
      kind: "failure",
      heading: "We couldn’t verify this checkout",
      message:
        "We could not verify the payment or appointment. Please contact us before trying another payment if you believe you were charged.",
    };
  }
}

async function resolveDirectBooking({
  manageToken,
  free,
  dev,
}: {
  manageToken?: string;
  free: boolean;
  dev: boolean;
}): Promise<SuccessState> {
  // Keep the zero-configuration local demo available without making a
  // production success claim based only on a query-string flag.
  if (dev && process.env.NODE_ENV !== "production") {
    return {
      kind: "confirmed",
      heading: free ? "Your free session is booked" : "Your session is booked",
      message: free
        ? "No charge — your complimentary session is on us. A confirmation is on its way to your inbox."
        : "Your session is confirmed. A confirmation is on its way to your inbox with all the details.",
    };
  }

  const supabase = createSupabaseAdminClient();
  if (!manageToken || !supabase) {
    return {
      kind: "failure",
      heading: "We couldn’t verify this booking",
      message:
        "No confirmed booking was found. Please return to booking or contact us for help.",
    };
  }

  const manageTokenHash = createHash("sha256")
    .update(manageToken)
    .digest("hex");
  const { data, error } = await supabase
    .from("appointments")
    .select("status, amount_cents")
    .eq("manage_token_hash", manageTokenHash)
    .maybeSingle();

  if (error) {
    console.error("[booking success] direct booking verification failed", error);
    return {
      kind: "failure",
      heading: "We couldn’t verify this booking",
      message:
        "The booking record could not be checked. Please use your confirmation email or contact us for help.",
    };
  }

  if (data?.status === "confirmed" || data?.status === "completed") {
    const isFree = free || data.amount_cents === 0;
    return {
      kind: "confirmed",
      heading: isFree ? "Your free session is booked" : "Your session is booked",
      message: isFree
        ? "No charge — your complimentary session is on us. A confirmation is on its way to your inbox."
        : "Your session is confirmed. A confirmation is on its way to your inbox with all the details.",
    };
  }

  if (data?.status === "pending") {
    return {
      kind: "processing",
      heading: "Your booking is processing",
      message:
        "The appointment is still awaiting confirmation. Please wait a moment and refresh this page.",
    };
  }

  return {
    kind: "failure",
    heading: "This booking is not confirmed",
    message:
      "The appointment could not be confirmed. Please return to booking or contact us for help.",
  };
}

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string;
    dev?: string;
    free?: string;
    manage?: string;
    email?: string;
  }>;
}) {
  const { session_id: sessionId, dev, free, manage, email } =
    await searchParams;
  const state = sessionId
    ? await resolvePaidCheckout(sessionId)
    : await resolveDirectBooking({
        manageToken: manage,
        free: Boolean(free),
        dev: Boolean(dev),
      });
  const manageToken = manage ?? state.manageToken;

  return (
    <main className="flex min-h-screen items-center justify-center bg-sage/20 px-6">
      <div className="max-w-lg rounded-3xl border border-sage/40 bg-white/80 p-12 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-terracotta/15">
          <Heart className="h-8 w-8 text-terracotta" />
        </div>
        <h1 className="mt-6 text-4xl">{state.heading}</h1>
        <p className="mt-4 text-charcoal/70">{state.message}</p>
        {dev && process.env.NODE_ENV !== "production" && (
          <p className="mt-4 rounded-lg bg-gold/15 px-4 py-2 text-sm text-charcoal/70">
            Dev mode: booking created without payment (Stripe not configured yet).
          </p>
        )}
        {state.kind === "confirmed" && email === "delayed" && (
          <p className="mt-4 rounded-lg bg-gold/15 px-4 py-2 text-sm text-charcoal/70">
            Your session is confirmed, but email delivery is delayed. Save the
            manage-booking link below and contact us if the confirmation does
            not arrive.
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {manageToken && state.kind !== "failure" && (
            <Link
              href={`/manage/${encodeURIComponent(manageToken)}`}
              className="btn-primary"
            >
              Manage booking
            </Link>
          )}
          {state.kind === "failure" && (
            <Link href="/book" className="btn-primary">
              Return to booking
            </Link>
          )}
          <Link
            href="/"
            className={
              manageToken || state.kind === "failure"
                ? "btn-secondary"
                : "btn-primary"
            }
          >
            Return home
          </Link>
        </div>
      </div>
    </main>
  );
}
