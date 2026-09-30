// Sign in with @username: the API finds the account (Sentria api/username_login.py); the browser never sees the email.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const { mockSupabase, jwt } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const PHARMA = { sentria_onboarded: 'true', sentria_company_name: 'Pharmacie du Plateau', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: 'en', sentria_country: 'BJ' };
const newDb = () => ({ users: { 'ama@pharma.bj': { uid: 'u-ama', password: 'goodpass1', meta: { full_name: 'Ama Mensah' } } }, accounts: { 'u-ama': { profile: PHARMA, username: 'ama_pharma' } } });
const text = p => p.evaluate(() => document.body.innerText);

(async () => {
  const browser = await chromium.launch(LAUNCH);
  /** answer: 'ok' | 'wrong' | 'limited' | 'unconfirmed' | 'down' */
  const fresh = async (answer) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    p._calls = [];
    await p.route(/onrender\.com\//, async r => {
      const u = r.request().url();
      if (u.includes('/auth/username-sign-in')) {
        p._calls.push({ body: JSON.parse(r.request().postData()), auth: r.request().headers()['authorization'] || '' });
        if (answer === 'down') return r.abort('connectionrefused');
        const json = (status, body) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
        if (answer === 'wrong') return json(400, { detail: { error_code: 'invalid_credentials', message: 'Wrong username or password.' } });
        if (answer === 'limited') return json(429, { detail: { error_code: 'too_many_attempts', message: 'Too many tries.' } });
        if (answer === 'unconfirmed') return json(400, { detail: { error_code: 'email_not_confirmed', message: 'Confirm.' } });
        return json(200, { access_token: jwt('u-ama', 'ama@pharma.bj'), refresh_token: 'refresh-u-ama', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer' });
      }
      r.fulfill({ status: 200, contentType: 'application/json', body: u.includes('/alerts') ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' });
    });
    const log = await mockSupabase(p, newDb());
    await p.goto(APP_URL); await p.waitForTimeout(1200);
    return { p, ctx, log };
  };
  const signIn = async (p, id, pw) => { await p.fill('#auth-email', id); await p.fill('#auth-password', pw); await p.getByRole('button', { name: /^Sign in$/ }).click(); await p.waitForTimeout(2500); };

  console.log('== the field');
  { const { p, ctx } = await fresh('ok');
    const label = await p.locator('label[for=auth-email]').innerText();
    pass(/Email or username/.test(label), `sign-in field is labelled "${label}"`);
    pass(await p.locator('#auth-email').getAttribute('type') === 'text' && await p.locator('#auth-email').getAttribute('autocomplete') === 'username', 'type=text, autocomplete=username (password managers still fill it)');
    await p.getByRole('button', { name: 'Create one' }).click(); await p.waitForTimeout(300);
    pass(await p.locator('#auth-username').count() === 1 && await p.locator('#auth-email').getAttribute('type') === 'email' && /^Email \(to sign in and reset your password\)$/.test(await p.locator('label[for=auth-email]').innerText()), 'sign-up still asks for a real email');
    await ctx.close(); }

  console.log('== right username and password');
  { const { p, ctx, log } = await fresh('ok');
    await signIn(p, '@Ama_Pharma', 'goodpass1');
    pass(p._calls.length === 1 && p._calls[0].body.username === 'ama_pharma' && p._calls[0].body.password === 'goodpass1', 'the API gets the username (no @, lowercase) and the password: ' + JSON.stringify(p._calls[0] && p._calls[0].body));
    pass(p._calls[0] && p._calls[0].auth === '', 'no token sent (not signed in yet)');
    pass(!log.some(e => e.path === '/auth/v1/token'), 'Supabase password sign-in not called from the browser');
    const t = await text(p);
    pass(await p.locator('aside nav').count() === 1 && /Dashboard/.test(t), 'signed in: the app opens');
    pass(/Ama Mensah/.test(t), 'the sidebar shows the account (session loaded from the returned tokens)');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== an email still signs in directly');
  { const { p, ctx, log } = await fresh('ok');
    await signIn(p, 'ama@pharma.bj', 'goodpass1');
    pass(p._calls.length === 0 && log.some(e => e.path === '/auth/v1/token'), 'email: straight to Supabase, the API is not asked');
    pass(await p.locator('aside nav').count() === 1, 'signed in');
    await ctx.close(); }

  console.log('== refusals');
  for (const [answer, re, label] of [
    ['wrong', /Wrong username or password\./, 'wrong password: "Wrong username or password."'],
    ['limited', /Too many tries\. Wait a few minutes/, '429: "Too many tries. Wait a few minutes…"'],
    ['unconfirmed', /Confirm your email first/, 'unconfirmed: "Confirm your email first"'],
    ['down', /unavailable\. Use your email/, 'API unreachable: says to use the email'],
  ]) {
    const { p, ctx } = await fresh(answer);
    await signIn(p, 'ama_pharma', 'badpass99');
    const t = await text(p);
    pass(re.test(t) && await p.locator('aside nav').count() === 0, label);
    pass(!/ama@pharma\.bj/.test(t), `  …and the email appears nowhere (${answer})`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`); process.exit(fails ? 1 : 0);
})();
