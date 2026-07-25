import { Resend } from "resend";
import { formatInTimeZone } from "date-fns-tz";
import { env, emailConfigured } from "./env";
import { priceLabel, AFTERCARE, BUSINESS_TIMEZONE } from "./content";
import { isValidEmail } from "./validation";
import type { Appointment } from "./types";

const resend = emailConfigured ? new Resend(env.resendApiKey) : null;

export type AppointmentEmailInput = Pick<
  Appointment,
  | "client_name"
  | "client_email"
  | "service_name"
  | "starts_at"
  | "ends_at"
  | "amount_cents"
  | "notes"
  | "client_timezone"
> & {
  /** Database id used to make provider retries idempotent. */
  appointment_id?: string;
  /** Opaque client self-service link, when one has been issued. */
  manage_url?: string | null;
  /** Distinguishes separate reschedules of the same appointment. */
  notification_key?: string;
};

type RenderedAppointmentEmails = {
  subjectClient: string;
  subjectPractitioner: string;
  clientHtml: string;
  practitionerHtml: string;
};

export type EmailDeliveryResult = {
  clientSent: boolean;
  practitionerSent: boolean;
};

export type EmailRecipients = {
  client?: boolean;
  practitioner?: boolean;
};

/** Escape untrusted text before interpolating it into email HTML. */
function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeMultilineHtml(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br/>");
}

/** Keep client-controlled values from introducing line breaks into subjects. */
function subjectText(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function clientTimeZone(appt: AppointmentEmailInput): string {
  const candidate = appt.client_timezone || BUSINESS_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return BUSINESS_TIMEZONE;
  }
}

/**
 * Only render web links. Resolving relative links against the site URL lets
 * callers pass either a full manage URL or an app-relative path.
 */
function normalizeManageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, env.siteUrl);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/**
 * Renders the appointment date/time in a given timezone, with the zone's
 * abbreviation (e.g. "MDT", "CST") so each recipient reads it in their own
 * frame: the client in the zone they booked from, the practitioner in Mountain.
 */
function when(appt: AppointmentEmailInput, tz: string) {
  const day = formatInTimeZone(appt.starts_at, tz, "EEEE, MMMM d, yyyy");
  const start = formatInTimeZone(appt.starts_at, tz, "h:mm a");
  const end = formatInTimeZone(appt.ends_at, tz, "h:mm a");
  const abbr = formatInTimeZone(appt.starts_at, tz, "zzz");
  return `${day} · ${start} – ${end} (${abbr})`;
}

const wrap = (inner: string) => `
  <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; background:#F7F3EC; padding:16px;">
    <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; border:1px solid #e7e1d6;">
      <div style="background:#A8B2A1; padding:20px 24px;">
        <h1 style="margin:0; font-family:Georgia,serif; font-size:22px; color:#3A3A3A;">Sacred Hoof &amp; Hand</h1>
      </div>
      <div style="padding:24px; color:#3A3A3A; font-size:15px; line-height:1.6;">
        ${inner}
      </div>
      <div style="padding:16px 24px; background:#F7F3EC; color:#8a857c; font-size:12px;">
        Healing through Reiki, presence, and compassionate connection.
      </div>
    </div>
  </div>
`;

// Detail-table row. Value cells wrap (long emails have no spaces, so without
// this they overflow and clip the right side of the table on narrow screens).
const row = (label: string, value: string) =>
  `<tr>
    <td style="width:68px; padding:6px 16px 6px 0; color:#8a857c; vertical-align:top; white-space:nowrap;">${label}</td>
    <td style="padding:6px 0; word-break:break-word; overflow-wrap:anywhere;">${value}</td>
  </tr>`;

const textRow = (label: string, value: string | number) =>
  row(escapeHtml(label), escapeHtml(value));

function clientRow(appt: AppointmentEmailInput): string {
  const email = appt.client_email.trim();
  return row(
    "Client",
    `${escapeHtml(appt.client_name)}<br/><a href="mailto:${encodeURIComponent(email)}" style="color:#C98C73;">${escapeHtml(email)}</a>`,
  );
}

function notesRow(notes: string | null): string {
  return notes ? row("Notes", escapeMultilineHtml(notes)) : "";
}

