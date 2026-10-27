// The founder's switch: Founder, Boss, Employee. Each sends the right header to the API, and the screens
// follow it: the Admin and Sites items go away as the boss or an employee, the banner says which view it is,
// and Founder brings everything back. A company user never sees the switch.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const SITE = '11111111-0000-0000-0000-000000000001';
const LS = { sentria_onboarded: 'true', sentria_language: 'en', sentria_company_name: 'Atlantis', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_guide_done: '1', sentria_theme: 'light', sentria_active_site: SITE };
const srcs = ['csv', 'api', 'erp', 'iot'].map(type => ({ type, wanted: false, connected: false, synced: false }));

async function open({ isAdmin = true, sessionView = null } = {}) {
  const ctx = await (await chromium.launch(LAUNCH)).newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  const p = await ctx.newPage(); p._errors = []; p._headers = []; p.on('pageerror', e => p._errors.push(e.message));
  await p.route(/onrender\.com\//, r => {
    const req = r.request(); const u = new URL(req.url());
    if (u.pathname !== '/sites') p._headers.push({ path: u.pathname, view: req.headers()['x-view-as-employee'] ? 'employee:' + req.headers()['x-view-as-employee'] : req.headers()['x-view-as-owner'] ? 'boss' : req.headers()['x-view-as'] ? 'company' : 'founder' });
    const json = b => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (u.pathname === '/sites') return json({ sites: [{ id: SITE, name: 'Nairobi', location: '', sector: 'health', status: 'offline', sources: srcs, created_at: new Date().toISOString(), departments: ['pharmacie'], priorities: [], configured: true }], persisted: true, max_sites: 50 });
    if (u.pathname === '/alerts') return json([]);
    return json({ recommendations: [], assignments: [], contractors: [], freshness: [], persisted: false });
  });
  await p.addInitScript(([ls, sv]) => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); if (sv) sessionStorage.setItem('sentria_role_view', sv); } }, [LS, sessionView]);
  await signedIn(p, 'u-founder', 'founder@sentria.app', { plan: 'entreprise', isAdmin });
  await p.goto(APP_URL); await p.waitForTimeout(2200);
  return { ctx, p };
}
const nav = async p => ({ sites: await p.locator('aside [data-nav="sites"]').count(), admin: await p.locator('aside [data-nav="admin"]').count() });

(async () => {
  console.log('== the founder sees the switch; a company user does not');
  let x = await open();
  pass(await x.p.getByTestId('role-switch').count() === 0, 'the switch lives in the account menu, closed at first');
  await x.p.getByRole('button', { name: /Atlantis|account|compte/i }).first().click().catch(() => {});
  await x.p.waitForTimeout(400);
  pass(await x.p.getByTestId('role-switch').count() === 1 && await x.p.getByTestId('role-founder').getAttribute('aria-pressed') === 'true', 'with the founder chosen by default');
  pass(await x.p.getByTestId('role-employee').isEnabled(), 'Employee is available with a site on screen');
  const founderNav = await nav(x.p);
  pass(founderNav.admin === 1 && founderNav.sites === 1, 'as the founder: Sites and Admin are in the menu');
  await x.ctx.close();

  x = await open({ isAdmin: false });
  await x.p.getByRole('button', { name: /Atlantis|account|compte/i }).first().click().catch(() => {});
  await x.p.waitForTimeout(300);
  pass(await x.p.getByTestId('role-switch').count() === 0, 'a company user has no switch');
  await x.ctx.close();

  console.log('== Boss');
  x = await open();
  await x.p.getByRole('button', { name: /Atlantis|account|compte/i }).first().click().catch(() => {});
  await x.p.waitForTimeout(300);
  await x.p.getByTestId('role-boss').click(); await x.p.waitForTimeout(2200);
  pass(await x.p.getByTestId('view-as-banner').getAttribute('data-preview') === 'boss', 'the banner says the boss view');
  let n = await nav(x.p);
  pass(n.admin === 0, 'Admin is gone as the boss');
  pass(n.sites === 1, 'the boss still has Sites');
  pass(x.p._headers.some(h => h.view === 'boss') && !x.p._headers.some(h => h.view === 'employee:'+SITE), 'the API is asked for the boss view');
  await x.ctx.close();

  console.log('== Employee');
  x = await open();
  await x.p.getByRole('button', { name: /Atlantis|account|compte/i }).first().click().catch(() => {});
  await x.p.waitForTimeout(300);
  await x.p.getByTestId('role-employee').click(); await x.p.waitForTimeout(2200);
  pass(await x.p.getByTestId('view-as-banner').getAttribute('data-preview') === 'employee', 'the banner says the employee view');
  n = await nav(x.p);
  pass(n.sites === 0 && n.admin === 0, 'no Sites and no Admin, as an employee');
  pass(x.p._headers.some(h => h.view === 'employee:' + SITE), 'the API is asked for the employee view on the site shown');
  await x.p.screenshot({ path: 'roleview-employee.png' });
  pass(x.p._errors.length === 0, 'no page errors ' + x.p._errors.join('|'));
  console.log('== Founder brings everything back');
  await x.p.getByTestId('view-as-exit').click(); await x.p.waitForTimeout(1800);
  x.p._headers = [];
  await x.p.goto(APP_URL); await x.p.waitForTimeout(2000);
  n = await nav(x.p);
  pass(n.admin === 1 && n.sites === 1 && await x.p.getByTestId('view-as-banner').count() === 0, 'Founder: Sites and Admin back, no banner');
  pass(x.p._headers.every(h => !h.view || h.view === 'founder'), 'no preview header is sent');
  await x.ctx.close();

  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})();
