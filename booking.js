/* =============================================================
   Booking flow
   Step 1 service  ->  Step 2 date + time  ->  Step 3 details

   Availability is recalculated from live data at every step, so
   a slot that gets taken while the customer is still deciding
   disappears rather than failing at the last moment.
   ============================================================= */

const state = {
  serviceId: null,
  date: null,
  time: null,
  bookings: [],
  blocked: [],
  user: null
};

document.addEventListener('DOMContentLoaded', async () => {
  state.user = await Data.currentUser();
  await refreshData();

  renderServicePicks();
  renderDateStrip();
  wireNavigation();
  wireForm();
  prefillDetails();
});

/* Pull the latest bookings and blocked days. */
async function refreshData() {
  const [bookings, blocked] = await Promise.all([
    Data.getBookings(),
    Data.getBlockedDays()
  ]);
  state.bookings = bookings;
  state.blocked  = blocked.map(b => b.date);
}

/* ---------- step 1 : service ---------- */

function renderServicePicks() {
  const host = document.getElementById('service-picks');
  host.innerHTML = CONFIG.services.map(s => `
    <button type="button" class="pick" data-service="${s.id}">
      <h3>${esc(s.name)}</h3>
      <div class="price">${CONFIG.shop.currency}${s.price}</div>
      <small>${esc(s.blurb)}</small>
      <small>${s.minutes} minutes</small>
    </button>
  `).join('');

  host.querySelectorAll('[data-service]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.serviceId = btn.dataset.service;
      host.querySelectorAll('.pick').forEach(p => p.classList.remove('selected'));
      btn.classList.add('selected');
      updateSummary();
      goToStep(2);
    });
  });
}

/* ---------- step 2 : date strip ---------- */

function renderDateStrip() {
  const host = document.getElementById('date-strip');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const mons = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  host.innerHTML = bookingWindow().map(dateStr => {
    const d     = parseYmd(dateStr);
    const slots = availableSlots(dateStr, state.bookings, state.blocked);
    const free  = slots.filter(s => s.available).length;

    return `
      <button type="button" class="date-chip" data-date="${dateStr}" ${free === 0 ? 'disabled' : ''}>
        <span class="dow">${days[d.getDay()]}</span>
        <span class="dnum">${d.getDate()}</span>
        <span class="mon">${mons[d.getMonth()]}</span>
      </button>`;
  }).join('');

  host.querySelectorAll('[data-date]').forEach(chip => {
    chip.addEventListener('click', () => {
      state.date = chip.dataset.date;
      state.time = null;
      host.querySelectorAll('.date-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      renderSlots();
      updateSummary();
      document.getElementById('to-step-3').disabled = true;
    });
  });

  // Open on the first day that actually has space.
  const firstOpen = host.querySelector('.date-chip:not([disabled])');
  if (firstOpen) firstOpen.click();
}

/* ---------- step 2 : slots ---------- */

function renderSlots() {
  const host = document.getElementById('slot-area');

  if (!state.date) {
    host.innerHTML = '<div class="empty-day">Pick a day first.</div>';
    return;
  }

  const slots = availableSlots(state.date, state.bookings, state.blocked);

  if (slots.length === 0) {
    const why = state.blocked.includes(state.date)
      ? 'The shop is closed that day.'
      : isTradingDay(state.date)
        ? 'No times left that day.'
        : 'Closed on Mondays.';
    host.innerHTML = `<div class="empty-day">${why}</div>`;
    return;
  }

  host.innerHTML = `<div class="slot-grid">` + slots.map(s => `
    <button type="button" class="slot" data-time="${s.time}" ${s.available ? '' : 'disabled'}
            title="${s.available ? 'Available' : s.reason === 'booked' ? 'Already booked' : 'Too late to book'}">
      ${s.pretty}
    </button>`).join('') + `</div>`;

  host.querySelectorAll('[data-time]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.time = btn.dataset.time;
      host.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('to-step-3').disabled = false;
      updateSummary();
    });
  });
}

/* ---------- summary panel ---------- */