function manageBookingLink(appt: AppointmentEmailInput): string {
  const manageUrl = normalizeManageUrl(appt.manage_url);
  if (!manageUrl) return "";

  return `
    <div style="margin:22px 0; text-align:center;">
      <a href="${escapeHtml(manageUrl)}" style="display:inline-block; border-radius:999px; background:#C98C73; padding:11px 20px; color:#fff; font-weight:600; text-decoration:none;">
        Manage your booking
      </a>
    </div>
  `;
}

/** Builds the rendered subjects + HTML for both emails (no sending). */
export function buildBookingEmails(
  appt: AppointmentEmailInput,
): RenderedAppointmentEmails {
  // Client sees the time in the zone they booked from; the practitioner always
  // sees Mountain. Falls back to Mountain if we never captured the client's zone.
  const clientTz = clientTimeZone(appt);
  const whenClient = when(appt, clientTz);
  const whenPractitioner = when(appt, BUSINESS_TIMEZONE);

  const subjectClient = `Your Reiki session is confirmed — ${whenClient}`;
  const subjectPractitioner = `New booking: ${subjectText(appt.client_name)} — ${subjectText(appt.service_name)}`;

  const supportsList = AFTERCARE.supports
    .map(
      (item) =>
        `<li style="margin:2px 0; padding-left:18px; position:relative;"><span style="position:absolute; left:0; color:#C98C73;">&bull;</span>${escapeHtml(item)}</li>`,
    )
    .join("");

  const clientHtml = wrap(`
    <p>Hi ${escapeHtml(appt.client_name)},</p>
    <p>Your session is confirmed. Here are the details:</p>
    <table style="width:100%; border-collapse:collapse; margin:16px 0; table-layout:fixed;">
      ${textRow("Service", appt.service_name)}
      ${textRow("When", whenClient)}
      ${textRow("Paid", priceLabel(appt.amount_cents))}
    </table>
    ${manageBookingLink(appt)}
    <p>Take a few moments before our time together to settle in and set an intention. I look forward to holding space for you.</p>

    <div style="margin:24px 0; padding:20px 22px; background:#F7F3EC; border-left:3px solid #D6B56D; border-radius:8px;">
      <p style="margin:0 0 8px; font-family:Georgia,serif; font-size:17px; color:#3A3A3A;">${escapeHtml(AFTERCARE.heading)}</p>
      <p style="margin:0 0 12px; color:#5c5850; font-size:14px; line-height:1.6;">${escapeHtml(AFTERCARE.body)}</p>
      <p style="margin:0 0 6px; color:#5c5850; font-size:14px;">${escapeHtml(AFTERCARE.supportsIntro)}</p>
      <ul style="margin:0; padding:0; list-style:none; color:#3A3A3A; font-size:14px;">${supportsList}</ul>
    </div>

    <p>With warmth,<br/>Sacred Hoof &amp; Hand</p>
  `);

  const practitionerHtml = wrap(`
    <p>You have a new booking.</p>
    <table style="width:100%; border-collapse:collapse; margin:16px 0; table-layout:fixed;">
      ${clientRow(appt)}
      ${textRow("Service", appt.service_name)}
      ${textRow("When", whenPractitioner)}
      ${textRow("Paid", priceLabel(appt.amount_cents))}
      ${notesRow(appt.notes)}
    </table>
  `);

  return { subjectClient, subjectPractitioner, clientHtml, practitionerHtml };
}

function buildAppointmentChangedEmails(
  appt: AppointmentEmailInput,
): RenderedAppointmentEmails {
  const whenClient = when(appt, clientTimeZone(appt));
  const whenPractitioner = when(appt, BUSINESS_TIMEZONE);
  const subjectClient = `Your Reiki session has been rescheduled — ${whenClient}`;
  const subjectPractitioner = `Booking changed: ${subjectText(appt.client_name)} — ${subjectText(appt.service_name)}`;

  const clientHtml = wrap(`
    <p>Hi ${escapeHtml(appt.client_name)},</p>
    <p>Your session has been rescheduled. Here are the updated details:</p>
    <table style="width:100%; border-collapse:collapse; margin:16px 0; table-layout:fixed;">
      ${textRow("Service", appt.service_name)}
      ${textRow("When", whenClient)}
      ${textRow("Paid", priceLabel(appt.amount_cents))}
    </table>
    ${manageBookingLink(appt)}
    <p>If this new time does not work for you, please manage your booking or reply to this email.</p>
    <p>With warmth,<br/>Sacred Hoof &amp; Hand</p>
  `);

  const practitionerHtml = wrap(`
    <p>A booking has been rescheduled.</p>
    <table style="width:100%; border-collapse:collapse; margin:16px 0; table-layout:fixed;">
      ${clientRow(appt)}
      ${textRow("Service", appt.service_name)}
      ${textRow("New time", whenPractitioner)}
      ${textRow("Paid", priceLabel(appt.amount_cents))}
      ${notesRow(appt.notes)}
    </table>
  `);

  return { subjectClient, subjectPractitioner, clientHtml, practitionerHtml };
}

