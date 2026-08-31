/* =============================================================
   Tattoo request form
   One step, no availability check — this creates a lead for the
   owner to follow up on, not a confirmed slot. See schema.sql
   for why tattoos don't run through the booking engine.
   ============================================================= */

let tattooUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  tattooUser = await Data.currentUser();
  setMinDate();
  prefillTattooDetails();
  wireReferencePicker();
  wireTattooForm();
  initHeroVideo();
  renderGalleryInto(document.querySelector('.shot-row'), 'tattoo');
});

/* ---------- hero video ---------------------------------------
   The `loop` attribute is enough in every current browser, but a
   background clip that quietly stops just looks broken - there is
   no controls UI for anyone to restart it. So this is a safety net
   rather than the mechanism: restart on `ended`, and try again if
   autoplay was refused or the tab was backgrounded.

   Autoplay CAN be refused - low-power mode on iOS, a data saver, a
   browser policy - and nothing here can override that. The poster
   frame stays up instead, which is why it has to be a frame worth
   looking at on its own. */
function initHeroVideo() {
  const video = document.querySelector('.hero-video');
  if (!video) return;

  const play = () => { const p = video.play(); if (p) p.catch(() => {}); };

  video.addEventListener('loadeddata', play);
  video.addEventListener('ended', () => { video.currentTime = 0; play(); });

  // Some browsers pause a background video when the tab goes away and
  // do not start it again on return.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && video.paused) play();
  });

  play();
}

function setMinDate() {
  const input = document.getElementById('t-date');
  if (input) input.min = ymd(new Date());
}

function prefillTattooDetails() {
  const note = document.getElementById('tattoo-guest-note');
  if (!tattooUser) {
    note.innerHTML = 'Sending as a guest. <a href="account.html" style="text-decoration:underline">' +
                     'Create an account</a> if you want to see this request under My Account later.';
    return;
  }
  document.getElementById('t-name').value  = tattooUser.fullName || '';
  document.getElementById('t-phone').value = tattooUser.phone || '';
  document.getElementById('t-email').value = tattooUser.email || '';
  note.textContent = `Sending as ${tattooUser.email}. It will appear under My Account.`;
}

/* The reference photo, once shrunk. Held here rather than read off the
   input at submit time so the customer sees exactly what will be sent,
   and so a file the browser cannot decode fails immediately - while
   they are still looking at the field - rather than on submit. */
let referenceBlob = null;

function wireReferencePicker() {
  const input   = document.getElementById('t-reference');
  const preview = document.getElementById('t-reference-preview');
  const alert   = document.getElementById('tattoo-alert');
  if (!input || !preview) return;

  input.addEventListener('change', async () => {
    referenceBlob = null;
    preview.innerHTML = '';
    clearAlert(alert);

    const file = input.files[0];
    if (!file) return;

    try {
      // Contain, not crop: this is their design, so none of it is cut off.
      referenceBlob = await shrinkImageFile(file);
      const url = URL.createObjectURL(referenceBlob);
      preview.innerHTML =
        `<img src="${url}" alt="Your reference picture" class="ref-preview">` +
        `<p class="form-note">Attached &middot; ${Math.round(referenceBlob.size / 1024)} KB. ` +
        `Pick another file to replace it.</p>`;
    } catch (err) {
      input.value = '';
      showAlert(alert, err.message);
    }
  });
}

function wireTattooForm() {
  const form  = document.getElementById('tattoo-form');
  const alert = document.getElementById('tattoo-alert');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearAlert(alert);

    if (!form.checkValidity()) { form.reportValidity(); return; }

    const phone = document.getElementById('t-phone').value.trim();
    if (phone.replace(/\D/g, '').length < 9) {
      showAlert(alert, 'That phone number looks too short. We need it to reach you.');
      return;
    }

    const btn = document.getElementById('tattoo-submit');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    const result = await Data.createTattooRequest({
      userId:        tattooUser ? tattooUser.id : null,
      customerName:  document.getElementById('t-name').value.trim(),
      customerPhone: phone,
      customerEmail: document.getElementById('t-email').value.trim(),
      description:   document.getElementById('t-description').value.trim(),
      placement:     document.getElementById('t-placement').value.trim(),
      sizeEstimate:  document.getElementById('t-size').value,
      preferredDate: document.getElementById('t-date').value || null,
      notes:         document.getElementById('t-notes').value.trim(),
      referenceBlob
    });

    btn.disabled = false;
    btn.textContent = 'Send request';

    if (!result.ok) {
      showAlert(alert, result.error);
      return;
    }

    showTattooDone(result.request);
  });
}

function showTattooDone(req) {
  document.querySelector('[data-panel="form"]').hidden = true;
  document.querySelector('[data-panel="done"]').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  document.getElementById('t-wa-link').href =
    whatsappLink(CONFIG.shop.phone, tattooRequestMessage(req));

  toast('Request sent.');
}
