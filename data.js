/* =============================================================
   Data layer
   -------------------------------------------------------------
   Every page talks to `Data.*` and never touches storage
   directly. Two interchangeable adapters sit behind it:

     local     -> browser localStorage. No setup, works offline,
                  good for developing and demoing. Data lives in
                  ONE browser only.
     supabase  -> hosted Postgres. Real accounts, shared data,
                  works across phones and laptops.

   Switching between them is one line in config.js. Nothing else
   in the codebase changes - that is the whole point of putting
   an interface here instead of scattering fetch calls around.
   ============================================================= */

const Data = (() => {

  /* ===========================================================
     LOCAL ADAPTER - localStorage

     NOTE: demo only. Password hashing here happens in the
     browser, which is not real security; it exists so the demo
     does not store plain text. Supabase mode does authentication
     properly, on the server.
     =========================================================== */

  const LS = {
    bookings: 'cg_bookings',
    blocked:  'cg_blocked',
    users:    'cg_users',
    session:  'cg_session'
  };

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  async function hash(password) {
    const data   = new TextEncoder().encode('cheerful-giver::' + password);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const uid = () => 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const publicUser = u => ({ id: u.id, email: u.email, fullName: u.fullName, phone: u.phone });

  const localAdapter = {

    /* ---- auth ---- */

    async signUp({ email, password, fullName, phone }) {
      const users = read(LS.users, []);
      email = email.trim().toLowerCase();

      if (users.some(u => u.email === email)) {
        return { ok: false, error: 'An account with that email already exists.' };
      }
      const user = {
        id: uid(), email, fullName, phone,
        passwordHash: await hash(password),
        createdAt: new Date().toISOString()
      };
      users.push(user);
      write(LS.users, users);
      write(LS.session, user.id);
      return { ok: true, user: publicUser(user) };
    },

    async signIn({ email, password }) {
      const users = read(LS.users, []);
      email = email.trim().toLowerCase();
      const user = users.find(u => u.email === email);
      const attempted = await hash(password);

      if (!user || user.passwordHash !== attempted) {
        return { ok: false, error: 'Wrong email or password.' };
      }
      write(LS.session, user.id);
      return { ok: true, user: publicUser(user) };
    },

    async signOut() {
      localStorage.removeItem(LS.session);
      return { ok: true };
    },

    async currentUser() {
      const id = read(LS.session, null);
      if (!id) return null;
      const user = read(LS.users, []).find(u => u.id === id);
      return user ? publicUser(user) : null;
    },

    /* ---- bookings ---- */

    async getBookings() {
      return read(LS.bookings, []);
    },

    // Same data in local mode. The split only becomes meaningful
    // under Supabase, where column grants hide customer details
    // from anonymous visitors.
    async getAllBookings() {
      return read(LS.bookings, [])
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    },

    async getMyBookings(userId) {
      return read(LS.bookings, [])
        .filter(b => b.userId === userId)
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    },

    async createBooking(booking) {
      const bookings = read(LS.bookings, []);

      // Mirrors the database unique index: one confirmed booking
      // per start time. Last line of defence against two people
      // taking the same slot.
      const clash = bookings.some(b =>
        b.date === booking.date &&
        b.time === booking.time &&
        b.status === 'confirmed'
      );
      if (clash) {
        return { ok: false, error: 'Sorry, that slot was just taken. Please pick another.' };
      }

      const record = {
        ...booking,
        id: uid(),
        status: 'confirmed',
        createdAt: new Date().toISOString()
      };
      bookings.push(record);
      write(LS.bookings, bookings);
      return { ok: true, booking: record };
    },

    async setBookingStatus(id, status) {
      const bookings = read(LS.bookings, []);
      const booking  = bookings.find(b => b.id === id);
      if (!booking) return { ok: false, error: 'Booking not found.' };
      booking.status = status;
      write(LS.bookings, bookings);
      return { ok: true, booking };
    },

    /* ---- blocked days ---- */

    async getBlockedDays() {
      return read(LS.blocked, []);
    },

    async blockDay(date, reason = '') {
      const blocked = read(LS.blocked, []);
      if (!blocked.some(b => b.date === date)) {
        blocked.push({ date, reason });
        write(LS.blocked, blocked);
      }
      return { ok: true };
    },

    async unblockDay(date) {
      write(LS.blocked, read(LS.blocked, []).filter(b => b.date !== date));
      return { ok: true };
    }
  };

  /* ===========================================================
     SUPABASE ADAPTER - hosted Postgres + real auth
     Requires the supabase-js script tag and keys in config.js.
     =========================================================== */

  let sb = null;
  const client = () => {
    if (!sb) {
      if (!window.supabase) throw new Error('supabase-js did not load.');
      sb = window.supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
    }
    return sb;
  };

  /* Supabase auth errors are terse and, in one case, actively
     misleading: "Email not confirmed" sounds like the customer did
     something wrong, when it actually means the PROJECT still has
     email confirmation switched on. Translate the common ones. */
  function explainAuthError(error) {
    const msg = (error && error.message) || 'Something went wrong.';
    const code = (error && error.code) || '';

    if (/email not confirmed/i.test(msg) || code === 'email_not_confirmed') {
      return 'This account has not been confirmed yet. The shop owner needs to turn off ' +
             '"Confirm email" in Supabase (Authentication → Sign In / Providers → Email), ' +
             'or confirm this user from Authentication → Users.';
    }
    if (/invalid login credentials/i.test(msg)) {
      return 'Wrong email or password.';
    }
    if (/user already registered/i.test(msg)) {
      return 'An account with that email already exists. Try signing in instead.';
    }
    if (/password should be at least/i.test(msg)) {
      return 'Password is too short — use at least 6 characters.';
    }
    if (/email send rate limit|email rate limit/i.test(msg) || code === 'over_email_send_rate_limit') {
      return 'Supabase has hit its built-in email limit (about 2 per hour on the free tier). ' +
             'Turn off "Confirm email" in Authentication → Sign In / Providers → Email — ' +
             'then no confirmation mail is sent and this stops happening.';
    }
    if (/rate limit|too many requests/i.test(msg)) {
      return 'Too many attempts. Wait a minute and try again.';
    }
    return msg;
  }

  /* Postgres row -> the shape the rest of the app expects */
  function fromRow(r) {
    const [date, clock] = r.starts_at.split('T');
    return {
      id: r.id,
      userId: r.user_id,
      serviceId: r.service_id,
      serviceName: r.service_name,
      price: r.price_ghs,
      date,
      time: clock.slice(0, 5),
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      notes: r.notes,
      status: r.status,
      createdAt: r.created_at
    };
  }

  const supabaseAdapter = {

    async signUp({ email, password, fullName, phone }) {
      const { data, error } = await client().auth.signUp({
        email, password,
        options: { data: { full_name: fullName, phone } }
      });
      if (error) return { ok: false, error: explainAuthError(error) };
      return { ok: true, user: { id: data.user?.id, email, fullName, phone } };
    },

    async signIn({ email, password }) {
      const { data, error } = await client().auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: explainAuthError(error) };
      const meta = data.user.user_metadata || {};
      return {
        ok: true,
        user: { id: data.user.id, email: data.user.email, fullName: meta.full_name, phone: meta.phone }
      };
    },

    async signOut() {
      await client().auth.signOut();
      return { ok: true };
    },

    async currentUser() {
      const { data } = await client().auth.getUser();
      if (!data || !data.user) return null;
      const meta = data.user.user_metadata || {};
      return { id: data.user.id, email: data.user.email, fullName: meta.full_name, phone: meta.phone };
    },

    // Public availability, read from the booked_slots VIEW rather
    // than the bookings table. The view exposes start times and
    // nothing else, and is not re-filtered by the caller's RLS -
    // which matters, because a signed-in customer querying the
    // table directly would only see their OWN bookings and would
    // therefore think every other slot was free.
    async getBookings() {
      const { data, error } = await client()
        .from('booked_slots').select('starts_at');
      if (error) { console.error(error); return []; }
      return data.map(r => {
        const [date, clock] = r.starts_at.split('T');
        return { date, time: clock.slice(0, 5), status: 'confirmed' };
      });
    },

    // Full records. Only staff get rows back - enforced by RLS,
    // not by this function.
    async getAllBookings() {
      const { data, error } = await client()
        .from('bookings').select('*').order('starts_at', { ascending: true });
      if (error) { console.error(error); return []; }
      return data.map(fromRow);
    },

    async getMyBookings(userId) {
      const { data, error } = await client()
        .from('bookings').select('*').eq('user_id', userId)
        .order('starts_at', { ascending: true });
      if (error) { console.error(error); return []; }
      return data.map(fromRow);
    },

    async createBooking(booking) {
      // The id is generated here rather than read back, because a
      // guest has no SELECT grant on most columns - chaining
      // .select() would fail for exactly the people who book most.
      const id = crypto.randomUUID();

      const { error } = await client().from('bookings').insert({
        id,
        user_id:        booking.userId || null,
        service_id:     booking.serviceId,
        service_name:   booking.serviceName,
        price_ghs:      booking.price,
        starts_at:      booking.date + 'T' + booking.time + ':00',
        customer_name:  booking.customerName,
        customer_phone: booking.customerPhone,
        notes:          booking.notes || ''
        // status is NOT set here: anon has no insert grant on it,
        // so the column default of 'confirmed' applies.
      });

      // 23505 = unique_violation - the one_booking_per_slot index fired.
      if (error) {
        const msg = error.code === '23505'
          ? 'Sorry, that slot was just taken. Please pick another.'
          : error.message;
        return { ok: false, error: msg };
      }
      return { ok: true, booking: { ...booking, id, status: 'confirmed' } };
    },

    async setBookingStatus(id, status) {
      const { data, error } = await client()
        .from('bookings').update({ status }).eq('id', id).select().single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, booking: fromRow(data) };
    },

    async getBlockedDays() {
      const { data, error } = await client().from('blocked_days').select('*');
      if (error) { console.error(error); return []; }
      return data.map(r => ({ date: r.date, reason: r.reason }));
    },

    async blockDay(date, reason = '') {
      const { error } = await client().from('blocked_days').insert({ date, reason });
      return error ? { ok: false, error: error.message } : { ok: true };
    },

    async unblockDay(date) {
      const { error } = await client().from('blocked_days').delete().eq('date', date);
      return error ? { ok: false, error: error.message } : { ok: true };
    }
  };

  /* ---- pick the adapter ----------------------------------------
     Flipping `backend` to 'supabase' without filling in the keys,
     or before supabase-js has loaded, would otherwise throw on the
     first click and leave the page looking dead. Fall back to local
     and say so loudly instead. */

  function chooseAdapter() {
    if (CONFIG.backend !== 'supabase') return { adapter: localAdapter, mode: 'local' };

    const missingKeys = !CONFIG.supabase.url || !CONFIG.supabase.anonKey;
    const missingLib  = !window.supabase;

    if (missingKeys || missingLib) {
      const why = missingKeys
        ? 'config.js has no Supabase url / anonKey'
        : 'the supabase-js script did not load';
      console.error(
        `[Cheerful Giver] backend is set to "supabase" but ${why}. ` +
        'Falling back to local storage — bookings will NOT be shared between devices.'
      );
      return { adapter: localAdapter, mode: 'local', degraded: why };
    }
    return { adapter: supabaseAdapter, mode: 'supabase' };
  }

  const chosen = chooseAdapter();

  return {
    ...chosen.adapter,
    mode: chosen.mode,
    degraded: chosen.degraded || null,
    isOwner: user =>
      !!user && (user.email || '').toLowerCase() === CONFIG.ownerEmail.toLowerCase()
  };
})();

window.Data = Data;
