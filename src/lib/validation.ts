/**
 * Minimal email-shape check. Intentionally lenient — it rejects obviously
 * invalid input (a bare name, missing @, missing domain dot) without trying to
 * be an RFC-complete validator. Real deliverability is proven by whether the
 * confirmation email actually lands.
 *
 * Shared by the booking form (client) and the checkout route (server) so both
 * apply the exact same rule.
 */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
