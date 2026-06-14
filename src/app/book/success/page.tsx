import Link from "next/link";
import { Heart } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ dev?: string; free?: string }>;
}) {
  const { dev, free } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-sage/20 px-6">
      <div className="max-w-lg rounded-3xl border border-sage/40 bg-white/80 p-12 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-terracotta/15">
          <Heart className="h-8 w-8 text-terracotta" />
        </div>
        <h1 className="mt-6 text-4xl">
          {free ? "Your free session is booked" : "Your session is booked"}
        </h1>
        <p className="mt-4 text-charcoal/70">
          {free
            ? "No charge — your complimentary session is on us. A confirmation is on its way to your inbox."
            : "A confirmation is on its way to your inbox with all the details. Take a breath — your time to reconnect is held."}
        </p>
        {dev && (
          <p className="mt-4 rounded-lg bg-gold/15 px-4 py-2 text-sm text-charcoal/70">
            Dev mode: booking created without payment (Stripe not configured yet).
          </p>
        )}
        <Link href="/" className="btn-primary mt-8">
          Return home
        </Link>
      </div>
    </main>
  );
}
