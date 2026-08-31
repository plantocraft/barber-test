/* =============================================================
   Shared behaviour across every page:
   navigation, session-aware header, toasts, shop details.
   ============================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initShopDetails();
  initSessionHeader();
  initModeBanner();
  initMap();
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

  document.querySelectorAll('[data-tattoo]').forEach(el => {
    const key = el.dataset.tattoo;
    if (CONFIG.tattooArtist[key] !== undefined) el.textContent = CONFIG.tattooArtist[key];
  });

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  document.querySelectorAll('[data-tel]').forEach(a => {
    a.href = 'tel:' + CONFIG.shop.phone;
  });
  document.querySelectorAll('[data-mail]').forEach(a => {
    a.href = 'mailto:' + CONFIG.shop.email;
  });

  /* Directions search on the shop's NAME, not its street address.
     Accra addresses geocode unreliably, but the shop is a registered
     Google place, so the name lands on the exact pin. On a phone this
     opens the Maps app rather than a web page. */
  const mapsQuery = `${CONFIG.shop.name} ${CONFIG.shop.subtitle}, ${CONFIG.shop.city}`;
  document.querySelectorAll('[data-directions]').forEach(a => {
    a.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(mapsQuery);
  });

  initSocialLinks();
}

/* ---------- social links -------------------------------------
   Built from config rather than hard-coded, and an unset handle is
   REMOVED rather than left pointing at a profile that doesn't
   exist. A dead social icon on a shop's own page reads worse than
   no icon at all. If every handle is blank the whole row goes. */
function initSocialLinks() {
  const BASE = {
    instagram: { url: 'https://instagram.com/',      label: 'Instagram' },
    tiktok:    { url: 'https://www.tiktok.com/@',    label: 'TikTok' }
  };

  document.querySelectorAll('[data-social]').forEach(a => {
    const key = a.dataset.social;
    const cfg = BASE[key];
    const handle = String((CONFIG.tattooArtist || {})[key] || '').trim().replace(/^@/, '');

    if (!cfg || !handle) { a.remove(); return; }

    a.href = cfg.url + handle;
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', `${cfg.label} — @${handle}`);
    a.title = `@${handle} on ${cfg.label}`;
  });

  document.querySelectorAll('[data-social-row]').forEach(row => {
    if (!row.querySelector('[data-social]')) row.remove();
  });
}

/* ---------- map, loaded only when asked for -------------------
   A Google Maps iframe drags in a few hundred KB of script and
   tiles and sets Google's cookies for every visitor. Most people
   here want the address, the hours and a phone number - so the
   map costs nothing until someone actually taps it.

   The "Get directions" button beside it needs no iframe at all,
   which is what a customer standing on the street actually wants. */
