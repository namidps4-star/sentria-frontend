// I-COST, Industry: what an hour of stop costs, from the file's own columns
// (units_per_hour x unit_value, sent by the API as loss_per_hour). The popup
// shows it as a rate with its working, only from Pro, only when the API sent
// all of it. The import panel lists the two optional columns for Industry and
// not for Health.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const now = new Date().toISOString();
const KEY = 'industry.failure.imminent';
const LOSS = [['loss_per_hour', 640], ['units_per_hour', 8], ['unit_value', 80], ['currency', '€']];

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ plan = 'entreprise', params = undefined, sector = 'industry', lang = 'en', vw = 1440, theme = 'light', mode = 'popup' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vw < 500 ? 844 : 1000 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    const bt = sector === 'industry' ? 'usine-production' : 'pharmacie';
    const alert = { id: 'Press-2', equipment: 'Press-2', sector, business_type: bt, severity: 'CRITICAL', date: now, alert_key: KEY, message: 'Imminent failure on the machine Press-2', risk_score: 80, params };
    const rec = { equipment: 'Press-2', sector, business_type: bt, severity: 'CRITICAL', date: now, message: 'MSG Press-2', alert_key: KEY, recommended_action: 'ACT Press-2', action_category: 'maintenance', confidence: 0.8, risk_score: 80 };
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mode === 'import' ? [] : [alert]) }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: mode === 'import' ? [] : [rec] }) }));
    await p.route(/\/cost(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cost: { plan, starter: null, learned: {}, can_set_starter: true, can_tap: false } }) }));
    await p.route(/\/(contractors|assignments)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"contractors":[],"assignments":[]}' }));
    await p.addInitScript(([l, t, s, b]) => { const st = { sentria_onboarded: '1', sentria_sector: s, sentria_sectors: JSON.stringify([s]), sentria_business_type: b, sentria_language: l, sentria_company_name: 'Acme', sentria_theme: t }; for (const k in st) localStorage.setItem(k, st[k]); }, [lang, theme, sector, bt]);
    await signedIn(p, 'u-test', 'test@sentria.app', { plan });
    await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    if (mode === 'import') { await p.locator('button[aria-controls="import-panel"]').click(); await p.waitForTimeout(600); }
    else { if (sector === 'industry') { await p.getByRole('button', { name: /Back to dashboard|Retour au tableau de bord/ }).first().click(); await p.waitForTimeout(800); } await p.locator('tbody tr').first().click(); await p.waitForTimeout(400); await p.getByRole('button', { name: lang === 'fr' ? /Voir la recommandation/ : /See the recommendation/ }).first().click(); await p.waitForTimeout(600); }
    return { p, ctx };
  };
  const rate = p => p.locator('[data-cost-rate]');

  console.log('== the popup');
  { const { p, ctx } = await open({ params: LOSS });
    const t = await rate(p).innerText();
    pass(/^640\s*€/.test(t) && /for each hour it stays down/.test(t), `the hourly loss, as a rate (${t.split('\n')[0]})`);
    pass(/8 units per hour × 80\s*€ each, from your file/.test(t), 'with its working, from the file');
    pass(!/≈/.test(t), 'and not marked as an estimate: it is a plain product');
    await p.screenshot({ path: 'costrate-light.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }
  { const { p, ctx } = await open({ params: [['risk_score', 49]] });
    pass(await rate(p).count() === 0 && await p.locator('[data-cost-ignored]').count() === 0, 'an alert with no rate shows no rate and no amount');
    await ctx.close(); }
  for (const [label, params] of [
    ['no units', [['loss_per_hour', 640], ['unit_value', 80], ['currency', '€']]],
    ['a zero rate', [['loss_per_hour', 0], ['units_per_hour', 8], ['unit_value', 80], ['currency', '€']]],
    ['words', [['loss_per_hour', 'lots'], ['units_per_hour', 8], ['unit_value', 80], ['currency', '€']]],
  ]) {
    const { p, ctx } = await open({ params });
    pass(await rate(p).count() === 0, `${label}: nothing shown`);
    await ctx.close();
  }
  { const { p, ctx } = await open({ params: LOSS, plan: 'decouverte' });
    pass(await rate(p).count() === 0 && await p.locator('[data-cost-locked]').count() === 1, 'free plan: it says the amount comes with Pro, with no figure');
    pass(!/640/.test(await p.locator('[aria-labelledby=recommendation-dialog-title]').innerText()), 'and 640 is nowhere in the popup');
    await ctx.close(); }
  { const { p, ctx } = await open({ params: [['loss_per_hour', 500], ['units_per_hour', 5], ['unit_value', 100], ['currency', '']] });
    pass(/^500\b/.test(await rate(p).innerText()), 'an unknown currency: the amount stands alone');
    await ctx.close(); }
  { const { p, ctx } = await open({ params: LOSS, lang: 'fr' });
    const t = await rate(p).innerText();
    pass(/par heure d'arrêt/.test(t) && /8 unités par heure/.test(t) && /d'après votre fichier/.test(t), 'in French');
    await ctx.close(); }
  { const { p, ctx } = await open({ params: LOSS, theme: 'dark' });
    await p.screenshot({ path: 'costrate-dark.png' }); await ctx.close(); }
  { const { p, ctx } = await open({ params: LOSS, vw: 390 });
    pass(await rate(p).count() === 1 && !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'at 390 px it is there and nothing scrolls sideways');
    await ctx.close(); }

  console.log('== the tag beside the severity');
  { const { p, ctx } = await open({ params: LOSS });
    const tag = p.locator('[title^="Loss per hour of stop"]');
    pass(await tag.count() >= 1 && /640\s*€\/h/.test(await tag.first().innerText()), 'the alert row in the dashboard table shows 640 €/h');
    await p.screenshot({ path: 'costrate-table.png' });
    await ctx.close(); }
  { const { p, ctx } = await open({ params: LOSS, plan: 'decouverte' });
    pass(await p.locator('[title^="Loss per hour of stop"]').count() === 0, 'free plan: no tag');
    await ctx.close(); }
  { const { p, ctx } = await open({ params: [['risk_score', 40]] });
    pass(await p.locator('[title^="Loss per hour of stop"]').count() === 0, 'no columns: no tag');
    await ctx.close(); }

  console.log('== the import panel');
  { const { p, ctx } = await open({ mode: 'import' });
    const t = await p.locator('#import-panel').innerText();
    pass(await p.locator('[data-cost-columns]').count() === 1 && /units_per_hour/.test(t) && /unit_value/.test(t), 'Industry lists the two optional columns');
    pass(/never guesses/.test(t), 'and says nothing is guessed');
    await p.screenshot({ path: 'costrate-import.png' });
    await ctx.close(); }
  { const { p, ctx } = await open({ mode: 'import', sector: 'health' });
    pass(await p.locator('[data-cost-columns]').count() === 0 && !/units_per_hour/.test(await p.locator('#import-panel').innerText()), 'Health lists none: its alerts already carry the stock value');
    await ctx.close(); }
  { const { p, ctx } = await open({ mode: 'import', lang: 'fr' });
    pass(/Facultatif/i.test(await p.locator('[data-cost-columns]').innerText()), 'in French');
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
