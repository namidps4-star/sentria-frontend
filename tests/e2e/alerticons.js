// The alert rows wear a 3D icon on a severity chip instead of a dot, in every
// sector. Checks: the icon follows the alert's family (key, then words, then
// the sector), every row has one, the chip carries the severity, nothing
// moves while the icons load, light, dark and a phone, French.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const at = n => new Date(Date.now() - n * 36e5).toISOString();
const A = (sector, equipment, key, severity, hrs, message) => ({ id: equipment + hrs, equipment, sector, business_type: null, severity, date: at(hrs), alert_key: key, message });
// [alert, expected icon]
const CASES = [
  [A('health', 'Paracetamol 500 mg', 'health.stock.low', 'CRITICAL', 3, 'Out of stock in 3 days'), 'pill'],
  [A('health', 'Vaccine fridge 2', 'health.cold_chain.break', 'CRITICAL', 5, 'Cold chain broken'), 'cold'],
  [A('health', 'Artemether 80 mg', 'health.temperature.high', 'WARNING', 30, 'Shelf at 27 C'), 'temperature'],
  [A('health', 'Ceftriaxone 1 g', 'health.expiry.soon', 'WARNING', 8, 'Expires in 21 days'), 'expiry'],
  [A('transportation', 'Truck 12', 'transport.oil.critical_low', 'CRITICAL', 9, 'Oil pressure low'), 'oil'],
  [A('transportation', 'Truck 14', 'transport.service.due', 'WARNING', 11, 'Service due'), 'service'],
  [A('logistics', 'Reefer 3', 'logistics.fuel.warning', 'WARNING', 12, 'Fuel at 12 %'), 'fuel'],
  [A('logistics', 'Dock 2', 'logistics.wait.critical', 'CRITICAL', 14, 'Wait over limit'), 'wait'],
  [A('industry', 'Press 4', 'industry.maintenance.production_link', 'WARNING', 16, 'Maintenance link'), 'maintenance'],
  [A('industry', 'Mixer 1', 'industry.failure.signature_match', 'CRITICAL', 18, 'Failure signature'), 'failure'],
  [A('energy', 'Battery bank', 'energy.battery.low', 'WARNING', 20, 'Charge low'), 'battery'],
  [A('commerce', 'Aisle 5', 'commerce.shrinkage.high', 'CRITICAL', 22, 'Shrinkage above normal'), 'shrinkage'],
  [A('agriculture', 'Field 2', 'agriculture.irrigation.low', 'WARNING', 24, 'Soil dry'), 'water'],
  // unknown key: the words decide, then the sector, then a plain warning
  [A('energy', 'Pump A', 'energy.weird.thing', 'WARNING', 26, 'Fuel level odd'), 'fuel'],
  [A('commerce', 'Till 3', 'commerce.weird.thing', 'WARNING', 28, 'Something odd'), 'cart'],
  [A('other', 'Thing', 'x', 'WARNING', 30, 'Something odd'), 'warning'],
];
const SECTORS = ['health', 'transportation', 'logistics', 'industry', 'energy', 'commerce', 'agriculture'];
const LS = {
  sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: 'all', sentria_sectors: JSON.stringify(SECTORS),
};

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ lang = 'en', theme = 'light', vw = 1440, hold = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vw < 500 ? 844 : 900 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    const DATA = CASES.map(c => c[0]);
    await p.route(/onrender\.com\//, async r => {
      const u = r.request().url();
      if (/\/alerts/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DATA) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: /\/recommendations/.test(u) ? JSON.stringify({ recommendations: [] }) : '{"assignments":[],"contractors":[]}' });
    });
    if (hold) await p.route(/alert-icon-data|alert_icon_data/, r => setTimeout(() => r.continue(), 1500));
    await p.addInitScript(v => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, val] of Object.entries(v)) localStorage.setItem(k, val); } }, { ...LS, sentria_language: lang, sentria_theme: theme });
    await signedIn(p, 'u-1', 'ama@acme.test', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(3500);
    return { p, ctx };
  };
  const icons = p => p.locator('#alerts-table [data-alert-icon]').evaluateAll(els => els.map(e => ({ name: e.getAttribute('data-alert-icon'), svg: !!e.querySelector('svg path, svg g, svg defs'), row: e.closest('tr').innerText.split('\n')[0].trim(), bg: getComputedStyle(e).backgroundColor, w: Math.round(e.getBoundingClientRect().width) })));

  console.log('== every row in every sector has the right icon');
  { const { p, ctx } = await open();
    await p.locator('#alerts-table').scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
    const got = await icons(p);
    pass(got.length === CASES.length, `one icon for each of the ${CASES.length} rows (${got.length})`);
    for (const [a, want] of CASES) {
      const g = got.find(x => x.row === a.equipment);
      pass(!!g && g.name === want, `${a.equipment}: ${want} (${g && g.name})`);
    }
    pass(got.every(g => g.svg), 'every chip holds a drawn icon');
    pass(got.every(g => g.w === 30), 'every chip is 30 px wide');
    const crit = got.filter(g => CASES.find(c => c[0].equipment === g.row)[0].severity === 'CRITICAL');
    const warn = got.filter(g => CASES.find(c => c[0].equipment === g.row)[0].severity !== 'CRITICAL');
    pass(new Set(crit.map(g => g.bg)).size === 1 && new Set(warn.map(g => g.bg)).size === 1 && crit[0].bg !== warn[0].bg, 'the chip colour carries the severity: critical and warning differ');
    pass(await p.locator('#alerts-table tbody span.rounded-full.h-1\\.5').count() === 0, 'no severity dot is left in the table');
    await p.screenshot({ path: 'alerticons-light.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== a row does not move while the icons load');
  { const { p, ctx } = await open({ hold: true });
    await p.locator('#alerts-table').scrollIntoViewIfNeeded();
    const early = await p.locator('#alerts-table tbody tr').first().boundingBox();
    await p.waitForTimeout(3000);
    const late = await p.locator('#alerts-table tbody tr').first().boundingBox();
    pass(Math.abs(early.height - late.height) < 1, `the row keeps its height (${Math.round(early.height)} then ${Math.round(late.height)})`);
    await ctx.close(); }

  console.log('== French, dark, a phone');
  { const { p, ctx } = await open({ lang: 'fr', theme: 'dark' });
    await p.locator('#alerts-table').scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
    const got = await icons(p);
    pass(got.length === CASES.length && got.every(g => g.svg), `French and dark: ${got.length} icons drawn`);
    await p.screenshot({ path: 'alerticons-dark.png' });
    await ctx.close(); }
  { const { p, ctx } = await open({ vw: 390 });
    await p.locator('#alerts-table').scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
    const got = await icons(p);
    pass(got.length === CASES.length && got.every(g => g.svg && g.w === 30), 'a phone: icons drawn at full size');
    const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    pass(!over, 'no sideways scroll on the page');
    await p.screenshot({ path: 'alerticons-390.png' });
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
