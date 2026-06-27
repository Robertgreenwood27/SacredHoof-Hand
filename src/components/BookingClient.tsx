"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { priceLabel } from "@/lib/content";
import { isValidEmail } from "@/lib/validation";
import type { GridSlot } from "@/lib/scheduling";
import type { Service } from "@/lib/types";

type Props = {
  services: Service[];
  slotsByService: Record<string, GridSlot[]>;
  preselectServiceId?: string;
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

export function BookingClient({ services, slotsByService, preselectServiceId }: Props) {
  const initial =
    services.find((s) => s.id === preselectServiceId) ?? services[0];
  const [serviceId, setServiceId] = useState(initial?.id);
  const [dateKey, setDateKey] = useState<string | undefined>(undefined);
  const [slot, setSlot] = useState<LocalSlot | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

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
    service && slot && form.name.trim() && emailValid && !submitting;
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
                onClick={() => setServiceId(s.id)}
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
                      onClick={() => {
                        setDateKey(day.dateKey);
                        setSlot(null);
                      }}
                      disabled={!day.hasAvailable}
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
                          onClick={() => s.available && setSlot(s)}
                          disabled={!s.available}
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
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Doe"
              />
            </Field>
            <Field label="Email" required>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@example.com"
                aria-invalid={showEmailError}
              />
              {showEmailError && (
                <span className="mt-1 block text-xs text-terracotta">
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
            <div className="border-t border-sage/30 pt-3">
              <Row
                label="Total"
                value={service ? priceLabel(service.priceCents) : "—"}
                emphasize
              />
            </div>
          </dl>

          {error && (
            <p className="mt-4 rounded-lg bg-terracotta/15 px-3 py-2 text-sm text-terracotta">
              {error}
            </p>
          )}

          <button
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
