/**
 * Centralized env access. Everything is optional so the site renders and
 * builds before the real keys are wired up. Each integration checks its own
 * `isConfigured` flag and falls back to sensible placeholder behavior.
 */

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,

  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM ?? "Sacred Hoof & Hand <onboarding@resend.dev>",
  practitionerEmail: process.env.PRACTITIONER_EMAIL ?? "practitioner@example.com",

  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export const supabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const stripeConfigured = Boolean(env.stripeSecretKey);
export const emailConfigured = Boolean(env.resendApiKey);
