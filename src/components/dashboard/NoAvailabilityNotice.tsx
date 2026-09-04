import Link from "next/link";

/**
 * Shown when `availability_rules` is empty. Every standard session (the free
 * intro and the 30/60/90 Reiki, virtual and in person) is generated from those
 * weekly windows, so an empty table silently turns the booking page into "no
 * open times" — which reads to visitors as fully booked. The horse days come
 * from `event_slots` and keep working, which is what makes this so easy to miss.
 */
export function NoAvailabilityNotice({ linkToFix = false }: { linkToFix?: boolean }) {
  return (
    <div className="rounded-2xl border border-terracotta/50 bg-terracotta/10 p-6 text-sm leading-relaxed text-charcoal/80">
      <p className="font-semibold text-charcoal">
        No weekly hours are set — Reiki sessions cannot be booked right now
      </p>
      <p className="mt-2">
        Virtual and in-person sessions are offered entirely from your weekly
        windows. With none set, every visitor to the booking page is told there
        are no open times. Sessions with the horses are unaffected — they run on
        their own dated schedule.
      </p>
      <p className="mt-2">
        {linkToFix ? (
          <>
            Add a window on the{" "}
            <Link
              href="/dashboard/availability"
              className="font-semibold text-terracotta underline"
            >
              Availability page
            </Link>{" "}
            to reopen booking.
          </>
        ) : (
          "Add a window above to reopen booking."
        )}
      </p>
    </div>
  );
}
