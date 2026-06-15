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

  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM ?? "Sacred Hoof & Hand <onboarding@resend.dev>",
  practitionerEmail: process.env.PRACTITIONER_EMAIL ?? "practitioner@example.com",

  // Dashboard login (single practitioner). Email is PRACTITIONER_EMAIL above.
  dashboardPassword: process.env.DASHBOARD_PASSWORD,

  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export const supabaseConfigured = Boolean(
  env.supabaseUrl && env.supabasePublishableKey,
);
export const stripeConfigured = Boolean(env.stripeSecretKey);
export const emailConfigured = Boolean(env.resendApiKey);
