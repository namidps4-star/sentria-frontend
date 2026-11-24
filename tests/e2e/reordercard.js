// The order card on a Tracking board card (F-JIT): the order line and the days-of-stock bar replace
// the action sentence when the recommendation carries the reorder numbers. English and French,
// light, dark, 390 px. A card without the numbers (or with broken ones) keeps its action line.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const now = Date.now();
const iso = h => new Date(now - h * 3600e3).toISOString();
const base = { sector: 'health', business_type: 'pharmacie', action_category: 'stock', risk_score: null, signals: [], track_record: null, outcomes: null, advice_rule: null, status: 'todo' };
const RISK = 'Order now : at the current sales rate, stock will run out before the supplier can deliver.';
const ACT = 'Place the order today : stock is below the reorder point.';
const sup = name => ({ name, phone: '+254712345678', email: null });
const rec = (equipment, severity, h, key, taskKey, reorder, supplier, action) => ({ ...base, equipment, severity, date: iso(h), alert_key: key, task_key: taskKey, message: `${equipment} message`, recommended_action: action, supplier, confidence: 0.85, reasoning: 'x', reorder });
const recs = [
  rec('Insulin pens 100 IU', 'CRITICAL', 0.4, 'health.reorder.risk', 't1', { order_qty: 145, reorder_point: 90, days_of_stock: 1.5, buffer_days: 6, lead_days: 3 }, sup('Pharma Distrib'), RISK + ' Order from Pharma Distrib.'),
  rec('Amoxicillin 500 mg', 'WARNING', 2, 'health.reorder.order_now', 't2', { order_qty: 58, reorder_point: 48, days_of_stock: 4.5, buffer_days: 9, lead_days: 3 }, sup('Pharma Distrib'), ACT + ' Order from Pharma Distrib.'),
  rec('Paracetamol 1 g', 'WARNING', 2.5, 'health.reorder.plan_ahead', 't3', { order_qty: 57, reorder_point: 50, days_of_stock: 6.3, buffer_days: 3, lead_days: 2 }, sup('MediPlus'), 'Schedule the next order this week. Order from MediPlus.'),
  rec('Oral rehydration salts', 'WARNING', 3, 'health.reorder.plan_ahead', 't4', { order_qty: 33, reorder_point: 87, days_of_stock: 16, buffer_days: 4.5, lead_days: 10 }, sup('Imports Ltd'), 'Schedule the next order this week. Order from Imports Ltd.'),
  rec('Cough syrup 100 ml', 'WARNING', 30, 'health.reorder.order_now', 't5', { order_qty: 17, reorder_point: 9, days_of_stock: 3, buffer_days: 2.1, lead_days: 2 }, null, ACT),
  rec('Gloves M', 'WARNING', 31, 'health.stock.low', 't6', null, null, 'Plan a reorder before stock reaches the critical threshold.'),
  rec('Syringes 5 ml', 'WARNING', 32, 'health.reorder.order_now', 't7', { order_qty: 'lots', reorder_point: 9, days_of_stock: 3, buffer_days: 2.1, lead_days: 2 }, null, 'Place the order today, the numbers here are broken.'),
];
const EXPECT = {
  'Insulin pens 100 IU': { line: 'Order 145 units · Pharma Distrib, 3 days', tone: 'red', fill: 7.1, marker: 42.9, label: 'order today', left: '1.5 days left', aria: '1.5 days of stock left. Reorder point at 9 days.' },
  'Amoxicillin 500 mg': { line: 'Order 58 units · Pharma Distrib, 3 days', tone: 'red', fill: 21.4, marker: 57.1, label: 'order today', left: '4.5 days left' },
  'Paracetamol 1 g': { line: 'Order 57 units · MediPlus, 2 days', tone: 'red', fill: 30, marker: 23.8, label: 'order by day 1', left: '6.3 days left' },
  'Oral rehydration salts': { line: 'Order 33 units · Imports Ltd, 10 days', tone: 'amber', fill: 76.2, marker: 69, label: 'reorder point', left: '16 days left' },
  'Cough syrup 100 ml': { line: 'Order 17 units · supplier 2 days', tone: 'red', fill: 14.3, marker: 19.5, label: 'order today', left: '3 days left' },
};
const FR = {
  'Insulin pens 100 IU': { line: 'Commander 145 unités · Pharma Distrib, 3 jours', left: '1,5 jour restant', label: "commander aujourd'hui" },
  'Amoxicillin 500 mg': { line: 'Commander 58 unités · Pharma Distrib, 3 jours', left: '4,5 jours restants', label: "commander aujourd'hui" },
  'Paracetamol 1 g': { line: 'Commander 57 unités · MediPlus, 2 jours', left: '6,3 jours restants', label: 'commander avant le jour 1' },
  'Oral rehydration salts': { line: 'Commander 33 unités · Imports Ltd, 10 jours', left: '16 jours restants', label: 'point de commande' },
  'Cough syrup 100 ml': { line: 'Commander 17 unités · fournisseur 2 jours', left: '3 jours restants', label: "commander aujourd'hui" },
};
const clean = t => (t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

(async () => {
  const browser = await chromium.launch(LAUNCH);
  async function open({ lang = 'en', theme = 'light', width = 1440, height = 1250 } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height }, timezoneId: 'Africa/Nairobi', locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = [];
    p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: recs }) }));
    await p.route(/\/contractors/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contractors: [{ id: 'c1', name: 'Awa Diop', availability: 'available', open_assignments: 0, active: true }] }) }));
    await p.route(/\/assignments/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignments: [] }) }));
    await p.route(/\/freshness/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ freshness: [], persisted: false, stale_after_days: 7 }) }));
    await p.addInitScript(l => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(l)) localStorage.setItem(k, v); } },
      { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_departments: '{"health":["pharmacie"]}', sentria_language: lang, sentria_company_name: 'Acme', sentria_theme: theme });
    await signedIn(p, 'u', 'ama@acme.test', { plan: 'entreprise', isAdmin: false });
    await p.goto(APP_URL, { waitUntil: 'networkidle' });
    if (width < 500) { await p.getByRole('button', { name: /menu|menu/i }).first().click(); await p.waitForTimeout(500); }
    await p.getByRole('button', { name: lang === 'fr' ? /^Suivi$/ : /^Tracking$/ }).first().click(); await p.waitForTimeout(1800);
    const card = title => p.locator('article', { has: p.locator('h5', { hasText: title }) });
    return { ctx, p, card };
  }
  const bg = (loc) => loc.evaluate(el => getComputedStyle(el).backgroundColor);

  console.log('== English, desktop, light');
  let x = await open();
  pass(await x.p.locator('[data-reorder-bar]').count() === 5, 'five cards carry the order card (the two without usable numbers do not)');
  const crit = await bg(x.card('Insulin pens 100 IU').locator('span.rounded-full').filter({ hasText: /Critical/ }).first());
  const warn = await bg(x.card('Amoxicillin 500 mg').locator('span.rounded-full').filter({ hasText: /Warning/ }).first());
  for (const [title, e] of Object.entries(EXPECT)) {
    const c = x.card(title);
    pass(clean(await c.locator('[data-reorder-line]').innerText()) === e.line, `${title}: "${clean(await c.locator('[data-reorder-line]').innerText())}"`);
    const bar = c.locator('[data-reorder-bar]');
    pass(await bar.getAttribute('data-tone') === e.tone, `${title}: the bar is ${e.tone}`);
    const g = await bar.evaluate(el => { const t = el.querySelector('[data-reorder-fill]').parentElement.getBoundingClientRect(), f = el.querySelector('[data-reorder-fill]').getBoundingClientRect(), m = el.querySelector('[data-reorder-marker]').getBoundingClientRect(); return { fill: f.width / t.width * 100, marker: (m.left + 1 - t.left) / t.width * 100 }; });
    pass(Math.abs(g.fill - e.fill) < 0.8 && Math.abs(g.marker - e.marker) < 1.2, `${title}: fill ${g.fill.toFixed(1)}% (want ${e.fill}), marker ${g.marker.toFixed(1)}% (want ${e.marker})`);
    pass(clean(await c.locator('[data-reorder-label]').innerText()) === e.label, `${title}: the marker says "${e.label}"`);
    pass(clean(await bar.innerText()).includes('Days of stock') && clean(await bar.innerText()).includes(e.left), `${title}: "Days of stock", "${e.left}"`);
    if (e.aria) pass(await bar.getAttribute('aria-label') === e.aria && await bar.getAttribute('role') === 'img', `${title}: a spoken version: "${e.aria}"`);
    const fillCol = await bg(c.locator('[data-reorder-fill]'));
    pass(fillCol === (e.tone === 'red' ? crit : e.tone === 'amber' ? warn : fillCol), `${title}: the fill is the app's own ${e.tone}`);
    const gap = await c.evaluate(el => { const l = el.querySelector('[data-reorder-label]').getBoundingClientRect(), a = [...el.querySelectorAll('button')].find(b => /Assign/.test(b.innerText)).getBoundingClientRect(), art = el.getBoundingClientRect(), bar = el.querySelector('[data-reorder-bar]').getBoundingClientRect(); return { gap: a.top - l.bottom, inside: l.left >= art.left && l.right <= art.right && bar.right <= art.right }; });
    pass(gap.gap >= 4 && gap.inside, `${title}: the marker label clears Assign and Due (${Math.round(gap.gap)} px) and stays in the card`);
    pass(await c.getByRole('button', { name: /Assign/ }).count() === 1 && await c.locator('input[type=date], button:has-text("Due")').count() >= 1, `${title}: Assign and Due are still there`);
  }
  pass(!/Place the order today|at the current sales rate/.test(await x.card('Insulin pens 100 IU').innerText()), 'the action sentence is not on a card that has the numbers');
  pass((await x.card('Amoxicillin 500 mg').locator('p[title]').first().getAttribute('title')).includes('Place the order today'), 'but it is still the tooltip');
  const gl = x.card('Gloves M');
  pass(/Plan a reorder before stock reaches/.test(await gl.innerText()) && await gl.locator('[data-reorder-bar]').count() === 0, 'a card with no numbers keeps its action line');
  const sy = x.card('Syringes 5 ml');
  pass(/numbers here are broken/.test(await sy.innerText()) && await sy.locator('[data-reorder-bar]').count() === 0, 'a card with broken numbers keeps its action line');
  await x.card('Insulin pens 100 IU').getByRole('button', { name: /Priority detail/ }).click(); await x.p.waitForTimeout(700);
  pass(await x.p.getByText(/at the current sales rate/).first().isVisible(), 'the full action sentence is in the priority detail');
  await x.p.keyboard.press('Escape'); await x.p.waitForTimeout(300);
  await x.p.screenshot({ path: 'reordercard-light.png' });
  pass(x.p._errors.length === 0, 'no page errors ' + x.p._errors.join('|'));
  await x.ctx.close();

  console.log('== French');
  x = await open({ lang: 'fr' });
  for (const [title, e] of Object.entries(FR)) {
    const c = x.card(title);
    pass(clean(await c.locator('[data-reorder-line]').innerText()) === e.line, `${title}: "${clean(await c.locator('[data-reorder-line]').innerText())}"`);
    const t = clean(await c.locator('[data-reorder-bar]').innerText());
    pass(t.includes('Jours de stock') && t.includes(e.left) && t.includes(e.label), `${title}: "${e.left}", "${e.label}"`);
  }
  pass(!/Days of stock|days left|reorder point|order today/.test(await x.p.locator('[data-reorder-bar]').first().innerText()), 'no English left on the bar');
  await x.ctx.close();

  console.log('== dark');
  x = await open({ theme: 'dark' });
  const d = await x.card('Amoxicillin 500 mg').locator('[data-reorder-bar]').evaluate(el => ({ fill: getComputedStyle(el.querySelector('[data-reorder-fill]')).backgroundColor, track: getComputedStyle(el.querySelector('[data-reorder-fill]').parentElement).backgroundColor, marker: getComputedStyle(el.querySelector('[data-reorder-marker]')).backgroundColor }));
  pass(d.fill !== 'rgba(0, 0, 0, 0)' && d.marker !== d.track && d.fill !== d.track, `the fill, the marker and the track are three different colours in dark (${d.fill} / ${d.marker} / ${d.track})`);
  await x.p.screenshot({ path: 'reordercard-dark.png' });
  await x.ctx.close();

  console.log('== 390 px');
  x = await open({ width: 390, height: 1500 });
  pass(await x.p.locator('[data-reorder-bar]').count() === 5, 'the order cards are there on a phone');
  pass(await x.p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth) <= 0, 'no sideways scroll');
  const inside = await x.p.locator('article').evaluateAll(els => els.every(el => { const b = el.querySelector('[data-reorder-bar]'); if (!b) return true; const a = el.getBoundingClientRect(), r = b.getBoundingClientRect(), l = el.querySelector('[data-reorder-label]').getBoundingClientRect(); return r.left >= a.left && r.right <= a.right && l.left >= a.left && l.right <= a.right; }));
  pass(inside, 'every bar and label stays inside its card');
  await x.p.screenshot({ path: 'reordercard-phone.png' });
  pass(x.p._errors.length === 0, 'no page errors ' + x.p._errors.join('|'));
  await x.ctx.close();

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
