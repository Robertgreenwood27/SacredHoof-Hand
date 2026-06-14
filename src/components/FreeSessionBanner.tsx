import Link from "next/link";
import { Sparkles } from "lucide-react";
import { FREE_SESSION_OFFER } from "@/lib/content";

/**
 * Featured promo banner for the limited-time free session. Renders nothing when
 * the offer is inactive — controlled by FREE_SESSION_OFFER in src/lib/content.ts.
 */
export function FreeSessionBanner() {
  const { service } = FREE_SESSION_OFFER;

  return (
    <section className="bg-ivory pt-16">
      <div className="section">
        <div className="relative overflow-hidden rounded-3xl border-2 border-gold bg-gradient-to-r from-gold/20 via-ivory to-terracotta/15 p-8 md:p-10">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-charcoal">
                <Sparkles className="h-3.5 w-3.5" />
                {FREE_SESSION_OFFER.badge}
              </span>
              <h2 className="mt-4 text-3xl md:text-4xl">
                Your first session is on us
              </h2>
              <p className="mt-2 text-charcoal/70">
                {service.description}
              </p>
            </div>
            <Link
              href={`/book?service=${service.id}`}
              className="btn-primary shrink-0"
            >
              Claim your free session
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
