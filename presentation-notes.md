# Presentation notes

**Part One** sets up the project: goal, objectives, deliverables, and the
SDLC methods actually used. **Part Two** is the decisions behind the build.
Present Part One first, then demo, then use Part Two to answer "why did
you do it that way".

Vocabulary throughout is from Sessions 1–4, so the mapping is explicit.

---

# PART ONE — Goal, objectives, deliverables, method

## A. The goal

> Replace phone-and-walk-in scheduling at Cheerful Giver Unisex Salon
> with an online booking system that shows **genuine live availability**,
> so customers stop ringing to ask what's free and the barber stops
> losing the chair to double-bookings and no-shows.

One sentence, one outcome. Everything below serves it.

**Why a goal and not a feature list:** Session 1 says a requirements
statement is *the agreement on what work will be done*. The goal is what
that agreement is measured against — a feature is only justified if it
moves this sentence.

---

## B. Objectives

Deliberately written so each one can be shown working in the demo.

| # | Objective | How it's proved |
|---|---|---|
| 1 | Show real availability for a rolling 14-day window, derived from trading hours, the daily break, owner closures and existing bookings | Slot grid — greyed slots are genuinely unavailable, not decorative |
| 2 | Make double-booking **impossible**, not merely discouraged | Unique index in Postgres; two browsers booking 3:00 PM — one wins, one is told to pick again |
| 3 | Let a customer book in under a minute with no account | Three steps, guest checkout |
| 4 | Give the owner one screen to run the week | Dashboard: week view, walk-ins, close a day, mark done / no-show |
| 5 | Capture tattoo enquiries that do **not** fit the fixed-slot model | Tattsappeal request form with reference photo |
| 6 | Let the owner change photos and content without a developer | Gallery upload in the dashboard; `config.js` as single source of truth |
| 7 | Cost the shop nothing to run | GitHub Pages + Supabase free tier — ₵0/month |
| 8 | Work on a mid-range Android phone on mobile data | Images shrunk in-browser before upload; click-to-load map |

---

## C. Deliverables

Session 1: *"each phase produces a deliverable"*. Mapped to what exists
in this repository.

| Phase | Deliverable | Where it is |
|---|---|---|
| Preliminary Investigation | Feasibility decision (technical / time / budget) | Section A of Part Two |
| Analysis | Scope decisions, incl. the braiding cut and the tattoo split | Part Two §2, README |
| Design | Interface sketches → six pages; the availability **algorithm**; the data model | `*.html`, `slots.js`, `schema.sql` |
| Development | Working system: 6 pages, 9 JS modules, 2 storage adapters | this repository |
| Development | Test evidence | Part Two §11 |
| Implementation | Deployment + handover documentation | `README.md` |
| Maintenance | Owner-editable content; outstanding TODO list | dashboard; end of `README.md` |

---

## D. SDLC methods used

### D1. Where this project sits: adaptive, not predictive

Session 2 draws the line at one question — *can the project be fully
planned in advance?*

Here it demonstrably could not, and the evidence is in the project's own
history:

- The **tattoo side did not exist** in the original requirements. It
  arrived after a conversation with the owner, mid-build.
- It was then **renamed** to Tattsappeal Studios — after the pages,
  navigation and database table were already written.
- The hero video was **replaced three times** as better footage arrived.
- A **reference-photo upload** was requested only once the request form
  already existed and had been reviewed.

Under Waterfall each of those is "swimming upstream" against a frozen
specification. Under an adaptive approach each is a normal iteration.
**The requirements genuinely were not knowable up front — so a predictive
model would have been the wrong choice, not merely a slower one.**

### D2. The six phases (Session 1), as actually executed

1. **Preliminary Investigation** — Yes/No on three factors.
   *Technical:* static hosting plus a free hosted Postgres is sufficient — no
   server needed. *Time:* deliverable by 1 September. *Budgetary:* ₵0, versus
   Squire/Booksy charging per chair in dollars. → **Proceed.**
2. **Analysis** — studied the real shop: one chair, one barber, unisex,
   cash and MoMo, customers on WhatsApp. This produced the scope cut in §2.
