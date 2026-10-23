// The Report page: one report, two tabs. The story first (headline, what needs you now, the plan),
// the figures behind it second (key figures, trends, the alerts table). One Export as PDF above the tabs,
// and printing shows both. Light, dark, French, 390 px.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const NAMES = ['Fridge-3', 'Paracetamol 500 mg', 'Artemether 80 mg', 'Freezer-1', 'Insulin pens', 'Fridge-3', 'Fridge-3'];
const SEV = ['CRITICAL', 'CRITICAL', 'WARNING', 'WARNING', 'CRITICAL', 'CRITICAL', 'WARNING'];
const dates = NAMES.map((_, i) => new Date(Date.now() - (i * 9 + 2) * 3600e3).toISOString());
const alerts = NAMES.map((n, i) => ({ id: i + 1, equipment: n, sector: 'health', business_type: 'pharmacie', severity: SEV[i], date: dates[i], alert_key: 'health.cold.high' + i, message: 'MSG ' + n, risk_score: 81 - i, params: [['value', 1240], ['currency', '€']] }));

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ theme = 'light', width = 1440, height = 900, lang = 'en' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(alerts) }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: [] }) }));
    await p.route(/\/(contractors|assignments)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"contractors":[],"assignments":[]}' }));
    await p.addInitScript(([l, t]) => { const s = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: l, sentria_company_name: 'Acme', sentria_theme: t }; for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, [lang, theme]);
    await signedIn(p, 'u', 'a@b.c'); await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    if (width < 500) await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click().catch(() => {});
    await p.locator('aside').getByRole('button', { name: lang === 'fr' ? /^Rapport$/ : /^Report$/ }).click(); await p.waitForTimeout(1800);
    return { p, ctx, main: p.locator('main') };
  };

  console.log('== desktop, light');
  let { p, ctx, main } = await open();
  let t = (await main.innerText()).replace(/\s+/g, ' ');
  const tabs = p.getByRole('tablist', { name: 'Report' });
  pass(await tabs.count() === 1 && await tabs.getByRole('tab').count() === 2, 'one tab switch with two tabs');
  pass(await p.getByRole('tab', { name: 'The story' }).getAttribute('aria-selected') === 'true', 'The story is open first');
  pass(/critical things need you/i.test(t) && /What needs you now/.test(t) && /The plan/i.test(t), 'the story shows the headline, what needs you now and the plan');
  pass(!/Key figures/i.test(t) && !/The period/.test(t), 'the figures are not on the story tab');
  pass(!/The figures behind the story/.test(t), 'the old "figures behind the story" heading is gone');
  pass(await p.getByRole('button', { name: /Export as PDF/ }).count() === 1, 'one Export as PDF button');
  await p.screenshot({ path: 'reportui-story-light.png' });
  await p.getByRole('tab', { name: 'The figures' }).click(); await p.waitForTimeout(500);
  t = (await main.innerText()).replace(/\s+/g, ' ');
  pass(/Key figures/i.test(t) && /Alerts in all\s*7/.test(t) && /Critical\s*4/.test(t), 'the figures tab: key figures and the period card (7 alerts, 4 critical)');
  pass(!/What needs you now/.test(t), 'the story is not on the figures tab');
  pass(await p.getByRole('button', { name: /Export as PDF/ }).count() === 1, 'still one Export as PDF button');
  pass(await p.getByRole('tab', { name: 'The figures' }).getAttribute('aria-selected') === 'true', 'the tab follows');
  await p.screenshot({ path: 'reportui-figures-light.png' });
  await p.getByRole('tab', { name: 'The figures' }).focus(); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(300);
  pass(await p.getByRole('tab', { name: 'The story' }).getAttribute('aria-selected') === 'true', 'the arrow keys switch the tabs');
  console.log('== printing shows both');
  await p.emulateMedia({ media: 'print' }); await p.waitForTimeout(300);
  const both = await p.evaluate(() => ['report-panel-story', 'report-panel-figures'].map(id => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.height > 40; }));
  pass(both[0] && both[1], 'in print both panels take space: ' + both.join(','));
  const vis = await p.evaluate(() => ['report-panel-story', 'report-panel-figures'].map(id => getComputedStyle(document.getElementById(id)).visibility));
  pass(vis.every(v => v === 'visible'), 'and are visible: ' + vis.join(','));
  await p.emulateMedia({ media: 'screen' });
  pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
  await ctx.close();

  console.log('== French, dark, phone');
  ({ p, ctx, main } = await open({ lang: 'fr' }));
  pass(await p.getByRole('tab', { name: 'Le récit' }).count() === 1 && await p.getByRole('tab', { name: 'Les chiffres' }).count() === 1 && await p.getByRole('button', { name: /Exporter en PDF/ }).count() === 1, 'in French');
  await ctx.close();
  ({ p, ctx, main } = await open({ theme: 'dark' })); await p.screenshot({ path: 'reportui-story-dark.png' }); await ctx.close();
  ({ p, ctx, main } = await open({ width: 390, height: 844 }));
  pass(await p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth) <= 0, 'no sideways scroll at 390 px');
  await p.screenshot({ path: 'reportui-story-phone.png' }); await ctx.close();

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
