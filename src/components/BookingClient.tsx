"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Check, Loader2 } from "lucide-react";
import { priceLabel } from "@/lib/content";
import { groupSlotsByDay } from "@/lib/scheduling";
import type { Service, TimeSlot } from "@/lib/types";

type Props = {
  services: Service[];
  slotsByService: Record<string, TimeSlot[]>;
  preselectServiceId?: string;
};

export function BookingClient({ services, slotsByService, preselectServiceId }: Props) {
  const initial =
    services.find((s) => s.id === preselectServiceId) ?? services[0];
  const [serviceId, setServiceId] = useState(initial?.id);
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? services[0];
  const isFree = service?.priceCents === 0;
  const slots = slotsByService[serviceId ?? ""] ?? [];
  const grouped = useMemo(() => groupSlotsByDay(slots), [slots]);
  const days = Object.keys(grouped);

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
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      if (data.url) {
        window.location.href = data.url; // Stripe Checkout
      } else {
        throw new Error("No checkout URL returned.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  const canSubmit = service && slot && form.name && form.email && !submitting;

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
                onClick={() => {
                  setServiceId(s.id);
                  setSlot(null);
                }}
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
          <h2 className="mb-4 text-2xl">2 · Pick a time</h2>
          {days.length === 0 ? (
            <p className="rounded-xl border border-sage/40 bg-white/60 p-5 text-sm text-charcoal/60">
              No open times in the next few weeks. Please check back soon or reach
              out directly.
            </p>
          ) : (
            <div className="space-y-5">
              {days.map((day) => (
                <div key={day}>
                  <p className="mb-2 text-sm font-semibold text-charcoal/70">
                    {format(new Date(day + "T00:00:00"), "EEEE, MMMM d")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {grouped[day].map((s) => {
                      const active = slot?.startsAt === s.startsAt;
                      return (
                        <button
                          key={s.startsAt}
                          onClick={() => setSlot(s)}
                          className={`rounded-full border px-4 py-2 text-sm transition ${
                            active
                              ? "border-terracotta bg-terracotta text-ivory"
                              : "border-sage/50 bg-white/70 hover:border-terracotta"
                          }`}
                        >
                          {format(new Date(s.startsAt), "h:mm a")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
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
              />
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
              value={slot ? format(new Date(slot.startsAt), "EEE MMM d · h:mm a") : "Select a time"}
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
    <div className="flex items-center justify-between">
      <dt className="text-charcoal/60">{label}</dt>
      <dd className={emphasize ? "font-heading text-2xl text-terracotta" : "text-charcoal"}>
        {value}
      </dd>
    </div>
  );
}
