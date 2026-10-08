// Money amounts come with Pro and up (I-COST step 1). On the free plan the
// alert table, the recommendation popup and the chart's value metric show no
// amount; the popup says an amount exists and where it comes from, and only
// when the alert has one. Pro, a running trial and an admin see the amounts.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const now = new Date().toISOString();
const rec = eq => ({ equipment: eq, sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, message: `MSG ${eq}`, alert_key: 'health.stock.low', recommended_action: `ACT ${eq}`, action_category: 'stock', confidence: 0.8, risk_score: 70 });
const alertOf = (eq, params) => ({ id: eq, equipment: eq, sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, alert_key: 'health.stock.low', message: `MSG ${eq}`, risk_score: 70, params });
const WITH = [['value', 1240], ['currency', '€']];
const future = new Date(Date.now() + 5 * 86400000).toISOString();

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async (params, { plan = 'entreprise', trialEndsAt = null, isAdmin = false, lang = 'en', popup = true } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([alertOf('Doliprane', params)]) }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: [rec('Doliprane')] }) }));
    await p.route(/\/(contractors|assignments)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"contractors":[],"assignments":[]}' }));
    await p.addInitScript(l => { const s = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: l, sentria_company_name: 'Acme' }; for (const k in s) localStorage.setItem(k, s[k]); }, lang);
    await signedIn(p, 'u-test', 'test@sentria.app', { plan, trialEndsAt, isAdmin });
    await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    await p.locator('tbody tr').first().click(); await p.waitForTimeout(400);
    if (popup) { await p.getByRole('button', { name: lang === 'fr' ? /Voir la recommandation/ : /See the recommendation/ }).first().click(); await p.waitForTimeout(600); }
    return { p, ctx };
  };
  const rowText = p => p.locator('tbody tr').first().innerText();
  const dialog = p => p.locator('[aria-labelledby=recommendation-dialog-title]');

  console.log('== free plan: no amount anywhere');
  { const { p, ctx } = await open(WITH, { plan: 'decouverte' });
    pass(!/1,240/.test(await rowText(p)), 'the alert row shows no amount');
    pass(await p.locator('[data-cost-ignored]').count() === 0 && await p.locator('[data-cost-locked]').count() === 1, 'the popup has no figure and says it comes with Pro');
    pass(!/1,240/.test(await dialog(p).innerText()), 'and the amount is nowhere in the popup');
    await p.screenshot({ path: 'amountgate-free.png' });
    await p.getByRole('button', { name: 'Close the recommendation' }).click(); await p.waitForTimeout(300);
    await p.getByRole('button', { name: 'Chart options' }).first().click(); await p.waitForTimeout(300);
    const menu = p.locator('[role=dialog][aria-label="Chart options"]:visible').first();
    pass(await menu.locator('input[data-metric="value"]').isDisabled() && /Available with the Pro plan/.test(await menu.innerText()), 'the chart\'s value metric is off, with the reason');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }
  { const { p, ctx } = await open([['stock', 3]], { plan: 'decouverte' });
    pass(await p.locator('[data-cost-locked]').count() === 0 && await p.locator('[data-cost-ignored]').count() === 0, 'an alert with no amount gets no "comes with Pro" note either');
    await ctx.close(); }
  { const { p, ctx } = await open(WITH, { plan: 'decouverte', lang: 'fr' });
    pass(/plan Pro/.test(await p.locator('[data-cost-locked]').innerText()), 'the note is in French');
    await ctx.close(); }

  console.log('== Pro, trial, admin: amounts shown');
  { const { p, ctx } = await open(WITH, { plan: 'pro' });
    pass(/1,240/.test(await rowText(p)), 'Pro: the alert row shows the amount');
    pass(await p.locator('[data-cost-ignored]').count() === 1 && await p.locator('[data-cost-locked]').count() === 0, 'Pro: the popup shows the figure');
    await p.getByRole('button', { name: 'Close the recommendation' }).click(); await p.waitForTimeout(300);
    await p.getByRole('button', { name: 'Chart options' }).first().click(); await p.waitForTimeout(300);
    pass(await p.locator('[role=dialog][aria-label="Chart options"]:visible').first().locator('input[data-metric="value"]').isEnabled(), 'Pro: the value metric is on');
    await ctx.close(); }
  { const { p, ctx } = await open(WITH, { plan: 'decouverte', trialEndsAt: future });
    pass(await p.locator('[data-cost-ignored]').count() === 1, 'a free account with a running trial sees the figure (the trial is Business)');
    await ctx.close(); }
  { const { p, ctx } = await open(WITH, { plan: 'decouverte', isAdmin: true });
    pass(await p.locator('[data-cost-ignored]').count() === 1, 'an admin sees the figure');
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
