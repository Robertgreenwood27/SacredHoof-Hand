import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { AppointmentManager } from "@/components/AppointmentManager";
import {
  getAgreementById,
  getAppointmentById,
} from "@/lib/appointment-management";
import { getRescheduleSlots } from "@/lib/slot-validation";
import { BUSINESS_TIMEZONE, formatPrice } from "@/lib/content";
import {
  cancelDashboardAppointment,
  rescheduleDashboardAppointment,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function DashboardAppointmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    updated?: string;
    cancelled?: string;
    delivery?: string;
    error?: string;
  }>;
}) {
  const { id } = await params;
  const notices = await searchParams;
  const appointment = await getAppointmentById(id);
  if (!appointment) notFound();

  const editable =
    appointment.status === "confirmed" &&
    new Date(appointment.starts_at).getTime() > Date.now();
  const [slots, agreement] = await Promise.all([
    editable ? getRescheduleSlots(appointment) : Promise.resolve([]),
    getAgreementById(appointment.agreement_id),
  ]);
  const rescheduleAction = rescheduleDashboardAppointment.bind(null, id);
  const cancelAction = cancelDashboardAppointment.bind(null, id);

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/dashboard"
          className="text-sm text-charcoal/55 underline hover:text-terracotta"
        >
          ← All appointments
        </Link>
        <h1 className="mt-3 text-3xl">{appointment.client_name}</h1>
        <p className="text-charcoal/60">
          {appointment.client_email}
          {appointment.client_phone ? ` · ${appointment.client_phone}` : ""}
        </p>
      </header>

      {notices.updated && (
        <Notice>
          The new time is confirmed.{" "}
          {notices.delivery === "delayed"
            ? "One or more email notifications are delayed."
            : "Both parties were emailed."}
        </Notice>
      )}
      {notices.cancelled && (
        <Notice>
          The appointment is cancelled.{" "}
          {notices.delivery === "delayed"
            ? "One or more email notifications are delayed."
            : "Both parties were emailed."}
        </Notice>
      )}
      {notices.error && (
        <p className="rounded-xl bg-terracotta/15 p-4 text-sm text-terracotta">
          {notices.error}
        </p>
      )}
      {appointment.status === "pending" && (
        <p className="rounded-xl border border-gold/50 bg-gold/15 p-4 text-sm text-charcoal/75">
          Awaiting checkout. This is an unpaid reservation and is not a
          confirmed appointment.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Detail
          label={appointment.status === "pending" ? "Payment" : "Paid"}
          value={
            appointment.status === "pending"
              ? "Awaiting checkout"
              : formatPrice(appointment.amount_cents)
          }
        />
        <Detail
          label="Discount"
          value={
            appointment.discount_code
              ? `${appointment.discount_percent}% · ${appointment.discount_code}`
              : "None"
          }
        />
        <Detail
          label="Reminder"
          value={appointment.reminder_sent_at ? "Sent" : "Pending"}
        />
      </div>

      <AppointmentManager
        appointment={{
          service_name: appointment.service_name,
          starts_at: appointment.starts_at,
          status: appointment.status,
        }}
        slots={slots}
        rescheduleAction={rescheduleAction}
        cancelAction={cancelAction}
        displayTimeZone={BUSINESS_TIMEZONE}
        viewer="practitioner"
      />

      <section className="rounded-2xl border border-sage/40 bg-white/75 p-6">
        <h2 className="text-2xl">Signed agreements</h2>
        {agreement ? (
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <DetailRow label="Electronic signature" value={agreement.signature_name} />
            <DetailRow
              label="Signed"
              value={formatInTimeZone(
                agreement.signed_at,
                BUSINESS_TIMEZONE,
                "MMM d, yyyy · h:mm a zzz",
              )}
            />
            <DetailRow label="Terms version" value={agreement.terms_version} />
            <DetailRow label="Waiver version" value={agreement.waiver_version} />
            <DetailRow
              label="Signer capacity"
              value={
                agreement.signer_capacity === "parent_or_guardian"
                  ? `Parent/legal guardian${
                      agreement.guardian_relationship
                        ? ` · ${agreement.guardian_relationship}`
                        : ""
                    }`
                  : agreement.signer_capacity === "self"
                    ? "Adult participant"
                    : "Legacy record · not captured"
              }
            />
          </dl>
        ) : (
          <p className="mt-3 text-sm text-charcoal/55">
            No stored agreement is attached to this legacy appointment.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-4 text-sm">
          <Link href="/terms" target="_blank" className="text-terracotta underline">
            View current Terms
          </Link>
          <Link
            href="/liability-waiver"
            target="_blank"
            className="text-terracotta underline"
          >
            View current waiver
          </Link>
        </div>
        {agreement && (
          <div className="mt-6 space-y-3">
            <details className="rounded-xl border border-sage/35 bg-ivory/60 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-charcoal/75">
                Exact Terms snapshot signed
              </summary>
              <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-charcoal/65">
                {agreement.terms_snapshot}
              </pre>
            </details>
            <details className="rounded-xl border border-sage/35 bg-ivory/60 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-charcoal/75">
                Exact waiver snapshot signed
              </summary>
              <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-charcoal/65">
                {agreement.waiver_snapshot}
              </pre>
            </details>
          </div>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sage/40 bg-white/70 p-5">
      <p className="text-xs uppercase tracking-wide text-charcoal/45">{label}</p>
      <p className="mt-1 font-heading text-xl text-terracotta">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-charcoal/45">{label}</dt>
      <dd className="mt-1 text-charcoal/80">{value}</dd>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-sage/50 bg-sage/15 p-4 text-sm text-charcoal/75">
      {children}
    </p>
  );
}
