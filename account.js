/* =============================================================
   Customer account
   Sign in / sign up, then view, cancel and reschedule bookings.

   Rescheduling is deliberately "book the new slot, then release
   the old one" rather than editing in place: if the new slot is
   gone the customer still keeps their original appointment.
   ============================================================= */

let me = null;                                   // signed-in user
let resched = { booking: null, date: null, time: null };

document.addEventListener('DOMContentLoaded', async () => {
  wireAuthTabs();
  wireAuthForms();
  wireSignOut();
  wireModal();
  await render();
});

/* ---------- view switching ---------- */

async function render() {
  me = await Data.currentUser();

  document.getElementById('auth-view').hidden    = !!me;
  document.getElementById('account-view').hidden = !me;

  if (!me) return;

  document.getElementById('hello').textContent =
    'Hello, ' + (me.fullName || 'there').split(' ')[0];
  document.getElementById('account-email').textContent = me.email;

  // The owner signs in through the same door as everyone else, then
  // gets taken to the dashboard from here - so nobody has to know or
  // remember the admin URL.
  const ownerBar = document.getElementById('owner-shortcut');
  if (ownerBar) ownerBar.hidden = !Data.isOwner(me);

  await renderBookings();
  await renderTattooRequests();
}

/* ---------- auth ---------- */

function wireAuthTabs() {
  const tabs = document.querySelectorAll('.auth-tabs button');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const login = tab.dataset.tab === 'login';
      document.getElementById('login-form').hidden  = !login;
      document.getElementById('signup-form').hidden = login;
      clearAlert(document.getElementById('auth-alert'));
    });
  });
}

function wireAuthForms() {
  const alert = document.getElementById('auth-alert');

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    clearAlert(alert);

    const result = await Data.signIn({
      email:    document.getElementById('login-email').value,
      password: document.getElementById('login-password').value
    });

    if (!result.ok) { showAlert(alert, result.error); return; }
    toast('Signed in.');
    await render();
  });

  document.getElementById('signup-form').addEventListener('submit', async e => {
    e.preventDefault();
    clearAlert(alert);

    const form = e.target;
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const result = await Data.signUp({
      fullName: document.getElementById('signup-name').value.trim(),
      phone:    document.getElementById('signup-phone').value.trim(),
      email:    document.getElementById('signup-email').value,
      password: document.getElementById('signup-password').value
    });

    if (!result.ok) { showAlert(alert, result.error); return; }

    // Supabase may require email confirmation before a session exists.
    if (Data.mode === 'supabase' && !(await Data.currentUser())) {
      showAlert(alert, 'Account created. Check your email to confirm, then sign in.', 'ok');
      return;
    }
    toast('Account created.');
    await render();
  });
}

function wireSignOut() {
  document.getElementById('signout-btn').addEventListener('click', async () => {
    await Data.signOut();
    toast('Signed out.');
    await render();
  });
}

/* ---------- bookings ---------- */

async function renderBookings() {
  const all = await Data.getMyBookings(me.id);
  const now = new Date();

  const upcoming = [];
  const past     = [];

  all.forEach(b => {
    const when = slotDateTime(b.date, b.time);
    (b.status === 'confirmed' && when >= now ? upcoming : past).push(b);
  });

  past.reverse();

  const up = document.getElementById('upcoming-list');
  up.innerHTML = upcoming.length
    ? upcoming.map(b => bookingCard(b, true)).join('')
    : `<div class="empty-day">No upcoming appointments.
         <a href="booking.html" style="text-decoration:underline">Book one</a>.</div>`;

  const pl = document.getElementById('past-list');
  pl.innerHTML = past.length
    ? past.map(b => bookingCard(b, false)).join('')
    : `<div class="empty-day">Nothing here yet.</div>`;

  up.querySelectorAll('[data-cancel]').forEach(btn =>
    btn.addEventListener('click', () => cancelBooking(btn.dataset.cancel)));

  up.querySelectorAll('[data-reschedule]').forEach(btn =>
    btn.addEventListener('click', () => openReschedule(btn.dataset.reschedule, all)));
}

function bookingCard(b, actionable) {
  const status = actionable ? 'confirmed'
    : b.status === 'confirmed' ? 'past' : b.status;

  return `
    <div class="booking-card">
      <div>
        <div class="when">${prettyDate(b.date)} &middot; ${prettyTime(b.time)}</div>
        <div class="what">
          ${esc(b.serviceName)} &middot; ${CONFIG.shop.currency}${b.price}
          &middot; <span class="badge badge-${status}">${status.replace('_', ' ')}</span>
        </div>
        ${b.notes ? `<div class="what">Note: ${esc(b.notes)}</div>` : ''}
      </div>
      ${actionable ? `
      <div class="booking-actions">
        <button class="btn btn-ghost btn-sm" data-reschedule="${b.id}">Reschedule</button>
        <button class="btn btn-danger btn-sm" data-cancel="${b.id}">Cancel</button>
      </div>` : ''}
    </div>`;
}

/* ---------- tattoo requests ----------
   Read-only here: there's no slot to cancel or reschedule, just a
   status the shop moves along after they've followed up. */

