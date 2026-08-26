/* =============================================================
   Demo data
   An empty dashboard is a bad demo. This fills the current week
   with believable bookings so the week view, the stats and the
   "slot already taken" behaviour can all be shown live.

   Local mode only — it never touches a real database.
   Also available from the console as CG.seed() / CG.reset().
   ============================================================= */

const CG = (() => {

  const NAMES = [
    'Kwame Mensah', 'Kofi Boateng', 'Yaw Asante', 'Kojo Adjei',
    'Nana Owusu', 'Kwabena Darko', 'Fiifi Amoah', 'Kwesi Appiah',
    'Samuel Tetteh', 'Michael Ofori', 'Daniel Quaye', 'Joseph Nkrumah',
    'Ibrahim Alhassan', 'Emmanuel Larbi', 'Prince Agyei'
  ];

  const PHONES = ['024', '054', '055', '020', '050', '026'];

  const randomPhone = () =>
    PHONES[Math.floor(Math.random() * PHONES.length)] + ' ' +
    String(Math.floor(Math.random() * 900) + 100) + ' ' +
    String(Math.floor(Math.random() * 9000) + 1000);

  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  async function seed({ fillRate = 0.45, days = 10 } = {}) {
    if (Data.mode !== 'local') {
      console.warn('Seeding is local mode only.');
      return;
    }

    let made = 0;
    const window = bookingWindow().slice(0, days);

    for (const date of window) {
      const slots = allSlotsForDate(date);
      if (!slots.length) continue;

      for (const time of slots) {
        if (Math.random() > fillRate) continue;

        const svc  = pick(CONFIG.services);
        const name = pick(NAMES);

        const result = await Data.createBooking({
          userId:        null,
          serviceId:     svc.id,
          serviceName:   svc.name,
          price:         svc.price,
          date, time,
          customerName:  name,
          customerPhone: randomPhone(),
          notes:         Math.random() < 0.2 ? 'Number 2 on the sides.' : ''
        });
        if (result.ok) made++;
      }
    }

    console.log(`Seeded ${made} bookings across ${window.length} days.`);
    return made;
  }

  function reset() {
    ['cg_bookings', 'cg_blocked'].forEach(k => localStorage.removeItem(k));
    console.log('Bookings and closures cleared. Accounts kept.');
  }

  function resetAll() {
    ['cg_bookings', 'cg_blocked', 'cg_users', 'cg_session']
      .forEach(k => localStorage.removeItem(k));
    console.log('Everything cleared, including accounts.');
  }

  return { seed, reset, resetAll };
})();

window.CG = CG;

/* Convenience buttons on the dashboard, local mode only. */
document.addEventListener('DOMContentLoaded', () => {
  if (Data.mode !== 'local') return;

  const bar = document.querySelector('#admin-view .admin-bar > div:last-child');
  if (!bar) return;

  const seedBtn = document.createElement('button');
  seedBtn.className = 'btn btn-ghost btn-sm';
  seedBtn.textContent = 'Fill demo data';
  seedBtn.addEventListener('click', async () => {
    seedBtn.disabled = true;
    seedBtn.textContent = 'Filling…';
    await CG.seed();
    location.reload();
  });

  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn btn-ghost btn-sm';
  clearBtn.textContent = 'Clear';
  clearBtn.addEventListener('click', () => {
    if (!confirm('Delete all bookings and closures? Accounts are kept.')) return;
    CG.reset();
    location.reload();
  });

  bar.append(seedBtn, clearBtn);
});
