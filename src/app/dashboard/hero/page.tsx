import { getHeroContent } from "@/lib/data";
import { updateHero } from "../actions";
import { supabaseConfigured } from "@/lib/env";
import { SetupNotice } from "@/components/dashboard/SetupNotice";

export const dynamic = "force-dynamic";

export default async function HeroEditPage() {
  const hero = await getHeroContent();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Hero section</h1>
        <p className="text-charcoal/60">
          Edit the headline visitors see first. Changes go live immediately.
        </p>
      </header>

      {!supabaseConfigured ? (
        <SetupNotice />
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <form action={updateHero} className="space-y-5">
            <Field name="eyebrow" label="Eyebrow (small text above title)" defaultValue={hero.eyebrow} />
            <Field name="title" label="Title" defaultValue={hero.title} />
            <Field
              name="subtitle"
              label="Subtitle"
              defaultValue={hero.subtitle}
              textarea
            />
            <Field name="ctaLabel" label="Button label" defaultValue={hero.ctaLabel} />
            <Field
              name="imageUrl"
              label="Background image URL"
              defaultValue={hero.imageUrl}
              hint="Use /horse-hero.webp or paste a Supabase Storage URL."
            />
            <button className="btn-primary">Save changes</button>
          </form>

          {/* Live-ish preview */}
          <div className="overflow-hidden rounded-2xl border border-sage/40">
            <div
              className="relative flex min-h-[320px] flex-col items-center justify-center bg-cover bg-center p-8 text-center"
              style={{ backgroundImage: `url(${hero.imageUrl})` }}
            >
              <div className="absolute inset-0 bg-charcoal/45" />
              <div className="relative text-ivory">
                <p className="text-xs font-semibold uppercase tracking-widest text-gold">
                  {hero.eyebrow}
                </p>
                <p className="mt-3 font-heading text-4xl">{hero.title}</p>
                <p className="mt-3 text-sm text-ivory/90">{hero.subtitle}</p>
                <span className="btn-primary mt-5 inline-block">{hero.ctaLabel}</span>
              </div>
            </div>
            <p className="bg-white/70 px-4 py-2 text-xs text-charcoal/50">
              Preview reflects the currently saved values.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  hint,
  textarea,
}: {
  name: string;
  label: string;
  defaultValue: string;
  hint?: string;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-charcoal/80">{label}</span>
      {textarea ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          rows={3}
          className="w-full rounded-xl border border-sage/50 bg-white px-4 py-2.5 text-sm outline-none focus:border-terracotta focus:ring-2 focus:ring-gold/40"
        />
      ) : (
        <input
          name={name}
          defaultValue={defaultValue}
          className="w-full rounded-xl border border-sage/50 bg-white px-4 py-2.5 text-sm outline-none focus:border-terracotta focus:ring-2 focus:ring-gold/40"
        />
      )}
      {hint && <span className="mt-1 block text-xs text-charcoal/40">{hint}</span>}
    </label>
  );
}
