// The recommendation popup as three steps (what happened, why, do this now),
// with the impact block unchanged. Light, dark, 390 px, French.
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
  const dlg = p => p.locator('[aria-labelledby=recommendation-dialog-title]');

  console.log('== the steps');
  { const { p, ctx } = await open([['value', 1240], ['currency', '€']]);
    const steps = p.locator('[data-popup-steps] > li');
    pass(await steps.count() === 3, 'three steps');
    const t = await dlg(p).innerText();
    pass(/What happened/i.test(t) && /Why/i.test(t) && /Do this now/i.test(t), 'labelled: What happened, Why, Do this now');
    pass(/MSG Doliprane/.test(await steps.nth(0).innerText()), 'step 1 carries the alert message');
    pass(/ACT Doliprane/.test(await p.locator('[data-popup-action]').innerText()), 'step 3 carries the recommended action, in the lime tile');
    pass(await p.locator('[data-popup-risk]').count() === 1 && /81 \/ 100/.test(await p.locator('[data-popup-risk]').innerText()), 'the risk is a bar with 81 / 100');
    pass(await p.locator('[data-cost-ignored]').count() === 1 && /1,240\s*€/.test(await p.locator('[data-cost-ignored]').innerText()), 'the impact block is still there, with its big amount');
    const order = await p.evaluate(() => { const d = document.querySelector('[aria-labelledby=recommendation-dialog-title]'); const a = d.querySelector('[data-popup-steps]').getBoundingClientRect().top, b = d.querySelector('[data-cost-ignored]').getBoundingClientRect().top; return a < b; });
    pass(order, 'the steps come before the impact block');
    pass(await dlg(p).getByRole('button', { name: 'Mark handled' }).count() === 1, 'one Mark handled button in the popup');
    await p.screenshot({ path: 'popupui-light.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== French, dark, phone');
  { const { p, ctx } = await open([['value', 1240], ['currency', '€']], { lang: 'fr' });
    pass(/Ce qui s'est passé/i.test(await dlg(p).innerText()) && /À faire maintenant/i.test(await dlg(p).innerText()), 'in French');
    await ctx.close(); }
  { const { p, ctx } = await open([['value', 1240], ['currency', '€']], { theme: 'dark' });
    await p.screenshot({ path: 'popupui-dark.png' }); await ctx.close(); }
  { const { p, ctx } = await open([['value', 1240], ['currency', '€']], { vw: 390 });
    const box = await dlg(p).boundingBox();
    pass(box.x >= 0 && box.x + box.width <= 390, 'fits the phone');
    pass(await p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth) <= 0, 'no sideways scroll');
    await p.screenshot({ path: 'popupui-phone.png' }); await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
