# Presentation notes — the decisions, not the code

The course is about solving problems, so these are the problems, what
was decided, and why. Each one is a slide's worth.

---

## 1. Why build it at all?

The design reference for this project was **ManCave For Men**. Their
site looks excellent — and every single "BOOK NOW" button hands off to
**Squire**, a third-party booking service they pay for.

So the honest question was: why not do the same?

**Because of what it costs and what it assumes.** Services like Squire
and Booksy charge a monthly fee per chair, in dollars, and are built
around card-on-file deposits. For a one-barber shop in Accra taking
cash and MoMo, that is a subscription in the wrong currency solving a
problem the shop doesn't have.

The thing worth building was the thing ManCave outsourced.

---

## 2. The scope cut nobody expected

The shop is **Cheerful Giver Unisex Salon**. Unisex.

That mattered technically, not just cosmetically. Men's barbering is
uniform — a cut, a fade, a beard trim all take about the same time.
Women's work at a Ghanaian salon is not: **braiding takes three to
five hours.**

The whole booking engine was designed around fixed-length slots. Drop
braiding into a 25-minute grid and one booking silently destroys the
rest of the day.

**Decision: online booking covers men's services only.** Women's work
stays walk-in and phone. This wasn't a limitation discovered late — it
was a scoping decision made deliberately, and it's the reason the
fixed-slot model is safe.

---

## 3. Availability is not a loop over opening hours

The naive version is one loop from opening to closing. Reality has
four holes in it:

- **Closed Mondays** — the barber's day off
- **12:00–14:00 break** every day
- **Sunday opens at 11:00**, not 9:00
- **The service must fit** — an 11:45 start would run into the break

So a slot is offered only if it clears six independent checks: trading
day, not closed by the owner, fits fully inside a work block, not in
the past, respects 30-minute notice, not already taken.

Result: **20 slots** Tue–Sat, **16** Sunday, **0** Monday.

> Demo: open the booking page, scroll the date strip. Monday is greyed
> out. There is a visible gap where 12:00–14:00 would be.

---

## 4. The bug that would have embarrassed the shop

Two customers open the site at the same moment. Both see 3:00 PM free.
Both tap it. Both get a confirmation.

One chair. Two people. On a Saturday.

JavaScript cannot fix this. Any check written in the browser is a
check that happened *before* the other person's booking arrived — the
gap between "is it free?" and "take it" is where the collision lives.

**The fix is one line, in the database:**

```sql
create unique index one_booking_per_slot
  on bookings (starts_at)
  where status = 'confirmed';
```

Postgres now physically refuses a second confirmed booking at the same
start time. The loser gets error `23505`, which the app turns into
*"Sorry, that slot was just taken."*

The front-end check still exists — but as courtesy, not as protection.

> Demo: three simultaneous bookings for one empty slot were fired at
> the system during testing. Exactly one succeeded.

---

## 5. Hiding customers without hiding availability

A stranger **must** be able to learn that 3:00 PM Thursday is taken —
otherwise the calendar is useless. A stranger must **not** be able to
learn who took it, or their phone number.

Row-level security can't express that on its own: it filters *rows*,
and the answer here is about *columns*.

My first attempt was column grants — let anon read every row, but only
two harmless columns:

```sql
revoke select on bookings from anon;
grant  select (starts_at, status) on bookings to anon;
```

**That was wrong, and the bug is the interesting part.** It works for a
logged-out visitor. But a *signed-in* customer is a different database
role, governed by this policy:

```sql
using (user_id = auth.uid() or public.is_staff())
```

Which restricts them to their own rows. So the moment you log in, the
availability query returns only your own bookings — and every slot
anyone else had taken appears **free**. You would pick one, and only
find out at the very last step, when the unique index refused it.

The fix is to stop asking the table and ask a view instead:

```sql
create or replace view public.booked_slots
with (security_invoker = false) as
  select starts_at from public.bookings where status = 'confirmed';
```

`security_invoker = false` means the view runs as its owner and is not
re-filtered by the caller's RLS. That is normally a thing to avoid —
Supabase even flags it — but it is exactly right here, because the only
column the view can leak is a start time.

Now the base table can stay strict: anonymous visitors read nothing
from it at all, customers see only their own, staff see everything.

One more subtlety in the same area: guests may insert a booking, but
have no grant on `status`, so nobody can create a booking that arrives
already marked `completed`.

