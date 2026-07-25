-- Sacred Hoof & Hand — database schema
-- Run this in the Supabase SQL editor (or `supabase db push`) after creating
-- your project. Safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────
-- site_content: singleton row (id = 1) holding the editable hero section
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.site_content (
  id            integer primary key default 1,
  hero_eyebrow  text,
  hero_title    text,
  hero_subtitle text,
  hero_cta_label text,
  hero_image_url text,
  updated_at    timestamptz default now(),
  constraint site_content_singleton check (id = 1)
);

insert into public.site_content (id) values (1)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- services: bookable session types (seeds Stripe Checkout amounts)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.services (
  id               text primary key,
  name             text not null,
  description      text not null,
  duration_minutes integer not null default 60,
  price_cents      integer not null,
  location         text not null default 'both'
                     check (location in ('virtual','in-person','both')),
  active           boolean not null default true,
  created_at       timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- booking_promotions: server-owned discount codes controlled by the dashboard
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.booking_promotions (
  discount_percent integer primary key
                     check (discount_percent in (20, 50, 85)),
  code              text not null
                     check (
                       code = upper(code)
                       and code ~ '^[A-Z0-9_-]{3,40}$'
                     ),
  enabled           boolean not null default true,
  updated_at        timestamptz not null default now()
);

create unique index if not exists booking_promotions_code_uidx
  on public.booking_promotions (lower(code));

insert into public.booking_promotions (discount_percent, code, enabled)
values
  (20, 'SACRED20', true),
  (50, 'SACRED50', true),
  (85, 'SACRED85', true)
on conflict (discount_percent) do nothing;

alter table public.booking_promotions enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- availability_rules: weekly recurring open windows
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.availability_rules (
  id          uuid primary key default gen_random_uuid(),
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time  text not null,  -- "HH:MM" 24h
  end_time    text not null
);

-- ─────────────────────────────────────────────────────────────────────────
-- blocked_days: full days the practitioner has taken off. No bookings are
-- offered on these dates. `day` is a calendar date in the BUSINESS timezone.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.blocked_days (
  day    date primary key,  -- YYYY-MM-DD in the business timezone
  reason text
);
alter table public.blocked_days enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- booking_agreements: immutable evidence of the exact terms and waiver a
-- ─────────────────────────────────────────────────────────────────────────
-- client signed before checkout. Snapshots keep the accepted copy auditable
-- even after the public documents are revised.
create table if not exists public.booking_agreements (
  id                   uuid primary key default gen_random_uuid(),
  client_name          text not null,
  client_email         text not null,
  signature_name       text not null,
  service_id           text not null,
  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  terms_version        text not null,
  terms_effective_date date not null,
  terms_snapshot       text not null,
  waiver_version       text not null,
  waiver_snapshot      text not null,
  electronic_consent   boolean not null
                         check (electronic_consent),
  signer_authority     boolean not null,
  signer_capacity      text not null
                         check (signer_capacity in ('self','parent_or_guardian')),
  guardian_relationship text,
  signed_at            timestamptz not null default now(),
  signer_ip            text,
  signer_user_agent    text,
  created_at           timestamptz not null default now(),
  constraint booking_agreements_signer_authority_true_check
    check (signer_authority is true),
  constraint booking_agreements_guardian_relationship_check
    check (
      signer_capacity <> 'parent_or_guardian'
      or (
        guardian_relationship is not null
        and length(btrim(guardian_relationship)) > 0
      )
    )
);
alter table public.booking_agreements enable row level security;

alter table public.booking_agreements
  add column if not exists signer_authority boolean,
  add column if not exists signer_capacity text,
  add column if not exists guardian_relationship text;

-- Older deployments may contain agreement rows created before signer capacity
-- was captured. Preserve those immutable legacy rows, but enforce TRUE for
-- every new row without pretending that the old evidence exists.
do $$
begin
  alter table public.booking_agreements
    drop constraint if exists booking_agreements_signer_authority_check;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_agreements_signer_authority_true_check'
      and conrelid = 'public.booking_agreements'::regclass
  ) then
    alter table public.booking_agreements
      add constraint booking_agreements_signer_authority_true_check
      check (signer_authority is true) not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_agreements_guardian_relationship_check'
      and conrelid = 'public.booking_agreements'::regclass
  ) then
    alter table public.booking_agreements
      add constraint booking_agreements_guardian_relationship_check
      check (
        signer_capacity <> 'parent_or_guardian'
        or (
          guardian_relationship is not null
          and length(btrim(guardian_relationship)) > 0
        )
      ) not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_agreements_signer_capacity_check'
      and conrelid = 'public.booking_agreements'::regclass
  ) then
    alter table public.booking_agreements
      add constraint booking_agreements_signer_capacity_check
      check (
        signer_capacity is not null
        and signer_capacity in ('self','parent_or_guardian')
      ) not valid;
  end if;
