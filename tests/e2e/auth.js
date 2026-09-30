// S-3 step 1: sign-in, sign-up, account load/save, sign-out, recovery.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const { mockSupabase, session, STORAGE_KEY, jwt } = require('./auth-mock');
const APP = APP_URL;
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const PHARMA = { sentria_onboarded: 'true', sentria_company_name: 'Pharmacie du Plateau', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: 'en', sentria_country: 'BJ' };
const FARM = { sentria_onboarded: 'true', sentria_company_name: 'Ferme Nord', sentria_sector: 'agriculture', sentria_sectors: '["agriculture"]', sentria_business_type: 'exploitation-agricole', sentria_language: 'en' };
const newDb = () => ({ users: { 'ama@pharma.bj': { uid: 'u-ama', password: 'goodpass1', meta: { company_name: 'Pharmacie du Plateau' } }, 'kofi@farm.bj': { uid: 'u-kofi', password: 'farmpass1' }, 'new@co.bj': { uid: 'u-new', password: 'newpass12', meta: { company_name: 'Nouvelle SARL' } } }, accounts: { 'u-ama': { profile: PHARMA }, 'u-kofi': { profile: FARM } } });
const api = async (p) => {
  await p.route(/onrender\.com\/(alerts|recommendations|assignments|contractors)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('/alerts') ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
};
const ls = p => p.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
const text = p => p.evaluate(() => document.body.innerText);
const signIn = async (p, email, pw) => { await p.fill('#auth-email', email); await p.fill('#auth-password', pw); await p.getByRole('button', { name: /^(Sign in|Se connecter)$/ }).click(); };
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const fresh = async (db, opts, vw = 1440, init) => { const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: 'en-US' }); const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message)); await api(p); const log = await mockSupabase(p, db, opts); if (init) await p.addInitScript(init.fn, init.arg); return { p, log, ctx }; };

  console.log('== 1 signed out: sign-in screen, no app');
  { const { p, ctx } = await fresh(newDb()); await p.goto(APP); await p.waitForTimeout(1200);
    const t = await text(p);
    pass(/Welcome back/.test(t) && await p.locator('#auth-email').count() === 1, 'sign-in screen shown');
    pass(await p.locator('aside nav').count() === 0 && !/Dashboard/.test(t), 'app not rendered');
    pass(/Real-time alerts/.test(t) && /Your data stays yours/.test(t), 'feature list');
    await p.screenshot({ path: 'auth-signin-1440.png' });
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200); await p.screenshot({ path: 'auth-signin-390.png', fullPage: true });
    pass(await p.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), 'phone: no sideways scroll');
    await p.getByRole('button', { name: 'fr', exact: true }).click(); await p.waitForTimeout(200);
    pass(/Content de vous revoir/.test(await text(p)), 'language switch to FR');
    await ctx.close(); }

  console.log('== 2 wrong password');
  { const { p, ctx } = await fresh(newDb()); await p.goto(APP); await p.waitForTimeout(800);
    await signIn(p, 'ama@pharma.bj', 'nope'); await p.waitForTimeout(800);
    pass(/Wrong email or password/.test(await text(p)), 'error shown');
    pass(await p.locator('aside nav').count() === 0, 'still locked');
    await ctx.close(); }

  console.log('== 3 sign in with saved account → own dashboard, stale keys replaced');
  { const { p, log, ctx } = await fresh(newDb(), {}, 1440, { fn: () => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.setItem('sentria_sector', 'industry'); localStorage.setItem('sentria_company_name', 'Usine Leftover'); localStorage.setItem('sentria_onboarded', 'true'); localStorage.setItem('sentria_cost_rates', '{"x":1}'); localStorage.setItem('sentria_theme', 'dark'); } } });
    await p.goto(APP); await p.waitForTimeout(800);
    await signIn(p, 'ama@pharma.bj', 'goodpass1'); await p.waitForTimeout(2000);
    const s = await ls(p);
    pass(await p.locator('aside nav').count() === 1, 'app shown');
    pass(s.sentria_company_name === 'Pharmacie du Plateau' && s.sentria_sector === 'health' && s.sentria_business_type === 'pharmacie', 'account values loaded');
    pass(!('sentria_cost_rates' in s), 'previous user\'s leftover removed');
    pass(s.sentria_theme === 'dark', 'browser theme kept');
    pass(s.sentria_account_owner === 'u-ama', 'owner recorded');
    pass(!/Usine Leftover/.test(await text(p)) && /Pharmacie du Plateau|Health|Santé/.test(await text(p)), 'UI shows own company');
    pass(/ama@pharma\.bj/.test(await text(p)), 'email in sidebar');
    pass(!log.some(l => l.method === 'POST' && l.path === '/rest/v1/accounts'), 'no duplicate account row created');
    await p.screenshot({ path: 'auth-dashboard.png' });

    console.log('== 4 changes are saved to the account');
    await p.evaluate(() => localStorage.setItem('sentria_cost_rates', '{"truck":25}'));
    await p.waitForTimeout(3000);
    const patch = log.filter(l => l.method === 'PATCH');
    pass(patch.length >= 1 && patch.at(-1).body.profile.sentria_cost_rates === '{"truck":25}', 'PATCH with new value');
    pass(patch.at(-1).query.includes('user_id=eq.u-ama') && patch.at(-1).auth.startsWith('Bearer '), 'scoped to own row, with user token');
    pass(!('company_id' in patch.at(-1).body), 'company_id never sent');
    pass(!('sentria_theme' in patch.at(-1).body.profile) && !('sentria_account_owner' in patch.at(-1).body.profile), 'device keys not saved');
    const n = patch.length; await p.waitForTimeout(4500);
    pass(log.filter(l => l.method === 'PATCH').length === n, 'no save when nothing changed');

    console.log('== 5 reload keeps you signed in');
    await p.evaluate(() => localStorage.setItem('sentria_notifications_seen_at', '2026-09-29T10:00:00.000Z'));
    await p.reload(); await p.waitForTimeout(2000);
    pass(await p.locator('aside nav').count() === 1 && await p.locator('#auth-email').count() === 0, 'straight to app');
    pass((await ls(p)).sentria_notifications_seen_at === '2026-09-29T10:00:00.000Z', 'same user: bell read state kept');
    pass((await ls(p)).sentria_company_name === 'Pharmacie du Plateau', 'same user: account values still there');

    console.log('== 6 sign out');
    await p.evaluate(() => localStorage.setItem('sentria_monitoring', '["late-change"]'));
    await p.getByRole('button', { name: /^Sign out$/ }).click(); await p.waitForTimeout(1500);
    const after = await ls(p);
    pass(await p.locator('#auth-email').count() === 1, 'back to sign-in');
    pass(!Object.keys(after).some(k => k.startsWith('sentria_') && !['sentria_language', 'sentria_theme'].includes(k)), 'account values wiped: ' + Object.keys(after).filter(k => k.startsWith('sentria_')).join(','));
    pass(!Object.keys(after).some(k => k.startsWith('sb-')), 'session removed');
    pass(log.some(l => l.path === '/auth/v1/logout'), 'server sign-out called');
    const last = log.filter(l => l.method === 'PATCH').at(-1);
    pass(last && last.body.profile.sentria_monitoring === '["late-change"]', 'last change saved before sign-out');

    console.log('== 7 another user on the same browser sees only theirs');
    await signIn(p, 'kofi@farm.bj', 'farmpass1'); await p.waitForTimeout(2000);
    const k = await ls(p); const t = await text(p);
    pass(k.sentria_sector === 'agriculture' && k.sentria_company_name === 'Ferme Nord' && !('sentria_cost_rates' in k), 'farm account only');
    pass(!('sentria_notifications_seen_at' in k), 'other user: bell read state not inherited');
    pass(!/Pharmacie du Plateau|ama@pharma/.test(t), 'nothing from the pharmacy');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== 8 first sign-in: row created, onboarding with company pre-filled');
  { const db = newDb(); const { p, log, ctx } = await fresh(db); await p.goto(APP); await p.waitForTimeout(800);
    await signIn(p, 'new@co.bj', 'newpass12'); await p.waitForTimeout(2200);
    const post = log.find(l => l.method === 'POST' && l.path === '/rest/v1/accounts');
    pass(post && post.body.user_id === 'u-new' && !('company_id' in post.body), 'account row created without company_id');
    const t = await text(p);
    pass(/onboard|Welcome|Bienvenue|sector|secteur/i.test(t) && await p.locator('[role=dialog], .fixed').count() > 0, 'onboarding shown');
    const hasCo = await p.evaluate(() => [...document.querySelectorAll('input')].some(i => i.value === 'Nouvelle SARL'));
    pass(hasCo || (await ls(p)).sentria_company_name === 'Nouvelle SARL', 'company from sign-up carried');
    await ctx.close(); }

  console.log('== 9 sign up');
  { const db = newDb(); const { p, log, ctx } = await fresh(db); await p.goto(APP); await p.waitForTimeout(800);
    await p.getByRole('button', { name: 'Create one' }).click();
    pass(/Let's protect your operations together/.test(await text(p)), 'sign-up form');
    await p.fill('#auth-name', 'Afi'); await p.fill('#auth-username', 'afi_sud'); await p.fill('#auth-company', 'Clinique Sud'); await p.fill('#auth-email', 'afi@clinique.bj'); await p.fill('#auth-password', 'short');
    await p.getByRole('button', { name: /Create my account/ }).click(); await p.waitForTimeout(400);
    pass(/at least 8 characters/.test(await text(p)) && !log.some(l => l.path === '/auth/v1/signup'), 'short password refused locally');
    await p.screenshot({ path: 'auth-signup-1440.png' });
    await p.fill('#auth-password', 'longenough1'); await p.getByRole('button', { name: /Create my account/ }).click(); await p.waitForTimeout(1000);
    const su = log.find(l => l.path === '/auth/v1/signup');
    pass(su && su.body.data.company_name === 'Clinique Sud' && su.body.data.full_name === 'Afi' && su.body.data.username === 'afi_sud', 'name + username + company sent as metadata');
    pass(/Open the email sent to afi@clinique\.bj/.test(await text(p)), 'check-your-email notice');
    await p.getByRole('button', { name: 'Create one' }).click();
    await p.fill('#auth-name', 'A'); await p.fill('#auth-username', 'ama2'); await p.fill('#auth-company', 'B'); await p.fill('#auth-email', 'ama@pharma.bj'); await p.fill('#auth-password', 'longenough1');
    await p.getByRole('button', { name: /Create my account/ }).click(); await p.waitForTimeout(800);
    pass(/already exists/.test(await text(p)), 'existing email: clear message');
    await ctx.close(); }

  console.log('== 10 forgot password');
  { const { p, log, ctx } = await fresh(newDb()); await p.goto(APP); await p.waitForTimeout(800);
    await p.getByRole('button', { name: /Forgot your password/ }).click();
    await p.fill('#auth-email', 'ama@pharma.bj'); await p.getByRole('button', { name: /Send the link/ }).click(); await p.waitForTimeout(800);
    const rec = log.find(l => l.path === '/auth/v1/recover');
    pass(rec && rec.body.email === 'ama@pharma.bj', 'reset email requested');
    pass(/a link to change the password has just been sent/.test(await text(p)), 'neutral notice');
    await ctx.close(); }

  console.log('== 11 reset link → new password form, then app');
  { const db = newDb(); const { p, log, ctx } = await fresh(db); const tok = jwt('u-ama', 'ama@pharma.bj');
    await p.goto(`${APP}/#access_token=${tok}&expires_at=${Math.floor(Date.now() / 1000) + 3600}&expires_in=3600&refresh_token=r1&token_type=bearer&type=recovery`); await p.waitForTimeout(2000);
    pass(await p.locator('#auth-password').count() === 1 && /Choose a new password/.test(await text(p)), 'reset form shown');
    pass(await p.locator('aside nav').count() === 0, 'app not opened before the new password');
    await p.fill('#auth-password', 'brandnew99'); await p.getByRole('button', { name: /Save the password/ }).click(); await p.waitForTimeout(2200);
    pass(db.users['ama@pharma.bj'].password === 'brandnew99', 'password updated');
    pass(await p.locator('aside nav').count() === 1, 'then into the app');
    pass(!(await p.evaluate(() => location.hash)).includes('access_token'), 'token removed from the address bar');
    await ctx.close(); }

  console.log('== 12 account cannot be loaded → error, not someone else\'s data');
  { const { p, ctx } = await fresh(newDb(), { accountsFail: true }); await p.goto(APP); await p.waitForTimeout(800);
    await signIn(p, 'ama@pharma.bj', 'goodpass1'); await p.waitForTimeout(1500);
    pass(/Your account could not be loaded/.test(await text(p)) && await p.locator('aside nav').count() === 0, 'error screen, app locked');
    await ctx.close(); }

  console.log('== 13 sign-out in another tab signs this tab out');
  { const { p, ctx } = await fresh(newDb()); await p.goto(APP); await p.waitForTimeout(800);
    await signIn(p, 'ama@pharma.bj', 'goodpass1'); await p.waitForTimeout(2000);
    const p2 = await ctx.newPage(); await api(p2); await mockSupabase(p2, newDb()); await p2.goto(APP); await p2.waitForTimeout(2000);
    pass(await p2.locator('aside nav').count() === 1, 'second tab signed in');
    await p2.getByRole('button', { name: /^Sign out$/ }).click(); await p2.waitForTimeout(1500);
    await p.waitForTimeout(1500);
    pass(await p.locator('#auth-email').count() === 1, 'first tab back to sign-in');
    await ctx.close(); }

  console.log('== 14 every API call carries the user\'s token (S-3 step 2)');
  { const { p, ctx } = await fresh(newDb()); const seen = [];
    await p.route(/onrender\.com\//, r => { const u = r.request().url(); seen.push({ path: new URL(u).pathname, auth: r.request().headers()['authorization'] || '' });
      r.fulfill({ status: 200, contentType: 'application/json', body: u.includes('/alerts') ? '[]' : u.includes('/upload') ? '{"success":true,"message":"ok"}' : '{"recommendations":[],"assignments":[],"contractors":[]}' }); });
    await p.goto(APP); await p.waitForTimeout(800);
    pass(seen.length === 0, 'signed out: no API call at all (' + seen.length + ')');
    await signIn(p, 'ama@pharma.bj', 'goodpass1'); await p.waitForTimeout(2500);
    await p.setInputFiles('input[type=file]', { name: 'x.csv', mimeType: 'text/csv', buffer: Buffer.from('medicine_name,stock_qty\nA,1\n') }); await p.waitForTimeout(3000);
    await p.locator('[role=dialog][aria-label="Data import"] button').click(); await p.waitForTimeout(200);
    for (const label of ['Tracking', 'Calendar', 'Report', 'Profile', 'Contractors']) { const b = p.locator('aside nav button', { hasText: label }).first(); if (await b.count()) { await b.click(); await p.waitForTimeout(900); } }
    await p.locator('aside nav button', { hasText: 'Calendar' }).first().click(); await p.waitForTimeout(1500);
    const before = seen.length; await p.waitForTimeout(5000);
    pass(seen.length === before, `Calendar left open 5 s: ${seen.length - before} new API calls (was an endless loop)`);
    const token = JSON.parse(await p.evaluate(k => localStorage.getItem(k), STORAGE_KEY)).access_token;
    const paths = [...new Set(seen.map(s => s.path))].sort(); const byPath = {}; seen.forEach(s => byPath[s.path] = (byPath[s.path] || 0) + 1); console.log('   counts', JSON.stringify(byPath));
    pass(paths.includes('/alerts') && paths.includes('/recommendations') && paths.includes('/upload'), 'alerts, recommendations, upload called: ' + paths.join(' '));
    const bad = seen.filter(s => s.auth !== `Bearer ${token}`);
    pass(bad.length === 0, `all ${seen.length} API calls carry "Bearer <session token>"` + (bad.length ? ' — missing on ' + bad.map(b => b.path).join(',') : ''));
    await ctx.close(); }

  await browser.close();
  console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`); process.exit(fails ? 1 : 0);
})();
