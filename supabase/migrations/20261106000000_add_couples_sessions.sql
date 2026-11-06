-- Add couples sessions without changing existing services or horse-day availability.
-- Prices cover both partners. Both sessions currently reserve 60 minutes.
insert into public.services
  (id, name, description, duration_minutes, price_cents, location, session_kind, active)
values
  ('reiki-couples', 'Couples Reiki',
   'A shared Reiki session for two, with space to slow down, set intentions together, and reconnect. The price includes both partners.',
   60, 13100, 'both', 'standard', true),
  ('equine-couples', 'Couples with the Horses',
   'A shared Reiki session for two alongside the herd, with time to settle into the surroundings and reconnect together. The price includes both partners.',
   60, 20200, 'in-person', 'equine', true)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  price_cents = excluded.price_cents,
  location = excluded.location,
  session_kind = excluded.session_kind,
  active = excluded.active;