end
$$;

-- Agreement evidence is append-only, including for service-role callers.
create or replace function public.prevent_booking_agreement_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'booking agreements are immutable';
end;
$$;

drop trigger if exists booking_agreements_immutable
  on public.booking_agreements;
create trigger booking_agreements_immutable
  before update or delete on public.booking_agreements
  for each row execute function public.prevent_booking_agreement_mutation();

-- appointments: a booked session (created by the Stripe webhook / dev fallback)
create table if not exists public.appointments (
  id                uuid primary key default gen_random_uuid(),
  agreement_id      uuid references public.booking_agreements(id)
                      on delete restrict,
  service_id        text,
  service_name      text not null,
  client_name       text not null,
  client_email      text not null,
  client_phone      text,
  client_timezone   text,  -- IANA zone the client booked from (e.g. America/Chicago)
  notes             text,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  status            text not null default 'confirmed'
                      check (status in ('pending','confirmed','cancelled','completed')),
  amount_cents      integer not null default 0,
  original_amount_cents integer not null default 0,
  discount_code     text,
  discount_percent  integer not null default 0
                      check (discount_percent between 0 and 100),
  stripe_session_id text,
  manage_token_hash text,
  hold_expires_at   timestamptz,
  updated_at        timestamptz not null default now(),
  rescheduled_at    timestamptz,
  reminder_sent_at  timestamptz,
  client_reminder_sent_at timestamptz,
  practitioner_reminder_sent_at timestamptz,
  client_reminder_claimed_at timestamptz,
  practitioner_reminder_claimed_at timestamptz,
  confirmation_sent_at timestamptz,
  created_at        timestamptz not null default now()
);
alter table public.appointments enable row level security;

-- Backfill/migrate databases created before these booking lifecycle fields
-- existed. Keeping migration statements here makes the schema safe to re-run.
alter table public.appointments
  add column if not exists client_timezone text,
  add column if not exists agreement_id uuid,
  add column if not exists original_amount_cents integer,
  add column if not exists discount_code text,
  add column if not exists discount_percent integer,
  add column if not exists manage_token_hash text,
  add column if not exists hold_expires_at timestamptz,
  add column if not exists updated_at timestamptz,
  add column if not exists rescheduled_at timestamptz,
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists client_reminder_sent_at timestamptz,
  add column if not exists practitioner_reminder_sent_at timestamptz,
  add column if not exists client_reminder_claimed_at timestamptz,
  add column if not exists practitioner_reminder_claimed_at timestamptz,
  add column if not exists confirmation_sent_at timestamptz;

update public.appointments
set original_amount_cents = amount_cents
where original_amount_cents is null;

update public.appointments
set discount_percent = 0
where discount_percent is null;

update public.appointments
set updated_at = coalesce(created_at, now())
where updated_at is null;

-- Do not resend legacy reminders that were already recorded by the former
-- single-timestamp implementation.
update public.appointments
set client_reminder_sent_at = reminder_sent_at,
    practitioner_reminder_sent_at = reminder_sent_at
where reminder_sent_at is not null
  and (
    client_reminder_sent_at is null
    or practitioner_reminder_sent_at is null
  );

-- The previous app never created payment holds. Any legacy pending row has no
-- expiry and would otherwise reserve its range forever.
update public.appointments
set status = 'cancelled',
    updated_at = now()
where status = 'pending'
  and hold_expires_at is null;

alter table public.appointments
  alter column original_amount_cents set default 0,
  alter column original_amount_cents set not null,
  alter column discount_percent set default 0,
  alter column discount_percent set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_agreement_id_fkey'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_agreement_id_fkey
      foreign key (agreement_id)
      references public.booking_agreements(id)
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_discount_percent_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_discount_percent_check
      check (discount_percent between 0 and 100);
  end if;