async function renderTattooRequests() {
  const host = document.getElementById('tattoo-list');
  if (!host) return;

  const requests = await Data.getMyTattooRequests(me.id);

  host.innerHTML = requests.length
    ? requests.map(tattooCard).join('')
    : `<div class="empty-day">No Tattsappeal requests yet.
         <a href="tattoo.html" style="text-decoration:underline">Send one</a>.</div>`;
}

function tattooCard(r) {
  return `
    <div class="booking-card">
      <div>
        <div class="when">${esc(r.description.slice(0, 60))}${r.description.length > 60 ? '…' : ''}</div>
        <div class="what">
          ${r.placement ? esc(r.placement) + ' &middot; ' : ''}${r.sizeEstimate ? esc(r.sizeEstimate) : 'Size TBC'}
          &middot; <span class="badge badge-${r.status}">${r.status}</span>
        </div>
        <div class="what">Sent ${prettyDate(r.createdAt.slice(0, 10))}</div>
      </div>
    </div>`;
}

async function cancelBooking(id) {
  if (!confirm('Cancel this appointment? The slot goes back on sale immediately.')) return;

  const result = await Data.setBookingStatus(id, 'cancelled');
  if (!result.ok) { toast(result.error); return; }

  toast('Appointment cancelled.');
  await renderBookings();
}

/* ---------- reschedule ---------- */

function wireModal() {
  const modal = document.getElementById('reschedule-modal');

  modal.querySelectorAll('[data-close-modal]').forEach(btn =>
    btn.addEventListener('click', () => modal.classList.remove('open')));

  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.remove('open');
  });

  document.getElementById('resched-confirm').addEventListener('click', confirmReschedule);
}

async function openReschedule(id, all) {
  const booking = all.find(b => b.id === id);
  if (!booking) return;

  resched = { booking, date: null, time: null };

  document.getElementById('resched-current').textContent =
    `Currently ${prettyDate(booking.date)} at ${prettyTime(booking.time)} — ${booking.serviceName}.`;

  clearAlert(document.getElementById('resched-alert'));
  document.getElementById('resched-confirm').disabled = true;
  document.getElementById('reschedule-modal').classList.add('open');

  await renderReschedDates();
}

async function renderReschedDates() {
  const [bookings, blockedRaw] = await Promise.all([Data.getBookings(), Data.getBlockedDays()]);
  const blocked = blockedRaw.map(b => b.date);

  const host = document.getElementById('resched-dates');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const mons = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  host.innerHTML = bookingWindow().map(dateStr => {
    const d    = parseYmd(dateStr);
    const free = availableSlots(dateStr, bookings, blocked).filter(s => s.available).length;
    return `
      <button type="button" class="date-chip" data-date="${dateStr}" ${free === 0 ? 'disabled' : ''}>
        <span class="dow">${days[d.getDay()]}</span>
        <span class="dnum">${d.getDate()}</span>
        <span class="mon">${mons[d.getMonth()]}</span>
      </button>`;
  }).join('');

  host.querySelectorAll('[data-date]').forEach(chip => {
    chip.addEventListener('click', () => {
      resched.date = chip.dataset.date;
      resched.time = null;
      host.querySelectorAll('.date-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      document.getElementById('resched-confirm').disabled = true;
      renderReschedSlots(bookings, blocked);
    });
  });
}

function renderReschedSlots(bookings, blocked) {
  const host  = document.getElementById('resched-slots');
  const slots = availableSlots(resched.date, bookings, blocked);

  host.innerHTML = `<div class="slot-grid">` + slots.map(s => `
    <button type="button" class="slot" data-time="${s.time}" ${s.available ? '' : 'disabled'}>
      ${s.pretty}
    </button>`).join('') + `</div>`;

  host.querySelectorAll('[data-time]').forEach(btn => {
    btn.addEventListener('click', () => {
      resched.time = btn.dataset.time;
      host.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('resched-confirm').disabled = false;
    });
  });
}

async function confirmReschedule() {
  const alert = document.getElementById('resched-alert');
  const btn   = document.getElementById('resched-confirm');
  const old   = resched.booking;

  clearAlert(alert);
  btn.disabled = true;
  btn.textContent = 'Moving…';

  // Take the new slot FIRST. If it fails, the old booking is untouched.
  const created = await Data.createBooking({
    userId:        me.id,
    serviceId:     old.serviceId,
    serviceName:   old.serviceName,
    price:         old.price,
    date:          resched.date,
    time:          resched.time,
    customerName:  old.customerName,
    customerPhone: old.customerPhone,
    notes:         old.notes || ''
  });

  btn.textContent = 'Move booking';

  if (!created.ok) {
    showAlert(alert, created.error);
    btn.disabled = false;
    await renderReschedDates();
    return;
  }

  // New slot secured — now release the old one.
  await Data.setBookingStatus(old.id, 'cancelled');

  document.getElementById('reschedule-modal').classList.remove('open');
  toast('Moved to ' + prettyDate(resched.date) + ' at ' + prettyTime(resched.time) + '.');
  await renderBookings();
}
