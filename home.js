/* =============================================================
   Homepage — service menu and opening hours, both rendered
   from config.js so prices never drift between pages.
   ============================================================= */

document.addEventListener('DOMContentLoaded', () => {
  renderServiceList();
  renderHoursTable();
  renderGalleryInto(document.querySelector('.shot-row'), 'barber');
});

function renderServiceList() {
  const host = document.getElementById('service-list');
  if (!host) return;

  host.innerHTML = CONFIG.services.map(s => `
    <div class="service-row">
      <h3>${esc(s.name)}</h3>
      <div class="price">${CONFIG.shop.currency}${s.price}</div>
      <p>${esc(s.blurb)} <span class="dur">&middot; ${s.minutes} min</span></p>
    </div>
  `).join('');
}

function renderHoursTable() {
  const host = document.getElementById('hours-table');
  if (!host) return;

  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = new Date().getDay();
  const order = [1, 2, 3, 4, 5, 6, 0];   // display Monday-first
  const pad = n => String(n).padStart(2, '0');

  host.innerHTML = order.map(day => {
    const hours = CONFIG.hours[day];
    const label = hours
      ? `${pad(hours[0])}:${pad(hours[1])} – ${pad(hours[2])}:${pad(hours[3])}`
      : 'Closed';

    const cls = [hours ? '' : 'closed', day === today ? 'today' : ''].filter(Boolean).join(' ');
    return `<tr class="${cls}"><td>${names[day]}</td><td>${label}</td></tr>`;
  }).join('');
}
