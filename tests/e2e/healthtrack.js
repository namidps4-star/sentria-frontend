// Health priorities as a track (lime pill for the open one, icons for the rest),
// and the general KPI tiles as lime / white / charcoal shapes.
// Checks: order by urgency, the figure is a reading (loading, failed read, no
// figure), a pill filters the alerts table and a stale pick never hides rows
// elsewhere, French, a phone, dark, and that the KPI tiles keep the class the
// other suites find them by.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const at = n => new Date(Date.now() - n * 36e5).toISOString();
const A = (equipment, key, severity, hrs, message) => ({ id: equipment + hrs, equipment, sector: 'health', business_type: 'pharmacie', severity, date: at(hrs), alert_key: key, message });
const DATA = [
  A('Paracetamol 500 mg', 'health.stock.low', 'CRITICAL', 3, 'Out of stock in 3 days'),
  A('Amoxicillin 1 g', 'health.stock.low', 'CRITICAL', 20, 'Out of stock in 2 days'),
  A('Insulin glargine', 'health.stock.low', 'WARNING', 50, 'Low stock, 9 days left'),
  A('Oral rehydration salts', 'health.stock.low', 'WARNING', 70, 'Low stock, 12 days left'),
  A('Vaccine fridge 2', 'health.cold_chain.break', 'CRITICAL', 5, 'Cold chain broken for 40 min'),
  A('Artemether 80 mg', 'health.temperature.high', 'WARNING', 30, 'Shelf at 27 C, limit 25 C'),
  A('Ceftriaxone 1 g', 'health.expiry.soon', 'WARNING', 8, 'Expires in 21 days'),
  A('Metformin 500 mg', 'health.expiry.soon', 'WARNING', 26, 'Expires in 30 days'),
  A('Salbutamol inhaler', 'health.expiry.soon', 'WARNING', 100, 'Expires in 28 days'),
];
const LS = {
  sentria_onboarded: 'true', sentria_company_name: 'Pharmacie A', sentria_sector: 'health', sentria_sectors: '["health"]',
  sentria_business_type: 'pharmacie', sentria_departments: '{"health":["pharmacie","clinique-hopital","laboratoire"]}',
  sentria_equipment: '["stocks","cold-chain","temperature","expiry","medications","storage"]',
};