---

## 6. Reschedule, in the right order

Moving an appointment is two operations: release the old slot, take
the new one. The order decides what happens when it goes wrong.

- Release first → new slot turns out to be gone → customer now has
  **no appointment at all**
- Take first → old one released only on success → worst case, the
  customer keeps the appointment they already had

**Take the new slot first.** Failure should leave people no worse off
than when they started.

---

## 7. Walk-ins, or why the app would have been abandoned

Real barbershops get people walking in off the street.

If the owner can't put those on the same calendar, he keeps a paper
book beside the laptop — and the moment there are two sources of truth,
the online one is wrong and everybody stops trusting it.

So the dashboard has a **Walk-in** button. It writes to the same table,
with `user_id` left null because someone off the street has no account.
Online availability updates immediately.

The `user_id` column being nullable is a deliberate design decision,
not an accident of convenience.

---

## 8. GitHub Pages cannot run a backend

The site needed logins, saved bookings and an admin dashboard — and it
needed to be free, and hosted on GitHub.

GitHub Pages serves static files only. No server code, no database.
The three options:

| Option | Verdict |
|---|---|
| Node + Express + SQLite | Real server code, but only runs on one laptop. Can't be shown to a barber on their phone. |
| `localStorage` only | Free and simple, but every visitor gets a private copy. Two phones never agree. Useless in a real shop. |
| **Static site + Supabase** | Front-end stays static on GitHub Pages; a hosted Postgres holds the data. Free tier. **Chosen.** |

The machine this was built on has neither Node nor Python installed,
which made the decision easier to justify — and proves the point that
this runs anywhere with a browser.

---

## 9. One interface, two backends

`data.js` exposes one set of functions. Behind them sit two adapters:
`localStorage` for developing offline, Supabase for real use.

```js
backend: 'local',      // change this one line
```

Nothing else in the codebase changes. That's the payoff for putting an
interface between the pages and the storage instead of scattering
`fetch` calls through five files.

---

## 10. The first design was generic, and research proved it

The first version of this site was dark charcoal, with condensed
uppercase headings, three feature cards numbered 01/02/03, and a row
of big statistics. It looked competent. It also looked like every
other template on the internet.

Rather than argue about taste, I went and measured a real one. Mr.
Winston's is an award-winning barbershop in Dallas. Reading the
computed styles straight off their live homepage:

```
fonts   ibm-plex-mono         418 uses   <- monospace, as the main UI face
        new-spirit-condensed   86 uses   <- a condensed SERIF for display
colors  #FFFFFF   ground
        #135381   one signature blue, matched to their actual chairs
```

Every assumption was wrong. Not dark — white. Not a condensed sans —
a serif. And a **monospace** face doing all the functional work.

What changed, and why:

| Before | After | Reason |
|---|---|---|
| Charcoal ground | Warm cream | Dark-everything is the template default |
| Oswald caps | Instrument Serif, mixed case | Heritage, not tech startup |
| No accent colour | Oxblood `#8B2331` | Barber pole red. One colour, used hard |
| Sans everywhere | IBM Plex Mono for times, prices, labels | A grid of times in mono reads like a ticket |
| No people | The barber's portrait, name and quote | **A one-chair shop sells a person** |
| Stats row, 01/02/03 cards | Deleted | Borrowed from dashboards, meaningless here |

The last row is the important one. The first design had no human being
anywhere on it — for a shop where one man cuts every head of hair. That
was a business mistake dressed up as a design choice.

---

## 11. Bugs found by testing, not by reading

Worth mentioning because "I tested it" is more convincing with
specifics:

- **The nav drawer painted over its own header.** It was a child of the
  sticky header, so it shared its stacking context — no amount of
  translating it upward would hide it. Fixed with visibility, not
  position.
- **The whole page scrolled sideways on mobile.** CSS grid items
  default to `min-width: auto`, so the wide date strip stretched its
  column instead of scrolling inside it, dragging the layout with it.
  One line: `min-width: 0`.
- **Past days advertised free slots.** The "is it in the past?" check
  only ran for *today*, so last Tuesday cheerfully offered 20 openings.

---

## Closing line

The booking engine is about 200 lines. The interesting part isn't the
code — it's that a haircut shop's schedule has a day off, a lunch
break, a grace period for latecomers, and people who walk in off the
street, and every one of those had to become a rule the computer could
check.
