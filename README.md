# Cheerful Giver Unisex Salon — Online Booking

A booking system for a one-barber shop in Accra. Customers see live
availability, book instantly, and manage their own appointments. The
owner gets a week-view dashboard.

Plain HTML, CSS and JavaScript. No build step, no framework, no
`npm install`.

---

## Running it

**Best:** open the `cheerful-giver` folder in VS Code, install the
**Live Server** extension, right-click `index.html` → *Open with Live
Server*.

Double-clicking `index.html` also renders the site, but some browsers
restrict `localStorage` on `file://` URLs, which is where bookings are
saved in demo mode. If bookings vanish on refresh, that's why — use a
local server instead.

---

## The six pages

| Page | What it does |
|---|---|
| `index.html` | Homepage — hero, service menu, opening hours |
| `services.html` | Full price list and shop policies |
| `tattoo.html` | Tattoo **request** form — not a booking flow, see below |
| `booking.html` | The booking flow: service → date → time → details |
| `account.html` | Sign up / sign in, view, cancel, reschedule; also lists tattoo requests |
| `admin.html` | Owner dashboard — week view, closures, walk-ins, tattoo requests |

## The JavaScript

| File | Responsibility |
|---|---|
| `config.js` | **Every** shop setting: hours, break, prices, services |
| `slots.js` | The availability engine — turns opening hours into bookable times |
| `data.js` | Storage. Two swappable adapters: `local` and `supabase` |
| `main.js` | Shared nav, toasts, WhatsApp links |
| `home.js` | Renders the service menu and hours table |
| `booking.js` | The three-step booking flow |
| `tattoo.js` | The one-step tattoo request form |
| `account.js` | Customer account, cancel, reschedule, own tattoo requests |
| `admin.js` | Owner dashboard, including tattoo request follow-up |
| `seed.js` | Demo data generator (local mode only) |

---

## Tattoo requests aren't bookings

`tattoo.html` looks similar to `booking.html` but is deliberately **not**
wired into the availability engine above. A haircut is a fixed 25
minutes, which is what makes a live slot picker possible; a tattoo
might be a 30-minute flash piece or a multi-session sleeve — the same
variable-duration problem that already ruled women's braiding out of
online booking.

Rather than reworking `slots.js` to handle variable durations, a
tattoo request is just a lead: the customer describes the idea, and
the owner follows up by phone or WhatsApp to agree a real time. That
shows up end to end:

- `tattoo_requests` is its own table (`schema.sql`), with no
  `starts_at`, no unique index, and no availability view — there is
  no slot to double-book.
