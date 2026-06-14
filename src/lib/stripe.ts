import Stripe from "stripe";
import { env, stripeConfigured } from "./env";

/**
 * Server-side Stripe instance. Null when no secret key is configured so the
 * checkout route can return a clear "payments not set up yet" message.
 */
export const stripe: Stripe | null = stripeConfigured
  ? new Stripe(env.stripeSecretKey!, { apiVersion: "2025-02-24.acacia" })
  : null;

export { stripeConfigured };