function initMap() {
  const host = document.querySelector('[data-map]');
  if (!host || !CONFIG.shop.mapEmbed) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'map-load';
  btn.innerHTML =
    `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor"
          stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
       <path d="M20 10c0 5.5-8 12-8 12s-8-6.5-8-12a8 8 0 0 1 16 0z"/>
       <circle cx="12" cy="10" r="2.6"/>
     </svg>
     <span class="lbl">Show the map</span>
     <span class="sub">Loads from Google</span>`;

  btn.addEventListener('click', () => {
    const frame = document.createElement('iframe');
    frame.src = CONFIG.shop.mapEmbed;
    frame.title = CONFIG.shop.name + ' ' + CONFIG.shop.subtitle + ' on Google Maps';
    frame.loading = 'lazy';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    host.replaceChildren(frame);
  });

  host.appendChild(btn);
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

/* wa.me wants a full international number with no '+', no spaces and
   crucially NO leading zero: 233241234567, never 0241234567.

   Customers type the local form because that is exactly what the
   form placeholder asks for ("024 000 0000"), so the shop's own
   "WhatsApp this customer" buttons would otherwise open a dead
   chat every time. Normalise here rather than nag the customer.

   Order matters. The local trunk '0' is tested BEFORE the country
   code, because a real local number like 0233456789 also happens
   to start with '233' once the zero is gone - checking the country
   code first would silently mangle it. */
function whatsappNumber(phone) {
  let digits = String(phone || '').replace(/[^0-9]/g, '');
  const cc = String(CONFIG.shop.countryCode || '');

  if (!digits) return '';

  // 00 233 ... - the old-style international prefix
  if (digits.startsWith('00')) return digits.slice(2);

  // 024 123 4567 - local, drop the trunk zero and prepend the country
  if (digits.startsWith('0')) return cc + digits.slice(1);

  // already 233...
  if (cc && digits.startsWith(cc)) return digits;

  // bare subscriber number, no zero and no country code
  return cc + digits;
}

function whatsappLink(phone, message) {
  return `https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(message)}`;
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

/* ---------- gallery photos -----------------------------------
   A photo straight off a phone is 3-4 MB and 4000px wide. Uploading
   that raw would cost the barber his own data to send it, and every
   visitor theirs to load it. So the browser crops and shrinks it
   first, to the same 4:5 shape the rest of the site uses.

   This runs on the owner's phone, not a server: no image library,
   no Edge Function, nothing to pay for.                          */

function resizeImageFile(file, targetW = 800, targetH = 1000, quality = 0.78) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Pick an image file.'));
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Cover-crop: fill the frame, never letterbox.
      const targetRatio = targetW / targetH;
      const srcRatio    = img.width / img.height;
      let sx, sy, sw, sh;

      if (srcRatio > targetRatio) {
        sh = img.height;
        sw = Math.round(sh * targetRatio);
        sx = Math.round((img.width - sw) / 2);
        sy = 0;
      } else {
        sw = img.width;
        sh = Math.round(sw / targetRatio);
        sx = 0;
        // Bias upward: in a photo of a person the subject sits high,
        // and a centred crop cuts heads off.
        sy = Math.round((img.height - sh) * 0.25);
      }

      const canvas = document.createElement('canvas');
      canvas.width  = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Could not process that image.')),
        'image/jpeg',
        quality
      );
    };

    // Most often an iPhone HEIC that this browser cannot decode.
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image. Try saving it as a JPEG first.'));
    };

    img.src = url;
  });
}

/* Same idea as resizeImageFile, but it never crops.

   That distinction matters: a gallery photo is cover-cropped to a
   fixed 4:5 tile because the grid has to line up. A reference photo
   is the customer's actual design - cropping it to fit a shape would
   cut the drawing in half. So this only ever scales down, keeps the
   whole frame, and leaves the aspect alone. */
function shrinkImageFile(file, maxEdge = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Pick an image file.'));
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Could not process that image.')),
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image. Try saving it as a JPEG first.'));
    };

    img.src = url;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(blob);
  });
}

/* Uploaded photos render BEFORE the ones shipped in the repo, so the
   gallery never looks emptier after an upload than it did before. */
async function renderGalleryInto(row, category) {
  if (!row) return;

  const photos = await Data.getGalleryPhotos(category);
  if (!photos.length) return;          // built-in tiles carry the page

  row.insertAdjacentHTML('afterbegin', photos.map(p => `
    <div class="shot" data-label="${esc(p.label || '')}">
      <img src="${esc(p.url)}" alt="${esc(p.label || 'Recent work from the shop')}"
           width="800" height="1000" loading="lazy">
    </div>`).join(''));
}

/* Tattoo requests have no slot to confirm, so this reads as a
   hand-off line rather than a receipt - it's what starts the
   phone/WhatsApp conversation that actually books the session. */
function tattooRequestMessage(req) {
  return [
    `*${CONFIG.shop.name} - Tattoo Request*`,
    '',
    `Name:      ${req.customerName}`,
    `Idea:      ${req.description}`,
    req.placement     ? `Placement: ${req.placement}` : null,
    req.sizeEstimate  ? `Size:      ${req.sizeEstimate}` : null,
    req.preferredDate ? `Preferred: ${prettyDate(req.preferredDate)}` : null,
    '',
    `Ref: ${req.id}`,
    '',
    'This is a request, not a confirmed booking - the shop will follow up to agree a time.'
  ].filter(line => line !== null).join('\n');
}
