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


-- =============================================================
-- TATTOO REQUESTS
--
-- Deliberately NOT part of the slot engine above. A haircut is a
-- fixed 25 minutes so a live picker works; a tattoo might be a
-- 30-minute flash piece or a multi-session sleeve, so it has the
-- same variable-duration problem that got women's braiding cut
-- from online booking (see README). Rather than reworking the
-- availability engine, a tattoo "request" is just a lead: the
-- owner reviews it and agrees a real time by phone or WhatsApp.
-- That is why this table has no starts_at, no unique index, and
-- no availability view — there is no slot to double-book.
-- =============================================================

create table if not exists public.tattoo_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete set null,
  customer_name  text        not null,
  customer_phone text        not null,
  customer_email text,
  description    text        not null,
  placement      text        default '',
  size_estimate  text        default '',
  preferred_date date,
  notes          text        default '',
  status         text        not null default 'pending',
  created_at     timestamptz not null default now(),

  constraint tattoo_status_is_valid
    check (status in ('pending', 'contacted', 'booked', 'declined'))
);

create index if not exists tattoo_requests_created_idx
  on public.tattoo_requests (created_at desc);

create index if not exists tattoo_requests_user_idx
  on public.tattoo_requests (user_id);

alter table public.tattoo_requests enable row level security;

-- Anyone, signed in or not, may submit a request (guests included).
create policy "anyone may request a tattoo"
  on public.tattoo_requests for insert
  to anon, authenticated
  with check (true);

-- Signed-in customers see their own requests. Staff see everything.
-- Anonymous visitors get no select policy — there is no public
-- availability to expose here, unlike bookings.
create policy "customers read own, staff read all tattoo requests"
  on public.tattoo_requests for select
  to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- Only staff move a request along (pending -> contacted -> booked/declined).
-- Customers cannot edit or cancel their own request from the app;
-- they follow up with the shop directly, same as agreeing the time did.
create policy "staff update tattoo requests"
  on public.tattoo_requests for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke select on public.tattoo_requests from anon;
revoke insert on public.tattoo_requests from anon;
grant  insert (id, user_id, customer_name, customer_phone, customer_email,
               description, placement, size_estimate, preferred_date, notes)
  on public.tattoo_requests to anon;


-- =============================================================
-- GALLERY PHOTOS
--
-- So the shop can put its own work on the site without touching
-- the code, GitHub, or Luc. The owner signs in, picks a photo off
-- his phone, and it is live.
--
-- The photos shipped in the repo are NOT in this table. They stay
-- as a floor: uploads render before them, so the page is never
-- empty and a first upload never makes the gallery look thinner
-- than it did yesterday.
--
-- Files live in a public Storage bucket rather than as bytes in a
-- column. Postgres would hold a JPEG happily enough, but then
-- every page load drags it through the database connection. A
-- bucket gives an ordinary URL that an <img> tag fetches direct.
--
-- Re-runnable on purpose: unlike the policies above, these drop
-- themselves first, because this section gets pasted into a
-- project where the rest of the file has already been run.
-- =============================================================

create table if not exists public.gallery_photos (
  id           uuid primary key default gen_random_uuid(),
  category     text not null default 'tattoo',
  label        text default '',
  storage_path text not null,
  created_at   timestamptz not null default now(),

  constraint gallery_category_is_valid
    check (category in ('tattoo', 'barber'))
);

create index if not exists gallery_photos_category_idx
  on public.gallery_photos (category, created_at desc);

alter table public.gallery_photos enable row level security;

-- The gallery is the shop window. Everyone reads it, signed in or not.
drop policy if exists "anyone may see the gallery" on public.gallery_photos;
create policy "anyone may see the gallery"
  on public.gallery_photos for select
  to anon, authenticated
  using (true);

drop policy if exists "staff may add photos" on public.gallery_photos;
create policy "staff may add photos"
  on public.gallery_photos for insert
  to authenticated
  with check (public.is_staff());

drop policy if exists "staff may remove photos" on public.gallery_photos;
create policy "staff may remove photos"
  on public.gallery_photos for delete
  to authenticated
  using (public.is_staff());


-- ---------- the bucket the files themselves live in ------------
-- public = true means the files are served from a plain URL with
-- no token. That is correct here: these photos ARE the advertising.
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

drop policy if exists "anyone may view gallery files" on storage.objects;
create policy "anyone may view gallery files"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'gallery');

-- Only the owner may put files in or take them out. Without this a
-- stranger with the public anon key could fill the bucket.
drop policy if exists "staff may upload gallery files" on storage.objects;
create policy "staff may upload gallery files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'gallery' and public.is_staff());

drop policy if exists "staff may delete gallery files" on storage.objects;
create policy "staff may delete gallery files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'gallery' and public.is_staff());


-- =============================================================
-- TATTOO REFERENCE IMAGES
--
-- A customer describing a tattoo in words is guessing at what the
-- artist will picture. One photo of the design they mean removes
-- most of that, so the follow-up call starts from the same image.
--
-- This bucket is PRIVATE, unlike `gallery`. A reference is often a
-- photo of the customer's own body, or someone else's artwork they
-- want adapted - it is sent to the shop, not published by it. Staff
-- read it through a short-lived signed URL; nobody else can read it
-- at all, and there is no public URL to guess.
--
-- Re-runnable: safe to paste into a project where the rest of this
-- file has already been run.
-- =============================================================

alter table public.tattoo_requests
  add column if not exists reference_path text;

-- The insert grant above is column-by-column, so the new column has
-- to be added to it or an anonymous request carrying a photo fails.
grant insert (reference_path) on public.tattoo_requests to anon;

insert into storage.buckets (id, name, public)
values ('tattoo-refs', 'tattoo-refs', false)
on conflict (id) do nothing;

-- Anyone may send one in, signed in or not - the request form itself
-- is open to guests, so the photo that belongs to it must be too.
drop policy if exists "anyone may attach a reference" on storage.objects;
create policy "anyone may attach a reference"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'tattoo-refs');

-- Only staff may read them back. No customer-read policy: the person
-- who sent the photo already has it, and the shop is the only party
-- that needs it afterwards.
drop policy if exists "staff may read references" on storage.objects;
create policy "staff may read references"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'tattoo-refs' and public.is_staff());

drop policy if exists "staff may delete references" on storage.objects;
create policy "staff may delete references"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'tattoo-refs' and public.is_staff());
