// Admin page: visible to admins only, lists accounts, changes plan and trial through the API.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const { signedIn } = require('./auth-mock');
const APP = APP_URL;
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const soon = new Date(Date.now() + 6.5 * 86400000).toISOString();
const ACCOUNTS = [
  { user_id: 'u-1', email: 'ama@pharma.bj', name: 'Ama Mensah', company_id: 'c1', company_name: 'Pharmacie A', sector: 'health', department: 'pharmacie', country: 'BJ', onboarded: true, plan: 'decouverte', effective_plan: 'business', trial_ends_at: soon, is_admin: false, created_at: '2026-09-20T10:00:00Z', alerts: 12 },
  { user_id: 'u-2', email: 'kofi@farm.gh', name: null, username: 'kofi_farm', company_id: 'c2', company_name: 'Ferme Nord', sector: 'agriculture', department: 'exploitation-agricole', country: 'GH', onboarded: true, plan: 'pro', effective_plan: 'pro', trial_ends_at: null, is_admin: false, created_at: '2026-09-10T10:00:00Z', alerts: 3 },
  { user_id: 'u-me', email: 'boss@sentria.app', company_id: 'c0', company_name: 'SentrIA', sector: null, department: null, country: null, onboarded: false, plan: 'decouverte', effective_plan: 'decouverte', trial_ends_at: null, is_admin: true, created_at: '2026-09-01T10:00:00Z', alerts: 0 },
];
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async (isAdmin, vw = 1440) => {
    const p = await browser.newPage({ viewport: { width: vw, height: 900 }, locale: 'en-US' });
    p._errors = []; p.on('pageerror', e => p._errors.push(e.message)); p._patches = [];
    await p.route(/onrender\.com\//, async r => { const u = new URL(r.request().url());
      if (u.pathname === '/admin/accounts') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accounts: ACCOUNTS }) });
      if (u.pathname.startsWith('/admin/accounts/')) { const body = JSON.parse(r.request().postData()); p._patches.push({ id: u.pathname.split('/').pop(), body, auth: r.request().headers()['authorization'] });
        const a = { ...ACCOUNTS.find(x => x.user_id === u.pathname.split('/').pop()) }; if (body.plan) { a.plan = body.plan; a.effective_plan = body.plan; } if ('trial_days' in body) a.trial_ends_at = new Date(Date.now() + body.trial_days * 86400000).toISOString();
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ account: a }) }); }
      r.fulfill({ status: 200, contentType: 'application/json', body: u.pathname === '/alerts' ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' }); });
    await p.addInitScript(() => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries({ sentria_language: 'en', sentria_onboarded: 'true', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' }).forEach(([k, v]) => localStorage.setItem(k, v)); } });
    await signedIn(p, 'u-me', 'boss@sentria.app', { plan: 'decouverte', isAdmin });
    await p.goto(APP); await p.waitForTimeout(1800); return p;
  };
  { const p = await open(false);
    pass(await p.locator('aside nav button', { hasText: /^Admin$/ }).count() === 0, 'normal user: no Admin entry in the sidebar');
    await p.close(); }
  { const p = await open(true);
    const nav = p.locator('aside nav button', { hasText: /^Admin$/ });
    pass(await nav.count() === 1, 'admin: Admin entry in the sidebar');
    const plan = await p.evaluate(() => localStorage.getItem('sentria_is_admin'));
    pass(plan === 'true', 'admin flag loaded at sign-in');
    await nav.click(); await p.waitForTimeout(1000);
    const t = await p.evaluate(() => document.querySelector('main').innerText);
    pass(/Pharmacie A/.test(t) && /Ama Mensah · ama@pharma\.bj/.test(t) && /Ferme Nord/.test(t) && /kofi@farm\.gh/.test(t), 'accounts listed: name · email, or the email when no name');
    pass(/@kofi_farm · kofi@farm\.gh/.test(t), 'username shown as @kofi_farm · email');
    await p.locator('main input[type=search]').fill('@kofi'); await p.waitForTimeout(200);
    { const t2 = await p.evaluate(() => document.querySelector('main').innerText);
      pass(/Ferme Nord/.test(t2) && !/Pharmacie A/.test(t2), 'search "@kofi" finds the username'); }
    await p.locator('main input[type=search]').fill(''); await p.waitForTimeout(200);
    pass(/Accounts\s*3/.test(t) && /On trial\s*1/.test(t) && /Paid plan\s*1/.test(t), 'counts: 3 accounts, 1 on trial, 1 paid');
    pass(/7 days left/.test(t) && /Right now: Business/.test(t), 'trial days and effective plan shown');
    await p.screenshot({ path: 'admin-1440.png' });
    await p.getByRole('combobox', { name: 'Plan for Ferme Nord' }).selectOption('business'); await p.waitForTimeout(500);
    const last = p._patches.at(-1);
    pass(last && last.id === 'u-2' && last.body.plan === 'business' && /^Bearer /.test(last.auth), 'plan change → PATCH /admin/accounts/u-2 {plan: business}, signed');
    pass(/Ferme Nord: saved/.test(await p.evaluate(() => document.querySelector('main').innerText)), 'saved notice');
    await p.locator('tr', { hasText: 'Pharmacie A' }).getByRole('button', { name: '+14 days' }).click(); await p.waitForTimeout(500);
    pass(p._patches.at(-1).body.trial_days === 21, '+14 days on a 7-day trial → trial_days 21');
    await p.locator('tr', { hasText: 'Pharmacie A' }).getByRole('button', { name: 'End' }).click(); await p.waitForTimeout(500);
    pass(p._patches.at(-1).body.trial_days === 0, 'End trial → trial_days 0');
    await p.getByRole('searchbox', { name: 'Search accounts' }).fill('ferme'); await p.waitForTimeout(200);
    const rows = await p.locator('tbody tr').count();
    pass(rows === 1, 'search filters the list');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await p.close(); }
  { const p = await open(true, 390);
    await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(300);
    await p.locator('aside nav button', { hasText: /^Admin$/ }).click(); await p.waitForTimeout(1000);
    pass(await p.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), 'phone: page itself never scrolls sideways (table scrolls in its card)');
    await p.close(); }
  await browser.close();
  console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`); process.exit(fails ? 1 : 0);
})();
