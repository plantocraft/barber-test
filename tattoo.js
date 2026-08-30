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
  wireTattooForm();
  renderGalleryInto(document.querySelector('.shot-row'), 'tattoo');
});

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
      notes:         document.getElementById('t-notes').value.trim()
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
