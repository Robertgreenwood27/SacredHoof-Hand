import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DonateForm } from "@/components/DonateForm";
import { DONATION, EQUINE_PROGRAM } from "@/lib/content";

export const metadata: Metadata = {
  title: "Support the horses · Sacred Hoof & Hand",
  description:
    "Support the equine programme at Sacred Hoof & Hand — the horses' care, their rehabilitation, and keeping equine-assisted sessions available.",
};

export default function DonatePage() {
  return (
    <main className="min-h-screen bg-ivory">
      <div className="bg-sage/30">
        <Navbar onLight />
        <div className="section pb-12 pt-32 text-center">
          <p className="eyebrow">{EQUINE_PROGRAM.eyebrow}</p>
          <h1 className="mt-3 text-4xl md:text-5xl">Support the horses</h1>
          <p className="mx-auto mt-4 max-w-xl text-charcoal/70">
            Every gift goes to the herd — feed, farrier and veterinary care,
            rehabilitation for the horses who arrive needing it, and keeping
            equine-assisted sessions within reach of the people who need them.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm text-charcoal/60 underline"
          >
            ← Back home
          </Link>
        </div>
      </div>

      <div className="section grid max-w-5xl gap-10 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
        <div className="space-y-6">
          <h2 className="text-3xl">Where your gift goes</h2>
          <p className="text-lg font-light leading-relaxed text-charcoal/75">
            {EQUINE_PROGRAM.body}
          </p>
          <div className="space-y-4">
            {EQUINE_PROGRAM.pillars.map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-2xl border border-gold/30 bg-white/60 p-6"
              >
                <h3 className="text-xl text-charcoal">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/70">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
          <p className="rounded-2xl border border-sage/40 bg-sage/10 p-5 text-sm leading-relaxed text-charcoal/70">
            {DONATION.disclaimer}
          </p>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <DonateForm />
        </aside>
      </div>

      <Footer />
    </main>
  );
}
