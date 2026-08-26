/* =============================================================
   Availability engine
   -------------------------------------------------------------
   The heart of the booking system. Turns "the shop is open
   9–9, closed Mondays, with a 12–2 break" into a concrete list
   of bookable times for a given date.

   Availability is NOT a simple loop over opening hours. A slot
   survives only if it clears every one of these:
     1. the shop trades that weekday       (closed Mondays)
     2. the owner hasn't blocked the date  (travel, funeral…)
     3. it fits fully inside a work block  (never runs into 12:00)
     4. it isn't in the past
     5. it respects minimum notice         (no booking 3 mins out)
     6. nobody already holds it
   ============================================================= */

/* ---------- small date helpers -------------------------------
   Everything is keyed on a local 'YYYY-MM-DD' string rather than
   a Date object, so a slot can never drift across a day boundary. */

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseYmd(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** minutes-since-midnight  →  "14:30" */
function minsToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "14:30" → minutes-since-midnight */
function timeToMins(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** "14:30" → "2:30 PM"  (friendlier on a phone) */
function prettyTime(time) {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

/** "2026-08-27" → "Thu 27 Aug" */
function prettyDate(dateStr) {
  const d = parseYmd(dateStr);
  const days   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

/** "2026-08-27" + "14:30" → Date */
function slotDateTime(dateStr, time) {
  const d = parseYmd(dateStr);
  const mins = timeToMins(time);
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

/* ---------- trading hours ------------------------------------ */

/** Does the shop trade at all on this date? */
function isTradingDay(dateStr) {
  return CONFIG.hours[parseYmd(dateStr).getDay()] !== null;
}

/**
 * The work blocks for a date, in minutes-since-midnight,
 * with the daily break carved out of the middle.
 *
 *   Tue–Sat → [[540, 720], [840, 1260]]   (9–12, 14–21)
 *   Sunday  → [[660, 720], [840, 1260]]   (11–12, 14–21)
 *   Monday  → []
 */
function workBlocks(dateStr) {
  const hours = CONFIG.hours[parseYmd(dateStr).getDay()];
  if (!hours) return [];

  const [oh, om, ch, cm] = hours;
  const open  = oh * 60 + om;
  const close = ch * 60 + cm;

  const [bsh, bsm, beh, bem] = CONFIG.breakTime;
  const breakStart = bsh * 60 + bsm;
  const breakEnd   = beh * 60 + bem;

  // No overlap with the break — one continuous block.
  if (breakEnd <= open || breakStart >= close) return [[open, close]];

  const blocks = [];
  if (breakStart > open)  blocks.push([open, breakStart]);
  if (breakEnd   < close) blocks.push([breakEnd, close]);
  return blocks;
}

/* ---------- slot generation ---------------------------------- */

/**
 * Every slot the shop could theoretically sell on this date,
 * ignoring bookings. A slot is only kept if the FULL service
 * fits inside the block — which is what stops an appointment
 * running into the barber's lunch or past closing.
 */
function allSlotsForDate(dateStr) {
  const slots = [];
  for (const [start, end] of workBlocks(dateStr)) {
    for (let t = start; t + CONFIG.serviceMinutes <= end; t += CONFIG.strideMinutes) {
      slots.push(minsToTime(t));
    }
  }
  return slots;
}

/**
 * The slots a customer may actually pick right now.
 *
 * @param {string} dateStr      'YYYY-MM-DD'
 * @param {Array}  bookings     confirmed bookings [{date, time, status}]
 * @param {Array}  blockedDays  ['2026-09-03', …]
 * @returns {Array} [{ time, pretty, available, reason }]
 */
function availableSlots(dateStr, bookings = [], blockedDays = []) {
  // 2. owner blocked the whole day
  if (blockedDays.includes(dateStr)) return [];
  // 1. shop doesn't trade this weekday
  if (!isTradingDay(dateStr)) return [];

  const taken = new Set(
    bookings
      .filter(b => b.date === dateStr && b.status === 'confirmed')
      .map(b => b.time)
  );

  const now      = new Date();
  const todayStr = ymd(now);
  const nowMins  = now.getHours() * 60 + now.getMinutes();

  const dayIsPast = dateStr < todayStr;   // 'YYYY-MM-DD' sorts chronologically

  return allSlotsForDate(dateStr).map(time => {
    const mins = timeToMins(time);

    // 6. already booked
    if (taken.has(time)) {
      return { time, pretty: prettyTime(time), available: false, reason: 'booked' };
    }

    // 4 + 5. a day that has been and gone, or today but already
    // past / inside the minimum-notice window
    if (dayIsPast || (dateStr === todayStr && mins < nowMins + CONFIG.minNoticeMinutes)) {
      return { time, pretty: prettyTime(time), available: false, reason: 'past' };
    }

    return { time, pretty: prettyTime(time), available: true, reason: null };
  });
}

/** The rolling booking window: today → today + windowDays. */
function bookingWindow() {
  const days = [];
  const today = new Date();
  for (let i = 0; i < CONFIG.windowDays; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(ymd(d));
  }
  return days;
}

/** Monday of the week containing dateStr — for the admin week view. */
function weekStart(dateStr) {
  const d = parseYmd(dateStr);
  const offset = (d.getDay() + 6) % 7;   // Mon = 0
  d.setDate(d.getDate() - offset);
  return ymd(d);
}

/** The seven 'YYYY-MM-DD' strings of the week starting Monday. */
function weekDays(mondayStr) {
  const out = [];
  const d = parseYmd(mondayStr);
  for (let i = 0; i < 7; i++) {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    out.push(ymd(x));
  }
  return out;
}