function buildAppointmentCancelledEmails(
  appt: AppointmentEmailInput,
): RenderedAppointmentEmails {
  const whenClient = when(appt, clientTimeZone(appt));
  const whenPractitioner = when(appt, BUSINESS_TIMEZONE);
  const subjectClient = "Your Reiki session has been cancelled";
  const subjectPractitioner = `Booking cancelled: ${subjectText(appt.client_name)} — ${subjectText(appt.service_name)}`;

  const clientHtml = wrap(`
    <p>Hi ${escapeHtml(appt.client_name)},</p>
    <p>Your session has been cancelled.</p>
    <table style="width:100%; border-collapse:collapse; margin:16px 0; table-layout:fixed;">
      ${textRow("Service", appt.service_name)}
      ${textRow("Was", whenClient)}
      ${textRow("Paid", priceLabel(appt.amount_cents))}
    </table>
    <p>If you have questions about this cancellation or payment, please reply to this email.</p>
    <p>With warmth,<br/>Sacred Hoof &amp; Hand</p>
  `);

  const practitionerHtml = wrap(`
    <p>A booking has been cancelled.</p>
    <table style="width:100%; border-collapse:collapse; margin:16px 0; table-layout:fixed;">
      ${clientRow(appt)}
      ${textRow("Service", appt.service_name)}
      ${textRow("Was", whenPractitioner)}
      ${textRow("Paid", priceLabel(appt.amount_cents))}
      ${notesRow(appt.notes)}
    </table>
  `);

  return { subjectClient, subjectPractitioner, clientHtml, practitionerHtml };
}

function buildReminderEmails(
  appt: AppointmentEmailInput,
): RenderedAppointmentEmails {
  const whenClient = when(appt, clientTimeZone(appt));
  const whenPractitioner = when(appt, BUSINESS_TIMEZONE);
  const subjectClient = `Reminder: your Reiki session is coming up — ${whenClient}`;
  const subjectPractitioner = `Upcoming session reminder: ${subjectText(appt.client_name)} — ${subjectText(appt.service_name)}`;

  const clientHtml = wrap(`
    <p>Hi ${escapeHtml(appt.client_name)},</p>
    <p>This is a gentle reminder that your session is coming up soon.</p>
    <table style="width:100%; border-collapse:collapse; margin:16px 0; table-layout:fixed;">
      ${textRow("Service", appt.service_name)}
      ${textRow("When", whenClient)}
    </table>
    ${manageBookingLink(appt)}
    <p>Take a few moments beforehand to settle in and set an intention. I look forward to our time together.</p>
    <p>With warmth,<br/>Sacred Hoof &amp; Hand</p>
  `);

  const practitionerHtml = wrap(`
    <p>You have a session coming up soon.</p>
    <table style="width:100%; border-collapse:collapse; margin:16px 0; table-layout:fixed;">
      ${clientRow(appt)}
      ${textRow("Service", appt.service_name)}
      ${textRow("When", whenPractitioner)}
      ${notesRow(appt.notes)}
    </table>
  `);

  return { subjectClient, subjectPractitioner, clientHtml, practitionerHtml };
}

