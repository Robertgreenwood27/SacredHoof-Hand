-- Track each client's post-session check-in independently from reminders.
-- No appointment dates, availability, or existing delivery state are changed.
alter table public.appointments
  add column if not exists followup_sent_at timestamptz,
  add column if not exists followup_claimed_at timestamptz;
