/**
 * Centralized env access. Everything is optional so the site renders and
 * builds before the real keys are wired up. Each integration checks its own
 * `isConfigured` flag and falls back to sensible placeholder behavior.
 */

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  // New Supabase key naming: `sb_publishable_...` for the browser/client.
  // Falls back to the legacy `anon` key for older projects.
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  // New `sb_secret_...` server-side key, falling back to legacy `service_role`.
  supabaseSecretKey:
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,

  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  // Legacy alias for the 50% promotion. New installs use the dashboard-managed
  // SACRED20, SACRED50, and SACRED85 codes stored in Supabase.
  bookingDiscountCode: process.env.BOOKING_DISCOUNT_CODE ?? "SACRED50",

  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM ?? "Sacred Hoof & Hand <onboarding@resend.dev>",
  practitionerEmail: process.env.PRACTITIONER_EMAIL ?? "practitioner@example.com",

  // Dashboard login (single practitioner). Email is PRACTITIONER_EMAIL above.
  dashboardPassword: process.env.DASHBOARD_PASSWORD,

  // Authenticates server-to-server reminder cron requests.
  cronSecret: process.env.CRON_SECRET,

  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export const supabaseConfigured = Boolean(
  env.supabaseUrl && env.supabasePublishableKey,
);
export const supabaseAdminConfigured = Boolean(
  env.supabaseUrl && env.supabaseSecretKey,
);
// Checkout is not safe to enable without the signing secret that lets the
// webhook turn a paid reservation into a confirmed appointment.
export const stripeConfigured = Boolean(
  env.stripeSecretKey && env.stripeWebhookSecret,
);
export const emailConfigured = Boolean(env.resendApiKey);
// Production booking requires explicit sender + practitioner destinations;
// the development defaults must never receive real client notifications.
export const productionEmailConfigured = Boolean(
  env.resendApiKey &&
    process.env.EMAIL_FROM &&
    process.env.PRACTITIONER_EMAIL,
);
export const productionSiteConfigured = (() => {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
})();
