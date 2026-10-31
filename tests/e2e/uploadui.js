// The import dropdown: a lime header (where the file goes + sector tabs),
// the department as visible choices, a file row. Light, dark, 390 px, French.
process.env.TZ = 'Europe/Paris';
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const LS = { sentria_sector: 'health', sentria_sectors: '["industry","health"]', sentria_business_type: 'pharmacie', sentria_departments: '{"health":["pharmacie","clinique"],"industry":["usine-production"]}' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  async function open({ theme = 'light', width = 1440, lang = 'en' } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, timezoneId: 'Europe/Paris', locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = [];
    p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => {
      const path = new URL(r.request().url()).pathname;
      const json = b => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
      if (path === '/alerts') return json([]);
      if (path === '/freshness') return json({ freshness: [], persisted: false, stale_after_days: 7 });
      return json({ recommendations: [], assignments: [], contractors: [] });
    });
    await p.addInitScript(l => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(l)) localStorage.setItem(k, v); } },
      { sentria_language: lang, sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_theme: theme, ...LS });
    await signedIn(p, 'u', 'ama@acme.test', { plan: 'entreprise', isAdmin: true });
    await p.goto(APP_URL); await p.waitForTimeout(2200);
    await p.click('button[aria-controls=import-panel]'); await p.waitForTimeout(500);
    return { ctx, p, panel: p.locator('#import-panel') };
  }

  console.log('== desktop, light');
  let x = await open();
  let t = await x.panel.innerText();
  pass(/IMPORTING INTO/i.test(t), 'header says where the file goes');
  pass(await x.panel.locator('[class*="bg-accent "] button[aria-pressed]').count() >= 2, 'sector tabs are in the lime header');
  pass(await x.panel.getByRole('group', { name: /Which department/ }).getByRole('button').count() >= 2, 'departments are visible buttons');
  pass(await x.panel.locator('input[type=file]').count() === 1, 'one file input');
  pass(!/1 · Sector|3 · The file/.test(t), 'the old numbered steps are gone');
  const scroll = await x.panel.evaluate(el => el.scrollHeight - el.clientHeight);
  pass(scroll <= 1, `no scroll bar inside the card (${scroll})`);
  await x.panel.getByRole('button', { name: 'Health', exact: true }).click(); await x.p.waitForTimeout(200);
  const dep = x.panel.getByRole('group', { name: /Which department/ }).getByRole('button').first();
  const first = await dep.innerText();
  const rows = await x.panel.getByRole('group', { name: /Which department/ }).getByRole('button').evaluateAll(els => els.map(e => ({ text: e.innerText.trim(), glyph: !!e.querySelector('[data-department-icon]') })));
  pass(rows.length >= 3 && rows.every(r => r.text && !r.glyph), 'each department is a plain labelled row, no glyph: ' + rows.map(r => r.text).join(' | '));
  pass(!/[\u{1F300}-\u{1FAFF}]/u.test(first), 'and no emoji in the row');
  const second = x.panel.getByRole('group', { name: /Which department/ }).getByRole('button').nth(1);
  await second.click(); await x.p.waitForTimeout(150);
  pass(await second.getAttribute('aria-pressed') === 'true' && (await x.panel.locator('h3').innerText()).includes((await second.innerText()).trim()), 'picking a department updates the header');
  pass(await x.panel.locator('[data-supplier-columns]').count() === 1, 'Health shows the supplier columns');
  await x.panel.getByRole('button', { name: 'Industry', exact: true }).click(); await x.p.waitForTimeout(200);
  pass(await x.panel.locator('[data-cost-columns]').count() === 1 && /units_per_hour/.test(await x.panel.innerText()), 'Industry shows the cost columns');
  pass(/Industry/.test(await x.panel.locator('h3').innerText()), 'header follows the sector');
  await x.p.screenshot({ path: 'uploadui-light.png' });
  await x.p.keyboard.press('Escape'); await x.p.waitForTimeout(300);
  pass(await x.panel.isHidden(), 'Escape closes it');
  pass(x.p._errors.length === 0, 'no page errors ' + x.p._errors.join('|'));
  await x.ctx.close();

  console.log('== French');
  x = await open({ lang: 'fr' });
  t = await x.panel.innerText();
  pass(/IMPORT DANS/i.test(t) && /Choisir un fichier CSV/.test(t), 'French header and file row');
  await x.ctx.close();

  console.log('== dark');
  x = await open({ theme: 'dark' });
  await x.p.screenshot({ path: 'uploadui-dark.png' });
  await x.ctx.close();

  console.log('== 390 px');
  x = await open({ width: 390 });
  const box = await x.panel.boundingBox();
  pass(box.x >= 0 && box.x + box.width <= 390, `fits the phone (${Math.round(box.x)}..${Math.round(box.x + box.width)})`);
  pass(await x.p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth) <= 0, 'no sideways scroll');
  await x.p.screenshot({ path: 'uploadui-phone.png' });
  await x.ctx.close();

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
