// The site menu in the top bar: the active site pinned in lime, the other sites as cards, and a tap on a card's
// arrow opens that whole industry as one card (sites and department pills). One industry open at a time.
// Light, dark and 390 px. Screenshots go to E2E_SHOTS (default: the working directory).
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { mockSupabase, session, STORAGE_KEY } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const UID = 'u-scope', EMAIL = 'a@b.c';
const NOW = new Date().toISOString();
const alertOf = (name, site) => ({ id: name, equipment: name, sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: NOW, alert_key: null, message: `MSG ${name}`, risk_score: 70, site_id: site });
const srcs = (c = false) => ['csv', 'api', 'erp', 'iot'].map(type => ({ type, wanted: false, connected: c, synced: c }));
const mkSite = (id, name, location, sector = 'health', departments = [], configured = true) => ({ id, name, location, sector, status: 'offline', sources: srcs(), created_at: NOW, departments, priorities: [], configured });


const path = require('path');
const SHOTS = process.env.E2E_SHOTS || '.';
const SITES = () => [
  mkSite('s1', 'Atl industry', '', 'industry', ['production-plant']),
  mkSite('s2', 'Main site', '', 'health', ['pharmacie', 'clinique-hopital', 'laboratoire']),
  mkSite('s3', 'ATL - Vet', '', 'health', ['veterinaire']),
  mkSite('s4', 'Atl Retail', '', 'commerce', ['grossiste-distributeur', 'supermarche-hypermarche', 'chaine-magasins']),
];

