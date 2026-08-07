import { CheckCircle2, CircleOff } from "lucide-react";
import { SetupNotice } from "@/components/dashboard/SetupNotice";
import { supabaseAdminConfigured } from "@/lib/env";
import {
  getBookingPromotionConfiguration,
  PROMOTION_SCOPE_LABEL,
} from "@/lib/promotion";
import { setPromotionEnabled } from "../actions";

export const dynamic = "force-dynamic";

export default async function PromotionsPage() {
  if (!supabaseAdminConfigured) {
    return (
      <div className="space-y-8">
        <PageHeader />
        <SetupNotice />
      </div>
    );
  }

  const configuration = await getBookingPromotionConfiguration();

  return (
    <div className="space-y-8">
      <PageHeader />

      {!configuration.persisted && (
        <div className="rounded-2xl border border-gold/50 bg-gold/10 p-5 text-sm text-charcoal/80">
          <p className="font-semibold text-charcoal">
            Promo-code storage needs the latest schema
          </p>
          <p className="mt-1">
            The default codes are available, but dashboard changes cannot be
            saved until <code>supabase/schema.sql</code> has been run.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {configuration.promotions.map((promotion) => (
          <article
            key={promotion.code}
            className="flex flex-col gap-5 rounded-2xl border border-sage/40 bg-white/70 p-6 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl">
                  {promotion.discountPercent}% off
                </h2>
                <span className="rounded-full bg-gold/25 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-charcoal/70">
                  {PROMOTION_SCOPE_LABEL[promotion.appliesTo]}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                    promotion.enabled
                      ? "bg-sage/30 text-charcoal"
                      : "bg-charcoal/10 text-charcoal/60"
                  }`}
                >
                  {promotion.enabled ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <CircleOff className="h-3.5 w-3.5" />
                  )}
                  {promotion.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <p className="mt-2 text-sm text-charcoal/60">
                Client code:{" "}
                <code className="rounded bg-ivory px-2 py-1 font-semibold tracking-wide text-charcoal">
                  {promotion.code}
                </code>
              </p>
            </div>

            <form
              action={setPromotionEnabled.bind(
                null,
                promotion.code,
                !promotion.enabled,
              )}
            >
              <button
                className={
                  promotion.enabled
                    ? "rounded-full border border-terracotta/50 px-4 py-2 text-sm font-semibold text-terracotta transition hover:bg-terracotta/10"
                    : "btn-primary"
                }
                disabled={!configuration.persisted}
              >
                {promotion.enabled ? "Disable code" : "Enable code"}
              </button>
            </form>
          </article>
        ))}
      </div>

      <p className="text-sm leading-relaxed text-charcoal/60">
        Codes are not case-sensitive. A disabled code is rejected immediately
        when a client applies it and is checked again before checkout. A code
        marked <em>horse sessions only</em> is refused on virtual and in-person
        Reiki, both in the booking form and again on the server.
      </p>
    </div>
  );
}

function PageHeader() {
  return (
    <header>
      <h1 className="text-3xl">Promo codes</h1>
      <p className="mt-1 max-w-2xl text-charcoal/60">
        Turn each booking discount on or off. Existing appointment records are
        not changed.
      </p>
    </header>
  );
}
