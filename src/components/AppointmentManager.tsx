"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import type { GridSlot } from "@/lib/scheduling";
import type { Appointment } from "@/lib/types";

type Action = (formData: FormData) => void | Promise<void>;

type Props = {
  appointment: Pick<Appointment, "service_name" | "starts_at" | "status">;
  slots: GridSlot[];
  rescheduleAction: Action;
  cancelAction: Action;
  displayTimeZone: string;
  viewer: "client" | "practitioner";
};

type LocalSlot = GridSlot & { timeLabel: string };
type LocalDay = {
  key: string;
  label: string;
  shortLabel: string;
  slots: LocalSlot[];
};

function dateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function groupSlots(slots: GridSlot[], timeZone: string): LocalDay[] {
  const dayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const shortLabel = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    day: "numeric",
  });
  const timeLabel = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const grouped = new Map<string, LocalDay>();

  for (const slot of slots.filter((candidate) => candidate.available)) {
    const start = new Date(slot.startsAt);
    const key = dateKey(start, timeZone);
    const day =
      grouped.get(key) ??
      {
        key,
        label: dayLabel.format(start),
        shortLabel: shortLabel.format(start),
        slots: [],
      };
    day.slots.push({ ...slot, timeLabel: timeLabel.format(start) });
    grouped.set(key, day);
  }
  return [...grouped.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function formatCurrent(
  appointment: Pick<Appointment, "starts_at">,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(appointment.starts_at));
}

export function AppointmentManager({
  appointment,
  slots,
  rescheduleAction,
  cancelAction,
  displayTimeZone,
  viewer,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const days = useMemo(
    () =>
      groupSlots(
        slots.filter(
          (slot) =>
            new Date(slot.startsAt).getTime() !==
            new Date(appointment.starts_at).getTime(),
        ),
        displayTimeZone,
      ),
    [slots, displayTimeZone, appointment.starts_at],
  );
  const [dayKey, setDayKey] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<LocalSlot | null>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setDayKey(days[0]?.key);
    setSelected(null);
  }, [days]);
  const activeDay = days.find((day) => day.key === dayKey);
  const editable =
    appointment.status === "confirmed" &&
    new Date(appointment.starts_at).getTime() > Date.now();

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-sage/40 bg-white/75 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-terracotta/10 p-3 text-terracotta">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-xl">{appointment.service_name}</p>
            <p className="mt-1 text-sm text-charcoal/65">
              {mounted
                ? formatCurrent(appointment, displayTimeZone)
                : "Loading appointment time…"}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-charcoal/45">
              Status: {appointment.status}
            </p>
          </div>
        </div>
      </section>

      {editable ? (
        <section className="space-y-5 rounded-2xl border border-sage/40 bg-white/75 p-6">
          <header>
            <h2 className="text-2xl">Choose a new time</h2>
            <p className="mt-1 text-sm text-charcoal/60">
              Available times are shown in the timezone used for this booking.
              Both parties receive an email as soon as the time changes.
            </p>
          </header>

          {days.length === 0 ? (
            <p className="rounded-xl bg-sage/10 p-4 text-sm text-charcoal/60">
              No alternate times are currently open. Please check back or reply
              to the confirmation email for help.
            </p>
          ) : (
            <form action={rescheduleAction} className="space-y-5">
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
                {days.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    aria-pressed={day.key === dayKey}
                    onClick={() => {
                      setDayKey(day.key);
                      setSelected(null);
                    }}
                    className={`shrink-0 rounded-xl border px-4 py-2 text-sm transition ${
                      day.key === dayKey
                        ? "border-terracotta bg-terracotta text-ivory"
                        : "border-sage/50 bg-white hover:border-terracotta"
                    }`}
                  >
                    {day.shortLabel}
                  </button>
                ))}
              </div>

              {activeDay && (
                <div>
                  <p className="mb-3 text-sm font-semibold text-charcoal/70">
                    {activeDay.label}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {activeDay.slots.map((slot) => (
                      <button
                        key={slot.startsAt}
                        type="button"
                        aria-pressed={selected?.startsAt === slot.startsAt}
                        onClick={() => setSelected(slot)}
                        className={`rounded-xl border px-3 py-2 text-sm transition ${
                          selected?.startsAt === slot.startsAt
                            ? "border-terracotta bg-terracotta text-ivory"
                            : "border-sage/50 bg-white hover:border-terracotta"
                        }`}
                      >
                        {slot.timeLabel}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <input type="hidden" name="startsAt" value={selected?.startsAt ?? ""} />
              <input type="hidden" name="endsAt" value={selected?.endsAt ?? ""} />
              <SubmitButton disabled={!selected}>Confirm new time</SubmitButton>
            </form>
          )}
        </section>
      ) : (
        <p className="rounded-2xl border border-sage/40 bg-white/70 p-6 text-sm text-charcoal/60">
          This appointment can no longer be changed online.
        </p>
      )}

      {editable && (
        <section className="rounded-2xl border border-terracotta/30 bg-terracotta/5 p-6">
          <h2 className="text-xl">Need to cancel?</h2>
          <p className="mt-2 text-sm leading-relaxed text-charcoal/65">
            The Terms allow penalty-free rescheduling with at least 72 hours’
            notice; cancellations with less than 24 hours’ notice may be subject
            to fees. Cancelling here does not automatically issue a refund.
          </p>
          <form
            action={cancelAction}
            className="mt-4"
            onSubmit={(event) => {
              if (
                !window.confirm(
                  viewer === "client"
                    ? "Cancel this appointment? Both you and the practitioner will be notified."
                    : "Cancel this appointment and notify the client?",
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            <SubmitButton subtle>Cancel appointment</SubmitButton>
          </form>
        </section>
      )}
    </div>
  );
}

function SubmitButton({
  children,
  disabled,
  subtle,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  subtle?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={subtle ? "btn-secondary" : "btn-primary"}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
