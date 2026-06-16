import { Resend } from "resend";
import { formatInTimeZone } from "date-fns-tz";
import { env, emailConfigured } from "./env";
import {
  priceLabel,
  AFTERCARE,
  BUSINESS_TIMEZONE,
  BUSINESS_TZ_LABEL,
} from "./content";
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
  const tz = BUSINESS_TIMEZONE;
  const day = formatInTimeZone(appt.starts_at, tz, "EEEE, MMMM d, yyyy");
  const start = formatInTimeZone(appt.starts_at, tz, "h:mm a");
  const end = formatInTimeZone(appt.ends_at, tz, "h:mm a");
  return `${day} · ${start} – ${end} (${BUSINESS_TZ_LABEL})`;
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

/** Builds the rendered subjects + HTML for both emails (no sending). */
export function buildBookingEmails(appt: BookingEmailInput) {
  const subjectClient = `Your Reiki session is confirmed — ${when(appt)}`;
  const subjectPractitioner = `New booking: ${appt.client_name} — ${appt.service_name}`;

  const supportsList = AFTERCARE.supports
    .map(
      (item) =>
        `<li style="margin:2px 0; padding-left:18px; position:relative;"><span style="position:absolute; left:0; color:#C98C73;">&bull;</span>${item}</li>`,
    )
    .join("");

  const clientHtml = wrap(`
    <p>Hi ${appt.client_name},</p>
    <p>Your session is confirmed. Here are the details:</p>
    <table style="width:100%; border-collapse:collapse; margin:16px 0;">
      <tr><td style="padding:6px 16px 6px 0; color:#8a857c; vertical-align:top; white-space:nowrap;">Service</td><td style="padding:6px 0;">${appt.service_name}</td></tr>
      <tr><td style="padding:6px 16px 6px 0; color:#8a857c; vertical-align:top; white-space:nowrap;">When</td><td style="padding:6px 0;">${when(appt)}</td></tr>
      <tr><td style="padding:6px 16px 6px 0; color:#8a857c; vertical-align:top; white-space:nowrap;">Paid</td><td style="padding:6px 0;">${priceLabel(appt.amount_cents)}</td></tr>
    </table>
    <p>Take a few moments before our time together to settle in and set an intention. I look forward to holding space for you.</p>

    <div style="margin:24px 0; padding:20px 22px; background:#F7F3EC; border-left:3px solid #D6B56D; border-radius:8px;">
      <p style="margin:0 0 8px; font-family:Georgia,serif; font-size:17px; color:#3A3A3A;">${AFTERCARE.heading}</p>
      <p style="margin:0 0 12px; color:#5c5850; font-size:14px; line-height:1.6;">${AFTERCARE.body}</p>
      <p style="margin:0 0 6px; color:#5c5850; font-size:14px;">${AFTERCARE.supportsIntro}</p>
      <ul style="margin:0; padding:0; list-style:none; color:#3A3A3A; font-size:14px;">${supportsList}</ul>
    </div>

    <p>With warmth,<br/>Sacred Hoof &amp; Hand</p>
  `);

  const practitionerHtml = wrap(`
    <p>You have a new booking.</p>
    <table style="width:100%; border-collapse:collapse; margin:16px 0;">
      <tr><td style="padding:6px 16px 6px 0; color:#8a857c; vertical-align:top; white-space:nowrap;">Client</td><td style="padding:6px 0;">${appt.client_name} (${appt.client_email})</td></tr>
      <tr><td style="padding:6px 16px 6px 0; color:#8a857c; vertical-align:top; white-space:nowrap;">Service</td><td style="padding:6px 0;">${appt.service_name}</td></tr>
      <tr><td style="padding:6px 16px 6px 0; color:#8a857c; vertical-align:top; white-space:nowrap;">When</td><td style="padding:6px 0;">${when(appt)}</td></tr>
      <tr><td style="padding:6px 16px 6px 0; color:#8a857c; vertical-align:top; white-space:nowrap;">Paid</td><td style="padding:6px 0;">${priceLabel(appt.amount_cents)}</td></tr>
      ${appt.notes ? `<tr><td style="padding:6px 16px 6px 0; color:#8a857c; vertical-align:top; white-space:nowrap;">Notes</td><td style="padding:6px 0;">${appt.notes}</td></tr>` : ""}
    </table>
  `);

  return { subjectClient, subjectPractitioner, clientHtml, practitionerHtml };
}

/**
 * Sends booking confirmations to both the client and the practitioner.
 * No-ops (logs only) when email isn't configured yet.
 */
export async function sendBookingEmails(appt: BookingEmailInput) {
  const { subjectClient, subjectPractitioner, clientHtml, practitionerHtml } =
    buildBookingEmails(appt);

  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY not set — skipping send. Would have emailed:",
      { client: appt.client_email, practitioner: env.practitionerEmail },
    );
    return;
  }

  const [clientRes, practitionerRes] = await Promise.all([
    // Client confirmation — replies go to the practitioner.
    resend.emails.send({
      from: env.emailFrom,
      to: appt.client_email,
      replyTo: env.practitionerEmail,
      subject: subjectClient,
      html: clientHtml,
    }),
    // Practitioner notification — replies go straight to the client.
    resend.emails.send({
      from: env.emailFrom,
      to: env.practitionerEmail,
      replyTo: appt.client_email,
      subject: subjectPractitioner,
      html: practitionerHtml,
    }),
  ]);

  // Resend returns errors in the payload rather than throwing — surface them.
  if (clientRes.error) {
    console.error("[email] client confirmation failed:", clientRes.error);
  }
  if (practitionerRes.error) {
    console.error("[email] practitioner notification failed:", practitionerRes.error);
  }
}
