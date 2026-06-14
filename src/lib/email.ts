import { Resend } from "resend";
import { format } from "date-fns";
import { env, emailConfigured } from "./env";
import { formatPrice } from "./content";
import type { Appointment } from "./types";

const resend = emailConfigured ? new Resend(env.resendApiKey) : null;

type BookingEmailInput = Pick<
  Appointment,
  | "client_name"
  | "client_email"
  | "service_name"
  | "starts_at"
  | "ends_at"
  | "amount_cents"
  | "notes"
>;

function when(appt: BookingEmailInput) {
  const start = new Date(appt.starts_at);
  const end = new Date(appt.ends_at);
  return `${format(start, "EEEE, MMMM d, yyyy")} · ${format(start, "h:mm a")} – ${format(end, "h:mm a")}`;
}

const wrap = (inner: string) => `
  <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; background:#F7F3EC; padding:32px;">
    <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; border:1px solid #e7e1d6;">
      <div style="background:#A8B2A1; padding:24px 32px;">
        <h1 style="margin:0; font-family:Georgia,serif; font-size:22px; color:#3A3A3A;">Sacred Hoof &amp; Hand</h1>
      </div>
      <div style="padding:32px; color:#3A3A3A; font-size:15px; line-height:1.6;">
        ${inner}
      </div>
      <div style="padding:20px 32px; background:#F7F3EC; color:#8a857c; font-size:12px;">
        Healing through Reiki, presence, and compassionate connection.
      </div>
    </div>
  </div>
`;

/**
 * Sends booking confirmations to both the client and the practitioner.
 * No-ops (logs only) when email isn't configured yet.
 */
export async function sendBookingEmails(appt: BookingEmailInput) {
  const subjectClient = `Your Reiki session is confirmed — ${when(appt)}`;
  const subjectPractitioner = `New booking: ${appt.client_name} — ${appt.service_name}`;

  const clientHtml = wrap(`
    <p>Hi ${appt.client_name},</p>
    <p>Your session is confirmed. Here are the details:</p>
    <table style="width:100%; border-collapse:collapse; margin:16px 0;">
      <tr><td style="padding:6px 0; color:#8a857c;">Service</td><td style="padding:6px 0;">${appt.service_name}</td></tr>
      <tr><td style="padding:6px 0; color:#8a857c;">When</td><td style="padding:6px 0;">${when(appt)}</td></tr>
      <tr><td style="padding:6px 0; color:#8a857c;">Paid</td><td style="padding:6px 0;">${formatPrice(appt.amount_cents)}</td></tr>
    </table>
    <p>Take a few moments before our time together to settle in and set an intention. I look forward to holding space for you.</p>
    <p>With warmth,<br/>Sacred Hoof &amp; Hand</p>
  `);

  const practitionerHtml = wrap(`
    <p>You have a new booking.</p>
    <table style="width:100%; border-collapse:collapse; margin:16px 0;">
      <tr><td style="padding:6px 0; color:#8a857c;">Client</td><td style="padding:6px 0;">${appt.client_name} (${appt.client_email})</td></tr>
      <tr><td style="padding:6px 0; color:#8a857c;">Service</td><td style="padding:6px 0;">${appt.service_name}</td></tr>
      <tr><td style="padding:6px 0; color:#8a857c;">When</td><td style="padding:6px 0;">${when(appt)}</td></tr>
      <tr><td style="padding:6px 0; color:#8a857c;">Paid</td><td style="padding:6px 0;">${formatPrice(appt.amount_cents)}</td></tr>
      ${appt.notes ? `<tr><td style="padding:6px 0; color:#8a857c;">Notes</td><td style="padding:6px 0;">${appt.notes}</td></tr>` : ""}
    </table>
  `);

  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY not set — skipping send. Would have emailed:",
      { client: appt.client_email, practitioner: env.practitionerEmail },
    );
    return;
  }

  await Promise.all([
    resend.emails.send({
      from: env.emailFrom,
      to: appt.client_email,
      subject: subjectClient,
      html: clientHtml,
    }),
    resend.emails.send({
      from: env.emailFrom,
      to: env.practitionerEmail,
      subject: subjectPractitioner,
      html: practitionerHtml,
    }),
  ]);
}
