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
    address:    '105 King Takie Tawiah Ave, Accra',
    // `phone` is the machine-readable one: it feeds tel: links and,
    // after normalising, WhatsApp. Full international form so it also
    // works when someone opens the site from outside Ghana.
    phone:      '+233200074673',
    // `phonePretty` is only ever displayed. Local form, because that
    // is what a customer in Accra recognises and can dial as-is.
    phonePretty:'020 007 4673',
    countryCode:'233',                     // Ghana. Used to normalise numbers for wa.me
    email:      'hello@cheerfulgiver.com', // TODO: real email
    instagram:  '#',
    currency:   '₵',

    /* Google Maps embed for the real listing. Taken from
       Maps -> Share -> Embed a map, which needs no API key and no
       billing account. Only the src is kept: the width, height and
       inline border from Google's snippet are handled in the CSS so
       the map can be responsive.

       Moving shop? Replace this one line. */
    mapEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3970.480465370635!2d-0.2543857246925598!3d5.643399394337838!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xfdf99a3d65d07c9%3A0x43c5d41b710d8259!2sCheerful%20Giver%20Unisex%20Salon!5e0!3m2!1sen!2sgh!4v1788103732027!5m2!1sen!2sgh'
  },

  /* --- Tattoo (request-only, not part of the slot engine) -----
     A tattoo doesn't fit the fixed 25-minute grid below - see
     schema.sql for why. This is a lead, not a bookable service,
     so there is no `minutes` or live slot picker.

     Deliberately says nothing about WHO does the work: the site
     sells the shop and the craft, not a named person. */
  tattooArtist: {
    blurb: 'Every idea starts as a short conversation about placement, size and style - ' +
           'the exact price and time get agreed once that’s clear, not from a price list.',

    /* Social handles, with or without the leading @. Leave one blank
       and its icon is removed rather than rendered as a dead link -
       so an account that does not exist yet simply does not show.
       `instagram` is the handle burned into the studio video. */
    instagram: 'tattsappeal',
    tiktok:    'tattsappeal'
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
