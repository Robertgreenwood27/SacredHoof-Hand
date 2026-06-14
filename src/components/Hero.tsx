import Image from "next/image";
import Link from "next/link";
import type { HeroContent } from "@/lib/types";

export function Hero({ content }: { content: HeroContent }) {
  return (
    <section className="relative flex min-h-[88vh] items-center justify-center overflow-hidden">
      <Image
        src={content.imageUrl}
        alt="A woman meditating between two horses at sunset in a wildflower meadow"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {/* Warm overlay for legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-charcoal/50 via-charcoal/25 to-charcoal/70" />

      <div className="section relative z-10 flex flex-col items-center text-center text-ivory">
        <p className="eyebrow mb-5 animate-fade-up text-gold">{content.eyebrow}</p>
        <h1 className="max-w-3xl animate-fade-up text-5xl font-medium leading-[1.05] drop-shadow md:text-7xl">
          {content.title}
        </h1>
        <p className="mt-6 max-w-xl animate-fade-up text-lg font-light leading-relaxed text-ivory/90 md:text-xl">
          {content.subtitle}
        </p>
        <div className="mt-9 flex animate-fade-up flex-col items-center gap-3 sm:flex-row">
          <Link href="/book" className="btn-primary">
            {content.ctaLabel}
          </Link>
          <Link
            href="/#vision"
            className="text-sm font-semibold uppercase tracking-wide text-ivory/90 underline-offset-4 hover:text-gold hover:underline"
          >
            Explore the vision
          </Link>
        </div>
      </div>
    </section>
  );
}
