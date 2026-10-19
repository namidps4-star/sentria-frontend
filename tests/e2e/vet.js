// H-VET step 1: the Vet department. It is a health department of its own: the empty CSV carries the batch and
// expiry columns, the department is named on the dashboard, and the French and phone views hold.
const { chromium } = require('playwright');
const fs = require('fs');
const { LAUNCH, APP_URL } = require('./env');
const { mockSupabase, session, STORAGE_KEY } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const UID = 'u-csv', EMAIL = 'a@b.c';

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ sector = 'health', business = 'pharmacie', sectors, lang = 'en', vw = 1440, site = null, serverSites = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US', acceptDownloads: true });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    if (serverSites) await p.route(/\/sites$/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sites: [], persisted: true, max_sites: 50 }) }));
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
  { const { p, ctx } = await open({ sector: 'health', business: 'veterinaire' });
    await openImport(p);
    const f = await download(p);
    pass(f.text === 'medicine_name,batch_number,stock_qty,min_stock,sales_last_30_days,unit_cost,expiry_date,fridge_temp\n', 'a vet outlet gets the batch and expiry columns: ' + JSON.stringify(f.text));
    pass(f.name === 'sentria-veterinaire-template.csv', 'named for the department: ' + f.name);
    await p.getByTestId('csv-template').first().scrollIntoViewIfNeeded(); await p.screenshot({ path: 'vet-light.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== its icon');
  { const { p, ctx } = await open({ sector: 'health', business: 'pharmacie', sectors: ['health'], serverSites: true });
    await p.getByRole('button', { name: /^Sites$/ }).first().click(); await p.waitForTimeout(600);
    await p.getByRole('button', { name: 'Add a site' }).locator('visible=true').first().click(); await p.waitForTimeout(400);
    await p.getByPlaceholder('e.g. Lyon plant').fill('Vet clinic');
    await p.getByTestId('add-site-next').click(); await p.waitForTimeout(400);
    await p.getByRole('button', { name: /^Health/ }).click(); await p.waitForTimeout(300);
    await p.getByTestId('add-site-next').click(); await p.waitForTimeout(500);
    const vet = p.getByRole('button', { name: /^Veterinary/ }), lab = p.getByRole('button', { name: /^Laboratory/ });
    pass(await vet.count() === 1, 'the new-site wizard offers the Vet department');
    const vetSvg = await vet.locator('svg').first().innerHTML().catch(() => ''), labSvg = await lab.locator('svg').first().innerHTML().catch(() => '');
    pass(vetSvg.length > 50 && vetSvg !== labSvg, 'with its own paw icon, not the laboratory one');
    await vet.scrollIntoViewIfNeeded(); await p.screenshot({ path: 'vet-icon-light.png' });
    await ctx.close(); }

  console.log('== its picture');
  { const ctx = await browser.newContext(); const r = await ctx.request.get(APP_URL.replace(/\/$/, '') + '/veterinaire.png');
    pass(r.status() === 200 && /image\/png/.test(r.headers()['content-type'] || '') && (await r.body()).length > 1000, 'the Vet picture is served as a PNG');
    await ctx.close(); }

  console.log('== French, dark, phone');
  { const { p, ctx } = await open({ sector: 'health', business: 'veterinaire', lang: 'fr', vw: 390 });
    await openImport(p, 'fr');
    const f = await download(p);
    pass(f.text.startsWith('medicine_name,batch_number'), 'the same columns in French');
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll at 390 px');
    await p.screenshot({ path: 'vet-390-fr.png' });
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
