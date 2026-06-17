import { isAfter } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { setAppointmentStatus } from "./actions";
import { formatPrice, BUSINESS_TIMEZONE } from "@/lib/content";
import type { Appointment } from "@/lib/types";
import { SetupNotice } from "@/components/dashboard/SetupNotice";

export const dynamic = "force-dynamic";

const statusStyles: Record<string, string> = {
  pending: "bg-gold/20 text-charcoal",
  confirmed: "bg-sage/30 text-charcoal",
  completed: "bg-charcoal/10 text-charcoal/70",
  cancelled: "bg-terracotta/15 text-terracotta line-through",
};

export default async function AppointmentsPage() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return (
      <Shell>
        <SetupNotice />
      </Shell>
    );
  }

  const { data } = await supabase
    .from("appointments")
    .select("*")
    .order("starts_at", { ascending: true });

  const appts = (data ?? []) as Appointment[];
  const now = new Date();
  const upcoming = appts.filter(
    (a) => isAfter(new Date(a.starts_at), now) && a.status !== "cancelled",
  );
  const past = appts.filter(
    (a) => !isAfter(new Date(a.starts_at), now) || a.status === "cancelled",
  );

  return (
    <Shell>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Upcoming" value={upcoming.length} />
        <Stat
          label="This month"
          value={
            appts.filter(
              (a) => new Date(a.starts_at).getMonth() === now.getMonth(),
            ).length
          }
        />
        <Stat
          label="Revenue (confirmed)"
          value={formatPrice(
            appts
              .filter((a) => a.status === "confirmed" || a.status === "completed")
              .reduce((sum, a) => sum + a.amount_cents, 0),
          )}
        />
      </div>

      <Section title="Upcoming sessions">
        {upcoming.length === 0 ? (
          <Empty>No upcoming sessions yet.</Empty>
        ) : (
          upcoming.map((a) => <Row key={a.id} appt={a} />)
        )}
      </Section>

      {past.length > 0 && (
        <Section title="Past & cancelled">
          {past.map((a) => (
            <Row key={a.id} appt={a} />
          ))}
        </Section>
      )}
    </Shell>
  );
}

function Row({ appt }: { appt: Appointment }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-sage/40 bg-white/70 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <p className="font-heading text-lg">{appt.client_name}</p>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${statusStyles[appt.status]}`}
          >
            {appt.status}
          </span>
        </div>
        <p className="text-sm text-charcoal/70">{appt.service_name}</p>
        <p className="text-sm text-charcoal/50">
          {formatInTimeZone(appt.starts_at, BUSINESS_TIMEZONE, "EEE MMM d, yyyy · h:mm a zzz")}{" "}
          · {appt.client_email}
        </p>
        {appt.client_timezone && appt.client_timezone !== BUSINESS_TIMEZONE && (
          <p className="text-xs text-charcoal/40">
            Client&apos;s local time:{" "}
            {formatInTimeZone(appt.starts_at, appt.client_timezone, "h:mm a zzz")}
          </p>
        )}
        {appt.notes && (
          <p className="mt-1 text-sm italic text-charcoal/50">“{appt.notes}”</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {appt.status !== "confirmed" && appt.status !== "cancelled" && (
          <StatusButton id={appt.id} status="confirmed" label="Confirm" />
        )}
        {appt.status !== "completed" && appt.status !== "cancelled" && (
          <StatusButton id={appt.id} status="completed" label="Mark done" subtle />
        )}
        {appt.status !== "cancelled" && (
          <StatusButton id={appt.id} status="cancelled" label="Cancel" subtle />
        )}
      </div>
    </div>
  );
}

function StatusButton({
  id,
  status,
  label,
  subtle,
}: {
  id: string;
  status: Appointment["status"];
  label: string;
  subtle?: boolean;
}) {
  return (
    <form action={setAppointmentStatus.bind(null, id, status)}>
      <button
        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
          subtle
            ? "border border-sage/50 text-charcoal/60 hover:bg-sage/20"
            : "bg-terracotta text-ivory hover:bg-[#b87a62]"
        }`}
      >
        {label}
      </button>
    </form>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl">Appointments</h1>
        <p className="text-charcoal/60">Manage your upcoming and past sessions.</p>
      </header>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-sage/40 bg-white/70 p-5">
      <p className="text-xs uppercase tracking-wide text-charcoal/50">{label}</p>
      <p className="mt-1 font-heading text-3xl text-terracotta">{value}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-sage/50 bg-white/40 p-6 text-sm text-charcoal/50">
      {children}
    </p>
  );
}
