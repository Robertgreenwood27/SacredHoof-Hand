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
-- availability_rules: weekly recurring open windows
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.availability_rules (
  id          uuid primary key default gen_random_uuid(),
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time  text not null,  -- "HH:MM" 24h
  end_time    text not null
);

-- ─────────────────────────────────────────────────────────────────────────
-- appointments: a booked session (created by the Stripe webhook / dev fallback)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.appointments (
  id                uuid primary key default gen_random_uuid(),
  service_id        text,
  service_name      text not null,
  client_name       text not null,
  client_email      text not null,
  client_phone      text,
  notes             text,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  status            text not null default 'confirmed'
                      check (status in ('pending','confirmed','cancelled','completed')),
  amount_cents      integer not null default 0,
  stripe_session_id text,
  created_at        timestamptz default now()
);

create index if not exists appointments_starts_at_idx
  on public.appointments (starts_at);

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- Public site reads content/services/availability. Only authenticated users
-- (the practitioner) manage data through the dashboard. Appointments are
-- written by the service-role key (webhook), which bypasses RLS.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.site_content       enable row level security;
alter table public.services           enable row level security;
alter table public.availability_rules enable row level security;
alter table public.appointments       enable row level security;

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

-- Authenticated full management
drop policy if exists "auth manage content" on public.site_content;
create policy "auth manage content" on public.site_content
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "auth manage services" on public.services;
create policy "auth manage services" on public.services
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "auth manage availability" on public.availability_rules;
create policy "auth manage availability" on public.availability_rules
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Appointments: dashboard reads/writes use the Supabase secret key, which
-- bypasses RLS. These policies are kept for completeness (e.g. if you ever use
-- Supabase Auth directly).
drop policy if exists "auth read appointments" on public.appointments;
create policy "auth read appointments" on public.appointments
  for select using (auth.role() = 'authenticated');
drop policy if exists "auth update appointments" on public.appointments;
create policy "auth update appointments" on public.appointments
  for update using (auth.role() = 'authenticated');

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
