// The alerts table shows how long ago, not a full date: "12 min ago", "2 h ago",
// "Yesterday", then a short date. The exact time is in the tooltip.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const now = new Date().toISOString();
const rec = eq => ({ equipment: eq, sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, message: `MSG ${eq}`, alert_key: 'health.stock.low', recommended_action: `ACT ${eq}`, action_category: 'stock', confidence: 0.8, risk_score: 81 });
const alertOf = (eq, params) => ({ id: eq, equipment: eq, sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, alert_key: 'health.stock.low', message: `MSG ${eq}`, risk_score: 81, params });

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const ages = [[0.2, 'MSG a'], [2, 'MSG b'], [26, 'MSG c'], [24 * 6, 'MSG d']];
  const rows = ages.map(([h, m], i) => ({ id: i + 1, equipment: 'Asset ' + 'abcd'[i], sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: new Date(Date.now() - h * 3600e3).toISOString(), alert_key: 'health.x' + i, message: m, risk_score: 70, params: [] }));
  const open = async (lang) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: [] }) }));
    await p.route(/\/(contractors|assignments)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"contractors":[],"assignments":[]}' }));
    await p.addInitScript(l => { const s = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: l, sentria_company_name: 'Acme', sentria_theme: 'light' }; for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, lang);
    await signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1800);
    return { p, ctx };
  };

  console.log('== English');
  { const { p, ctx } = await open('en');
    const t = await p.locator('[data-alert-time]').allInnerTexts();
    pass(t.length === 4, 'one time per alert row (' + t.length + ')');
    const by = Object.fromEntries((await p.locator('tbody tr').evaluateAll(trs => trs.map(tr => [tr.innerText.match(/MSG [a-d]/)?.[0], tr.querySelector('[data-alert-time]')?.textContent]))).filter(x => x[0]));
    pass(/^1?\d min ago$/.test(by['MSG a']) || /^[1-9] min ago$/.test(by['MSG a']), 'a recent alert: "' + by['MSG a'] + '"');
    pass(by['MSG b'] === '2 h ago', 'two hours: "' + by['MSG b'] + '"');
    pass(by['MSG c'] === 'Yesterday', 'a day ago: "' + by['MSG c'] + '"');
    pass(/^\d{1,2} [A-Z][a-z]{2,4}$/.test(by['MSG d']), 'six days: a short date, "' + by['MSG d'] + '"');
    pass(!/\d{2}\/\d{2}\/\d{4}/.test(t.join(' ')), 'no full date in the column');
    const title = await p.locator('[data-alert-time]').first().getAttribute('title');
    pass(/\d{2}\/\d{2}\/\d{4}/.test(title || ''), 'the exact time is in the tooltip: ' + title);
    pass(await p.locator('time[datetime]').count() === 4, 'each is a <time> element');
    await p.screenshot({ path: 'reltime-light.png', fullPage: true });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== French');
  { const { p, ctx } = await open('fr');
    const t = await p.locator('[data-alert-time]').allInnerTexts();
    pass(t.some(x => /^il y a \d+ min$/.test(x)) && t.includes('il y a 2 h') && t.includes('Hier'), 'in French: ' + t.join(' | '));
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
