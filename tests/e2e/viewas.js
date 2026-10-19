// S-3: SentrIA staff can look at one company, read only. The Admin page has a View button per account; it
// remembers the company for the tab, every API call then carries X-View-As, a banner says whose data it is and
// ends the view, and a company user never sends the header. French, dark and a phone.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const ACCOUNTS = [
  { user_id: 'u-1', email: 'ama@pharma.bj', name: 'Ama Mensah', company_id: 'c1', company_name: 'Pharmacie A', sector: 'health', department: 'pharmacie', country: 'BJ', onboarded: true, plan: 'pro', effective_plan: 'pro', trial_ends_at: null, is_admin: false, created_at: '2026-09-20T10:00:00Z', alerts: 12 },
  { user_id: 'u-me', email: 'boss@sentria.app', company_id: 'c0', company_name: 'SentrIA', sector: null, department: null, country: null, onboarded: false, plan: 'decouverte', effective_plan: 'decouverte', trial_ends_at: null, is_admin: true, created_at: '2026-09-01T10:00:00Z', alerts: 0 },
];

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ admin = true, lang = 'en', theme = 'light', vw = 1440, viewing = null } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p._headers = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => {
      const u = new URL(r.request().url());
      if (u.pathname !== '/admin/accounts') p._headers.push(r.request().headers()['x-view-as'] || null);
      if (u.pathname === '/admin/accounts') return json(r, { accounts: ACCOUNTS });
      if (u.pathname === '/sites') return json(r, { sites: [{ id: 's1', name: 'Cotonou', location: '', sector: 'health', status: 'offline', sources: ['csv', 'api', 'erp', 'iot'].map(type => ({ type, wanted: false, connected: false, synced: false })), created_at: new Date().toISOString(), departments: [], priorities: [], configured: false, alerts: 0, stats: null }], persisted: true, max_sites: 50 });
      if (u.pathname === '/admin/sites') return json(r, { persisted: true, sites: [
        { id: 's1', company_id: 'c1', company_name: 'Pharmacie A', name: 'Cotonou', location: 'Bénin', sector: 'health', status: 'offline', alerts: 12, critical: 2 },
        { id: 's9', company_id: 'c2', company_name: 'Ferme Nord', name: 'Kumasi', location: '', sector: 'agriculture', status: 'connected', alerts: 0, critical: 0 }] });
      if (u.pathname === '/admin/thresholds') return json(r, { thresholds: [], persisted: true });
      if (u.pathname === '/admin/guard') return json(r, { enabled: true, forced_off: false, persisted: true, log: [] });
      return json(r, u.pathname === '/alerts' ? [] : { recommendations: [], assignments: [], contractors: [] });
    });
    await p.addInitScript(({ ls, viewing }) => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); if (viewing) sessionStorage.setItem('sentria_view_as', JSON.stringify(viewing)); } },
      { ls: { sentria_onboarded: 'true', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: lang, sentria_theme: theme }, viewing });
    await signedIn(p, 'u-me', 'boss@sentria.app', { plan: 'decouverte', isAdmin: admin });
    await p.goto(APP_URL); await p.waitForTimeout(1800);
    return { p, ctx };
  };
  const adminPage = async (p, vw = 1440) => {
    if (vw < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click(); await p.waitForTimeout(400); }
    await p.locator('aside nav button', { hasText: /^Admin$/ }).locator('visible=true').first().click(); await p.waitForTimeout(1200);
  };

  console.log('== the View button');
  { const { p, ctx } = await open();
    pass(await p.getByTestId('view-as-banner').count() === 0, 'no banner before a company is chosen');
    await adminPage(p);
    pass(await p.getByTestId('view-as').count() === 2, 'one View button per account');
    await p.getByTestId('view-as').first().click(); await p.waitForTimeout(2500);
    const stored = await p.evaluate(() => sessionStorage.getItem('sentria_view_as'));
    pass(JSON.parse(stored).company_id === 'c1', 'it remembers the company for the tab: ' + stored);
    pass(/You are viewing Pharmacie A \(read only\)/.test(await p.getByTestId('view-as-banner').innerText()), 'the banner says whose data this is and that it is read only');
    pass(p._headers.some(h => h === 'c1'), 'API calls now carry X-View-As: c1');
    await p.screenshot({ path: 'viewas-light.png' });
    await p.getByTestId('view-as-exit').click(); await p.waitForTimeout(2500);
    pass(await p.getByTestId('view-as-banner').count() === 0 && await p.evaluate(() => sessionStorage.getItem('sentria_view_as')) === null, 'Exit ends the view');
    p._headers.length = 0; await p.reload(); await p.waitForTimeout(1800);
    pass(!p._headers.some(Boolean), 'and the header is gone');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== every companys sites');
  { const { p, ctx } = await open();
    await adminPage(p);
    pass(await p.getByTestId('admin-site').count() === 2, 'the Admin page lists the sites of every company');
    const t = await p.getByTestId('admin-sites').innerText();
    pass(/Pharmacie A · Cotonou/.test(t) && /Ferme Nord · Kumasi/.test(t) && /12 alerts/.test(t) && /2 critical/.test(t), 'each row names the company, the site and its alerts');
    await p.getByTestId('admin-sites').getByLabel('Search sites').fill('kumasi'); await p.waitForTimeout(200);
    pass(await p.getByTestId('admin-site').count() === 1, 'the search narrows the list');
    await p.getByTestId('admin-sites').getByLabel('Search sites').fill('');
    await p.getByTestId('admin-site-view').first().click(); await p.waitForTimeout(2500);
    const stored = JSON.parse(await p.evaluate(() => sessionStorage.getItem('sentria_view_as')));
    pass(stored.company_id === 'c1' && await p.evaluate(() => localStorage.getItem('sentria_active_site')) === 's1', 'View opens that company on that site, read only');
    pass(await p.getByTestId('view-as-banner').count() === 1, 'with the banner');
    await ctx.close(); }

  console.log('== a company user');
  { const { p, ctx } = await open({ admin: false });
    pass(await p.locator('aside nav button', { hasText: /^Admin$/ }).count() === 0, 'sees no Admin page, so no View button');
    pass(!p._headers.some(Boolean), 'sends no X-View-As');
    await ctx.close(); }

  console.log('== French, dark, phone');
  { const { p, ctx } = await open({ lang: 'fr', theme: 'dark', vw: 390, viewing: { company_id: 'c1', name: 'Pharmacie A' } });
    pass(/Vous regardez Pharmacie A \(lecture seule\)/.test(await p.getByTestId('view-as-banner').innerText()), 'French banner');
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll at 390 px');
    await p.screenshot({ path: 'viewas-390-dark-fr.png' });
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
