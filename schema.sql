-- =============================================================
-- Cheerful Giver Unisex Salon — database schema
-- Run this once in the Supabase SQL editor.
--
-- Design notes worth defending in the presentation:
--
-- 1. starts_at is `timestamp` (no time zone), not `timestamptz`.
--    The shop is one physical room in Accra. Ghana is GMT all
--    year with no daylight saving, so wall-clock time IS the
--    truth. Storing a zone here would add conversion bugs and
--    buy nothing.
--
-- 2. Double-booking is prevented by a UNIQUE INDEX, not by
--    JavaScript. Front-end checks are a courtesy; the database
--    is the thing that cannot be raced.
--
-- 3. Services live in js/config.js rather than a table. One
--    barber, five services, prices that change once a year —
--    a table would cost a network round-trip on every page load
--    to store data that is effectively constant.
-- =============================================================


-- ---------- who counts as staff ------------------------------
create table if not exists public.staff (
  email text primary key
);

-- Add the owner. Change this to the real address before launch.
insert into public.staff (email)
values ('momolic6@gmail.com')
on conflict (email) do nothing;

-- Helper used by every policy below.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff
    where email = (auth.jwt() ->> 'email')
  );
$$;


-- ---------- bookings -----------------------------------------
create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete set null,
  service_id     text        not null,
  service_name   text        not null,
  price_ghs      numeric(10,2) not null,
  starts_at      timestamp   not null,
  customer_name  text        not null,
  customer_phone text,
  notes          text        default '',
  status         text        not null default 'confirmed',
  created_at     timestamptz not null default now(),

  constraint status_is_valid
    check (status in ('confirmed', 'cancelled', 'completed', 'no_show'))
);

-- THE important line.
-- One confirmed booking per start time. Two customers tapping
-- 3:00 PM at the same instant: one insert succeeds, the other
-- gets error 23505 and is told to pick again.
create unique index if not exists one_booking_per_slot
  on public.bookings (starts_at)
  where status = 'confirmed';

-- Week view sorts by day, so index the lookup.
create index if not exists bookings_starts_at_idx
  on public.bookings (starts_at);

create index if not exists bookings_user_idx
  on public.bookings (user_id);


-- ---------- blocked days -------------------------------------
create table if not exists public.blocked_days (
  id         uuid primary key default gen_random_uuid(),
  date       date not null unique,
  reason     text default '',
  created_at timestamptz not null default now()
);


-- =============================================================
-- AVAILABILITY VIEW
--
-- The hard problem: EVERYONE needs to know 3:00 PM Thursday is
-- taken, but NOBODY except staff should learn who took it.
--
-- RLS filters rows, so it cannot express "all rows, two columns".
-- Worse, a row-filtering policy actively breaks availability: a
-- signed-in customer restricted to their own rows would see every
-- other slot as free, pick one, and only be refused at insert.
--
-- So availability comes from a view instead. security_invoker =
-- false means it runs as its owner and is not re-filtered by the
-- caller's RLS — safe here precisely because the only column it
-- exposes is a start time.
-- =============================================================

create or replace view public.booked_slots
with (security_invoker = false) as
  select starts_at
  from public.bookings
  where status = 'confirmed';

grant select on public.booked_slots to anon, authenticated;


-- =============================================================
-- ROW LEVEL SECURITY
--
-- With availability handled by the view above, the base table can
-- stay strict: you see your own bookings, staff see everything,
-- and anonymous visitors read nothing from it at all.
-- =============================================================

alter table public.bookings     enable row level security;
alter table public.blocked_days enable row level security;
alter table public.staff        enable row level security;


-- ---------- bookings: rows -----------------------------------

-- Anyone, signed in or not, may create a booking (guests included).
create policy "anyone may book"
  on public.bookings for insert
  to anon, authenticated
  with check (true);

-- Signed-in customers see their own bookings in full. Staff see all.
-- Anonymous visitors get NO select policy on this table at all —
-- they read availability from the booked_slots view instead.
create policy "customers read own, staff read all"
  on public.bookings for select
  to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- Customers may cancel or move their own. Staff may change anything.
create policy "customers update own, staff update all"
  on public.bookings for update
  to authenticated
  using (user_id = auth.uid() or public.is_staff())
  with check (user_id = auth.uid() or public.is_staff());

-- Nothing is ever hard-deleted. Cancelling sets a status, which
-- keeps the shop's history intact for the week view and stats.


-- ---------- bookings: columns --------------------------------
-- This is what stops a stranger scraping customer phone numbers.
-- Supabase auto-grants ALL on new public tables, so this revoke
-- must run AFTER the create table above.

revoke select on public.bookings from anon;

-- Guests may insert, but may NOT choose their own status —
-- it is left to the column default of 'confirmed'.
revoke insert on public.bookings from anon;
grant  insert (id, user_id, service_id, service_name, price_ghs, starts_at,
               customer_name, customer_phone, notes)
  on public.bookings to anon;


-- ---------- blocked days -------------------------------------
-- Everyone needs to know the shop is shut on a given date.
create policy "anyone may read closures"
  on public.blocked_days for select
  to anon, authenticated
  using (true);

create policy "staff may close a day"
  on public.blocked_days for insert
  to authenticated
  with check (public.is_staff());

create policy "staff may reopen a day"
  on public.blocked_days for delete
  to authenticated
  using (public.is_staff());


-- ---------- staff table --------------------------------------
-- Readable only by staff; nobody can add themselves from the app.
create policy "staff may read staff"
  on public.staff for select
  to authenticated
  using (public.is_staff());
