# Sacred Hoof & Hand

A calm, modern site for a Reiki practice — virtual & in-person session booking with
online payment, automated confirmation emails, and a dashboard where the
practitioner can edit the hero section and manage appointments.

**Stack:** Next.js 15 (App Router, TypeScript) · Tailwind CSS · Supabase
(Postgres) · Stripe Checkout · Resend (email) · password-gated dashboard.

> The whole app **runs and is fully clickable with zero configuration** — every
> integration degrades gracefully and uses placeholders until you add real keys.
> You can demo the booking flow end-to-end before Stripe/Supabase are wired up
> (it uses a dev fallback that skips payment).

---

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

That's it for a local preview. To enable real auth, payments, and email, copy the
env file and fill it in:

```bash
cp .env.local.example .env.local
```

---

## Setup checklist (when you're ready to go live)

### 1. Supabase — data
1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → API Keys**: copy the URL, the **publishable** key
   (`sb_publishable_…`) and the **secret** key (`sb_secret_…`) into `.env.local`.
   (Older projects' `anon` / `service_role` keys also work — the code accepts
   either.)
3. Open the **SQL editor** and run [`supabase/schema.sql`](supabase/schema.sql).
   This creates the tables, RLS policies, and seeds the services.

### 1b. Dashboard login
The dashboard uses a simple single-practitioner login (no Supabase Auth needed).
Set `PRACTITIONER_EMAIL` and `DASHBOARD_PASSWORD` in `.env.local`, then sign in
at `/login` — reachable via the faint gear icon in the site footer. The session
is a signed, httpOnly cookie; `/dashboard` is guarded by middleware. All
dashboard reads/writes use the Supabase **secret** key server-side, so the
secret key must be set for the dashboard to load and save data.

### 2. Stripe — payments
1. Grab test keys from **Developers → API keys** → `.env.local`.
2. Forward webhooks locally:
   ```bash
   npm run stripe:listen   # needs the Stripe CLI
   ```
   Copy the `whsec_...` it prints into `STRIPE_WEBHOOK_SECRET`.
3. In production, add a webhook endpoint pointing at
   `https://YOUR-DOMAIN/api/webhooks/stripe` for the
   `checkout.session.completed` event.

### 3. Resend — email
1. Create an API key at [resend.com](https://resend.com) → `RESEND_API_KEY`.
2. Verify a sending domain, then set `EMAIL_FROM` to an address on it.
3. Set `PRACTITIONER_EMAIL` to where new-booking alerts should go.

---

## How it fits together

```
Visitor → /book → picks service + time + details
        → POST /api/checkout → Stripe Checkout
        → (payment) → Stripe webhook /api/webhooks/stripe
        → writes appointment to Supabase + emails client AND practitioner
        → /book/success
```

- **Slots** are generated in [`src/lib/scheduling.ts`](src/lib/scheduling.ts) from
  the practitioner's weekly availability minus already-booked times.
- **Hero content** lives in the `site_content` table and is edited at
  `/dashboard/hero`; the homepage reads it live.
- **Dashboard** (`/dashboard`) is protected by middleware — password login required.

## Project map

| Path | What it is |
|------|------------|
| `src/app/page.tsx` | Landing page (hero, services, vision, CTA) |
| `src/app/book/` | Booking flow + success page |
| `src/app/login/` | Practitioner password login |
| `src/app/dashboard/` | Appointments, hero editor, availability |
| `src/app/api/checkout/` | Creates Stripe Checkout session (+ dev fallback) |
| `src/app/api/webhooks/stripe/` | Confirms payment → books + emails |
| `src/lib/` | Supabase/Stripe/email clients, data access, scheduling |
| `supabase/schema.sql` | Database schema + RLS + seed data |

## The limited-time free session

A promotional **free intro session** is configured in
[`src/lib/content.ts`](src/lib/content.ts) via `FREE_SESSION_OFFER`. It shows a
featured banner on the homepage, appears as a highlighted card in the services
grid, and is bookable through the normal flow — but skips Stripe (since $0 can't
go through Checkout) and books directly.

- **To remove it:** set `enabled: false`. The banner, card, and bookability all
  disappear.
- **To auto-expire it:** set `endsOn: "2026-07-31"` (any ISO date).
- **One per person:** `onePerClient: true` blocks a second free booking from the
  same email (enforced once Supabase is connected).

Adjust the name, length, description, and badge text in the same object.

## Things left as placeholders (intentional)

- Contact email/footer links, the homepage quote, and service pricing/descriptions
  (`src/lib/content.ts`) — swap for her real copy.
- `EMAIL_FROM` / `PRACTITIONER_EMAIL` and all API keys.
- Hero image is her uploaded `public/horse-hero.webp`; she can change it from the
  dashboard once Supabase Storage is set up (or just drop a new file in `public/`).
- Future offerings (horse-assisted Reiki, sound healing, retreats) are shown as
  "coming soon" per her notes.
