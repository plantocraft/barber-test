/* =============================================================
   Owner dashboard
   Week view of every appointment, plus the three things a real
   shop actually needs: close a day, add a walk-in, and mark
   someone as done / no-show / cancelled.
   ============================================================= */

let currentMonday = weekStart(ymd(new Date()));
let bookings = [];
let blocked  = [];
let openAppt = null;
let blockDate = null;

document.addEventListener('DOMContentLoaded', async () => {
  wireLogin();
  wireWeekNav();
  wireModals();
  wireWalkin();
  await gate();
});

/* ---------- access control -----------------------------------
   In local mode this is a client-side check only. With Supabase
   the real protection is row-level security on the database:
   even if someone forced this page open, the queries would
   return nothing.                                              */

async function gate() {
  const user = await Data.currentUser();
  const allowed = Data.isOwner(user);

  document.getElementById('locked-view').hidden = allowed;
  document.getElementById('admin-view').hidden  = !allowed;
  document.getElementById('signout-btn').hidden = !allowed;

  if (allowed) await loadWeek();
}

function wireLogin() {
  const alert = document.getElementById('admin-alert');

  document.getElementById('admin-login').addEventListener('submit', async e => {
    e.preventDefault();
    clearAlert(alert);

    const email = document.getElementById('admin-email').value;
    const result = await Data.signIn({
      email,
      password: document.getElementById('admin-password').value
    });

    if (!result.ok) { showAlert(alert, result.error); return; }

    if (!Data.isOwner(result.user)) {
      await Data.signOut();
      showAlert(alert, 'That account is not the owner account.');
      return;
    }
    await gate();
  });

  document.getElementById('signout-btn').addEventListener('click', async () => {
    await Data.signOut();
    await gate();
  });
}

/* ---------- week navigation ---------- */

function wireWeekNav() {
  document.getElementById('prev-week').addEventListener('click', () => shiftWeek(-7));
  document.getElementById('next-week').addEventListener('click', () => shiftWeek(7));
  document.getElementById('this-week').addEventListener('click', () => {
    currentMonday = weekStart(ymd(new Date()));
    loadWeek();
  });
}

function shiftWeek(days) {
  const d = parseYmd(currentMonday);
  d.setDate(d.getDate() + days);
  currentMonday = ymd(d);
  loadWeek();
}

/* ---------- render ---------- */

async function loadWeek() {
  const [b, bl] = await Promise.all([Data.getAllBookings(), Data.getBlockedDays()]);
  bookings = b;
  blocked  = bl;

  renderWeek();
  renderStats();
}

