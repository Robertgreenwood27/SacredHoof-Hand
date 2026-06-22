import { getAvailabilityRules, getBlockedDays } from "@/lib/data";
import {
  addAvailabilityRule,
  deleteAvailabilityRule,
  blockDay,
  unblockDay,
} from "../actions";
import { supabaseConfigured } from "@/lib/env";
import { SetupNotice } from "@/components/dashboard/SetupNotice";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Format a "YYYY-MM-DD" key as a friendly date without timezone drift. */
function formatDayKey(day: string): string {
  return format(new Date(`${day}T12:00:00`), "EEEE, MMMM d, yyyy");
}

export default async function AvailabilityPage() {
  const [rules, blockedDays] = await Promise.all([
    getAvailabilityRules(),
    getBlockedDays(),
  ]);
  // Only surface today and future days off; past ones are just clutter.
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const upcomingBlocked = blockedDays.filter((b) => b.day >= todayKey);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Availability</h1>
        <p className="text-charcoal/60">
          Set the weekly windows when clients can book. Slots are generated from
          these hours and the session length, minus anything already booked.
        </p>
      </header>

      {!supabaseConfigured ? (
        <SetupNotice />
      ) : (
        <>
          <form
            action={addAvailabilityRule}
            className="flex flex-wrap items-end gap-4 rounded-2xl border border-sage/40 bg-white/70 p-6"
          >
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-charcoal/80">Day</span>
              <select
                name="day_of_week"
                defaultValue="1"
                className="rounded-xl border border-sage/50 bg-white px-4 py-2.5 text-sm"
              >
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-charcoal/80">Start</span>
              <input
                type="time"
                name="start_time"
                defaultValue="10:00"
                className="rounded-xl border border-sage/50 bg-white px-4 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-charcoal/80">End</span>
              <input
                type="time"
                name="end_time"
                defaultValue="16:00"
                className="rounded-xl border border-sage/50 bg-white px-4 py-2.5 text-sm"
              />
            </label>
            <button className="btn-primary">Add window</button>
          </form>

          <div className="space-y-3">
            {rules.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-sage/50 bg-white/40 p-6 text-sm text-charcoal/50">
                No availability set yet. Add a window above.
              </p>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between rounded-2xl border border-sage/40 bg-white/70 px-5 py-4"
                >
                  <div>
                    <p className="font-heading text-lg">{DAYS[rule.day_of_week]}</p>
                    <p className="text-sm text-charcoal/60">
                      {rule.start_time} – {rule.end_time}
                    </p>
                  </div>
                  <form action={deleteAvailabilityRule.bind(null, rule.id)}>
                    <button
                      className="flex items-center gap-1 text-sm text-charcoal/50 hover:text-terracotta"
                      aria-label="Delete window"
                    >
                      <Trash2 className="h-4 w-4" /> Remove
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>

          <section className="space-y-4 border-t border-sage/30 pt-8">
            <header>
              <h2 className="text-2xl">Days off</h2>
              <p className="text-charcoal/60">
                Block out full days you&apos;re unavailable (vacation, time off).
                No times are offered to clients on these days.
              </p>
            </header>

            <form
              action={blockDay}
              className="flex flex-wrap items-end gap-4 rounded-2xl border border-sage/40 bg-white/70 p-6"
            >
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-charcoal/80">Date</span>
                <input
                  type="date"
                  name="day"
                  required
                  min={todayKey}
                  className="rounded-xl border border-sage/50 bg-white px-4 py-2.5 text-sm"
                />
              </label>
              <label className="block flex-1 min-w-[12rem]">
                <span className="mb-1 block text-sm font-medium text-charcoal/80">
                  Reason <span className="text-charcoal/40">(optional, private)</span>
                </span>
                <input
                  type="text"
                  name="reason"
                  placeholder="e.g. Vacation"
                  className="w-full rounded-xl border border-sage/50 bg-white px-4 py-2.5 text-sm"
                />
              </label>
              <button className="btn-primary">Block day</button>
            </form>

            <div className="space-y-3">
              {upcomingBlocked.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-sage/50 bg-white/40 p-6 text-sm text-charcoal/50">
                  No days off scheduled. Block one above when you need a break.
                </p>
              ) : (
                upcomingBlocked.map((b) => (
                  <div
                    key={b.day}
                    className="flex items-center justify-between rounded-2xl border border-sage/40 bg-white/70 px-5 py-4"
                  >
                    <div>
                      <p className="font-heading text-lg">{formatDayKey(b.day)}</p>
                      {b.reason && (
                        <p className="text-sm text-charcoal/60">{b.reason}</p>
                      )}
                    </div>
                    <form action={unblockDay.bind(null, b.day)}>
                      <button
                        className="flex items-center gap-1 text-sm text-charcoal/50 hover:text-terracotta"
                        aria-label="Remove day off"
                      >
                        <Trash2 className="h-4 w-4" /> Remove
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
