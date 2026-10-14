// An empty CSV can be downloaded before anything is imported: the header row for the department
// (else the sector) in the import panel, and for a site's sector on its page. Checks: the file's
// content for each sector, the department winning over its sector, the site page, French, a phone.
const { chromium } = require('playwright');
const fs = require('fs');
const { LAUNCH, APP_URL } = require('./env');
const { mockSupabase, session, STORAGE_KEY } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const UID = 'u-csv', EMAIL = 'a@b.c';

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ sector = 'health', business = 'pharmacie', sectors, lang = 'en', vw = 1440, site = null } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US', acceptDownloads: true });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    const profile = { sentria_onboarded: '1', sentria_sector: sector, sentria_sectors: JSON.stringify(sectors || [sector]), sentria_business_type: business, sentria_company_name: 'Acme', sentria_language: lang };
    if (site) profile.sentria_sites = JSON.stringify([site]);
    const db = { users: { [EMAIL]: { uid: UID, password: 'x' } }, accounts: { [UID]: { profile, plan: 'entreprise' } } };
    await mockSupabase(p, db, { plan: 'entreprise' });
    await p.addInitScript(({ key, s }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s)); }, { key: STORAGE_KEY, s: session(UID, EMAIL, {}) });
    await p.goto(APP_URL); await p.waitForTimeout(3000);
    return { p, ctx };
  };
  const openImport = async (p, lang = 'en') => { await p.getByRole('button', { name: lang === 'fr' ? 'Importer des données' : 'Import data' }).click(); await p.waitForTimeout(500); };
  const download = async p => {
    const [d] = await Promise.all([p.waitForEvent('download'), p.getByTestId('csv-template').first().click()]);
    const file = await d.path();
    return { name: d.suggestedFilename(), text: fs.readFileSync(file, 'utf8') };
  };

  console.log('== the import panel');
  { const { p, ctx } = await open({ sector: 'health', business: 'pharmacie' });
    await openImport(p);
    pass(await p.getByTestId('csv-template').first().isVisible(), 'the import panel offers an empty CSV');
    const f = await download(p);
    pass(f.text === 'medicine_name,stock_qty,min_stock,sales_last_30_days,unit_cost,expiry_date\n', 'a pharmacy gets its own columns, and nothing else in the file: ' + JSON.stringify(f.text));
    pass(f.name === 'sentria-pharmacie-template.csv', 'named for the department: ' + f.name);
    await p.screenshot({ path: 'csvtemplate-light.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }
  for (const [sector, business, first] of [['industry', null, 'Product ID'], ['agriculture', null, 'product_name'], ['energy', null, 'generator_id'], ['transportation', null, 'truck_id'], ['logistics', null, 'equipment_id']]) {
    const { p, ctx } = await open({ sector, business });
    await openImport(p);
    const f = await download(p);
    pass(f.text.startsWith(first) && f.text.trim().split('\n').length === 1 && /^sentria-.+-template\.csv$/.test(f.name), `${sector}: a header row only, starting with ${first} (${f.name}: ${JSON.stringify(f.text.slice(0, 50))})`);
    await ctx.close();
  }

  console.log('== a site');
  { const site = { id: 'x1', name: 'Dakar depot', location: 'Dakar', sector: 'agriculture', status: 'offline', synced: false, sources: ['csv', 'api', 'iot'].map(type => ({ type, connected: false, synced: false })) };
    const { p, ctx } = await open({ sector: 'industry', site });
    await p.locator('aside nav button', { hasText: /^Sites$/ }).first().click(); await p.waitForTimeout(800);
    await p.getByText('Dakar depot').first().click(); await p.waitForTimeout(600);
    const f = await download(p);
    pass(f.text.startsWith('product_name,days_in_storage,storage_temp'), 'a new site gets the columns of its own sector (agriculture), not the account\'s: ' + JSON.stringify(f.text));
    await ctx.close(); }

  console.log('== French and a phone');
  { const { p, ctx } = await open({ sector: 'health', business: 'pharmacie', lang: 'fr', vw: 390 });
    await p.getByRole('button', { name: /Ouvrir.*(menu|navigation)/i }).first().isVisible().catch(() => {});
    await openImport(p, 'fr');
    pass(/Télécharger un CSV vide/.test(await p.getByTestId('csv-template').first().innerText()), 'French label');
    await p.screenshot({ path: 'csvtemplate-fr-390.png' });
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll at 390 px');
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
