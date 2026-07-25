"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { priceLabel } from "@/lib/content";
import { isValidEmail } from "@/lib/validation";
import type { GridSlot } from "@/lib/scheduling";
import type { Service } from "@/lib/types";

type Props = {
  services: Service[];
  slotsByService: Record<string, GridSlot[]>;
  preselectServiceId?: string;
  agreementEvidence: {
    termsVersion: string;
    termsHash: string;
    waiverVersion: string;
    waiverHash: string;
  };
};

/** A slot with its time re-labeled in the visitor's local timezone. */
type LocalSlot = GridSlot & { localLabel: string };

/** A day's slots, grouped + labeled by the visitor's local calendar date. */
type LocalDay = {
  dateKey: string; // YYYY-MM-DD in the visitor's timezone
  dayLabel: string; // "Thursday, June 18"
  shortLabel: string; // "Thu 18"
  slots: LocalSlot[];
  hasAvailable: boolean;
};

/**
 * Groups flat UTC slots into days using the visitor's own timezone, so a client
 * in Texas sees Central times/days rather than the practitioner's Mountain ones.
 * Runs in the browser (after mount) to read the local zone.
 */
function groupByLocalDay(slots: GridSlot[]): LocalDay[] {
  const keyFmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dayFmt = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const shortFmt = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const byKey = new Map<string, LocalDay>();
  for (const slot of slots) {
    const start = new Date(slot.startsAt);
    const dateKey = keyFmt.format(start);
    let day = byKey.get(dateKey);
    if (!day) {
      day = {
        dateKey,
        dayLabel: dayFmt.format(start),
        shortLabel: shortFmt.format(start),
        slots: [],
        hasAvailable: false,
      };
      byKey.set(dateKey, day);
    }
    day.slots.push({ ...slot, localLabel: timeFmt.format(start) });
    if (slot.available) day.hasAvailable = true;
  }

  return [...byKey.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

/** Short abbreviation for the visitor's timezone, e.g. "CDT". */
function localTzAbbr(): string {
  const part = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? "";
}

export function BookingClient({
  services,
  slotsByService,
  preselectServiceId,
  agreementEvidence,
}: Props) {
  const initial =
    services.find((s) => s.id === preselectServiceId) ?? services[0];
  const [serviceId, setServiceId] = useState(initial?.id);
  const [dateKey, setDateKey] = useState<string | undefined>(undefined);
  const [slot, setSlot] = useState<LocalSlot | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [promoCode, setPromoCode] = useState("");
  const [promotion, setPromotion] = useState<{
    code: string;
    amountCents: number;
    discountPercent: number;
  } | null>(null);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [agreements, setAgreements] = useState({
    acceptedTerms: false,
    acceptedWaiver: false,
    authorizedSigner: false,
    electronicConsent: false,
    signatureName: "",
    signerCapacity: "",
    guardianRelationship: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Timezone-dependent labels are computed client-side; gate them behind mount
  // so server and first client render match (no hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const service = services.find((s) => s.id === serviceId) ?? services[0];
  const isFree = service?.priceCents === 0;
  const grid = useMemo(
    () => groupByLocalDay(slotsByService[serviceId ?? ""] ?? []),
    [slotsByService, serviceId],
  );
  const tzAbbr = useMemo(() => (mounted ? localTzAbbr() : ""), [mounted]);
  const selectedDay = grid.find((d) => d.dateKey === dateKey);

  // When the service changes, reset to its first day with open times.
  useEffect(() => {
    const firstAvailable = grid.find((d) => d.hasAvailable) ?? grid[0];
    setDateKey(firstAvailable?.dateKey);
    setSlot(null);
    setPromoCode("");
    setPromotion(null);
    setPromoMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  async function applyPromoCode() {
    if (!service || !promoCode.trim()) {
      setPromotion(null);
      setPromoMessage("Enter a discount code.");
      return;
    }
    setCheckingPromo(true);
    setPromoMessage(null);
    try {
      const res = await fetch("/api/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: service.id, code: promoCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        throw new Error(data.error ?? "That discount code is not valid.");
      }
      setPromotion({
        code: data.code,
        amountCents: data.amountCents,
        discountPercent: data.discountPercent,
      });
      setPromoCode(data.code);
      setPromoMessage(`${data.discountPercent}% discount applied.`);
    } catch (e) {
      setPromotion(null);
      setPromoMessage(
        e instanceof Error ? e.message : "That discount code is not valid.",
      );
    } finally {
      setCheckingPromo(false);
    }
  }

  async function handleSubmit() {
    if (!service || !slot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          promoCode: promotion?.code ?? "",
          ...agreementEvidence,
          ...agreements,
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      if (data.url) {
        window.location.href = data.url; // Stripe Checkout (or free/dev success)
      } else {
        throw new Error("No checkout URL returned.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  // The email <input type="email"> doesn't self-validate here because we submit
  // via a button click, not a native form submit — so check the shape ourselves.
  const emailValid = isValidEmail(form.email);
  const showEmailError = form.email.trim().length > 0 && !emailValid;
  const canSubmit =
    service &&
    slot &&
    form.name.trim() &&
    emailValid &&
    agreements.acceptedTerms &&
    agreements.acceptedWaiver &&
    agreements.authorizedSigner &&
    agreements.electronicConsent &&
    agreements.signatureName.trim().length >= 2 &&
    Boolean(agreements.signerCapacity) &&
    (agreements.signerCapacity !== "parent_or_guardian" ||
      agreements.guardianRelationship.trim().length >= 2) &&
    (isFree || !promoCode.trim() || Boolean(promotion)) &&
    !submitting;
  const anyAvailability = grid.some((d) => d.hasAvailable);

  return (
    <div className="section grid gap-10 py-16 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-10">
        {/* Step 1: choose a service */}
        <section>
          <h2 className="mb-4 text-2xl">1 · Choose your session</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setServiceId(s.id)}
                aria-pressed={s.id === serviceId}
                className={`rounded-2xl border p-5 text-left transition ${
                  s.id === serviceId
                    ? "border-terracotta bg-terracotta/10 ring-1 ring-terracotta"
                    : "border-sage/40 bg-white/60 hover:border-sage"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading text-xl">{s.name}</span>
                  {s.id === serviceId && <Check className="h-5 w-5 text-terracotta" />}
                </div>
                <p className="mt-1 text-sm text-charcoal/60">
                  {s.durationMinutes} min · {priceLabel(s.priceCents)}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Step 2: pick a time */}
        <section>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-2xl">2 · Pick a time</h2>
            <span className="text-xs font-medium uppercase tracking-wide text-charcoal/50">
              Times shown in your local time{tzAbbr && ` (${tzAbbr})`}
            </span>
          </div>

          {!mounted ? (
            <p className="rounded-xl border border-sage/40 bg-white/60 p-5 text-sm text-charcoal/60">
              Loading available times…
            </p>
          ) : !anyAvailability ? (
            <p className="rounded-xl border border-sage/40 bg-white/60 p-5 text-sm text-charcoal/60">
              No open times in the next few weeks. Please check back soon or reach
              out directly.
            </p>
          ) : (
            <>
              {/* Day selector */}
              <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-2">
                {grid.map((day) => {
                  const active = day.dateKey === dateKey;
                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      onClick={() => {
                        setDateKey(day.dateKey);
                        setSlot(null);
                      }}
                      disabled={!day.hasAvailable}
                      aria-pressed={active}
                      className={`shrink-0 rounded-xl border px-4 py-2 text-center text-sm transition ${
                        active
                          ? "border-terracotta bg-terracotta text-ivory"
                          : day.hasAvailable
                            ? "border-sage/50 bg-white/70 hover:border-terracotta"
                            : "cursor-not-allowed border-sage/20 bg-transparent text-charcoal/30"
                      }`}
                    >
                      {day.shortLabel}
                    </button>
                  );
                })}
              </div>

              {/* Time grid for the selected day */}
              {selectedDay && (
                <div>
                  <p className="mb-3 text-sm font-semibold text-charcoal/70">
                    {selectedDay.dayLabel}
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {selectedDay.slots.map((s) => {
                      const active = slot?.startsAt === s.startsAt;
                      return (
                        <button
                          key={s.startsAt}
                          type="button"
                          onClick={() => s.available && setSlot(s)}
                          disabled={!s.available}
                          aria-pressed={active}
                          title={s.available ? undefined : "Unavailable"}
                          className={`rounded-lg border px-2 py-2 text-sm transition ${
                            active
                              ? "border-terracotta bg-terracotta text-ivory"
                              : s.available
                                ? "border-sage/50 bg-white/80 hover:border-terracotta hover:bg-terracotta/5"
                                : "cursor-not-allowed border-transparent bg-sage/10 text-charcoal/30 line-through"
                          }`}
                        >
                          {s.localLabel}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs text-charcoal/40">
                    Greyed-out times are unavailable or already booked.
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        {/* Step 3: your details */}
        <section>
          <h2 className="mb-4 text-2xl">3 · Your details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required>
              <input
                className="input"
                required
                aria-required="true"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Doe"
              />
            </Field>
            <Field label="Email" required>
              <input
                type="email"
                className="input"
                required
                aria-required="true"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@example.com"
                aria-invalid={showEmailError}
                aria-describedby={
                  showEmailError ? "booking-email-error" : undefined
                }
              />
              {showEmailError && (
                <span
                  id="booking-email-error"
                  className="mt-1 block text-xs text-terracotta"
                >
                  Please enter a valid email address so we can send your
                  confirmation.
                </span>
              )}
            </Field>
            <Field label="Phone (optional)">
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </Field>
            <Field label="Anything you'd like to share? (optional)">
              <input
                className="input"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Intentions, focus areas…"
              />
            </Field>
          </div>
        </section>

        {/* Step 4: legal review and electronic signature */}
        <section>
          <h2 className="mb-4 text-2xl">4 · Review and sign</h2>
          <div className="space-y-4 rounded-2xl border border-sage/40 bg-white/70 p-6">
            <p className="text-sm leading-relaxed text-charcoal/65">
              Your signed agreement is recorded before payment begins. Please
              open and review both documents, then sign below.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="I am signing as" required>
                <select
                  className="input"
                  required
                  aria-required="true"
                  value={agreements.signerCapacity}
                  onChange={(event) =>
                    setAgreements({
                      ...agreements,
                      signerCapacity: event.target.value,
                      guardianRelationship:
                        event.target.value === "parent_or_guardian"
                          ? agreements.guardianRelationship
                          : "",
                    })
                  }
                >
                  <option value="">Choose one</option>
                  <option value="self">The adult participant</option>
                  <option value="parent_or_guardian">
                    Parent or legal guardian
                  </option>
                </select>
              </Field>
              {agreements.signerCapacity === "parent_or_guardian" && (
                <Field label="Relationship to participant" required>
                  <input
                    className="input"
                    required
                    aria-required="true"
                    value={agreements.guardianRelationship}
                    onChange={(event) =>
                      setAgreements({
                        ...agreements,
                        guardianRelationship: event.target.value,
                      })
                    }
                    placeholder="Parent or legal guardian"
                  />
                </Field>
              )}
            </div>

            <label className="flex items-start gap-3 text-sm text-charcoal/80">
              <input
                type="checkbox"
                required
                className="mt-1 h-4 w-4 accent-[#C98C73]"
                checked={agreements.acceptedTerms}
                onChange={(event) =>
                  setAgreements({
                    ...agreements,
                    acceptedTerms: event.target.checked,
                  })
                }
              />
              <span>
                I have read and agree to the{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  className="font-semibold text-terracotta underline"
                >
                  Terms of Service
                </Link>
                .
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm text-charcoal/80">
              <input
                type="checkbox"
                required
                className="mt-1 h-4 w-4 accent-[#C98C73]"
                checked={agreements.authorizedSigner}
                onChange={(event) =>
                  setAgreements({
                    ...agreements,
                    authorizedSigner: event.target.checked,
                  })
                }
              />
              <span>
                I am at least 18 years old, or I am the participant&apos;s
                parent or legal guardian and am authorized to sign for them.
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm text-charcoal/80">
              <input
                type="checkbox"
                required
                className="mt-1 h-4 w-4 accent-[#C98C73]"
                checked={agreements.acceptedWaiver}
                onChange={(event) =>
                  setAgreements({
                    ...agreements,
                    acceptedWaiver: event.target.checked,
                  })
                }
              />
              <span>
                I have read, understand, and voluntarily sign the{" "}
                <Link
                  href="/liability-waiver"
                  target="_blank"
                  className="font-semibold text-terracotta underline"
                >
                  Liability Waiver and Assumption of Risk Agreement
                </Link>
                .
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm text-charcoal/80">
              <input
                type="checkbox"
                required
                className="mt-1 h-4 w-4 accent-[#C98C73]"
                checked={agreements.electronicConsent}
                onChange={(event) =>
                  setAgreements({
                    ...agreements,
                    electronicConsent: event.target.checked,
                  })
                }
              />
              <span>
                I consent to receive and retain these records electronically,
                can access and save or print them, and intend my typed name to
                be my electronic signature for this booking.
              </span>
            </label>

            <Field label="Electronic signature (full legal name)" required>
              <input
                className="input"
                required
                aria-required="true"
                autoComplete="name"
                value={agreements.signatureName}
                onChange={(event) =>
                  setAgreements({
                    ...agreements,
                    signatureName: event.target.value,
                  })
                }
                placeholder="Type your full legal name"
              />
            </Field>
            <p className="text-xs leading-relaxed text-charcoal/50">
              A time-stamped copy of the document versions you sign is retained
              with the booking record. Payment and booking are disabled until
              every item above is complete.
            </p>
            <p className="text-[11px] text-charcoal/40">
              Terms version {agreementEvidence.termsVersion} · Waiver version{" "}
              {agreementEvidence.waiverVersion}
            </p>
          </div>
        </section>
      </div>

      {/* Summary / checkout */}
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-3xl border border-sage/40 bg-white/80 p-7 shadow-sm">
          <h3 className="text-2xl">Your booking</h3>
          <dl className="mt-5 space-y-3 text-sm">
            <Row label="Session" value={service?.name ?? "—"} />
            <Row label="Duration" value={service ? `${service.durationMinutes} min` : "—"} />
            <Row
              label="Time"
              value={
                slot && selectedDay
                  ? `${selectedDay.dayLabel} · ${slot.localLabel}${tzAbbr ? ` (${tzAbbr})` : ""}`
                  : "Select a time"
              }
            />
            {!isFree && (
              <div className="border-t border-sage/30 pt-4">
                <label
                  htmlFor="promo-code"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wide text-charcoal/55"
                >
                  Discount code
                </label>
                <div className="flex gap-2">
                  <input
                    id="promo-code"
                    className="input min-w-0 flex-1 uppercase"
                    value={promoCode}
                    onChange={(event) => {
                      setPromoCode(event.target.value);
                      setPromotion(null);
                      setPromoMessage(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void applyPromoCode();
                      }
                    }}
                    placeholder="Enter code"
                    aria-describedby={
                      promoMessage ? "promo-code-status" : undefined
                    }
                  />
                  <button
                    type="button"
                    onClick={() => void applyPromoCode()}
                    disabled={checkingPromo || !promoCode.trim()}
                    aria-busy={checkingPromo}
                    aria-label={
                      checkingPromo
                        ? "Applying discount code"
                        : "Apply discount code"
                    }
                    className="rounded-xl border border-sage/60 px-3 text-xs font-semibold uppercase tracking-wide text-charcoal/70 transition hover:border-terracotta disabled:opacity-50"
                  >
                    {checkingPromo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Apply"
                    )}
                  </button>
                </div>
                {promoMessage && (
                  <p
                    id="promo-code-status"
                    role="status"
                    aria-live="polite"
                    className={`mt-2 text-xs ${
                      promotion ? "text-[#61705c]" : "text-terracotta"
                    }`}
                  >
                    {promoMessage}
                  </p>
                )}
              </div>
            )}
            <div className="border-t border-sage/30 pt-3">
              {promotion && (
                <>
                  <Row
                    label="Original"
                    value={service ? priceLabel(service.priceCents) : "—"}
                  />
                  <Row
                    label="Discount"
                    value={`-${promotion.discountPercent}%`}
                  />
                </>
              )}
              <Row
                label="Total"
                value={
                  service
                    ? priceLabel(
                        promotion?.amountCents ?? service.priceCents,
                      )
                    : "—"
                }
                emphasize
              />
            </div>
          </dl>

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
            disabled={!canSubmit}
            className="btn-primary mt-6 w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {isFree ? "Booking…" : "Redirecting…"}
              </>
            ) : isFree ? (
              "Confirm free session"
            ) : (
              "Continue to payment"
            )}
          </button>
          <p className="mt-3 text-center text-xs text-charcoal/50">
            {isFree
              ? "No payment required — your complimentary session is on us."
              : "Secure checkout via Stripe. You won't be charged until you confirm."}
          </p>
        </div>
      </aside>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(168,178,161,0.5);
          background: #fff;
          padding: 0.65rem 0.85rem;
          font-size: 0.9rem;
          color: #3A3A3A;
          outline: none;
        }
        .input:focus { border-color: #C98C73; box-shadow: 0 0 0 2px rgba(214,181,109,0.4); }
      `}</style>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-charcoal/80">
        {label} {required && <span className="text-terracotta">*</span>}
      </span>
      {children}
    </label>
  );
}

function Row({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-charcoal/60">{label}</dt>
      <dd
        className={
          emphasize
            ? "font-heading text-2xl text-terracotta"
            : "text-right text-charcoal"
        }
      >
        {value}
      </dd>
    </div>
  );
}
