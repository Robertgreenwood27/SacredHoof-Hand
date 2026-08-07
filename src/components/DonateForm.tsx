"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { DONATION, formatPrice } from "@/lib/content";

/** Parses a typed dollar amount into whole cents, or null if unusable. */
function toCents(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!/^\d*(\.\d{0,2})?$/.test(cleaned) || cleaned === "") return null;
  const cents = Math.round(Number(cleaned) * 100);
  return Number.isFinite(cents) ? cents : null;
}

export function DonateForm() {
  const [amount, setAmount] = useState(
    String(DONATION.defaultCents / 100),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cents = toCents(amount);
  const valid =
    cents !== null &&
    cents >= DONATION.minCents &&
    cents <= DONATION.maxCents;

  async function handleSubmit() {
    if (!valid || cents === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: cents }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "The donation could not be started.");
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-3xl border border-sage/40 bg-white/80 p-7 shadow-sm">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal/55">
          Choose an amount
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DONATION.presetsCents.map((preset) => {
            const active = cents === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset / 100))}
                aria-pressed={active}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                  active
                    ? "border-terracotta bg-terracotta text-ivory"
                    : "border-sage/50 bg-white hover:border-terracotta"
                }`}
              >
                {formatPrice(preset)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="mt-6 block">
        <span className="mb-1 block text-sm font-medium text-charcoal/80">
          Or enter your own amount
        </span>
        <div className="flex items-center gap-2 rounded-xl border border-sage/50 bg-white px-3 py-2 focus-within:border-terracotta">
          <span className="text-charcoal/50">$</span>
          <input
            className="w-full bg-transparent text-base text-charcoal outline-none"
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="50"
            aria-describedby="donate-amount-help"
          />
        </div>
        <span
          id="donate-amount-help"
          className="mt-1 block text-xs text-charcoal/50"
        >
          Minimum {formatPrice(DONATION.minCents)}.
        </span>
      </label>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-terracotta/15 px-3 py-2 text-sm text-terracotta"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!valid || submitting}
        className="btn-primary mt-6 w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Redirecting…
          </>
        ) : valid && cents !== null ? (
          `Donate ${formatPrice(cents)}`
        ) : (
          "Donate"
        )}
      </button>
      <p className="mt-3 text-center text-xs text-charcoal/50">
        Secure one-time payment through Stripe.
      </p>
    </div>
  );
}