function updateSummary() {
  const panel = document.getElementById('summary');
  const svc   = CONFIG.serviceById(state.serviceId);
  if (!svc) { panel.hidden = true; return; }

  panel.hidden = false;
  document.getElementById('sum-service').textContent = svc.name;
  document.getElementById('sum-date').textContent    = state.date ? prettyDate(state.date) : '—';
  document.getElementById('sum-time').textContent    = state.time ? prettyTime(state.time) : '—';
  document.getElementById('sum-length').textContent  = svc.minutes + ' min';
  document.getElementById('sum-total').textContent   = CONFIG.shop.currency + svc.price;
}

/* ---------- step navigation ---------- */

function goToStep(n) {
  document.querySelectorAll('[data-panel]').forEach(p => {
    p.hidden = p.dataset.panel !== String(n);
  });
  document.querySelectorAll('[data-step]').forEach(s => {
    const step = Number(s.dataset.step);
    s.classList.toggle('active', step === n);
    s.classList.toggle('done', step < n);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function wireNavigation() {
  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => goToStep(Number(btn.dataset.back)));
  });

  document.getElementById('to-step-3').addEventListener('click', async () => {
    // Someone may have taken this slot while the customer was choosing.
    await refreshData();
    const still = availableSlots(state.date, state.bookings, state.blocked)
      .find(s => s.time === state.time && s.available);

    if (!still) {
      toast('That slot was just taken. Please pick another.');
      renderDateStrip();
      return;
    }
    goToStep(3);
  });
}

/* ---------- step 3 : details + confirm ---------- */

function prefillDetails() {
  const note = document.getElementById('guest-note');

  if (state.user) {
    document.getElementById('customer-name').value  = state.user.fullName || '';
    document.getElementById('customer-phone').value = state.user.phone || '';
    note.textContent = `Booking as ${state.user.email}. It will appear under My Appointments.`;
  } else {
    note.innerHTML = 'Booking as a guest. <a href="account.html" style="text-decoration:underline">' +
                     'Create an account</a> if you want to cancel or reschedule online later.';
  }
}

function wireForm() {
  const form  = document.getElementById('details-form');
  const alert = document.getElementById('book-alert');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearAlert(alert);

    if (!form.checkValidity()) { form.reportValidity(); return; }

    const name  = document.getElementById('customer-name').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    const notes = document.getElementById('customer-notes').value.trim();

    if (phone.replace(/\D/g, '').length < 9) {
      showAlert(alert, 'That phone number looks too short. We need it to reach you.');
      return;
    }

    const btn = document.getElementById('confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Booking…';

    const svc = CONFIG.serviceById(state.serviceId);
    const result = await Data.createBooking({
      userId:        state.user ? state.user.id : null,
      serviceId:     svc.id,
      serviceName:   svc.name,
      price:         svc.price,
      date:          state.date,
      time:          state.time,
      customerName:  name,
      customerPhone: phone,
      notes
    });

    btn.disabled = false;
    btn.textContent = 'Confirm booking';

    if (!result.ok) {
      showAlert(alert, result.error);
      await refreshData();
      renderDateStrip();
      goToStep(2);
      return;
    }

    showDone(result.booking);
  });
}

/* ---------- confirmation ---------- */

function showDone(booking) {
  goToStep('done');
  document.getElementById('summary').hidden = true;
  document.querySelectorAll('[data-step]').forEach(s => s.classList.add('done'));

  document.getElementById('done-line').textContent =
    `${booking.serviceName} on ${prettyDate(booking.date)} at ${prettyTime(booking.time)}.`;

  // WhatsApp: free, no API, and the channel people in Ghana actually read.
  document.getElementById('wa-link').href =
    whatsappLink(CONFIG.shop.phone, bookingMessage(booking));

  // Calendar file, generated in the browser. No mail client, no
  // server, and it lands somewhere the customer will actually look.
  document.getElementById('ics-link').onclick = () => {
    downloadIcs(booking);
    toast('Added to your calendar.');
  };

  toast('Booking confirmed.');
}
