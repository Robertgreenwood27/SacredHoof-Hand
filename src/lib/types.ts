export type HeroContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  imageUrl: string;
};

export type Service = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCents: number;
  location: "virtual" | "in-person" | "both";
  active: boolean;
};

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed";

export type Appointment = {
  id: string;
  service_id: string | null;
  service_name: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  notes: string | null;
  starts_at: string; // ISO timestamp
  ends_at: string; // ISO timestamp
  status: AppointmentStatus;
  amount_cents: number;
  stripe_session_id: string | null;
  created_at: string;
};

/** Weekly recurring availability rule (one row per open block per weekday). */
export type AvailabilityRule = {
  id: string;
  day_of_week: number; // 0 = Sunday ... 6 = Saturday
  start_time: string; // "HH:MM" 24h
  end_time: string; // "HH:MM" 24h
};

export type TimeSlot = {
  startsAt: string; // ISO
  endsAt: string; // ISO
};
