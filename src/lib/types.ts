export type HeroContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  imageUrl: string;
};

/**
 * Which programme a session belongs to. `standard` sessions are scheduled from
 * the weekly availability rules; `equine` sessions are only offered on the
 * specific event dates in `event_slots` (the horses travel and the herd is only
 * gathered on those days).
 */
export type SessionKind = "standard" | "equine";

export type Service = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  location: "virtual" | "in-person" | "both";
  kind: SessionKind;
  active: boolean;
};

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed";

export type Appointment = {
  id: string;
  agreement_id: string | null;
  service_id: string | null;
  service_name: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  client_timezone: string | null; // IANA zone the client booked from
  notes: string | null;
  starts_at: string; // ISO timestamp
  ends_at: string; // ISO timestamp
  status: AppointmentStatus;
  amount_cents: number;
  original_amount_cents: number;
  discount_code: string | null;
  discount_percent: number;
  stripe_session_id: string | null;
  manage_token_hash: string | null;
  hold_expires_at: string | null;
  updated_at: string;
  rescheduled_at: string | null;
  reminder_sent_at: string | null;
  client_reminder_sent_at: string | null;
  practitioner_reminder_sent_at: string | null;
  client_reminder_claimed_at: string | null;
  practitioner_reminder_claimed_at: string | null;
  confirmation_sent_at: string | null;
  created_at: string;
};

/** Immutable evidence of the documents and electronic signature accepted. */
export type BookingAgreement = {
  id: string;
  client_name: string;
  client_email: string;
  signature_name: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  terms_version: string;
  terms_effective_date: string; // YYYY-MM-DD
  terms_snapshot: string;
  waiver_version: string;
  waiver_snapshot: string;
  electronic_consent: boolean;
  signer_authority: boolean | null;
  signer_capacity: "self" | "parent_or_guardian" | null;
  guardian_relationship: string | null;
  signed_at: string;
  signer_ip: string | null;
  signer_user_agent: string | null;
  created_at: string;
};

/** One auditable appointment lifecycle transition. */
export type AppointmentEvent = {
  id: string;
  appointment_id: string;
  event_type: string;
  actor: string;
  old_starts_at: string | null;
  old_ends_at: string | null;
  new_starts_at: string | null;
  new_ends_at: string | null;
  created_at: string;
};

/** Weekly recurring availability rule (one row per open block per weekday). */
export type AvailabilityRule = {
  id: string;
  day_of_week: number; // 0 = Sunday ... 6 = Saturday
  start_time: string; // "HH:MM" 24h
  end_time: string; // "HH:MM" 24h
};

/**
 * One explicitly scheduled session on a specific date, used by event-based
 * programmes (the horse days) instead of the weekly recurring rules. Each row
 * is exactly one bookable start time of one fixed length — a 60-minute row
 * cannot be booked as two 30-minute sessions.
 */
export type EventSlot = {
  id: string;
  session_kind: SessionKind;
  day: string; // "YYYY-MM-DD" in the business timezone
  start_time: string; // "HH:MM" 24h, business timezone
  duration_minutes: number;
};

/** A full day the practitioner has blocked off (no bookings offered). */
export type BlockedDay = {
  day: string; // "YYYY-MM-DD" in the business timezone
  reason: string | null;
};

export type TimeSlot = {
  startsAt: string; // ISO
  endsAt: string; // ISO
};
