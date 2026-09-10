import { Quote } from "lucide-react";
import { TESTIMONIALS, type Testimonial } from "@/lib/testimonials";

/**
 * "In their words" — client testimonials, after the gallery.
 *
 * Content lives in src/lib/testimonials.ts. One quote gets the whole width as a
 * centered pull-quote; two or more fall into a grid of cards. The section
 * disappears entirely if there are none, so it is never an empty promise.
 */
export function TestimonialsSection() {
  if (TESTIMONIALS.length === 0) return null;

  const [only] = TESTIMONIALS;
  // Two cards across a three-column grid would leave a conspicuous hole.
  const columns =
    TESTIMONIALS.length >= 3 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2";

  return (
    <section id="testimonials" className="bg-terracotta/5 py-24">
      <div className="section">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">In their words</p>
          <h2 className="mt-3 text-4xl md:text-5xl">What people take home</h2>
        </div>

        {TESTIMONIALS.length === 1 ? (
          <figure className="mx-auto mt-14 max-w-3xl text-left sm:text-center">
            {/* Centred display type is lovely across a wide column and a wall
                of ragged edges on a phone, so it squares up below sm. */}
            <Quote
              aria-hidden
              className="h-9 w-9 fill-gold/40 text-gold/40 sm:mx-auto"
            />
            <blockquote className="mt-6 font-heading text-xl leading-snug text-charcoal/80 sm:text-2xl md:text-3xl">
              &ldquo;{only.quote}&rdquo;
            </blockquote>
            <Attribution testimonial={only} className="mt-8" />
          </figure>
        ) : (
          <div className={`mt-14 grid gap-6 ${columns}`}>
            {TESTIMONIALS.map((testimonial) => (
              <figure
                key={testimonial.quote}
                className="flex flex-col rounded-3xl border border-gold/30 bg-ivory/80 p-8"
              >
                <Quote
                  aria-hidden
                  className="h-7 w-7 fill-gold/40 text-gold/40"
                />
                <blockquote className="mt-4 flex-1 text-base leading-relaxed text-charcoal/75">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <Attribution testimonial={testimonial} className="mt-6" />
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Attribution({
  testimonial,
  className,
}: {
  testimonial: Testimonial;
  className?: string;
}) {
  return (
    <figcaption className={className}>
      <span className="text-sm font-semibold uppercase tracking-wide text-charcoal">
        {testimonial.name}
      </span>
      {testimonial.context && (
        <span className="mt-1 block text-sm text-charcoal/55">
          {testimonial.context}
        </span>
      )}
    </figcaption>
  );
}
