/* =============================================================
   Cheerful Giver Unisex Salon — configuration
   Single source of truth for the shop. Change it here, the whole
   site follows: opening hours, break, services, prices.
   ============================================================= */

const CONFIG = {

  shop: {
    name:       'Cheerful Giver',
    subtitle:   'Unisex Salon',
    city:       'Accra, Ghana',
    area:       'Osu',                     // TODO: real neighbourhood
    address:    'Osu, Accra',              // TODO: exact street from the owner
    phone:      '+233000000000',           // TODO: real number
    phonePretty:'+233 00 000 0000',
    email:      'hello@cheerfulgiver.com', // TODO: real email
    instagram:  '#',
    currency:   '₵'
  },

  /* --- The barber --------------------------------------------
     A one-chair shop sells a person, not a brand. Every one of
     these is a PLACEHOLDER until Luc gets the real details from
     the shop - especially the name. */
  barber: {
    name:      'Kwame',                    // TODO: real name
    role:      'Barber & Owner',
    years:     12,                         // TODO: real number
    quote:     'If you leave the chair and don’t look in every mirror on the way home, I have not finished.',
    bio:       'Cutting in Accra since he was seventeen. Known for fades that stay sharp into the second week, and for taking his time on a line-up that most shops rush.',
    instagram: '#'                         // TODO: real handle
  },

  /* --- Trading hours -----------------------------------------
     Index = JS day number (0 = Sunday … 6 = Saturday).
     null  = closed all day.
     [openHour, openMinute, closeHour, closeMinute]              */
  hours: {
    0: [11, 0, 21, 0],   // Sunday
    1: null,             // Monday — barber's day off
    2: [9, 0, 21, 0],    // Tuesday
    3: [9, 0, 21, 0],    // Wednesday
    4: [9, 0, 21, 0],    // Thursday
    5: [9, 0, 21, 0],    // Friday
    6: [9, 0, 21, 0]     // Saturday
  },

  /* Daily break — no appointments start or run through this */
  breakTime: [12, 0, 14, 0],   // 12:00 – 14:00

  /* --- Slot maths --------------------------------------------
     serviceMinutes  how long a cut actually takes
     gapMinutes      cleanup between clients
     strideMinutes   how far apart slots start (service + gap)
     Keeping stride at 30 gives clean times: 9:00, 9:30, 10:00…  */
  serviceMinutes: 25,
  gapMinutes:     5,
  strideMinutes:  30,

  /* How far ahead customers may book */
  windowDays: 14,

  /* Minimum notice — can't book a slot starting in < 30 minutes */
  minNoticeMinutes: 30,

  /* Grace period before the barber may release a slot (no-show) */
  noShowGraceMinutes: 10,

  /* --- Services ---------------------------------------------- */
  services: [
    { id: 'haircut',   name: 'Haircut',       price: 40, minutes: 25, blurb: 'Clean, sharp, finished with a line-up.' },
    { id: 'fade',      name: 'Fade / Taper',  price: 50, minutes: 25, blurb: 'Low, mid or high — blended clean.' },
    { id: 'beard',     name: 'Beard Trim',    price: 30, minutes: 25, blurb: 'Shaped, edged and conditioned.' },
    { id: 'combo',     name: 'Cut + Beard',   price: 60, minutes: 25, blurb: 'The full reset. Best value.' },
    { id: 'kids',      name: 'Kids Cut',      price: 30, minutes: 25, blurb: 'Patient hands for under-12s.' }
  ],

  /* --- Data backend ------------------------------------------
     'local'    → browser localStorage. Works offline, no setup.
     'supabase' → real hosted database, shared across devices.
     Start on 'local', flip to 'supabase' once keys are filled in. */
  backend: 'supabase',

  supabase: {
    url:     'https://arhcofqbbfkwwajgowyc.supabase.co',   // https://xxxxxxxx.supabase.co
    anonKey: 'sb_publishable_ObqP60BqtOu3nu1QZdqPwg_2IcK9XPm'    // the public "anon" key — safe in the browser
  },

  /* Owner account. Any user with this email sees the dashboard. */
  ownerEmail: 'momolic6@gmail.com'
};

/* Convenience lookups */
CONFIG.serviceById = id => CONFIG.services.find(s => s.id === id) || null;

window.CONFIG = CONFIG;