- Status moves `pending → contacted → booked/declined`, set only by
  staff (customers can't edit their own request once sent).
- The admin dashboard lists requests separately from the week grid,
  with WhatsApp/call links to start the follow-up.
- The customer's account page shows their requests read-only — no
  cancel/reschedule, because there's no slot to move.
- A request can carry one **reference picture**. The browser shrinks it
  first, contained rather than cropped, because it is the customer's
  design and cutting it to a tile shape would cut the drawing in half.
  The file goes to a **private** `tattoo-refs` bucket, not the public
  gallery one: a reference is often a photo of the customer's own body,
  or artwork they want adapted. Staff read it through a signed link
  that expires; there is no public URL to guess. See `schema.sql`.

---

## The shop adds its own photos

The owner should never have to message Luc to get a photo on the site.
The dashboard has a **Gallery** panel: pick a photo off the phone,
choose whether it belongs on the tattoo page or the home page, upload.
It is live immediately.

Three things make that work without a server:

**The browser shrinks the photo first.** A photo off a phone is 3–4 MB
and 4000px wide. `resizeImageFile()` in `main.js` cover-crops it to
the same 4:5 shape the rest of the site uses and re-encodes it at
800×1000 — roughly 120 KB. That runs on the owner's own phone, so it
costs his data to send *less*, not more, and no image library or paid
Edge Function is involved. The upload modal previews the actual crop,
so nothing is a surprise after it is already public.

**Files go in a Storage bucket, not a column.** Postgres would store a
JPEG happily, but then every page load drags it through the database
connection. The `gallery` bucket gives a plain URL an `<img>` fetches
directly, cached for a year.

**Uploads render before the built-in photos, never instead of them.**
The four tattoo photos and four barbering photos in the repo are not
rows in the table — they are the floor. So the page is never empty,
and the first upload never makes the gallery look thinner than it did
the day before. To retire a built-in photo, delete its `<div class="shot">`
from the markup.

Both writes are staff-only *at the database* (`is_staff()` on both the
table and `storage.objects`), not merely hidden in the UI — otherwise
anyone holding the public anon key could fill the bucket.

In demo mode there is no bucket, so the shrunk JPEG is kept as a data
URL in `localStorage`. That only works because it has already been cut
to ~120 KB; a raw phone photo would blow the 5 MB quota by itself.

Changing a price or an opening hour means editing `config.js` and
nothing else. Every page reads from it.

---

## Demo accounts

The site starts empty. Create accounts from `account.html`:

- **Owner** — sign up with the address in `ownerEmail`. Any account using
  that address sees the dashboard. The address is set by `ownerEmail`
  in `config.js`.
- **Customer** — any other email.

On the dashboard, **Fill demo data** populates the next nine days with
believable bookings so the week view isn't empty during a demo.
**Clear** wipes bookings but keeps accounts.

---

## How availability actually works

A slot is offered only if it survives all six checks:

1. The shop trades that weekday — **closed Mondays**
2. The owner hasn't closed the date — travel, funerals, sickness
3. The whole 25-minute service fits inside a work block, so nothing
   runs into the **12:00–14:00 break** or past closing
4. It isn't in the past
5. It respects the 30-minute minimum notice
6. Nobody already holds it

Trading hours: **Tue–Sat 09:00–21:00**, **Sun 11:00–21:00**, closed
Monday, with a daily 12:00–14:00 break.

Services are 25 minutes on a 30-minute grid, so the 5-minute cleanup
gap is built in and times stay readable: 9:00, 9:30, 10:00 — not 9:00,
9:35, 10:10.

That gives **20 slots** on a Tue–Sat, **16** on a Sunday, and **0** on
Monday.

---

## Going live with a real database

Demo mode stores everything in one browser. Two people on two phones
each see their own private world — fine for developing, useless for a
real shop. Supabase fixes that, free.

The library is already loaded on every page and the code already
speaks both backends. Four steps remain, and only you can do them
because they need your account.

**1.** Create a free project at [supabase.com](https://supabase.com).
Choose a region close to Ghana — **eu-west-1 (Ireland)** is the usual
pick; it is far nearer to Accra than anything in the US.

**2.** Open `schema.sql` and change one line — the owner's real
email address:

```sql
insert into public.staff (email)
values ('you@example.com')   -- <-- put the real address here
```

That table is what `is_staff()` checks, so it decides who can see the
dashboard. Getting it wrong locks the owner out.

**3.** In Supabase open **SQL Editor → New query**, paste the whole
file, and run it. It creates two tables, the availability view, the
double-booking index and every security policy.

**4.** From **Project Settings → API**, copy the Project URL and the
`anon` public key into `config.js`, and flip the switch:

```js
backend: 'supabase',

supabase: {
  url:     'https://YOURPROJECT.supabase.co',
  anonKey: 'eyJhbGciOi...'
}
```

Then create the owner account through the site's own sign-up form,
using the address you put in the `staff` table.

### Two things worth knowing

**The `anon` key is meant to be public.** It is safe in the browser and
safe in a public GitHub repo. What protects the data is row-level
security, not secrecy of the key. Never put the `service_role` key in
this project — that one bypasses every policy.

**Supabase will flag `booked_slots` as a "security definer view".**
That is deliberate, and `schema.sql` explains why: the view exposes
start times and nothing else, and it has to bypass the caller's RLS or
signed-in customers would see everyone else's slots as free.

### Checking it worked

Open the site on your laptop, book a slot, then open the same URL on
your phone. If the phone shows that slot as taken, it is working. If
both devices disagree, you are still in demo mode — check the browser
console, which will say exactly why.

---

## Deploying to GitHub Pages

GitHub Pages serves static files only, which is exactly what this is.
It cannot run a backend — which is why the database lives in Supabase
rather than in a Node server.

```bash
git init
git add .
git commit -m "Cheerful Giver booking system"
git branch -M main
git remote add origin https://github.com/YOURNAME/cheerful-giver.git
git push -u origin main
```

Then **Settings → Pages → Source: main / (root)**. The site appears at
`https://YOURNAME.github.io/cheerful-giver/` in a minute or two.

---

## Photographs

The project folder holds four free stock photos from Pexels, standing in until real
ones exist. **None of them are this shop.** Keep the filenames and you
can swap them with no code changes:

```
fade.jpg   lineup.jpg   beard.jpg   kids.jpg
```

Roughly 4:5 crops, 60–100 KB each, 332 KB in total. Compress anything
you add — the audience is on Ghanaian mobile data.

There is no photograph of the barber, by choice. Every image is of
*work* — hands, clippers, a finished cut — so nothing on the page
claims to be a particular person. `CREDITS.md` has the credits.

---

## Still to do

- Real address, phone and email in `config.js` (currently placeholders)
- Real barber name, years, bio and quote in `config.js` (currently invented)
- Automatic email confirmations — the confirmation screen currently
  offers a calendar download and a WhatsApp message. Sending real email
  would need a Supabase Edge Function plus a mail provider
