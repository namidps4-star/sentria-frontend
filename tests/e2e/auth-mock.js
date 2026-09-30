// Fake Supabase (auth + accounts table) for the browser tests.
const REF = 'sentria-test';
const BASE = `https://${REF}.supabase.co`;
const STORAGE_KEY = `sb-${REF}-auth-token`;
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (uid, email) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: uid, email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const user = (uid, email, meta = {}) => ({ id: uid, aud: 'authenticated', role: 'authenticated', email, user_metadata: meta, app_metadata: { provider: 'email' }, identities: [{ id: uid }], created_at: new Date().toISOString() });
const session = (uid, email, meta) => ({ access_token: jwt(uid, email), refresh_token: 'refresh-' + uid, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: user(uid, email, meta) });
const json = (r, status, body) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: body === undefined ? '' : JSON.stringify(body) });

/** Routes the fake Supabase. db = { users: {email: {uid, password, meta}}, accounts: {uid: {profile}} }.
 *  Returns a log of what the app called. */
async function mockSupabase(page, db, opts = {}) {
  const log = [];
  await page.route(`${BASE}/**`, async (r) => {
    const req = r.request(); const url = new URL(req.url()); const path = url.pathname; const method = req.method();
    if (method === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    const auth = req.headers()['authorization'] || '';
    log.push({ method, path, query: url.search, body, auth });
    if (path === '/auth/v1/token') {
      const u = db.users[body.email];
      if (!u || u.password !== body.password) return json(r, 400, { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return json(r, 200, session(u.uid, body.email, u.meta));
    }
    if (path === '/rest/v1/rpc/username_available') {
      if (opts.rpcFail) return json(r, 404, { message: 'function not found' });
      if (opts.rpcDelay) await new Promise(res => setTimeout(res, opts.rpcDelay));
      return json(r, 200, !(db.taken || []).includes(String(body.name).toLowerCase()));
    }
    if (path === '/rest/v1/rpc/set_username') {
      if (opts.setUsernameMissing) return json(r, 404, { code: 'PGRST202', message: 'Could not find the function public.set_username(name) in the schema cache' });
      const want = String(body.name).toLowerCase();
      if ((db.taken || []).includes(want)) return json(r, 200, 'taken');
      if (!/^[a-z0-9_]{3,24}$/.test(want)) return json(r, 200, 'invalid');
      (db.taken = db.taken || []).push(want); log.push({ setUsername: want });
      return json(r, 200, 'ok');
    }
    if (path === '/auth/v1/signup') {
      if (db.users[body.email]) return json(r, 422, { code: 'user_already_exists', error_code: 'user_already_exists', msg: 'User already registered' });
      // The 006 trigger: a taken username makes the insert fail.
      if ((db.takenAtSignup || db.taken || []).includes(body.data && body.data.username)) return json(r, 500, { code: 'unexpected_failure', error_code: 'unexpected_failure', msg: 'Database error saving new user' });
      const uid = 'u-' + Object.keys(db.users).length;
      db.users[body.email] = { uid, password: body.password, meta: body.data };
      return json(r, 200, user(uid, body.email, body.data)); // confirmation on: no session
    }
    if (path === '/auth/v1/recover') return json(r, 200, {});
    if (path === '/auth/v1/logout') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    if (path === '/auth/v1/user') {
      const sub = JSON.parse(Buffer.from(auth.split(' ')[1].split('.')[1], 'base64url').toString()).sub;
      const email = Object.keys(db.users).find(e => db.users[e].uid === sub);
      if (method === 'PUT') db.users[email].password = body.password;
      return json(r, 200, user(sub, email, db.users[email]?.meta));
    }
    if (path === '/rest/v1/accounts') {
      if (opts.accountsFail) return json(r, 500, { message: 'boom' });
      if (opts.noUsernameColumn && method === 'GET' && (url.searchParams.get('select') || '').includes('username')) return json(r, 400, { code: '42703', message: 'column accounts.username does not exist' });
      const uid = (url.searchParams.get('user_id') || '').replace('eq.', '');
      if (method === 'GET') {
        if (opts.profileFromPage) {
          const profile = await page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('sentria_') && k !== 'sentria_account_owner') o[k] = localStorage.getItem(k); } return o; });
          return json(r, 200, [{ profile, plan: opts.plan || 'entreprise', trial_ends_at: opts.trialEndsAt || null, is_admin: !!opts.isAdmin, ...(opts.username !== undefined ? { username: opts.username } : {}) }]);
        }
        const a = db.accounts[uid];
        return json(r, 200, a ? [{ profile: a.profile, plan: a.plan || 'decouverte', trial_ends_at: a.trial_ends_at || null, ...(a.username !== undefined ? { username: a.username } : {}) }] : []);
      }
      if (method === 'POST') { db.accounts[body.user_id] = { profile: body.profile, company_id: 'c-' + body.user_id }; return json(r, 201); }
      if (method === 'PATCH') { if (db.accounts[uid]) db.accounts[uid].profile = body.profile; return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }); }
    }
    return json(r, 404, { message: 'not mocked ' + path });
  });
  return log;
}

/** For the older UI tests: signed in, and the "saved" account is whatever
 *  the test put in localStorage. Call after the test's own addInitScript. */
async function signedIn(page, uid = 'u-test', email = 'test@sentria.app', opts = {}) {
  const db = { users: { [email]: { uid, password: 'x' } }, accounts: {} };
  await mockSupabase(page, db, { profileFromPage: true, ...opts });
  const s = session(uid, email, opts.meta || {});
  await page.addInitScript(({ key, s, uid }) => { localStorage.setItem(key, JSON.stringify(s)); localStorage.setItem('sentria_account_owner', uid); }, { key: STORAGE_KEY, s, uid });
}

module.exports = { mockSupabase, signedIn, session, STORAGE_KEY, BASE, jwt };