function renderWeek() {
  const days = weekDays(currentMonday);
  const host = document.getElementById('week-grid');
  const dow  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const mons = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const todayStr = ymd(new Date());
  const blockedDates = blocked.map(x => x.date);

  document.getElementById('week-label').textContent =
    prettyDate(days[0]) + ' – ' + prettyDate(days[6]);

  host.innerHTML = days.map(dateStr => {
    const d         = parseYmd(dateStr);
    const isClosed  = !isTradingDay(dateStr);
    const isBlocked = blockedDates.includes(dateStr);
    const reason    = (blocked.find(x => x.date === dateStr) || {}).reason || '';

    const dayAppts = bookings
      .filter(b => b.date === dateStr && b.status !== 'cancelled')
      .sort((a, b) => a.time.localeCompare(b.time));

    const cancelled = bookings.filter(b => b.date === dateStr && b.status === 'cancelled');

    let body;
    if (isClosed) {
      body = '<div class="day-empty">Closed</div>';
    } else if (isBlocked) {
      body = `<div class="day-empty">Closed by owner${reason ? '<br>' + esc(reason) : ''}</div>`;
    } else if (dayAppts.length === 0) {
      body = '<div class="day-empty">No bookings</div>';
    } else {
      body = dayAppts.map(b => `
        <div class="appt ${b.status}" data-appt="${b.id}">
          <span class="t">${prettyTime(b.time)}</span>
          <span class="n">${esc(b.customerName)}</span>
          <span class="s">${esc(b.serviceName)} · ${CONFIG.shop.currency}${b.price}</span>
        </div>`).join('');
    }

    if (cancelled.length) {
      body += `<div class="day-empty" style="font-size:0.7rem">${cancelled.length} cancelled</div>`;
    }

    const free = isClosed || isBlocked ? 0
      : availableSlots(dateStr, bookings, blockedDates).filter(s => s.available).length;

    return `
      <div class="day-col ${isBlocked ? 'is-blocked' : ''} ${isClosed ? 'is-closed' : ''}">
        <div class="day-head ${dateStr === todayStr ? 'today' : ''}">
          <div class="dow">${dow[d.getDay()]}</div>
          <div class="dnum">${d.getDate()} ${mons[d.getMonth()]}</div>
        </div>
        <div class="day-body">${body}</div>
        <div class="day-foot">
          ${isClosed ? '<span class="text-dim" style="font-size:0.7rem">Day off</span>' : `
            <button class="btn btn-ghost btn-sm btn-block" data-block="${dateStr}"
                    style="font-size:0.6rem;padding:7px 8px">
              ${isBlocked ? 'Reopen day' : free + ' free · Close day'}
            </button>`}
        </div>
      </div>`;
  }).join('');

  host.querySelectorAll('[data-appt]').forEach(el =>
    el.addEventListener('click', () => openAppointment(el.dataset.appt)));

  host.querySelectorAll('[data-block]').forEach(el =>
    el.addEventListener('click', () => toggleBlock(el.dataset.block)));
}

function renderStats() {
  const days = weekDays(currentMonday);
  const blockedDates = blocked.map(x => x.date);
  const todayStr = ymd(new Date());

  const weekAppts = bookings.filter(b =>
    days.includes(b.date) && b.status !== 'cancelled');

  const revenue = weekAppts
    .filter(b => b.status !== 'no_show')
    .reduce((sum, b) => sum + Number(b.price || 0), 0);

  const free = days.reduce((sum, d) =>
    sum + availableSlots(d, bookings, blockedDates).filter(s => s.available).length, 0);

  const today = bookings.filter(b => b.date === todayStr && b.status !== 'cancelled').length;

  document.getElementById('stat-booked').textContent  = weekAppts.length;
  document.getElementById('stat-revenue').textContent = CONFIG.shop.currency + revenue;
  document.getElementById('stat-free').textContent    = free;
  document.getElementById('stat-today').textContent   = today;
}

/* ---------- appointment modal ---------- */

function openAppointment(id) {
  const b = bookings.find(x => x.id === id);
  if (!b) return;
  openAppt = b;

  document.getElementById('appt-title').textContent =
    prettyDate(b.date) + ' · ' + prettyTime(b.time);
  document.getElementById('appt-name').textContent    = b.customerName;
  document.getElementById('appt-phone').textContent   = b.customerPhone || '—';
  document.getElementById('appt-service').textContent =
    b.serviceName + ' · ' + CONFIG.shop.currency + b.price;
  document.getElementById('appt-status').innerHTML =
    `<span class="badge badge-${b.status}">${b.status.replace('_', ' ')}</span>`;
  document.getElementById('appt-notes').textContent = b.notes ? 'Note: ' + b.notes : '';

  const reminder = `Hi ${b.customerName}, this is ${CONFIG.shop.name}. ` +
    `Reminder of your ${b.serviceName} on ${prettyDate(b.date)} at ${prettyTime(b.time)}. See you soon.`;

  document.getElementById('appt-whatsapp').href = whatsappLink(b.customerPhone, reminder);
  document.getElementById('appt-call').href     = 'tel:' + (b.customerPhone || '');

  document.getElementById('appt-modal').classList.add('open');
}

