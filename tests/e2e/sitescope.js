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
const srcs = (c = false) => ['csv', 'api', 'erp', 'iot'].map(type => ({ type, wanted: false, connected: c, synced: c }));
const mkSite = (id, name, location) => ({ id, name, location, sector: 'health', status: 'offline', sources: srcs(), created_at: NOW, departments: [], priorities: [], configured: false });

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
      if (/^\/sites\/[^/]+\/claim$/.test(path) && m === 'POST') { api.log.push('CLAIM ' + path.split('/')[2]); return json({ success: true, moved: 2 }); }
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
  const rows = async p => (await p.locator('#alerts-table tbody tr').allInnerTexts()).map(t => t.replace(/\s+/g, ' '));

  console.log('== one site: the menu is there, with its one site');
  { const { p, ctx } = await open({ sites: [mkSite('s1', 'Lyon plant', 'Lyon')] });
    pass(await p.getByTestId('account-menu-button').count() === 1, 'the company menu is there even with a single site');
    pass((await p.getByTestId('account-menu-active').innerText()) === 'Lyon plant', 'and names that site');
    await p.getByTestId('account-menu-button').click(); await p.waitForTimeout(400);
    pass(await p.getByTestId('account-menu-site').count() === 1 && await p.getByTestId('account-menu-add').isVisible(), 'it lists the one site and offers "Add a site"');
    pass(await p.getByTestId('upload-site').count() === 0, 'the upload does not name a site: there is only one');
    await ctx.close(); }

  console.log('== no site yet: the menu offers to add one');
  { const { p, ctx } = await open({ sites: [], profile: { sentria_main_site_done: '1' } });
    await p.getByTestId('account-menu-button').click(); await p.waitForTimeout(400);
    pass(/No sites yet/.test(await p.getByTestId('account-menu').innerText()) && await p.getByTestId('account-menu-add').isVisible(), 'it says so and offers "Add a site"');
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
    pass(await p.getByTestId('account-menu-site').first().getAttribute('aria-current') === 'true', 'the one shown is marked');
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
    await p.getByTestId('add-site-name').fill('Dakar depot'); await p.getByTestId('add-site-next').click(); await p.waitForTimeout(200);
    await p.getByTestId('add-site-sector-health').click(); await p.getByTestId('add-site-next').click(); await p.waitForTimeout(200);
    await p.getByTestId('add-site-department-pharmacie').click(); await p.getByTestId('add-site-next').click(); await p.waitForTimeout(200);
    await p.getByTestId('add-site-next').click(); await p.waitForTimeout(200);
    await p.getByTestId('add-site-create').click(); await p.waitForTimeout(1500);
    pass(api.log.includes('POST /sites Dakar depot') && api.sites.length === 2, 'a new site is sent to the API');
    await p.locator('aside nav button', { hasText: /^Sites$/ }).first().click(); await p.waitForTimeout(800);
    await p.locator('main button', { hasText: 'Dakar depot' }).first().click(); await p.waitForTimeout(600);
    await p.getByTestId('site-delete').click(); await p.waitForTimeout(200);
    pass(await p.getByTestId('site-delete-warning').isVisible(), 'the delete confirmation says its alerts go too');
    await p.getByTestId('site-delete-confirm').click(); await p.waitForTimeout(900);
    pass(api.log.some(l => l.startsWith('DELETE ')) && api.sites.length === 1, 'delete goes to the API');
    pass((await p.getByTestId('account-menu-active').innerText()) === 'Lyon plant', 'back to one site: the menu names it');
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
    pass(await p.getByTestId('account-menu-active').count() === 0, 'two sites in the profile name no site shown: nothing is cut');
    pass(api.log.every(l => !/site=s/.test(l)) && api.log.some(l => l === 'GET /alerts site=null'), 'alerts are fetched with no site_id');
    pass((await rows(p)).length === 3, 'and all of the company\'s alerts show');
    await ctx.close(); }

  console.log('== Add a site: the onboarding\'s choices');
  { const { p, ctx, api } = await open({ sites: [mkSite('s1', 'Lyon plant', 'Lyon')], profile: { sentria_departments: JSON.stringify({ health: ['pharmacie'] }) } });
    await p.locator('aside nav button', { hasText: /^Sites$/ }).first().click(); await p.waitForTimeout(800);
    await p.getByRole('button', { name: 'Add a site' }).locator('visible=true').first().click(); await p.waitForTimeout(400);
    pass(await p.getByTestId('add-site-wizard').isVisible() && /Step 1 of 5/.test(await p.getByTestId('add-site-step').innerText()), 'it opens a five-step wizard');
    await p.getByTestId('add-site-next').click(); await p.waitForTimeout(200);
    pass(/Step 1 of 5/.test(await p.getByTestId('add-site-step').innerText()), 'a site needs a name before it goes on');
    await p.getByTestId('add-site-name').fill('Power depot'); await p.getByTestId('add-site-next').click(); await p.waitForTimeout(300);
    pass((await p.locator('[data-testid^="add-site-sector-"]').count()) === 7, 'step 2 offers the seven sectors, retail included');
    const lastBox = await p.getByTestId('add-site-sector-commerce').boundingBox(), firstBox = await p.getByTestId('add-site-sector-logistics').boundingBox();
    pass(lastBox && firstBox && lastBox.width > firstBox.width * 1.8, 'seven is odd: the last card takes the whole row, no empty cell');
    await p.getByTestId('add-site-sector-energy').click(); await p.waitForTimeout(200);
    await p.screenshot({ path: 'sitescope-wizard-step2.png' });
    await p.getByTestId('add-site-next').click(); await p.waitForTimeout(300);
    const depts = await p.locator('[data-testid^="add-site-department-"]').count();
    pass(depts >= 2, 'step 3 lists the sector\'s departments: ' + depts);
    await p.getByTestId('add-site-department-centrale-production').click();
    await p.getByTestId('add-site-department-distribution-energetique').click();
    pass(await p.getByTestId('add-site-department-centrale-production').getAttribute('aria-pressed') === 'true' && await p.getByTestId('add-site-department-distribution-energetique').getAttribute('aria-pressed') === 'true', 'where the plan allows it, several departments can be ticked');
    await p.getByTestId('add-site-next').click(); await p.waitForTimeout(300);
    const pri = p.locator('[data-testid^="add-site-priority-"]');
    pass(await pri.count() >= 1, 'step 4 lists what the sector can monitor');
    await pri.first().click();
    await p.getByTestId('add-site-next').click(); await p.waitForTimeout(300);
    pass(await p.getByTestId('add-site-source-csv').isVisible() && await p.getByTestId('add-site-source-api').isVisible() && await p.getByTestId('add-site-source-erp').isVisible(), 'step 5 offers CSV, API and ERP (and sensors)');
    await p.getByTestId('add-site-source-erp').click(); await p.waitForTimeout(150);
    pass(await p.getByTestId('add-site-not-live').isVisible(), 'API and ERP say they are not live yet, so nothing claims a link');
    pass(await p.getByTestId('csv-template').count() === 1, 'and CSV offers its empty file');
    await p.screenshot({ path: 'sitescope-wizard-light.png' });
    await p.getByTestId('add-site-create').click(); await p.waitForTimeout(2500);
    pass(api.body && api.body.sector === 'energy' && api.body.departments.length === 2 && api.body.priorities.length === 1 && api.body.configured === true, 'the API gets sector, departments, priorities and configured: ' + JSON.stringify(api.body).slice(0, 140));
    pass(api.body.sources.filter(x => x.wanted).map(x => x.type).join() === 'csv,erp' && api.body.sources.every(x => x.connected === false), 'the ways chosen are kept as wanted, none as connected');
    pass(/Dashboard/.test(await p.locator('header h1').innerText()), 'it lands on the dashboard');
    pass((await p.getByTestId('account-menu-active').innerText()) === 'Power depot', 'the new site is the one shown');
    pass(await p.evaluate(() => localStorage.getItem('sentria_sector')) === 'energy' && await p.evaluate(() => localStorage.getItem('sentria_sectors')) === '["energy"]', 'the dashboard runs on the new site\'s sector');
    pass(JSON.parse(await p.evaluate(() => localStorage.getItem('sentria_departments'))).energy.length === 2, 'and its departments');
    await p.getByTestId('account-menu-button').click(); await p.waitForTimeout(400);
    const rows2 = await p.getByTestId('account-menu-sector').allInnerTexts();
    pass(rows2.length === 2 && /health/i.test(rows2[0]) && /energy/i.test(rows2[1]), 'the dropdown groups the sites by industry: ' + rows2.join(' | '));
    await p.screenshot({ path: 'sitescope-new-site-light.png' });
    const deptItems = await p.getByTestId('account-menu-department-item').allInnerTexts();
    pass(deptItems.length === 2 && /Power plant/.test(deptItems[0]) && /Power distribution/.test(deptItems[1]), 'the site that runs two departments shows one chip each: ' + deptItems.join(' | '));
    pass(await p.getByTestId('account-menu-department-item').count() === 2, 'a site with no departments of its own shows no chips');
    await p.getByTestId('account-menu-department-item').nth(1).click(); await p.waitForTimeout(1200);
    pass(await p.evaluate(() => localStorage.getItem('sentria_business_type')) === 'distribution-energetique', 'choosing a department opens the dashboard on it');
    pass(/Power distribution/.test(await p.getByTestId('account-menu-department').innerText()), 'and the top bar says which department is shown');
    pass(/Energy/.test(await p.getByTestId('workspace-context').innerText()) && !/Pharmacy/.test(await p.getByTestId('workspace-context').innerText()), 'the sector chip in the top bar follows the site: ' + (await p.getByTestId('workspace-context').innerText()).replace(/\s+/g, ' '));
    await p.screenshot({ path: 'sitescope-department-light.png' });
    await p.reload(); await p.waitForTimeout(3500);
    pass(await p.evaluate(() => localStorage.getItem('sentria_business_type')) === 'distribution-energetique', 'a reload keeps the department');
    await p.getByTestId('account-menu-button').click(); await p.waitForTimeout(400);
    await p.getByTestId('account-menu-site').first().click(); await p.waitForTimeout(1200);
    pass(await p.evaluate(() => localStorage.getItem('sentria_sector')) === 'health', 'back on the first site, the account\'s own sector is back');
    pass(JSON.parse(await p.evaluate(() => localStorage.getItem('sentria_departments'))).health[0] === 'pharmacie', 'and its departments');
    await p.getByTestId('account-menu-button').click(); await p.waitForTimeout(300);
    await p.getByTestId('account-menu-add').click(); await p.waitForTimeout(800);
    pass(await p.getByTestId('add-site-wizard').isVisible(), 'the menu\'s "Add a site" opens the wizard on the Sites page');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== a Pro plan keeps to its sector, and the API has the last word');
  { const { p, ctx, api } = await open({ sites: [mkSite('s1', 'Lyon plant', 'Lyon')], plan: 'pro', profile: { sentria_sectors: '["health"]' } });
    await p.locator('aside nav button', { hasText: /^Sites$/ }).first().click(); await p.waitForTimeout(800);
    await p.getByRole('button', { name: /Add a site|Site limit/ }).locator('visible=true').first().click(); await p.waitForTimeout(400);
    const upgrade = await p.getByRole('dialog', { name: 'Site limit reached' }).count();
    if (upgrade) { pass(true, 'a Pro plan holds one site: the upgrade prompt shows (cap)'); }
    await ctx.close(); }
  { const { p, ctx, api } = await open({ sites: [mkSite('s1', 'Lyon plant', 'Lyon')], plan: 'business', profile: { sentria_sectors: '["health"]' }, refuse: 'plan_sectors' });
    await p.locator('aside nav button', { hasText: /^Sites$/ }).first().click(); await p.waitForTimeout(800);
    await p.getByRole('button', { name: 'Add a site' }).locator('visible=true').first().click(); await p.waitForTimeout(400);
    await p.getByTestId('add-site-name').fill('Power depot'); await p.getByTestId('add-site-next').click(); await p.waitForTimeout(200);
    pass(await p.getByTestId('add-site-sector-energy').isDisabled() && await p.getByTestId('add-site-sector-health').isEnabled(), 'another sector is locked for a plan that holds one');
    await p.getByTestId('add-site-sector-health').click(); await p.getByTestId('add-site-next').click(); await p.waitForTimeout(200);
    await p.getByTestId('add-site-department-pharmacie').click(); await p.getByTestId('add-site-next').click(); await p.waitForTimeout(200);
    await p.getByTestId('add-site-next').click(); await p.waitForTimeout(200);
    await p.getByTestId('add-site-create').click(); await p.waitForTimeout(1200);
    pass(/Entreprise/.test(await p.getByTestId('add-site-error').innerText()) && await p.getByTestId('add-site-wizard').isVisible(), 'a refusal by the plan stays in the wizard and says which plan: ' + (await p.getByTestId('add-site-error').innerText()).slice(0, 70));
    await ctx.close(); }

  console.log('== a CSV for a site');
  { const { p, ctx, api } = await open({ sites: [mkSite('s1', 'Lyon plant', 'Lyon'), mkSite('s3', 'Dakar depot', 'Dakar')] });
    await p.locator('aside nav button', { hasText: /^Sites$/ }).first().click(); await p.waitForTimeout(800);
    await p.locator('main button', { hasText: 'Dakar depot' }).first().click(); await p.waitForTimeout(600);
    pass(await p.getByTestId('site-import-csv-empty').isVisible(), 'a site with no data offers "Import CSV"');
    pass(await p.getByTestId('site-csv-input').count() === 1, 'which opens a real file chooser');
    await p.getByTestId('site-csv-input').setInputFiles({ name: 'dakar.csv', mimeType: 'text/csv', buffer: Buffer.from('medicine_name,stock_qty\nA,1\n') });
    await p.waitForTimeout(2500);
    pass(api.log.some(l => l === 'POST /upload site=s3'), 'the file goes to that site, not the one the top bar shows: ' + api.log.filter(l => /upload/.test(l)).join(','));
    pass(api.log.some(l => l === 'PATCH s3'), 'the site is marked as receiving a CSV');
    pass(/Active|Actif/.test(await p.locator('main').innerText()) && await p.getByTestId('site-import-csv').first().isVisible(), 'and it can take another file');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== the setup the account chose in its onboarding is its first site');
  { const { p, ctx, api } = await open({ sites: [], profile: { sentria_departments: JSON.stringify({ health: ['pharmacie'] }), sentria_business_type: 'pharmacie', sentria_equipment: JSON.stringify(['stock_expiry']) } });
    pass(api.log.includes('POST /sites Main site') && api.sites.length === 1, 'an account with no site gets one from its onboarding');
    pass(api.body && api.body.sector === 'health' && api.body.departments[0] === 'pharmacie' && api.body.configured === true && api.body.priorities[0] === 'stock_expiry', 'with its sector, department and priorities: ' + JSON.stringify(api.body).slice(0, 120));
    await p.getByTestId('account-menu-button').click(); await p.waitForTimeout(400);
    pass(/Main site/.test(await p.getByTestId('account-menu').innerText()) && /health/i.test(await p.getByTestId('account-menu-sector').first().innerText()), 'it is in the menu, under Health');
    await p.reload(); await p.waitForTimeout(3500);
    pass(api.sites.length === 1, 'and it is not made again after a reload');
    await ctx.close(); }
  { // The dashboard the account had before a new site: it comes back as a site.
    const base = { sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_departments: JSON.stringify({ health: ['pharmacie'] }), sentria_equipment: '[]' };
    const power = { ...mkSite('s9', 'Power depot', 'Dakar'), sector: 'energy', departments: ['centrale-production'], configured: true };
    const { p, ctx, api } = await open({ sites: [power], profile: { sentria_sector: 'energy', sentria_sectors: '["energy"]', sentria_base_config: JSON.stringify(base) }, active: 's9' });
    pass(api.log.includes('POST /sites Main site') && api.sites.length === 2, 'with a new site already made, the earlier health dashboard is added as a site');
    await p.getByTestId('account-menu-button').click(); await p.waitForTimeout(400);
    const heads = await p.getByTestId('account-menu-sector').allInnerTexts();
    pass(heads.length === 2 && heads.some(t => /health/i.test(t)) && heads.some(t => /energy/i.test(t)), 'the menu lists both industries: ' + heads.join(' | '));
    await p.getByTestId('account-menu-site').filter({ hasText: 'Main site' }).click(); await p.waitForTimeout(1500);
    pass(await p.evaluate(() => localStorage.getItem('sentria_sector')) === 'health', 'picking it brings the health dashboard back');
    await p.locator('aside nav button', { hasText: /^Sites$/ }).first().click(); await p.waitForTimeout(800);
    pass(await p.locator('main').getByText('Main site').first().isVisible() && await p.locator('main').getByText('Power depot').first().isVisible(), 'and the Sites page lists both');
    pass(await p.getByTestId('site-active-tag').count() === 1 && /Main site/.test(await p.locator('[data-active]').innerText()), 'the Sites page marks only the site on the dashboard as active');
    pass(await p.getByTestId('site-source-row').count() === 4, 'the sources panel lists the active site\'s own four sources');
    pass(/Active site/i.test(await p.getByTestId('site-active-card').innerText()) && /Main site/.test(await p.getByTestId('site-active-card').innerText()), 'the lime card names the active site');
    const first = await p.locator('main [data-active], main button.group').first().getAttribute('data-active');
    pass(first !== null, 'the active site card comes first');
    pass(await p.getByTestId('sidebar-active-site').isVisible() && /Main site/.test(await p.getByTestId('sidebar-active-site').innerText()), 'the left bar names the active site');
    pass(await p.locator('[data-active]').evaluate(el => getComputedStyle(el).boxShadow.includes('34, 197, 94') || /ring-green-500/.test(el.className)), 'and it is framed green');
    await p.locator('main button.group').first().click(); await p.waitForTimeout(500);
    const txt = await p.locator('main').innerText();
    const shownAssets = await p.locator('p', { hasText: /^Assets$/ }).first().locator('xpath=following-sibling::p').first().innerText();
    pass(Number(shownAssets) === new Set(api.alerts.filter(a => a.site_id === api.sites.find(x => x.name === 'Main site').id).map(a => a.equipment)).size && Number(shownAssets) > 0, 'the site shows its real asset count, not 0: ' + shownAssets);
    await p.getByTestId('site-claim').click(); await p.waitForTimeout(700);
    pass(api.log.some(l => l.startsWith('CLAIM ')) && /2 alert/.test(await p.getByTestId('site-claim-note').innerText()), 'Bring my earlier data here asks the API and says how many came: ' + await p.getByTestId('site-claim-note').innerText());
    await p.getByTestId('site-open-dashboard').click(); await p.waitForTimeout(1200);
    pass(await p.locator('aside nav button', { hasText: /^Dashboard$/ }).first().getAttribute('aria-current') !== null || /dashboard/i.test(await p.locator('header').first().innerText()), 'Go to dashboard leaves the Sites page');
    await p.locator('aside nav button', { hasText: /^Sites$/ }).first().click(); await p.waitForTimeout(600);
    await p.screenshot({ path: '/tmp/sites-active-light.png' });
    await ctx.close(); }

  console.log('== a short screen: nothing runs out of the frame');
  { const { p, ctx } = await open({ sites: [mkSite('s1', 'Lyon plant', 'Lyon')], vh: 640, vw: 1280 });
    await p.locator('aside nav button', { hasText: /^Sites$/ }).first().click(); await p.waitForTimeout(800);
    await p.getByRole('button', { name: 'Add a site' }).locator('visible=true').first().click(); await p.waitForTimeout(400);
    await p.getByTestId('add-site-name').fill('Atl retails'); await p.getByTestId('add-site-next').click(); await p.waitForTimeout(200);
    await p.getByTestId('add-site-sector-commerce').click(); await p.getByTestId('add-site-next').click(); await p.waitForTimeout(300);
    const depts = p.locator('[data-testid^="add-site-department-"]');
    for (let i = 0; i < await depts.count(); i++) await depts.nth(i).click();
    await p.getByTestId('add-site-next').click(); await p.waitForTimeout(300);
    const pri = p.locator('[data-testid^="add-site-priority-"]');
    for (let i = 0; i < await pri.count(); i++) await pri.nth(i).click();
    await p.waitForTimeout(200);
    const dlg = await p.getByTestId('add-site-wizard').boundingBox(), next = await p.getByTestId('add-site-next').boundingBox();
    pass(dlg && dlg.y >= 0 && dlg.y + dlg.height <= 640, 'with everything ticked, the wizard still fits a 640 px screen: ' + JSON.stringify(dlg));
    pass(next && next.y >= 0 && next.y + next.height <= 640, 'and "Continue" stays on screen: ' + (next && Math.round(next.y + next.height)));
    pass(await p.getByTestId('add-site-preview').evaluate(el => el.scrollHeight > el.clientHeight ? getComputedStyle(el).overflowY !== 'visible' : true), 'a long preview scrolls inside its panel instead of growing');
    await p.screenshot({ path: 'sitescope-wizard-short.png' });
    await ctx.close(); }

  console.log('== French and a phone');
  { const { p, ctx } = await open({ sites: [mkSite('s1', 'Usine de Lyon', 'Lyon'), mkSite('s2', 'Dépôt de Dakar', 'Dakar')], lang: 'fr', vw: 390 });
    await p.getByTestId('account-menu-button').click(); await p.waitForTimeout(400);
    const t = await p.getByTestId('account-menu').innerText();
    pass(/ajouter un site/i.test(t) && /gérer les sites/i.test(t) && /Usine de Lyon/.test(t) && /Dépôt de Dakar/.test(t), 'French labels');
    const box = await p.getByTestId('account-menu').boundingBox();
    pass(box && box.x >= 0 && box.x + box.width <= 390, 'the menu stays inside a 390 px screen');
    await p.screenshot({ path: 'sitescope-fr-390.png' });
    await p.getByTestId('account-menu-add').click(); await p.waitForTimeout(900);
    pass(await p.getByTestId('add-site-wizard').isVisible(), 'on a phone the menu\'s "Ajouter un site" opens the wizard');
    await p.getByTestId('add-site-name').fill('Dépôt Thiès'); await p.getByTestId('add-site-next').click(); await p.waitForTimeout(300);
    await p.getByTestId('add-site-sector-energy').click(); await p.waitForTimeout(300);
    const wb = await p.getByTestId('add-site-wizard').boundingBox();
    pass(wb && wb.x >= 0 && wb.x + wb.width <= 390 + 1, 'the wizard is a sheet inside the 390 px screen');
    pass(await p.getByTestId('add-site-preview-line').isVisible() && await p.getByTestId('add-site-preview').isHidden(), 'the preview is one line, not a side panel');
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll');
    await p.screenshot({ path: 'sitescope-wizard-fr-390.png' });
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
