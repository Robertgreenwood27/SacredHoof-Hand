import Link from "next/link";
import { Heart, Leaf, Sparkles } from "lucide-react";
import { EQUINE_PROGRAM, EQUINE_LOCATION, DONATION } from "@/lib/content";

const pillarIcons = [Leaf, Heart, Sparkles];

export function EquineProgramSection() {
  return (
    <section id="horses" className="bg-terracotta/5 py-24">
      <div className="section">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow">{EQUINE_PROGRAM.eyebrow}</p>
          <h2 className="mt-3 text-4xl md:text-5xl">{EQUINE_PROGRAM.title}</h2>
          <p className="mt-5 text-lg font-light leading-relaxed text-charcoal/75">
            {EQUINE_PROGRAM.lead}
          </p>
          <p className="mt-4 text-lg font-light leading-relaxed text-charcoal/75">
            {EQUINE_PROGRAM.body}
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {EQUINE_PROGRAM.pillars.map((pillar, index) => {
            const Icon = pillarIcons[index] ?? Leaf;
            return (
              <div
                key={pillar.title}
                className="rounded-3xl border border-gold/30 bg-ivory/80 p-8"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/25">
                  <Icon className="h-5 w-5 text-charcoal/70" />
                </span>
                <h3 className="mt-5 text-xl text-charcoal">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/70">
                  {pillar.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/book?service=equine-60" className="btn-primary">
              Book a session with the horses
            </Link>
            <Link href="/donate" className="btn-secondary">
              Support the horses
            </Link>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-charcoal/60">
            Sessions are held on scheduled herd days in{" "}
            {EQUINE_LOCATION.publicLabel}. The address and parking directions
            are sent to you when your booking is confirmed.
          </p>
          <p className="max-w-2xl text-xs leading-relaxed text-charcoal/50">
            {DONATION.disclaimer}
          </p>
        </div>
      </div>
    </section>
  );
}