async function sendRenderedEmails(
  appt: AppointmentEmailInput,
  rendered: RenderedAppointmentEmails,
  kind: string,
  options: {
    recipients?: EmailRecipients;
    idempotencyPrefix?: string;
  } = {},
): Promise<EmailDeliveryResult> {
  const { subjectClient, subjectPractitioner, clientHtml, practitionerHtml } =
    rendered;
  const sendClient = options.recipients?.client !== false;
  const sendPractitioner = options.recipients?.practitioner !== false;

  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping ${kind}. Would have emailed:`,
      { client: appt.client_email, practitioner: env.practitionerEmail },
    );
    return {
      clientSent: !sendClient,
      practitionerSent: !sendPractitioner,
    };
  }

  // Only send to a deliverable client address, and only use that address as
  // reply-to when valid. This keeps one malformed address from blocking the
  // practitioner's copy.
  const clientEmail = appt.client_email.trim();
  const clientEmailValid = isValidEmail(clientEmail);
  const key = options.idempotencyPrefix?.slice(0, 220);
  const [clientOutcome, practitionerOutcome] = await Promise.allSettled([
    sendClient && clientEmailValid
      ? resend.emails.send({
          from: env.emailFrom,
          to: clientEmail,
          replyTo: env.practitionerEmail,
          subject: subjectClient,
          html: clientHtml,
        }, key ? { idempotencyKey: `${key}:client` } : undefined)
      : Promise.resolve(null),
    sendPractitioner
      ? resend.emails.send({
          from: env.emailFrom,
          to: env.practitionerEmail,
          ...(clientEmailValid ? { replyTo: clientEmail } : {}),
          subject: subjectPractitioner,
          html: practitionerHtml,
        }, key ? { idempotencyKey: `${key}:practitioner` } : undefined)
      : Promise.resolve(null),
  ]);

  if (sendClient && !clientEmailValid) {
    console.error(
      `[email] skipped client ${kind} — invalid client email:`,
      appt.client_email,
    );
  }
  if (clientOutcome.status === "rejected") {
    console.error(`[email] client ${kind} failed:`, clientOutcome.reason);
  } else if (clientOutcome.value?.error) {
    console.error(`[email] client ${kind} failed:`, clientOutcome.value.error);
  }
  if (practitionerOutcome.status === "rejected") {
    console.error(
      `[email] practitioner ${kind} failed:`,
      practitionerOutcome.reason,
    );
  } else if (practitionerOutcome.value?.error) {
    console.error(
      `[email] practitioner ${kind} failed:`,
      practitionerOutcome.value.error,
    );
  }
  return {
    clientSent:
      !sendClient ||
      (clientEmailValid &&
        clientOutcome.status === "fulfilled" &&
        !clientOutcome.value?.error),
    practitionerSent:
      !sendPractitioner ||
      (practitionerOutcome.status === "fulfilled" &&
        !practitionerOutcome.value?.error),
  };
}

/**
 * Sends booking confirmations to both the client and the practitioner.
 * No-ops (logs only) when email isn't configured yet.
 */
export async function sendBookingEmails(
  appt: AppointmentEmailInput,
): Promise<void> {
  const result = await sendRenderedEmails(
    appt,
    buildBookingEmails(appt),
    "confirmation",
    {
      idempotencyPrefix: appt.appointment_id
        ? `confirmation:${appt.appointment_id}`
        : undefined,
    },
  );
  if (
    emailConfigured &&
    (!result.clientSent || !result.practitionerSent)
  ) {
    throw new Error("The confirmation was not delivered to both parties.");
  }
}

/** Sends a reschedule/change notice to both the client and practitioner. */
export async function sendAppointmentChangedEmails(
  appt: AppointmentEmailInput,
): Promise<EmailDeliveryResult> {
  return sendRenderedEmails(
    appt,
    buildAppointmentChangedEmails(appt),
    "appointment change",
    {
      idempotencyPrefix: appt.appointment_id
        ? `rescheduled:${appt.appointment_id}:${appt.notification_key ?? appt.starts_at}`
        : undefined,
    },
  );
}

/** Sends a cancellation notice to both the client and practitioner. */
export async function sendAppointmentCancelledEmails(
  appt: AppointmentEmailInput,
): Promise<EmailDeliveryResult> {
  return sendRenderedEmails(
    appt,
    buildAppointmentCancelledEmails(appt),
    "appointment cancellation",
    {
      idempotencyPrefix: appt.appointment_id
        ? `cancelled:${appt.appointment_id}`
        : undefined,
    },
  );
}

/** Sends a day-before reminder to the client, practitioner, or both. */
export async function sendReminderEmails(
  appt: AppointmentEmailInput,
  recipients: EmailRecipients = {},
): Promise<EmailDeliveryResult> {
  return sendRenderedEmails(
    appt,
    buildReminderEmails(appt),
    "upcoming-session reminder",
    {
      recipients,
      idempotencyPrefix: appt.appointment_id
        ? `reminder:${appt.appointment_id}:${appt.starts_at}`
        : undefined,
    },
  );
}