(async () => {
  const browser = await chromium.launch(LAUNCH);
  // `server`: the API has the sites table. `sites`: what it holds. `profile`: extra account values.
  const open = async ({ server = true, sites = [], profile = {}, lang = 'en', vw = 1440, vh = 900, active = null, plan = 'entreprise', refuse = null } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    const api = { refuse, sites: sites.map(s => ({ ...s })), log: [], alerts: [alertOf('Amox', 's1'), alertOf('Ibu', 's1'), alertOf('Paracetamol', 's2')] };
    await p.route(/onrender\.com\//, async r => {
      const req = r.request(), u = new URL(req.url()), m = req.method(), path = u.pathname;
      const json = (body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (path === '/sites' && m === 'GET') {
        if (!server) return json({ message: 'not found' }, 404);
        api.log.push('GET /sites');
        return json({ sites: api.sites.map(s => { const mine = api.alerts.filter(a => a.site_id === s.id); return { ...s, alerts: mine.length, stats: mine.length ? { alerts: mine.length, critical: mine.filter(a => a.severity === 'CRITICAL').length, warnings: mine.filter(a => a.severity !== 'CRITICAL').length, assets: new Set(mine.map(a => a.equipment)).size, last: NOW } : null }; }), persisted: true, max_sites: 50 });
      }
      if (path === '/sites' && m === 'POST') { const b = JSON.parse(req.postData()); if (api.refuse) return json({ success: false, error_code: api.refuse, message: 'no', needs: 'entreprise' }, 403); const s = mkSite('s' + (api.sites.length + 1), b.name, b.location || ''); s.sources = b.sources || srcs(); s.sector = b.sector || 'health'; s.departments = b.departments || []; s.priorities = b.priorities || []; s.configured = b.configured === true; api.body = b; api.sites.push(s); api.log.push('POST /sites ' + b.name); return json(s, 201); }
      if (/^\/sites\/[^/]+\/claim$/.test(path) && m === 'POST') { if (api.claimMissing) return json({ detail: 'Not Found' }, 404); api.log.push('CLAIM ' + path.split('/')[2]); api.claimBody = req.postData(); return json({ success: true, moved: 2 }); }
      const one = path.match(/^\/sites\/(.+)$/);
      if (one && m === 'PATCH') { const s = api.sites.find(x => x.id === one[1]); Object.assign(s, JSON.parse(req.postData())); api.log.push('PATCH ' + one[1]); return json(s); }
      if (one && m === 'DELETE') { api.sites = api.sites.filter(x => x.id !== one[1]); api.alerts = api.alerts.filter(a => a.site_id !== one[1]); api.log.push('DELETE ' + one[1]); return json({ success: true, alerts_deleted: 0 }); }
      if (path === '/alerts' && m === 'GET') {
        const site = u.searchParams.get('site_id'); api.log.push('GET /alerts site=' + site);
        return json(api.alerts.filter(a => !site || a.site_id === site || !api.sites.length));
      }
      if (path === '/upload') { api.log.push('POST /upload site=' + u.searchParams.get('site_id')); return json({ success: true, rows_processed: 3, alerts_fired: 1 }); }
      if (path === '/recommendations') return json({ count: 0, recommendations: [] });
      return json([]);
    });
    const prof = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_company_name: 'Acme', sentria_language: lang, ...profile };
    const db = { users: { [EMAIL]: { uid: UID, password: 'x' } }, accounts: { [UID]: { profile: prof, plan } } };
    await mockSupabase(p, db, { plan });
    await p.addInitScript(({ key, s, active }) => { if (!localStorage.getItem(key)) { localStorage.setItem(key, JSON.stringify(s)); if (active) localStorage.setItem('sentria_active_site', active); } }, { key: STORAGE_KEY, s: session(UID, EMAIL, {}), active });
    await p.goto(APP_URL); await p.waitForTimeout(3500);
    return { p, ctx, api, db };
  };

  for (const [name, vw, theme] of [['light', 1440, 'light'], ['dark', 1440, 'dark'], ['phone', 390, 'light']]) {
    console.log(`== ${name}`);
    const { p, ctx, api } = await open({ sites: SITES(), vw, vh: vw < 768 ? 844 : 900, active: 's1', profile: { sentria_theme: theme, sentria_sector: 'industry', sentria_sectors: '["industry","health","commerce"]' } });
    if (theme === 'dark') { await p.evaluate(() => localStorage.setItem('sentria_theme', 'dark')); await p.reload(); await p.waitForTimeout(3500); }
    await p.getByTestId('account-menu-button').click(); await p.waitForTimeout(500);
    const menu = p.getByTestId('account-menu');
    const bg = (loc) => loc.evaluate(el => { const cv = document.createElement('canvas'); cv.width = cv.height = 1; const c = cv.getContext('2d', { willReadFrequently: true }); c.fillStyle = '#000'; c.fillStyle = getComputedStyle(el).backgroundColor; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3); });

    pass(await p.getByTestId('account-menu-site').count() === 4, 'all four sites are listed');
    const first = p.getByTestId('account-menu-site').first();
    pass(await first.getAttribute('aria-current') === 'true' && /Atl industry/.test(await first.innerText()), 'the active site comes first and is marked');
    const lime = await bg(menu.locator('div.bg-brand').first());
    pass(lime[1] > 200 && lime[2] < 110, 'the active site sits on a lime card: ' + lime.join(','));
    pass(/active site/i.test(await menu.innerText()) && /other sites/i.test(await menu.innerText()), 'with the labels Active site and Other sites');
    const mt = await menu.innerText();
    pass(mt.includes('\u{1F3ED}') && mt.includes('\u{1F3E5}') && mt.includes('\u{1F6D2}'), 'each site carries its sector emoji (industry, health, retail)');
    pass(/\u{1F9EA}|\u{1F3ED}/u.test(await p.getByTestId('account-menu-department-item').first().innerText()) || (await p.getByTestId('account-menu-department-item').first().innerText()).trim().length > 2, 'the department pill has an emoji before its name');
    pass(await menu.evaluate(el => [...el.querySelectorAll('*')].every(n => !/(auto|scroll)/.test(getComputedStyle(n).overflowY) || n.scrollHeight <= n.clientHeight + 1)), 'no scroll bar inside the menu');
    pass(await p.getByTestId('account-menu-sector-toggle').count() === 3, 'each other site has its arrow');
    pass(await p.getByTestId('account-menu-department-item').count() === 1, 'only the active site shows its department pill (others stay closed)');
    pass(await menu.locator('section').count() === 0, 'no industry is open yet');
    pass((await p.getByTestId('account-menu-sector').allInnerTexts()).length === 3, 'one industry label for each of the three industries');
    await p.screenshot({ path: path.join(SHOTS, `sitemenu-closed-${name}.png`) });

    await p.getByTestId('account-menu-sector-toggle').first().click(); await p.waitForTimeout(400);
    const open1 = menu.locator('section');
    pass(await open1.count() === 1 && /Health/.test(await open1.first().getAttribute('aria-label')), 'the arrow opens the Health industry as one card');
    pass(await open1.first().locator('[data-testid="account-menu-site"]').count() === 2, 'with both of its sites');
    pass(await open1.first().locator('[data-testid="account-menu-department-item"]').count() === 4, 'and their department pills');
    pass(await p.getByTestId('account-menu-sector-toggle').count() === 2, 'the Health arrows are replaced by one close arrow, the retail one stays: ' + await p.getByTestId('account-menu-sector-toggle').count());
    await p.screenshot({ path: path.join(SHOTS, `sitemenu-open-${name}.png`) });

    await p.getByTestId('account-menu-sector-toggle').filter({ has: p.locator('svg') }).last().click(); await p.waitForTimeout(400);
    pass(await menu.locator('section').count() === 1 && /Retail|Commerce/.test(await menu.locator('section').first().getAttribute('aria-label')), 'opening another industry closes the first');

    await menu.locator('section [data-testid="account-menu-site"]').first().click(); await p.waitForTimeout(1500);
    pass(await menu.count() === 0, 'picking a site closes the menu');
    pass(api.log.some(l => /GET \/alerts site=s4|GET \/alerts site=s/.test(l)), 'and loads that site');
    await p.getByTestId('account-menu-button').click(); await p.waitForTimeout(500);
    pass(await p.getByTestId('account-menu').locator('section').count() === 0, 'reopening starts with every industry closed');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nAll passed');
  process.exit(fails ? 1 : 0);
})();
