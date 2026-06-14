import { FUTURE_OFFERINGS } from "@/lib/content";

export function VisionSection() {
  return (
    <section id="vision" className="relative bg-sage/20 py-24">
      <div className="section grid items-center gap-14 lg:grid-cols-2">
        <div>
          <p className="eyebrow">The growing dream</p>
          <h2 className="mt-3 text-4xl md:text-5xl">A larger vision of holistic healing</h2>
          <p className="mt-5 text-lg font-light leading-relaxed text-charcoal/75">
            Sacred Hoof &amp; Hand is growing toward a larger vision of holistic
            healing that includes horse-assisted Reiki, sound healing experiences,
            and retreat offerings.
          </p>
          <p className="mt-4 text-lg font-light leading-relaxed text-charcoal/75">
            While those services are not yet available, they remain a foundational
            part of the future dream and mission — a place where people and animals
            heal in presence, together.
          </p>
        </div>

        <div className="space-y-4">
          {FUTURE_OFFERINGS.map((offering) => (
            <div
              key={offering.title}
              className="rounded-2xl border border-gold/30 bg-ivory/70 p-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl text-charcoal">{offering.title}</h3>
                <span className="rounded-full bg-gold/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-charcoal/70">
                  Coming soon
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-charcoal/70">
                {offering.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
