/**
 * What people say after a session.
 *
 * ─── ADDING ONE ────────────────────────────────────────────────────────────
 * 1. Ask first. Nothing goes here without the client saying yes to being
 *    quoted publicly, and to how they are credited.
 * 2. Credit them the way they asked — a first name, initials, or "Anonymous".
 *    Never a full name, and never anything that would identify them alongside
 *    what they shared in a session.
 * 3. Quote them as they wrote it. Fix an obvious typo, cut a long middle with
 *    an ellipsis, but do not smooth their voice into marketing copy.
 *
 * The section renders one quote as a single centered pull-quote and several as
 * a grid, so adding the second and third takes no layout work.
 */

export type Testimonial = {
  /** Their words. No surrounding quotation marks — the section adds those. */
  quote: string;
  /** How they asked to be credited. */
  name: string;
  /** Optional line under the name, e.g. which session it was. */
  context?: string;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I wasn’t sure what to expect from a Reiki with horses session, especially since I had previously been afraid of horses. The experience was incredibly peaceful and relaxing. One of the horses rested against me throughout the session, the other cleaned my toes, creating a sense of calm, comfort and connection. It was truly a special and healing experience.",
    name: "John",
    context: "Reiki with the horses",
  },
];
