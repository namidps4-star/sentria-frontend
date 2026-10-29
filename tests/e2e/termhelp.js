// Confidence and risk, explained: the "i" beside each label opens a plain explanation with examples (closes on a
// second press, Escape or a click outside), and Robo's tour has a step that says what both numbers mean.
// Light English with the popover, dark French for the tour step, 390 px.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
const path = require('path');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const dayAgo = d => new Date(Date.now() - d * 86400000).toISOString();
const ALERTS = [['Doliprane', 'health.stock.critical_low', 'CRITICAL', 0], ['Insuline', 'health.cold_chain.broken', 'CRITICAL', 1], ['Aspirine', 'health.expiry.warning', 'WARNING', 2]]
  .map(([eq, key, severity, d], i) => ({ id: 'a' + i, equipment: eq, sector: 'health', business_type: 'pharmacie', severity, date: dayAgo(d), alert_key: key, message: 'MSG ' + eq, risk_score: 80, params: [] }));
const RECS = ALERTS.map(a => ({ ...a, recommended_action: 'ACT ' + a.equipment, action_category: 'stock', confidence: 0.92 }));
const SHOTS = path.join(__dirname, 'shots');
const PROFILE = { sentria_onboarded: 'true', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ lang = 'en', theme = 'light', vw = 1440, vh = 900 } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => { const u = new URL(r.request().url()).pathname;
      if (u === '/alerts') return json(r, ALERTS);
      if (u === '/recommendations') return json(r, { recommendations: RECS });
      return json(r, { recommendations: [], assignments: [], contractors: [] }); });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { ...PROFILE, sentria_language: lang, sentria_theme: theme });
    await signedIn(p, 'u-me', 'boss@sentria.app', { plan: 'decouverte', isAdmin: false });
    await p.goto(APP_URL); await p.waitForTimeout(1800);
    return { p, ctx };
  };

  console.log('== the "i" beside the labels opens an explanation');
  { const { p, ctx } = await open();
    const help = p.getByTestId('term-help-confidence').first();
    if (await help.count() === 0) { pass(false, 'the confidence "i" is on the screen with data'); await ctx.close(); }
    else {
      await help.click(); await p.waitForTimeout(250);
      const text = p.getByTestId('term-help-confidence-text').first();
      pass(await text.isVisible(), 'a press opens the explanation');
      const body = await text.innerText();
      pass(/sure SentrIA is/.test(body) && /85%/.test(body), 'it says what confidence means, with the bands');
      pass(/92% \(high\)/.test(body), 'and gives an example');
      await p.screenshot({ path: path.join(SHOTS, 'termhelp-light.png') });
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      pass(await text.count() === 0, 'Escape closes it');
      await help.click(); await p.waitForTimeout(200); await help.click(); await p.waitForTimeout(200);
      pass(await text.count() === 0, 'a second press closes it');
      await help.click(); await p.waitForTimeout(200);
      await p.mouse.click(5, 5); await p.waitForTimeout(200);
      pass(await text.count() === 0, 'a click outside closes it');
      pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
      await ctx.close(); }
  }

  console.log('== Robo explains both numbers');
  for (const [lang, theme, vw, label] of [['en', 'light', 1440, 'EN light'], ['fr', 'dark', 1440, 'FR dark'], ['fr', 'light', 390, 'FR 390']]) {
    const { p, ctx } = await open({ lang, theme, vw, vh: vw < 768 ? 844 : 900 });
    if (vw < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)|ouvrir/i }).first().click().catch(() => {}); await p.waitForTimeout(300); }
    await p.locator('[data-support-open]').locator('visible=true').first().click().catch(() => {}); await p.waitForTimeout(500);
    await p.locator('[data-tour-open]').click().catch(() => {}); await p.waitForTimeout(900);
    await p.getByRole('button', { name: /^(Next|Suivant)$/ }).click(); await p.waitForTimeout(650);
    await p.getByRole('button', { name: /^(Next|Suivant)$/ }).click(); await p.waitForTimeout(650);
    const tour = p.locator('[data-testid="guide-buddy"]');
    pass(await tour.getAttribute('data-step') === 'meaning', label + ': the step after the dashboard is the one on the two numbers');
    const body = await tour.innerText();
    pass(lang === 'fr' ? /Confiance et risque/.test(body) && /sûr/.test(body) : /Confidence and risk/.test(body) && /how sure/.test(body), label + ': title and text in the right language');
    pass(/Risque élevé|High risk/.test(body) && /Exemple|Example/.test(body), label + ': the three rules and an example are shown');
    const card = await p.getByTestId('guide-card').boundingBox();
    pass(card && card.x >= 0 && card.y >= 0 && card.x + card.width <= vw && card.y + card.height <= (vw < 768 ? 844 : 900), label + ': the card stays on screen');
    await p.screenshot({ path: path.join(SHOTS, `termhelp-tour-${label.replace(/ /g, '-')}.png`) });
    pass(p._errors.length === 0, label + ': no page errors ' + p._errors.join('|'));
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`); process.exit(fails ? 1 : 0);
})();
