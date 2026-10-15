// The Sites page is real: a site is saved with the account, survives a reload, comes back on another
// device, keeps the data source that was switched on, and can be deleted (after a confirmation).
// Checks: add, reload, account row, connect a source, cancel and confirm delete, French, a phone.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { mockSupabase, session, STORAGE_KEY } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const UID = 'u-sites', EMAIL = 'a@b.c';
const PROFILE = { sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_language: 'en' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ db, lang = 'en', theme = 'light', vw = 1440 } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 1000 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    db = db || { users: { [EMAIL]: { uid: UID, password: 'x' } }, accounts: { [UID]: { profile: { ...PROFILE, sentria_language: lang, sentria_theme: theme }, plan: 'entreprise' } } };
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await mockSupabase(p, db, { plan: 'entreprise' });
    await p.addInitScript(({ key, s }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s)); }, { key: STORAGE_KEY, s: session(UID, EMAIL, {}) });
    await p.goto(APP_URL); await p.waitForTimeout(3000);
    if (vw < 768) { await p.getByRole('button', { name: /(open|ouvrir).*(menu|navigation)/i }).first().click(); await p.waitForTimeout(400); }
    await p.locator('aside nav button', { hasText: lang === 'fr' ? /^Sites$/ : /^Sites$/ }).first().click(); await p.waitForTimeout(700);
    return { p, ctx, db };
  };
  const stored = db => JSON.parse(db.accounts[UID].profile.sentria_sites || '[]');
  const add = async (p, name, place) => {
    await p.getByRole('button', { name: /Add a site|Ajouter un site/ }).locator('visible=true').first().click(); await p.waitForTimeout(250);
    await p.getByPlaceholder(/e\.g\. Lyon plant|Ex\. Usine Lyon/).fill(name);
    if (place) { const loc = p.locator('input').nth(1); await loc.fill(place).catch(() => {}); }
    await p.getByRole('button', { name: /Create the site|Créer le site/ }).click(); await p.waitForTimeout(600);
  };

  console.log('== add, reload, another device');
  let db;
  { const o = await open(); db = o.db; const { p, ctx } = o;
    await add(p, 'Lyon plant');
    pass(stored(db).length === 1 && stored(db)[0].name === 'Lyon plant', 'the account holds the new site');
    await p.screenshot({ path: 'sitespersist-detail-light.png' });
    await p.reload(); await p.waitForTimeout(3000);
    await p.locator('aside nav button', { hasText: /^Sites$/ }).first().click(); await p.waitForTimeout(700);
    pass(await p.getByText('Lyon plant').first().isVisible(), 'a reload still shows it');
    pass(!/No sites yet|Aucun site/.test(await p.locator('main').innerText()), 'and not the empty state');
    await ctx.close(); }
  { const { p, ctx } = await open({ db });
    pass(await p.getByText('Lyon plant').first().isVisible(), 'a new browser signed in to the same account shows it');
    await p.screenshot({ path: 'sitespersist-list-light.png' });
    await ctx.close(); }

  console.log('== a data source is only connected by real data');
  { const { p, ctx } = await open({ db });
    await p.getByText('Lyon plant').first().click(); await p.waitForTimeout(500);
    pass(await p.getByTestId('site-import-csv').first().isVisible() && await p.getByTestId('site-csv-input').count() === 1, 'the CSV row offers a real file import');
    pass(await p.getByTestId('source-not-live').count() === 3, 'API, ERP and IoT say they are not live yet: nothing to "connect"');
    pass(!(await p.getByRole('button', { name: /^Connect$/ }).count()), 'and no button flips a source to connected');
    pass(stored(db)[0].sources.every(s => !s.connected) && stored(db)[0].status === 'offline', 'so the account holds nothing as connected');
    await ctx.close(); }

  console.log('== delete');
  { const { p, ctx } = await open({ db });
    await p.getByText('Lyon plant').first().click(); await p.waitForTimeout(500);
    await p.getByTestId('site-delete').click(); await p.waitForTimeout(200);
    await p.getByRole('button', { name: 'Cancel' }).click(); await p.waitForTimeout(200);
    pass(stored(db).length === 1 && await p.getByTestId('site-delete').count() === 1, 'Cancel keeps the site');
    await p.getByTestId('site-delete').click(); await p.waitForTimeout(200);
    await p.getByTestId('site-delete-confirm').click(); await p.waitForTimeout(600);
    pass(stored(db).length === 0, 'Yes, delete removes it from the account');
    pass(!(await p.locator('main').innerText()).includes('Lyon plant'), 'and from the page');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== French and a phone');
  { const o = await open({ lang: 'fr', vw: 390, theme: 'dark' }); const { p, ctx } = o;
    await add(p, 'Usine de Lyon');
    pass(stored(o.db).length === 1, 'adds a site in French on a phone');
    await p.getByTestId('site-delete').click(); await p.waitForTimeout(200);
    pass(/Oui, supprimer/.test(await p.locator('main').innerText()), 'the delete confirmation is in French');
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll at 390 px');
    await p.screenshot({ path: 'sitespersist-fr-dark-390.png' });
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
