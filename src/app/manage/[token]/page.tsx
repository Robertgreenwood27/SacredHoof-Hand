import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AppointmentManager } from "@/components/AppointmentManager";
import {
  getAgreementById,
  getAppointmentByManageToken,
} from "@/lib/appointment-management";
import { getRescheduleSlots } from "@/lib/slot-validation";
import {
  BUSINESS_TIMEZONE,
  EQUINE_LOCATION,
  isEquineServiceId,
} from "@/lib/content";
import {
  cancelClientAppointment,
  rescheduleClientAppointment,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ManageAppointmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    updated?: string;
    cancelled?: string;
    booked?: string;
    email?: string;
    delivery?: string;
    error?: string;
  }>;
}) {
  const { token } = await params;
  const notices = await searchParams;
  const appointment = await getAppointmentByManageToken(token);
  if (!appointment) notFound();

  const editable =
    appointment.status === "confirmed" &&
    new Date(appointment.starts_at).getTime() > Date.now();
  const [slots, agreement] = await Promise.all([
    editable ? getRescheduleSlots(appointment) : Promise.resolve([]),
    getAgreementById(appointment.agreement_id),
  ]);
  const rescheduleAction = rescheduleClientAppointment.bind(null, token);
  const cancelAction = cancelClientAppointment.bind(null, token);

  return (
    <main className="min-h-screen bg-ivory">
      <div className="bg-sage/25">
        <Navbar onLight />
        <header className="section pb-12 pt-32 text-center">
          <p className="eyebrow">Private booking access</p>
          <h1 className="mt-3 text-4xl md:text-5xl">Manage your session</h1>
          <p className="mx-auto mt-4 max-w-xl text-charcoal/65">
            Reschedule or cancel from this private link. Sacred Hoof &amp; Hand
            receives the same change confirmation you do.
          </p>
        </header>
      </div>

      <div className="section max-w-3xl py-12">
        {notices.booked && (
          <Notice>
            Your session is confirmed.{" "}
            {notices.email === "delayed"
              ? "Email delivery is delayed, so save this private page for your records."
              : "Confirmation was sent to both you and Sacred Hoof & Hand."}
          </Notice>
        )}
        {notices.updated && (
          <Notice>
            Your new appointment time is confirmed.{" "}
            {notices.delivery === "delayed"
              ? "One or more email notifications are delayed."
              : "Both parties were emailed."}
          </Notice>
        )}
        {notices.cancelled && (
          <Notice>
            Your appointment is cancelled.{" "}
            {notices.delivery === "delayed"
              ? "One or more email notifications are delayed."
              : "Both parties were emailed."}
          </Notice>
        )}
        {notices.error && (
          <p className="mb-6 rounded-xl bg-terracotta/15 p-4 text-sm text-terracotta">
            {notices.error === "invalid"
              ? "This private booking link is not valid."
              : notices.error}
          </p>
        )}

        <AppointmentManager
          appointment={{
            service_name: appointment.service_name,
            starts_at: appointment.starts_at,
            status: appointment.status,
          }}
          slots={slots}
          rescheduleAction={rescheduleAction}
          cancelAction={cancelAction}
          displayTimeZone={appointment.client_timezone || BUSINESS_TIMEZONE}
          viewer="client"
        />

        {/* The property is private — shown only here, behind the booking token,
            and never on a public page. */}
        {isEquineServiceId(appointment.service_id) &&
          appointment.status !== "cancelled" && (
            <section className="mt-8 rounded-2xl border border-gold/50 bg-gold/10 p-6">
              <h2 className="text-2xl">Where to meet us</h2>
              <p className="mt-3 font-heading text-xl text-charcoal">
                {EQUINE_LOCATION.address}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-charcoal/75">
                {EQUINE_LOCATION.directions}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-charcoal/75">
                {EQUINE_LOCATION.arrival}
              </p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  EQUINE_LOCATION.address,
                )}`}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-4 inline-block text-sm font-semibold text-terracotta underline"
              >
                Open in maps
              </a>
            </section>
          )}

        <section className="mt-8 rounded-2xl border border-sage/40 bg-white/75 p-6">
          <h2 className="text-2xl">Your signed agreement record</h2>
          {agreement ? (
            <>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <AgreementDetail
                  label="Electronic signature"
                  value={agreement.signature_name}
                />
                <AgreementDetail
                  label="Signed"
                  value={formatInTimeZone(
                    agreement.signed_at,
                    appointment.client_timezone || BUSINESS_TIMEZONE,
                    "MMM d, yyyy · h:mm a zzz",
                  )}
                />
                <AgreementDetail
                  label="Terms version"
                  value={agreement.terms_version}
                />
                <AgreementDetail
                  label="Waiver version"
                  value={agreement.waiver_version}
                />
                <AgreementDetail
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
              <p className="mt-5 text-xs leading-relaxed text-charcoal/55">
                These are the exact document snapshots retained when you
                signed. Use your browser&apos;s Print command to save a copy.
              </p>
              <div className="mt-4 space-y-3">
                <AgreementSnapshot
                  label="Exact Terms snapshot signed"
                  text={agreement.terms_snapshot}
                />
                <AgreementSnapshot
                  label="Exact waiver snapshot signed"
                  text={agreement.waiver_snapshot}
                />
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-charcoal/55">
              This legacy appointment does not have a stored agreement record.
            </p>
          )}
        </section>

        <p className="mt-8 text-center text-sm text-charcoal/50">
          Questions?{" "}
          <Link
            href="mailto:sacredhoofandhand@gmail.com"
            className="text-terracotta underline"
          >
            Contact Sacred Hoof &amp; Hand
          </Link>
        </p>
      </div>
      <Footer />
    </main>
  );
}

function AgreementDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-charcoal/45">{label}</dt>
      <dd className="mt-1 text-charcoal/80">{value}</dd>
    </div>
  );
}

function AgreementSnapshot({ label, text }: { label: string; text: string }) {
  return (
    <details className="rounded-xl border border-sage/35 bg-ivory/60 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-charcoal/75">
        {label}
      </summary>
      <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-charcoal/65">
        {text}
      </pre>
    </details>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-6 rounded-xl border border-sage/50 bg-sage/15 p-4 text-sm text-charcoal/75">
      {children}
    </p>
  );
}
