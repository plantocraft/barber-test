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
