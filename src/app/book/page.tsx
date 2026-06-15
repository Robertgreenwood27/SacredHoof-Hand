import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BookingClient } from "@/components/BookingClient";
import { getServices, getAvailabilityRules, getBookedAppointments } from "@/lib/data";
import { generateDayGrid } from "@/lib/scheduling";
import { BUSINESS_TIMEZONE } from "@/lib/content";
import { addDays } from "date-fns";

export const dynamic = "force-dynamic";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const { service: preselect } = await searchParams;
  const [services, rules] = await Promise.all([
    getServices(),
    getAvailabilityRules(),
  ]);

  const now = new Date();
  const booked = await getBookedAppointments(
    now.toISOString(),
    addDays(now, 30).toISOString(),
  );

  // Pre-compute the time grid per service duration so switching is instant.
  const gridByService = Object.fromEntries(
    services.map((s) => [
      s.id,
      generateDayGrid({
        rules,
        booked,
        durationMinutes: s.durationMinutes,
        timeZone: BUSINESS_TIMEZONE,
      }),
    ]),
  );

  return (
    <main className="min-h-screen bg-ivory">
      <div className="relative bg-sage/30">
        <Navbar />
        <div className="section pb-12 pt-32 text-center">
          <p className="eyebrow">Book your session</p>
          <h1 className="mt-3 text-4xl md:text-5xl">Reserve your time to heal</h1>
          <p className="mx-auto mt-4 max-w-xl text-charcoal/70">
            Choose a session, pick a time that feels right, and we&apos;ll hold the
            space for you. Payment is handled securely through Stripe.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm text-charcoal/60 underline">
            ← Back home
          </Link>
        </div>
      </div>

      <BookingClient
        services={services}
        gridByService={gridByService}
        preselectServiceId={preselect}
      />

      <Footer />
    </main>
  );
}
