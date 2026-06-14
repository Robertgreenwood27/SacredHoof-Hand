import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { ServicesSection } from "@/components/ServicesSection";
import { VisionSection } from "@/components/VisionSection";
import { FreeSessionBanner } from "@/components/FreeSessionBanner";
import { Footer } from "@/components/Footer";
import { getHeroContent, getServices } from "@/lib/data";
import { isFreeSessionActive } from "@/lib/content";

// Hero/services are dynamic (editable in the dashboard), so render per request.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [hero, services] = await Promise.all([getHeroContent(), getServices()]);
  const freeActive = isFreeSessionActive();

  return (
    <main>
      <Navbar />
      <Hero content={hero} />

      {/* Connection band */}
      <section className="bg-terracotta/10 py-16">
        <div className="section text-center">
          <p className="mx-auto max-w-3xl font-heading text-2xl leading-snug text-charcoal/80 md:text-3xl">
            “Reiki is the gentle remembering that you were never broken — only
            waiting to come home to yourself.”
          </p>
        </div>
      </section>

      {freeActive && <FreeSessionBanner />}
      <ServicesSection services={services} />
      <VisionSection />

      {/* Closing CTA */}
      <section className="bg-sage py-20">
        <div className="section text-center text-charcoal">
          <h2 className="text-4xl md:text-5xl">Begin your journey to the known</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg font-light text-charcoal/80">
            Reconnect with balance, clarity, and inner peace — one session at a time.
          </p>
          <a href="/book" className="btn-primary mt-8">Book Your Session</a>
        </div>
      </section>

      <Footer />
    </main>
  );
}