(async () => {
  const browser = await chromium.launch(LAUNCH);
  // alerts: 'ok' | 'fail' | 'hold' (answers only after release())
  const open = async ({ lang = 'en', theme = 'light', vw = 1440, alerts = 'ok' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vw < 500 ? 844 : 900 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    let release = () => {}; const gate = new Promise(r => { release = r; });
    await p.route(/onrender\.com\//, async r => {
      const u = r.request().url();
      if (/\/alerts/.test(u)) {
        if (alerts === 'hold') await gate;
        if (alerts === 'fail') return r.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DATA) });
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: /\/recommendations/.test(u) ? '{"recommendations":[]}' : '{"assignments":[],"contractors":[]}' });
    });
    await p.addInitScript(v => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, val] of Object.entries(v)) localStorage.setItem(k, val); } }, { ...LS, sentria_language: lang, sentria_theme: theme });
    await signedIn(p, 'u-1', 'ama@pharma.test', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(alerts === 'hold' ? 2500 : 3000);
    p._release = release;
    return { p, ctx };
  };
  const track = p => p.getByTestId('priority-track');
  const pills = p => track(p).locator('button');
  const names = p => pills(p).evaluateAll(bs => bs.map(b => b.getAttribute('aria-label')));
  const rows = p => p.locator('#alerts-table tbody tr').count();
  const pill = (p, label) => track(p).locator(`button[title="${label}"]`);

  console.log('== order, figures, the open pill (English)');
  { const { p, ctx } = await open();
    pass(await track(p).count() === 1, 'the track is on the Health dashboard');
    const n = await names(p);
    pass(n.length === 6, `six saved priorities, six pills (${n.length})`);
    pass(/^Medicines/.test(n[0]) && /^Stock/.test(n[1]) && /^Cold chain/.test(n[2]), `most urgent first: ${n.slice(0, 3).map(x => x.split(',')[0]).join(', ')}`);
    pass(/^Storage, No figure yet$/.test(n[5]), `a priority nothing counts shows no figure, last (${n[5]})`);
    const open1 = await track(p).locator('button[data-open]').innerText();
    pass(/Medicines/.test(open1) && /9/.test(open1) && /3 critical/.test(open1), `the open pill says what, how many, how bad (${open1.replace(/\s+/g, ' ')})`);
    pass(await track(p).locator('button[data-open]').count() === 1, 'exactly one pill is open');
    const storageText = await pill(p, 'Storage').innerText();
    pass(!/\d/.test(storageText), 'the no-figure pill has no number on it');
    const box = await track(p).locator('div').first().boundingBox();
    const main = await p.locator('main').boundingBox();
    pass(Math.abs((box.x + box.width / 2) - (main.x + main.width / 2)) < 24, `the capsule is centred (${Math.round(box.x + box.width / 2)} vs ${Math.round(main.x + main.width / 2)})`);
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== a pill filters the alerts table');
  { const { p, ctx } = await open();
    const all = await rows(p);
    pass(all === 9, `nine alerts in the table (${all})`);
    await pill(p, 'Stock').click(); await p.waitForTimeout(700);
    pass(await pill(p, 'Stock').getAttribute('aria-pressed') === 'true', 'Stock is pressed');
    pass(await rows(p) === 4, `Stock narrows the table to its 4 alerts (${await rows(p)})`);
    pass(/active filters/i.test(await p.locator('#alerts-table').innerText()) && /clear filters/i.test(await p.locator('#alerts-table').innerText()), 'the table says it is filtered and offers to clear');
    await pill(p, 'Temperature').click(); await p.waitForTimeout(500);
    pass(await rows(p) === 1 && await pill(p, 'Stock').getAttribute('aria-pressed') === 'false', 'Temperature replaces Stock: 1 alert');
    await p.getByRole('button', { name: /Clear filters/ }).click(); await p.waitForTimeout(400);
    pass(await rows(p) === 9 && await pill(p, 'Temperature').getAttribute('aria-pressed') === 'false', 'Clear filters brings every alert back and un-presses the pill');
    await pill(p, 'Expiry').click(); await p.waitForTimeout(400);
    await pill(p, 'Expiry').click(); await p.waitForTimeout(400);
    pass(await rows(p) === 9, 'pressing a pressed pill again lets go');
    await pill(p, 'Storage').click(); await p.waitForTimeout(400);
    pass(await rows(p) === 9, 'a priority with no figure filters nothing');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== a stale pick never hides rows elsewhere');
  { const { p, ctx } = await open();
    await pill(p, 'Stock').click(); await p.waitForTimeout(500);
    await p.locator('button:visible', { hasText: /^All\s*\d*$/ }).first().click(); await p.waitForTimeout(800);
    pass(await rows(p) === 9, `All sectors shows every alert, not the Stock pick (${await rows(p)})`);
    await p.locator('button:visible', { hasText: /^Health\s*\d*$/ }).first().click(); await p.waitForTimeout(800);
    pass(await track(p).count() === 1 && await track(p).locator('button[aria-pressed="true"]').count() === 0, 'back on Health nothing is pressed');
    pass(await rows(p) === 9, 'and the table is whole');
    await ctx.close(); }

  console.log('== a figure is a reading');
  { const { p, ctx } = await open({ alerts: 'hold' });
    pass(await track(p).locator('button[data-open] [data-skeleton]').count() >= 1, 'while the alerts load, the open pill holds its place with placeholders');
    const loadingNames = (await names(p)).join(' | ');
    pass(!/\d/.test(loadingNames), `no number is claimed while loading (${loadingNames})`);
    p._release(); await p.waitForTimeout(1500);
    pass(await track(p).locator('[data-skeleton]').count() === 0, 'the placeholders go once the alerts arrive');
    await ctx.close(); }
  { const { p, ctx } = await open({ alerts: 'fail' });
    const open1 = (await track(p).locator('button[data-open]').innerText()).replace(/\s+/g, ' ');
    pass(/Not measured/.test(open1) && !/\b0\b/.test(open1), `a failed read shows a dash, not a calm zero (${open1})`);
    const txt = await track(p).innerText();
    pass(!/all clear/i.test(txt), 'and never says "all clear"');
    pass(!/\d/.test((await names(p)).join(' ')), 'no pill carries a number');
    await ctx.close(); }

  console.log('== French');
  { const { p, ctx } = await open({ lang: 'fr' });
    pass(/Vos priorités/.test(await p.locator('main').innerText()), 'the heading is in French');
    const n = await names(p);
    pass(/^Médicaments, 9, 3 critiques$/.test(n[0]) && /^Stocks, 4, 2 critiques$/.test(n[1]), `labels and status in French (${n[0]} / ${n[1]})`);
    await ctx.close(); }

  console.log('== a phone and dark');
  { const { p, ctx } = await open({ vw: 390 });
    const sw = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    pass(!sw, 'no sideways scroll at 390 px');
    const first = await track(p).locator('button').first().boundingBox();
    pass(first && first.x >= 0, `the first pill is not cut off at the left (x ${first && Math.round(first.x)})`);
    await ctx.close(); }
  { const { p, ctx } = await open({ theme: 'dark' });
    const bg = await track(p).locator('div').first().evaluate(e => getComputedStyle(e).backgroundColor);
    pass(bg !== 'rgba(0, 0, 0, 0)', `the capsule has its own fill in dark (${bg})`);
    await ctx.close(); }

  console.log('== the general KPI tiles');
  { const { p, ctx } = await open({ theme: 'dark' });
    const tiles = p.locator('main .rounded-3xl.p-5.t-enter');
    const count = await tiles.count();
    pass(count >= 4, `the four KPI tiles still carry rounded-3xl p-5 (${count})`);
    const info = await tiles.evaluateAll(es => es.slice(0, 4).map(e => ({ r: getComputedStyle(e).borderTopLeftRadius, bg: getComputedStyle(e).backgroundColor, light: e.classList.contains('tags-light') })));
    pass(info.every(i => i.r === '34px'), `they are squircles (${info.map(i => i.r).join(', ')})`);
    pass(info[0].light && info[1].light && !info[2].light, 'bright tiles pin the light tag colours, the charcoal one does not');
    const bgs = new Set(info.map(i => i.bg));
    pass(bgs.size === 3, `lime, white and charcoal (${[...bgs].join(' / ')})`);
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
