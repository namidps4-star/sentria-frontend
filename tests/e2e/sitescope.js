// F-SITESCOPE: a company with sites never sees two sites' data together. The API is faked in memory
// (sites, alerts cut by site_id, uploads). Checks: a one-site company sees no switcher; with two sites
// the top bar names the site and rolls down all of them with their alerts; choosing a site fetches
// again for that site only and survives a reload; an upload goes to the site shown; adding and deleting
// a site go to the API; sites kept in the profile move to the API once; an API with no sites table
// (migration 016 not run) cuts nothing and shows no switcher; French and a phone.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { mockSupabase, session, STORAGE_KEY } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const UID = 'u-scope', EMAIL = 'a@b.c';
const NOW = new Date().toISOString();
const alertOf = (name, site) => ({ id: name, equipment: name, sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: NOW, alert_key: null, message: `MSG ${name}`, risk_score: 70, site_id: site });
const srcs = (c = false) => ['csv', 'api', 'iot'].map(type => ({ type, connected: c, synced: c }));
const mkSite = (id, name, location) => ({ id, name, location, sector: 'health', status: 'offline', sources: srcs(), created_at: NOW });

(async () => {
  const browser = await chromium.launch(LAUNCH);
  // `server`: the API has the sites table. `sites`: what it holds. `profile`: extra account values.
  const open = async ({ server = true, sites = [], profile = {}, lang = 'en', vw = 1440, active = null } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    const api = { sites: sites.map(s => ({ ...s })), log: [], alerts: [alertOf('Amox', 's1'), alertOf('Ibu', 's1'), alertOf('Paracetamol', 's2')] };
    await p.route(/onrender\.com\//, async r => {
      const req = r.request(), u = new URL(req.url()), m = req.method(), path = u.pathname;
      const json = (body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (path === '/sites' && m === 'GET') {
        if (!server) return json({ message: 'not found' }, 404);
        api.log.push('GET /sites');
        return json({ sites: api.sites.map(s => ({ ...s, alerts: api.alerts.filter(a => a.site_id === s.id).length })), persisted: true, max_sites: 50 });
      }
      if (path === '/sites' && m === 'POST') { const b = JSON.parse(req.postData()); const s = mkSite('s' + (api.sites.length + 1), b.name, b.location || ''); s.sources = b.sources || srcs(); api.sites.push(s); api.log.push('POST /sites ' + b.name); return json(s, 201); }
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
    const db = { users: { [EMAIL]: { uid: UID, password: 'x' } }, accounts: { [UID]: { profile: prof, plan: 'entreprise' } } };
    await mockSupabase(p, db, { plan: 'entreprise' });
    await p.addInitScript(({ key, s, active }) => { if (!localStorage.getItem(key)) { localStorage.setItem(key, JSON.stringify(s)); if (active) localStorage.setItem('sentria_active_site', active); } }, { key: STORAGE_KEY, s: session(UID, EMAIL, {}), active });
    await p.goto(APP_URL); await p.waitForTimeout(3500);
    return { p, ctx, api, db };
  };
  const rows = async p => (await p.locator('#alerts-table tbody tr').allInnerTexts()).map(t => t.replace(/\s+/g, ' '));

  console.log('== one site: no switcher');
  { const { p, ctx } = await open({ sites: [mkSite('s1', 'Lyon plant', 'Lyon')] });
    pass(await p.getByTestId('account-menu-button').count() === 0, 'a single-site company sees nothing about sites in the top bar');
    pass(await p.getByTestId('upload-site').count() === 0, 'and the upload does not name a site');
    await ctx.close(); }

  console.log('== two sites: the switcher and the cut');
  let api2, p2, ctx2;
  { const o = await open({ sites: [mkSite('s1', 'Lyon plant', 'Lyon'), mkSite('s2', 'Dakar depot', 'Dakar')] }); const { p, ctx, api } = o; api2 = api; p2 = p; ctx2 = ctx;
    const btn = p.getByTestId('account-menu-button');
    pass(await btn.count() === 1, 'the top bar has the switcher');
    pass(/ACME · SITE/i.test(await p.getByTestId('account-menu-line').innerText()), 'its top line reads "COMPANY · SITE"');
    pass((await p.getByTestId('account-menu-active').innerText()) === 'Lyon plant', 'and it names the site shown: the first one');
    const first = await rows(p);
    pass(first.length === 2 && first.every(t => /Amox|Ibu/.test(t)) && !first.some(t => /Paracetamol/.test(t)), 'the alerts are Lyon\'s only: ' + first.join(' | ').slice(0, 80));
    pass(api.log.some(l => l === 'GET /alerts site=s1'), 'and the request carried site_id');
    pass(/Lyon plant/.test(await p.getByTestId('upload-site').textContent()), 'the upload says it goes to the site shown');
    await btn.click(); await p.waitForTimeout(400);
    const items = await p.getByTestId('account-menu-site').allInnerTexts();
    pass(items.length === 2 && /Lyon plant/.test(items[0]) && /Dakar depot/.test(items[1]), 'the menu lists both sites');
    pass((await p.getByTestId('account-menu-count').allInnerTexts()).join(',') === '2,1', 'each with its alerts: 2 and 1');
    pass(await p.getByTestId('account-menu-site').first().getAttribute('aria-checked') === 'true', 'the one shown is marked');
    await p.screenshot({ path: 'sitescope-menu-light.png' });
    await p.getByTestId('account-menu-site').nth(1).click(); await p.waitForTimeout(1200);
    pass((await p.getByTestId('account-menu-active').innerText()) === 'Dakar depot', 'choosing the second site names it');
    const second = await rows(p);
    pass(second.length === 1 && /Paracetamol/.test(second[0]), 'the screen now shows that site only, nothing of Lyon: ' + second.join(' | ').slice(0, 60));
    pass(api.log.some(l => l === 'GET /alerts site=s2'), 'the new fetch carried the new site_id');
    pass((await p.getByTestId('upload-site').textContent()).includes('Dakar depot'), 'the upload follows');
    await p.screenshot({ path: 'sitescope-second-light.png' });
    await p.reload(); await p.waitForTimeout(3500);
    pass((await p.getByTestId('account-menu-active').innerText()) === 'Dakar depot', 'a reload keeps the site');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
  }

  console.log('== an upload goes to the site shown');
  { const p = p2, api = api2;
    await p.locator('input[type=file]').first().setInputFiles({ name: 'a.csv', mimeType: 'text/csv', buffer: Buffer.from('medicine_name,stock_qty\nA,1\n') });
    await p.waitForTimeout(2500);
    pass(api.log.some(l => l === 'POST /upload site=s2'), 'the upload request names site s2: ' + api.log.filter(l => /upload/.test(l)).join(','));
    await ctx2.close(); }

  console.log('== a site that is gone');
  { const { p, ctx } = await open({ sites: [mkSite('s1', 'Lyon plant', 'Lyon'), mkSite('s2', 'Dakar depot', 'Dakar')], active: 'gone-site' });
    pass((await p.getByTestId('account-menu-active').innerText()) === 'Lyon plant', 'a remembered site that no longer exists falls back to the first');
    await ctx.close(); }

  console.log('== adding and deleting a site');
  { const { p, ctx, api } = await open({ sites: [mkSite('s1', 'Lyon plant', 'Lyon')] });
    await p.locator('aside nav button', { hasText: /^Sites$/ }).first().click().catch(() => {});
    await p.waitForTimeout(800);
    await p.getByRole('button', { name: 'Add a site' }).locator('visible=true').first().click(); await p.waitForTimeout(300);
    await p.getByPlaceholder('e.g. Lyon plant').fill('Dakar depot');
    await p.getByRole('button', { name: 'Create the site' }).click(); await p.waitForTimeout(900);
    pass(api.log.includes('POST /sites Dakar depot') && api.sites.length === 2, 'a new site is sent to the API');
    await p.getByTestId('site-delete').click(); await p.waitForTimeout(200);
    pass(await p.getByTestId('site-delete-warning').isVisible(), 'the delete confirmation says its alerts go too');
    await p.getByTestId('site-delete-confirm').click(); await p.waitForTimeout(900);
    pass(api.log.some(l => l.startsWith('DELETE ')) && api.sites.length === 1, 'delete goes to the API');
    pass(await p.getByTestId('account-menu-button').count() === 0, 'back to one site: the switcher is gone');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== sites kept in the profile move to the API once');
  { const old = [{ id: 'x1', name: 'Old plant', location: 'Nice', sector: 'health', status: 'offline', synced: false, sources: srcs() }];
    const { p, ctx, api, db } = await open({ sites: [], profile: { sentria_sites: JSON.stringify(old) } });
    pass(api.log.includes('POST /sites Old plant') && api.sites.length === 1, 'the profile site is sent to the API');
    await p.reload(); await p.waitForTimeout(3500);
    pass(api.sites.length === 1, 'and not sent again after a reload');
    await ctx.close(); }

  console.log('== no sites table (migration 016 not run): nothing is cut');
  { const { p, ctx, api } = await open({ server: false, profile: { sentria_sites: JSON.stringify([{ id: 'a', name: 'A', location: '', sector: 'health', status: 'offline', synced: false, sources: srcs() }, { id: 'b', name: 'B', location: '', sector: 'health', status: 'offline', synced: false, sources: srcs() }]) } });
    pass(await p.getByTestId('account-menu-button').count() === 0, 'two sites in the profile give no switcher: it would cut nothing');
    pass(api.log.every(l => !/site=s/.test(l)) && api.log.some(l => l === 'GET /alerts site=null'), 'alerts are fetched with no site_id');
    pass((await rows(p)).length === 3, 'and all of the company\'s alerts show');
    await ctx.close(); }

  console.log('== French and a phone');
  { const { p, ctx } = await open({ sites: [mkSite('s1', 'Usine de Lyon', 'Lyon'), mkSite('s2', 'Dépôt de Dakar', 'Dakar')], lang: 'fr', vw: 390 });
    await p.getByTestId('account-menu-button').click(); await p.waitForTimeout(400);
    const t = await p.getByTestId('account-menu').innerText();
    pass(/site affiché/i.test(t) && /gérer les sites/i.test(t) && /Usine de Lyon/.test(t), 'French labels');
    const box = await p.getByTestId('account-menu').boundingBox();
    pass(box && box.x >= 0 && box.x + box.width <= 390, 'the menu stays inside a 390 px screen');
    await p.screenshot({ path: 'sitescope-fr-390.png' });
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
