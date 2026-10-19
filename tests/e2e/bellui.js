// The bell dropdown: a count header, sector chips that filter, one row per
// critical alert in plain words, a link to tracking. Light, dark and 390 px.
process.env.TZ = 'Europe/Paris';
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const ago = h => new Date(Date.now() - h * 3600e3).toISOString();
const A = (id, eq, sector, bt, msg, h) => ({ id, equipment: eq, sector, business_type: bt, severity: 'CRITICAL', date: ago(h), alert_key: `${sector}.x${id}`, message: msg });
const ROWS = [
  A(1, 'Fridge 2', 'health', 'pharmacie', 'Fridge 2 is too hot: 11°C, max 8°C', 0.2),
  A(2, 'Amoxicillin', 'health', 'pharmacie', 'Amoxicillin runs out in 2 days', 2),
  A(3, 'Oven 1', 'industry', 'usine-production', 'Oven 1 pressure is above the limit', 26),
];
const LS = { sentria_sector: 'health', sentria_sectors: '["industry","health"]', sentria_business_type: 'pharmacie', sentria_departments: '{"industry":["usine-production"]}' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  async function open({ theme = 'light', width = 1440, rows = ROWS } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, timezoneId: 'Europe/Paris', locale: 'en-US' });
    const p = await ctx.newPage(); p._errors = [];
    p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => {
      const path = new URL(r.request().url()).pathname;
      const json = b => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
      if (path === '/alerts') return json(rows);
      if (path === '/freshness') return json({ freshness: [], persisted: false, stale_after_days: 7 });
      return json({ recommendations: [], assignments: [], contractors: [] });
    });
    await p.addInitScript(l => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(l)) localStorage.setItem(k, v); } },
      { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_theme: theme, ...LS });
    await signedIn(p, 'u', 'ama@acme.test', { plan: 'entreprise', isAdmin: true });
    await p.goto(APP_URL); await p.waitForTimeout(2200);
    await p.getByRole('button', { name: /notification|critical/i }).first().click(); await p.waitForTimeout(500);
    return { ctx, p, dlg: p.getByRole('dialog', { name: /Critical alerts/ }) };
  }
  const overflow = p => p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);

  console.log('== desktop, light');
  let x = await open();
  pass((await x.dlg.locator('[data-bell-count]').innerText()).trim() === '3', 'header counts 3');
  pass(/critical alerts to handle/.test(await x.dlg.innerText()), 'header sentence');
  pass(await x.dlg.locator('li').count() === 3, 'one row per alert');
  pass(/Fridge 2 is too hot/.test(await x.dlg.innerText()), 'the row says the problem first');
  pass(/12 min ago/.test(await x.dlg.innerText()) && !/\d{2}\/\d{2}\/\d{4}/.test(await x.dlg.locator('li').first().innerText()), 'a recent alert reads "12 min ago", not a date');
  pass(await x.dlg.locator('li').first().getByText('Critical', { exact: true }).count() === 1, 'each row carries a Critical tag');
  pass(await x.dlg.locator('[data-bell-chip]').count() === 3, 'chips: All, Health, Industry');
  await x.dlg.locator('[data-bell-chip="health"]').click();
  pass(await x.dlg.locator('li').count() === 2 && (await x.dlg.locator('[data-bell-count]').innerText()).trim() === '3', 'Health chip filters to 2 rows, total stays 3');
  await x.dlg.locator('[data-bell-chip="all"]').click();
  pass(await x.dlg.locator('li').count() === 3, 'All brings them back');
  await x.p.screenshot({ path: 'bellui-light.png' });
  await x.p.keyboard.press('Escape');
  await x.p.getByRole('button', { name: /notification|critical/i }).first().click(); await x.p.waitForTimeout(400);
  pass(await x.p.getByRole('dialog', { name: /Critical alerts/ }).locator('[data-bell-chip="all"]').getAttribute('aria-pressed') === 'true', 'reopening resets the chip to All');
  await x.dlg.locator('li button').first().click(); await x.p.waitForTimeout(800);
  pass(await x.p.getByRole('dialog', { name: /Critical alerts/ }).count() === 0, 'a row closes the list and opens tracking');
  pass(x.p._errors.length === 0, 'no page errors ' + x.p._errors.join('|'));
  await x.ctx.close();

  console.log('== one sector only: no chips');
  x = await open({ rows: ROWS.slice(0, 2) });
  pass(await x.dlg.locator('[data-bell-chip]').count() === 0, 'a single sector shows no chips');
  pass(/critical alerts to handle/.test(await x.dlg.innerText()), 'count 2 plural');
  await x.ctx.close();

  console.log('== one alert: singular');
  x = await open({ rows: ROWS.slice(0, 1) });
  pass(/critical alert to handle/.test(await x.dlg.innerText()), 'singular sentence');
  await x.ctx.close();

  console.log('== dark');
  x = await open({ theme: 'dark' });
  await x.p.screenshot({ path: 'bellui-dark.png' });
  await x.ctx.close();

  console.log('== 390 px');
  x = await open({ width: 390 });
  const box = await x.dlg.boundingBox();
  pass(box.x >= 0 && box.x + box.width <= 390, `list fits the phone (${Math.round(box.x)}..${Math.round(box.x + box.width)})`);
  pass(await overflow(x.p) <= 0, 'no sideways scroll');
  await x.p.screenshot({ path: 'bellui-phone.png' });
  await x.ctx.close();

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
