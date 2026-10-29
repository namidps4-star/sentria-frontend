// The import menu is one click away on every page: the top bar shows the import button on the Sites and Settings
// pages, and it opens the Dashboard with the import menu open. The Dashboard keeps its own single button.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const NOW = new Date().toISOString();
const srcs = ['csv', 'api', 'erp', 'iot'].map(type => ({ type, wanted: false, connected: false, synced: false }));
const site = (id, name) => ({ id, name, location: '', sector: 'health', status: 'online', sources: srcs, created_at: NOW, departments: ['pharmacie'], priorities: [], configured: true });
const SITES = [site('s1', 'Nairobi'), site('s2', 'Mombasa')];
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Atlantis', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_active_site: 's1' };

(async () => {
  const b = await chromium.launch(LAUNCH);
  const open = async ({ vw = 1440, vh = 900 } = {}) => {
    const p = await b.newPage({ viewport: { width: vw, height: vh }, locale: 'en-US' });
    p._errs = [];
    p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/onrender\.com\//, r => {
      const req = r.request(); const u = new URL(req.url());
      const send = body => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (u.pathname === '/sites') return send({ sites: SITES, persisted: true, max_sites: 50 });
      if (u.pathname === '/alerts') return send([]);
      if (u.pathname === '/reports/weekly') return send({ alerts: 0, critical: 0, warning: 0, previous_alerts: 0, delta: 0, trend: 'flat', resolved: 0, top_offender: null });
      if (u.pathname === '/contractors') return send({ contractors: [] });
      return send({ recommendations: [], assignments: [], contractors: [] });
    });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); } }, LS);
    await signedIn(p, 'u', 'a@b.c', { plan: 'business' }); await p.goto(APP_URL); await p.waitForTimeout(1800);
    if (vw < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(300); }
    return p;
  };
  const go = async (p, name) => {
    await p.locator('aside nav button', { hasText: name }).first().click(); await p.waitForTimeout(1200);
  };

  console.log('== on the Dashboard: one import button, the dashboard\'s own');
  let p = await open();
  pass(await p.getByTestId('topbar-import').count() === 0, 'no shortcut on the Dashboard');
  pass(await p.locator('[data-tour="import"]').count() === 1, 'the Dashboard keeps its own import button');
  await p.close();

  console.log('== on Sites: the import button is in the top bar');
  p = await open();
  await go(p, 'Sites');
  pass(await p.getByTestId('topbar-import').count() === 1, 'the Sites page shows the import button in the top bar');
  pass(await p.getByTestId('topbar-import').isVisible(), 'and it is visible');
  await p.getByTestId('topbar-import').click(); await p.waitForTimeout(1200);
  pass(await p.locator('[data-tour="import"]').count() === 1, 'clicking it goes to the Dashboard');
  pass(await p.locator('#import-panel').isVisible(), 'and the import menu is open');
  pass(await p.getByRole('button', { name: /department|départ/i }).count() >= 0 && /Which department is this file for/.test(await p.locator('#import-panel').innerText()), 'the department choice is in the menu');
  pass(await p.evaluate(() => sessionStorage.getItem('sentria_open_import')) === null, 'the open flag is cleared, so the next visit stays closed');
  pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
  await p.screenshot({ path: 'importeverywhere-sites-opened.png' });
  await p.close();

  console.log('== on Settings, at 390 px');
  p = await open({ vw: 390, vh: 844 });
  await go(p, 'Settings');
  pass(await p.getByTestId('topbar-import').count() === 1 && await p.getByTestId('topbar-import').isVisible(), 'the import button shows on a phone too');
  pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '390 px: no sideways scroll');
  await p.screenshot({ path: 'importeverywhere-390.png' });
  await p.close();

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
