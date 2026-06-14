import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { priceLabel } from "@/lib/content";
import type { Service } from "@/lib/types";

const locationLabel: Record<Service["location"], string> = {
  virtual: "Virtual",
  "in-person": "In person",
  both: "Virtual or in person",
};

export function ServicesSection({ services }: { services: Service[] }) {
  return (
    <section id="services" className="bg-ivory py-24">
      <div className="section">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Sessions</p>
          <h2 className="mt-3 text-4xl md:text-5xl">Find your way back to balance</h2>
          <p className="mt-4 text-lg font-light leading-relaxed text-charcoal/70">
            Each session is a quiet invitation to slow down, release what you&apos;re
            carrying, and reconnect with clarity and inner peace.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {services.map((service) => {
            const isFree = service.priceCents === 0;
            return (
            <article
              key={service.id}
              className={`flex flex-col rounded-3xl p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-md ${
                isFree
                  ? "border-2 border-gold bg-gold/10 ring-1 ring-gold/40"
                  : "border border-sage/40 bg-white/60"
              }`}
            >
              {isFree && (
                <span className="mb-3 inline-flex w-fit rounded-full bg-gold px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-charcoal">
                  Limited time · Free
                </span>
              )}
              <h3 className="text-2xl">{service.name}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-charcoal/70">
                {service.description}
              </p>
              <dl className="mt-6 space-y-2 text-sm text-charcoal/80">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-sage" />
                  <span>{service.durationMinutes} minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-sage" />
                  <span>{locationLabel[service.location]}</span>
                </div>
              </dl>
              <div className="mt-6 flex items-center justify-between">
                <span className="font-heading text-3xl text-terracotta">
                  {priceLabel(service.priceCents)}
                </span>
                <Link
                  href={`/book?service=${service.id}`}
                  className={isFree ? "btn-primary" : "btn-secondary"}
                >
                  Book
                </Link>
              </div>
            </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
