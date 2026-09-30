// Usernames: chosen at sign-up, checked live, shown as @username.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const { mockSupabase, signedIn } = require('./auth-mock');
const APP = APP_URL;
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const text = p => p.evaluate(() => document.body.innerText);
const status = p => p.locator('#auth-username-status').innerText();
const api = p => p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('/alerts') ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const signUpPage = async (db, opts = {}) => {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
    p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await api(p); const log = await mockSupabase(p, db, opts);
    await p.goto(APP); await p.waitForTimeout(800);
    await p.getByRole('button', { name: 'Create one' }).click(); await p.waitForTimeout(200);
    await p.fill('#auth-name', 'Afi'); await p.fill('#auth-company', 'Clinique Sud'); await p.fill('#auth-email', 'afi@clinique.bj'); await p.fill('#auth-password', 'longenough1');
    return { p, log };
  };
  const submit = async p => { await p.getByRole('button', { name: /Create my account/ }).click(); await p.waitForTimeout(900); };
  const signups = log => log.filter(l => l.path === '/auth/v1/signup');

  console.log('== sign-up: live check');
  { const { p, log } = await signUpPage({ users: {}, accounts: {}, taken: ['ama_pharma'] });
    pass(await p.locator('#auth-username').count() === 1, 'Username field on the sign-up form');
    await p.fill('#auth-username', 'Ama Pharma'); await p.waitForTimeout(100);
    pass(await p.inputValue('#auth-username') === 'amapharma', 'typed as lowercase, no spaces (Ama Pharma → amapharma)');
    await p.fill('#auth-username', 'ama_pharma'); await p.waitForTimeout(900);
    pass(/already used/.test(await status(p)), 'taken name: "already used" (' + await status(p) + ')');
    pass(await p.getAttribute('#auth-username', 'aria-invalid') === 'true', 'taken name: field marked invalid');
    const rpc = log.filter(l => l.path === '/rest/v1/rpc/username_available');
    pass(rpc.length >= 1 && rpc[rpc.length - 1].body.name === 'ama_pharma', 'asks username_available(ama_pharma)');
    await submit(p);
    pass(signups(log).length === 0 && /already used/.test(await text(p)), 'taken name: sign-up refused before sending');
    await p.fill('#auth-username', 'ab'); await p.waitForTimeout(600);
    pass(/3 to 24 characters/.test(await status(p)), 'too short: format hint');
    await submit(p);
    pass(signups(log).length === 0, 'too short: sign-up refused before sending');
    const before = log.filter(l => l.path === '/rest/v1/rpc/username_available').length;
    await p.fill('#auth-username', 'a-b!'); await p.waitForTimeout(600);
    pass(log.filter(l => l.path === '/rest/v1/rpc/username_available').length === before, 'malformed name: no database call');
    await p.fill('#auth-username', 'afi_sud'); await p.waitForTimeout(900);
    pass(/@afi_sud is available/.test(await status(p)), 'free name: "@afi_sud is available"');
    await submit(p);
    const su = signups(log)[0];
    pass(su && su.body.data.username === 'afi_sud', 'sign-up sends username afi_sud');
    pass(/Open the email sent to afi@clinique\.bj/.test(await text(p)), 'then: check-your-email');
    await p.screenshot({ path: 'username-signup.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await p.close(); }

  console.log('== sign-up: taken in the meantime');
  { const { p } = await signUpPage({ users: {}, accounts: {}, taken: [], takenAtSignup: ['zed_1'] });
    await p.fill('#auth-username', 'zed_1'); await p.waitForTimeout(900);
    pass(/available/.test(await status(p)), 'looked free');
    await submit(p);
    pass(/This username was just taken/.test(await text(p)), 'database refusal → "This username was just taken"');
    pass(/already used/.test(await status(p)), 'field now says "already used"');
    await p.close(); }

  console.log('== sign-up: check unavailable (SQL 006 not run)');
  { const { p, log } = await signUpPage({ users: {}, accounts: {} }, { rpcFail: true });
    await p.fill('#auth-username', 'kofi'); await p.waitForTimeout(900);
    pass(!/already used|available/.test(await status(p)), 'no false "available"/"used" (' + await status(p) + ')');
    await submit(p);
    pass(signups(log).length === 1, 'form does not block: sign-up sent');
    await p.close(); }

  console.log('== shown in the sidebar');
  const shown = async (opts, meta, vw = 1440) => {
    const p = await browser.newPage({ viewport: { width: vw, height: 900 }, locale: 'en-US' });
    p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await api(p);
    await p.addInitScript(() => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries({ sentria_language: 'en', sentria_onboarded: 'true', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' }).forEach(([k, v]) => localStorage.setItem(k, v)); } });
    await signedIn(p, 'u-ama', 'ama@pharma.bj', { plan: 'decouverte', meta, ...opts });
    await p.goto(APP); await p.waitForTimeout(1800);
    const who = await p.locator('[data-testid=signed-in-user]').innerText().catch(() => '');
    return { p, who };
  };
  { const { p, who } = await shown({ username: 'ama_pharma' }, { full_name: 'Ama Mensah' });
    pass(/^Ama Mensah\s+@ama_pharma$/.test(who.trim()), 'name, then @ama_pharma (' + who.replace(/\n/g, ' / ') + ')');
    await p.locator('[data-testid=signed-in-user]').screenshot({ path: 'username-sidebar.png' });
    pass(p._errors.length === 0, 'no page errors'); await p.close(); }
  { const { p, who } = await shown({ username: 'ama_pharma' }, {});
    pass(who.trim() === '@ama_pharma', 'no name: @ama_pharma alone (' + who.replace(/\n/g, ' / ') + ')'); await p.close(); }
  { const { p, who } = await shown({ username: null }, { full_name: 'Ama Mensah' });
    pass(/^Ama Mensah\s+ama@pharma\.bj$/.test(who.trim()), 'no username (older account): name + email (' + who.replace(/\n/g, ' / ') + ')'); await p.close(); }
  { const { p, who } = await shown({ noUsernameColumn: true, isAdmin: true }, { full_name: 'Ama Mensah' });
    const admin = await p.evaluate(() => localStorage.getItem('sentria_is_admin'));
    pass(/Ama Mensah/.test(who) && admin === 'true', 'before SQL 006: app loads, admin flag still read (' + who.replace(/\n/g, ' / ') + ')');
    pass(p._errors.length === 0, 'no page errors'); await p.close(); }

  console.log('== choose one later, on the Profile page');
  const profile = async (opts) => { const r = await shown(opts, { full_name: 'Ama Mensah' });
    await r.p.locator('aside nav button', { hasText: 'Profile' }).click(); await r.p.waitForTimeout(800); return r.p; };
  { const p = await profile({ username: null });
    const card = p.locator('[data-testid=username-card]');
    pass(await card.count() === 1 && await p.locator('#profile-username').isVisible(), 'no username yet: Profile offers to choose one');
    await p.fill('#profile-username', 'Ama Pharma'); await p.waitForTimeout(900);
    pass(await p.inputValue('#profile-username') === 'amapharma' && /@amapharma is available/.test(await card.innerText()), 'typed lowercase, checked live');
    await card.getByRole('button', { name: 'Save' }).click(); await p.waitForTimeout(600);
    pass(/@amapharma/.test(await card.innerText()) && /Done: you are @amapharma/.test(await card.innerText()), 'saved: shown as @amapharma');
    const who = await p.locator('[data-testid=signed-in-user]').innerText();
    pass(/@amapharma/.test(who), 'sidebar updates at once: ' + who.replace(/\n/g, ' / '));
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await card.screenshot({ path: 'username-profile.png' });
    await p.close(); }
  { const p = await profile({ username: 'ama_pharma' });
    const t = await p.locator('[data-testid=username-card]').innerText();
    pass(/@ama_pharma/.test(t) && /Active/.test(t) && await p.locator('#profile-username').count() === 0, 'has one: shown, no form (chosen once)');
    await p.close(); }
  { const p = await profile({ username: null, setUsernameMissing: true });
    await p.fill('#profile-username', 'kofi_1'); await p.waitForTimeout(900);
    await p.locator('[data-testid=username-card]').getByRole('button', { name: 'Save' }).click(); await p.waitForTimeout(500);
    pass(/migration 007/.test(await p.locator('[data-testid=username-card]').innerText()), 'SQL 007 not run: says so');
    await p.close(); }

  await browser.close();
  console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`); process.exit(fails ? 1 : 0);
})();
