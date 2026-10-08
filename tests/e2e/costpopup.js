// I-COST (stock alerts): the recommendation popup shows the amount the alert
// itself carries, big, with how it was worked out. A stock-out estimate is
// marked "≈" and says so. An alert with no amount shows no figure block at
// all: never a zero, never a made-up number.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const now = new Date().toISOString();
const rec = eq => ({ equipment: eq, sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, message: `MSG ${eq}`, alert_key: 'health.stock.low', recommended_action: `ACT ${eq}`, action_category: 'stock', confidence: 0.8, risk_score: 70 });
const alertOf = (eq, params) => ({ id: eq, equipment: eq, sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, alert_key: 'health.stock.low', message: `MSG ${eq}`, risk_score: 70, params });

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async (params, { lang = 'en', theme = 'light', vw = 1440 } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vw < 500 ? 844 : 1000 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([alertOf('Doliprane', params)]) }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: [rec('Doliprane')] }) }));
    await p.route(/\/(contractors|assignments)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"contractors":[],"assignments":[]}' }));
    await p.addInitScript(([l, t]) => { const s = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: l, sentria_company_name: 'Acme', sentria_theme: t }; for (const k in s) localStorage.setItem(k, s[k]); }, [lang, theme]);
    await signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    await p.locator('tbody tr').first().click(); await p.waitForTimeout(400);
    await p.getByRole('button', { name: lang === 'fr' ? /Voir la recommandation/ : /See the recommendation/ }).first().click(); await p.waitForTimeout(600);
    return { p, ctx };
  };
  const block = p => p.locator('[data-cost-ignored]');

  console.log('== stock on hand');
  { const { p, ctx } = await open([['value', 1240], ['currency', '€']]);
    pass(await block(p).count() === 1, 'the popup shows the amount block');
    const t = await block(p).innerText();
    pass(/1,240\s*€/.test(t) && !/≈/.test(t), `the figure is the alert's own amount, not an estimate (${t.split('\n')[0]})`);
    pass(/stock at stake/i.test(t) && /Stock on hand × unit cost/.test(t), 'and it says how it was worked out');
    await p.screenshot({ path: 'costpopup-light.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== stock-out estimate');
  { const { p, ctx } = await open([['value', 900], ['currency', '€'], ['basis', 'sales']]);
    const t = await block(p).innerText();
    pass(/^≈\s*900\s*€/.test(t), `an estimate is marked with ≈ (${t.split('\n')[0]})`);
    pass(/sales lost while waiting/i.test(t) && /Estimate: \(daily sales/.test(t), 'and says it is an estimate and from what');
    await ctx.close(); }

  console.log('== no amount, no figure');
  { const { p, ctx } = await open([['stock', 3]]);
    pass(await block(p).count() === 0, 'an alert with no amount shows no figure block');
    pass(!/0\s*€/.test(await p.locator('[aria-labelledby=recommendation-dialog-title]').innerText()), 'and no zero amount anywhere in the popup');
    await ctx.close(); }
  { const { p, ctx } = await open([['value', 12], ['rate', 3]]);
    pass(await block(p).count() === 0, 'a bare value with no currency is not money, so no block');
    await ctx.close(); }

  console.log('== French, dark, phone');
  { const { p, ctx } = await open([['value', 1240], ['currency', '€']], { lang: 'fr' });
    const t = await block(p).innerText();
    pass(/1\s240\s*€/.test(t.replace(/[  ]/g, ' ')) && /de stock en jeu/.test(t) && /Stock en main × coût unitaire/.test(t), 'in French: figure, caption and basis');
    await ctx.close(); }
  { const { p, ctx } = await open([['value', 900], ['currency', '€'], ['basis', 'sales']], { theme: 'dark' });
    await p.screenshot({ path: 'costpopup-dark.png' }); await ctx.close(); }
  { const { p, ctx } = await open([['value', 900], ['currency', '€'], ['basis', 'sales']], { vw: 390 });
    pass(await block(p).count() === 1 && !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'at 390 px the figure is there and nothing scrolls sideways');
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
