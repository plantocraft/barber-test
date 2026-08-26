/* =============================================================
   Shared behaviour across every page:
   navigation, session-aware header, toasts, shop details.
   ============================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initShopDetails();
  initSessionHeader();
  initModeBanner();
});

/* ---------- mobile navigation ---------- */
function initNav() {
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  links.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => links.classList.remove('open'))
  );
}

/* ---------- fill shop details from config ---------- */
function initShopDetails() {
  document.querySelectorAll('[data-shop]').forEach(el => {
    const key = el.dataset.shop;
    if (CONFIG.shop[key] !== undefined) el.textContent = CONFIG.shop[key];
  });

  document.querySelectorAll('[data-barber]').forEach(el => {
    const key = el.dataset.barber;
    if (CONFIG.barber[key] !== undefined) el.textContent = CONFIG.barber[key];
  });

  document.querySelectorAll('[data-barber-ig]').forEach(a => {
    a.href = CONFIG.barber.instagram;
  });

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  document.querySelectorAll('[data-tel]').forEach(a => {
    a.href = 'tel:' + CONFIG.shop.phone;
  });
  document.querySelectorAll('[data-mail]').forEach(a => {
    a.href = 'mailto:' + CONFIG.shop.email;
  });
}

/* ---------- header reflects who is signed in ---------- */
async function initSessionHeader() {
  const slot = document.querySelector('[data-account-link]');
  if (!slot) return;

  const user = await Data.currentUser();

  if (!user) {
    slot.textContent = 'Login';
    slot.href = 'account.html';
    return;
  }

  slot.textContent = (user.fullName || 'Account').split(' ')[0];
  slot.href = 'account.html';

  // Owner gets a dashboard link injected next to their name.
  if (Data.isOwner(user) && !document.querySelector('[data-admin-link]')) {
    const li = document.createElement('li');
    const a  = document.createElement('a');
    a.href = 'admin.html';
    a.textContent = 'Dashboard';
    a.setAttribute('data-admin-link', '');
    li.appendChild(a);
    slot.closest('ul')?.appendChild(li);
  }
}

/* ---------- reminder banner in local mode ---------- */
function initModeBanner() {
  if (Data.mode !== 'local') return;
  if (!document.querySelector('[data-mode-banner]')) return;

  const bar = document.createElement('div');
  bar.className = 'mode-banner';
  bar.textContent = Data.degraded
    ? `Supabase is switched on but ${Data.degraded} — running on this browser only.`
    : 'Demo mode - bookings are saved in this browser only. Connect Supabase to share across devices.';
  document.body.prepend(bar);
}

/* ---------- toast ---------- */
let toastTimer = null;
function toast(message) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  requestAnimationFrame(() => el.classList.add('show'));

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3600);
}

/* ---------- alerts ---------- */
function showAlert(container, message, kind = 'error') {
  if (!container) return;
  container.className = 'alert alert-' + kind;
  container.textContent = message;
}
function clearAlert(container) {
  if (!container) return;
  container.className = 'alert';
  container.textContent = '';
}

/* ---------- escape user text before putting it in HTML ---------- */
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

/* ---------- WhatsApp deep link -------------------------------
   No API, no cost, no account. Opens WhatsApp with the message
   pre-typed. In Ghana this is where confirmations actually get
   read, so it beats email as the primary channel.             */
function whatsappLink(phone, message) {
  const clean = String(phone || '').replace(/[^0-9]/g, '');
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

/* ---------- calendar file ------------------------------------
   The booking is already in the database, so the shop knows. What
   the CUSTOMER needs is a reminder they'll actually see. An .ics
   file drops the appointment straight into their phone calendar -
   no account, no server, no email that might bounce.          */

function icsFor(booking) {
  const svc   = CONFIG.serviceById(booking.serviceId);
  const mins  = (svc && svc.minutes) || CONFIG.serviceMinutes;
  const start = slotDateTime(booking.date, booking.time);
  const end   = new Date(start.getTime() + mins * 60000);

  // Ghana is GMT year-round with no daylight saving, so local
  // wall-clock time IS UTC. No conversion needed.
  const stamp = d => d.getFullYear()
    + String(d.getMonth() + 1).padStart(2, '0')
    + String(d.getDate()).padStart(2, '0')
    + 'T'
    + String(d.getHours()).padStart(2, '0')
    + String(d.getMinutes()).padStart(2, '0')
    + '00Z';

  const escape = s => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cheerful Giver//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${booking.id}@cheerfulgiver`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(booking.serviceName + ' — ' + CONFIG.shop.name)}`,
    `LOCATION:${escape(CONFIG.shop.address)}`,
    `DESCRIPTION:${escape(
      `${booking.serviceName} · ${CONFIG.shop.currency}${booking.price}\n` +
      `Booked for ${booking.customerName}\n` +
      `Arrive 5 minutes early. More than 10 minutes late and the slot may go to a walk-in.\n` +
      `Ref ${booking.id}`
    )}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Haircut in 2 hours',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].map(foldIcsLine).join('\r\n');
}

/* RFC 5545: no line may exceed 75 octets. Longer ones are split and
   continued with a leading space. Lenient clients cope without this;
   strict ones reject the whole file, which would mean the button
   silently doing nothing on somebody's phone. */
function foldIcsLine(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const out = [];
  let current = '';
  let used = 0;

  for (const char of line) {                    // iterate by code point
    const size = new TextEncoder().encode(char).length;
    if (used + size > (out.length ? 74 : 75)) { // continuation lines lose one octet to the space
      out.push(current);
      current = '';
      used = 0;
    }
    current += char;
    used += size;
  }
  if (current) out.push(current);

  return out.join('\r\n ');
}

function downloadIcs(booking) {
  const blob = new Blob([icsFor(booking)], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `cheerful-giver-${booking.date}-${booking.time.replace(':', '')}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function bookingMessage(booking) {
  return [
    `*${CONFIG.shop.name} - Booking Confirmed*`,
    '',
    `Name:    ${booking.customerName}`,
    `Service: ${booking.serviceName}`,
    `When:    ${prettyDate(booking.date)} at ${prettyTime(booking.time)}`,
    `Price:   ${CONFIG.shop.currency}${booking.price}`,
    '',
    `Ref: ${booking.id}`,
    `${CONFIG.shop.address}`,
    '',
    'Please arrive 5 minutes early. Slots are released 10 minutes after the start time.'
  ].join('\n');
}