function wireModals() {
  document.querySelectorAll('[data-close-modal]').forEach(btn =>
    btn.addEventListener('click', () =>
      btn.closest('.modal-back').classList.remove('open')));

  document.querySelectorAll('.modal-back').forEach(back =>
    back.addEventListener('click', e => {
      if (e.target === back) back.classList.remove('open');
    }));

  document.querySelectorAll('[data-status]').forEach(btn =>
    btn.addEventListener('click', async () => {
      if (!openAppt) return;
      const status = btn.dataset.status;

      if (status === 'cancelled' &&
          !confirm('Cancel this booking? The slot goes back on sale.')) return;

      const result = await Data.setBookingStatus(openAppt.id, status);
      if (!result.ok) { toast(result.error); return; }

      document.getElementById('appt-modal').classList.remove('open');
      toast('Updated to ' + status.replace('_', ' ') + '.');
      await loadWeek();
    }));

  document.getElementById('block-confirm').addEventListener('click', async () => {
    const reason = document.getElementById('block-reason').value.trim();
    await Data.blockDay(blockDate, reason);
    document.getElementById('block-modal').classList.remove('open');
    toast('Day closed.');
    await loadWeek();
  });
}

/* ---------- block / reopen a day ---------- */

async function toggleBlock(dateStr) {
  const isBlocked = blocked.some(b => b.date === dateStr);

  if (isBlocked) {
    await Data.unblockDay(dateStr);
    toast('Day reopened.');
    await loadWeek();
    return;
  }

  blockDate = dateStr;
  document.getElementById('block-title').textContent = 'Close ' + prettyDate(dateStr);
  document.getElementById('block-reason').value = '';
  document.getElementById('block-modal').classList.add('open');
}

/* ---------- walk-ins ---------- */

function wireWalkin() {
  const modal = document.getElementById('walkin-modal');

  document.getElementById('add-walkin').addEventListener('click', () => {
    document.getElementById('walkin-service').innerHTML = CONFIG.services
      .map(s => `<option value="${s.id}">${esc(s.name)} — ${CONFIG.shop.currency}${s.price}</option>`)
      .join('');

    const blockedDates = blocked.map(x => x.date);
    document.getElementById('walkin-date').innerHTML = bookingWindow()
      .filter(d => availableSlots(d, bookings, blockedDates).some(s => s.available))
      .map(d => `<option value="${d}">${prettyDate(d)}</option>`)
      .join('');

    clearAlert(document.getElementById('walkin-alert'));
    document.getElementById('walkin-form').reset();
    fillWalkinTimes();
    modal.classList.add('open');
  });

  document.getElementById('walkin-date').addEventListener('change', fillWalkinTimes);

  document.getElementById('walkin-form').addEventListener('submit', async e => {
    e.preventDefault();
    const alert = document.getElementById('walkin-alert');
    clearAlert(alert);

    const svc = CONFIG.serviceById(document.getElementById('walkin-service').value);
    const result = await Data.createBooking({
      userId:        null,                       // walk-ins have no account
      serviceId:     svc.id,
      serviceName:   svc.name,
      price:         svc.price,
      date:          document.getElementById('walkin-date').value,
      time:          document.getElementById('walkin-time').value,
      customerName:  document.getElementById('walkin-name').value.trim(),
      customerPhone: document.getElementById('walkin-phone').value.trim(),
      notes:         'Walk-in'
    });

    if (!result.ok) { showAlert(alert, result.error); await loadWeek(); return; }

    modal.classList.remove('open');
    toast('Walk-in added.');
    await loadWeek();
  });
}

function fillWalkinTimes() {
  const dateStr = document.getElementById('walkin-date').value;
  const host    = document.getElementById('walkin-time');
  if (!dateStr) { host.innerHTML = ''; return; }

  const blockedDates = blocked.map(x => x.date);
  host.innerHTML = availableSlots(dateStr, bookings, blockedDates)
    .filter(s => s.available)
    .map(s => `<option value="${s.time}">${s.pretty}</option>`)
    .join('');
}