3. **Design** — see D3.
4. **Development** — built and tested, including the bug in §4 that
   testing caught and reading the code did not.
5. **Implementation** — see D5.
6. **Maintenance** — see D6.

### D3. Design: Output → Input → Processing → Storage

Session 1 says design covers four components and that **output is designed
first, because it clarifies what input is needed.** That is exactly the
order used, and it is worth showing because it explains the architecture:

- **Output first** — the slot grid. Deciding that a customer must see
  *which specific times are free* is what forced everything else.
- **Input** — only then: service → date → time → name and phone.
- **Processing** — `availableSlots()`: the six checks a slot must survive.
- **Storage** — two tables, one view, one unique index; and the deliberate
  split between what is public and what is not (§5).

Had input been designed first, the natural build is a "request a time"
form — which is the *tattoo* flow, and precisely the wrong shape for a
25-minute haircut.

### D4. Extreme Prototyping — the model that fits best

Session 4 describes Extreme Prototyping as a web-development model with
three sequential phases. This project followed it almost exactly:

| Course phase | What was built here |
|---|---|
| 1. Basic static HTML prototype of all pages | The six pages, styled, no logic |
| 2. Simulate data processing with a prototype services layer | `data.js` **local adapter** — real behaviour backed by `localStorage` |
| 3. Implement and integrate real services | `data.js` **supabase adapter** — same interface, real Postgres |

Both adapters still exist and are swapped with **one line** in `config.js`.
That is also **Evolutionary Prototyping** (Session 4): the prototype was
not thrown away — it became the foundation the real system grew from, and
it still earns its keep as offline demo mode.

### D5. Implementation: Parallel conversion

Session 1 lists four conversion styles — Direct, Parallel, Phased, Pilot.
This system uses **Parallel**, and the choice is visible in the software:

The shop does **not** stop taking walk-ins and phone bookings the day the
site goes live. Old and new run side by side. That is exactly why the
dashboard has an **"+ Walk-in"** button — a customer who walks in off the
street is entered by the owner and immediately occupies the same calendar,
so the online slots update.

**Without parallel-conversion support the system would have been abandoned
in week one**, because the barber's real day is still mostly walk-ins.

Direct conversion was rejected: a one-chair shop cannot risk losing a day's
bookings to a cutover.

### D6. Maintenance

Session 1: *ongoing audits, periodic evaluation, adjustment to new conditions.*

- Content the shop changes often — prices, hours, phone, address — lives
  in `config.js` alone.
- Photographs are updated by the **owner** through the dashboard, not by a
  developer. This was added specifically so maintenance does not depend on
  me remaining available.
- Known outstanding items are listed honestly at the end of `README.md`.

### D7. Models considered and rejected

Being able to say why *not* is worth as much as the choice itself.

| Model | Why not |
|---|---|
| **Waterfall** | Requirements demonstrably changed mid-build (D1). Freezing them would have excluded the entire tattoo side. |
| **V-Model** | Needs clear, fixed, unambiguous requirements. Same objection, plus heavy test documentation for a solo project. |
| **Spiral** | Built for medium-to-high risk and long cycles. The risk here is low and the schedule is weeks, so the overhead buys nothing. |
| **RAD** | Closest rejected fit — but it assumes a team, domain experts on call and code-generation tooling. This was one developer. |
| **Big Bang** | What this would have been *without* a method: start coding, hope. Named here because it is the honest default, and the thing the discipline is meant to prevent. |

### D8. Honest limits of the method

A solo student project cannot claim the parts of Agile that require a
team. There were no daily stand-ups, no sprint ceremonies, no pair
programming, no cross-functional team.

What **was** genuinely used from the adaptive/Agile side:

- **Working software over documentation** — every change was demonstrated
  running, not described.
- **Customer collaboration over contract** — the owner's input changed
  scope repeatedly, and was allowed to.
- **Responding to change** — see the four examples in D1.
- **Iterations** — each feature was analysed, designed, built and tested
  as a self-contained mini-project before the next began.

Claiming full Scrum would be false. Claiming an adaptive, iterative,
prototype-led process is exactly what happened.

---

# PART TWO — The decisions

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