end
$$;

create index if not exists appointments_starts_at_idx
  on public.appointments (starts_at);

create unique index if not exists appointments_stripe_session_id_uidx
  on public.appointments (stripe_session_id)
  where stripe_session_id is not null;

create unique index if not exists appointments_manage_token_hash_uidx
  on public.appointments (manage_token_hash)
  where manage_token_hash is not null;

-- Complimentary intro sessions may be booked repeatedly by the same client.
-- Drop the former one-per-email guard when upgrading an existing database.
drop index if exists public.appointments_free_intro_email_uidx;

-- Prevent double-booking at the database boundary. Pending holds continue to
-- reserve their range until application logic cancels them after hold_expires_at.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_no_active_overlap'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_no_active_overlap
      exclude using gist (
        tstzrange(starts_at, ends_at, '[)') with &&
      )
      where (status in ('pending', 'confirmed'));
  end if;
end
$$;

-- appointment_events: audit history for reschedules, cancellations,
-- confirmations, reminders, and other lifecycle changes.
create table if not exists public.appointment_events (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id)
                   on delete restrict,
  event_type     text not null,
  actor          text not null,
  old_starts_at  timestamptz,
  old_ends_at    timestamptz,
  new_starts_at  timestamptz,
  new_ends_at    timestamptz,
  created_at     timestamptz not null default now()
);
alter table public.appointment_events enable row level security;

create index if not exists appointment_events_appointment_id_idx
  on public.appointment_events (appointment_id, created_at);

create or replace function public.prevent_appointment_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'appointment events are append-only';
end;
$$;

drop trigger if exists appointment_events_append_only
  on public.appointment_events;
create trigger appointment_events_append_only
  before update or delete on public.appointment_events
  for each row execute function public.prevent_appointment_event_mutation();

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- Public site reads only content/services/availability. The practitioner
-- dashboard uses its signed app session and the server-only secret client.
-- Agreements, appointments, events, and blocked-day reasons remain private.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.site_content       enable row level security;
alter table public.services           enable row level security;
alter table public.booking_promotions enable row level security;
alter table public.availability_rules enable row level security;
alter table public.blocked_days       enable row level security;
alter table public.booking_agreements enable row level security;
alter table public.appointments       enable row level security;
alter table public.appointment_events enable row level security;

-- Public read
-- (drop-then-create so this whole file is safe to re-run)
drop policy if exists "public read content" on public.site_content;
create policy "public read content" on public.site_content
  for select using (true);
drop policy if exists "public read services" on public.services;
create policy "public read services" on public.services
  for select using (true);
drop policy if exists "public read availability" on public.availability_rules;
create policy "public read availability" on public.availability_rules
  for select using (true);
-- Blocked-day reasons are private. Booking reads them only through the
-- server-side secret client; remove the former anonymous table policy.
drop policy if exists "public read blocked days" on public.blocked_days;

-- This app uses its own signed dashboard cookie and the server-side secret
-- client. A generic Supabase `authenticated` role is not practitioner proof,
-- so remove the broad policies from earlier versions.
drop policy if exists "auth manage content" on public.site_content;
drop policy if exists "auth manage services" on public.services;
drop policy if exists "auth manage availability" on public.availability_rules;
drop policy if exists "auth manage blocked days" on public.blocked_days;

-- Appointment/dashboard reads and writes use the secret key, which bypasses
-- RLS only inside trusted server code.
drop policy if exists "auth read appointments" on public.appointments;
drop policy if exists "auth update appointments" on public.appointments;

-- ─────────────────────────────────────────────────────────────────────────
-- Seed the starter service catalog (matches src/lib/content.ts)
-- ─────────────────────────────────────────────────────────────────────────
insert into public.services (id, name, description, duration_minutes, price_cents, location)
values
  ('virtual-reiki', 'Virtual Reiki Session',
   'A distance Reiki session from the comfort of your own space.', 60, 9000, 'virtual'),
  ('in-person-reiki', 'In-Person Reiki Session',
   'A hands-on, in-person Reiki session in a calm, grounded setting.', 75, 12000, 'in-person'),
  ('intro-reiki', 'Intro Mini Session',
   'A shorter session to experience the practice before a full session.', 30, 5000, 'both')
on conflict (id) do nothing;
