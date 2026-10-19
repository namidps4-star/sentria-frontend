// An opened alert's Recommendation and Why follow the app's language. The read for one alert used to be kept by
// alert name only, so a copy fetched in French stayed on screen after the person switched to English.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

const now = new Date().toISOString();
const ALERT = { id: 'a1', equipment: 'DK-5678-B', sector: 'transportation', business_type: 'transporteur-routier', severity: 'CRITICAL', date: now, alert_key: 'transport.border_wait.critical', message: 'MSG', risk_score: 28, params: [['hours', 5]] };
const REC = lang => ({ equipment: 'DK-5678-B', sector: 'transportation', business_type: 'transporteur-routier', severity: 'CRITICAL', date: now, message: 'MSG', alert_key: 'transport.border_wait.critical',
  recommended_action: lang === 'fr' ? 'ACTION FR relancer le dossier' : 'ACTION EN chase the file', reasoning: lang === 'fr' ? 'POURQUOI FR' : 'WHY EN', action_category: 'delay', confidence: 0.66 });

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ slowFrench = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fr-FR', timezoneId: 'UTC' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message)); p._asked = [];
    await p.route(/\/alerts(\?|$)/, r => json(r, [ALERT]));
    await p.route(/\/recommendations/, async r => {
      const u = new URL(r.request().url());
      if (!u.searchParams.has('equipment')) return json(r, { recommendations: [] }); // the top list holds nothing, so the one-alert read answers
      const lang = u.searchParams.get('lang'); p._asked.push(lang);
      if (slowFrench && lang === 'fr') await new Promise(res => setTimeout(res, 1500));
      return json(r, { recommendations: [REC(lang)] });
    });
    await p.route(/\/(contractors|assignments)/, r => json(r, { contractors: [], assignments: [] }));
    await p.addInitScript(s => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } },
      { sentria_onboarded: '1', sentria_sector: 'transportation', sentria_sectors: '["transportation"]', sentria_business_type: 'transporteur-routier', sentria_language: 'fr', sentria_company_name: 'Acme', sentria_timezone: 'gmt' });
    await signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    await p.locator('tbody tr').first().click(); await p.waitForTimeout(400);
    return { p, ctx };
  };
  const toEnglish = async p => { await p.evaluate(() => { localStorage.setItem('sentria_language', 'en'); window.dispatchEvent(new Event('sentria_locale_updated')); }); await p.waitForTimeout(2800); };
  const body = p => p.locator('body').innerText();

  console.log('== French read finished, then English is chosen');
  { const { p, ctx } = await open();
    let t = await body(p);
    pass(/ACTION FR/.test(t) && /POURQUOI FR/.test(t), 'opened in French: the French action and why');
    await toEnglish(p);
    t = await body(p);
    pass(/ACTION EN/.test(t) && /WHY EN/.test(t), 'after switching to English: the English action and why');
    pass(!/ACTION FR|POURQUOI FR/.test(t), 'and no French action or why is left');
    pass(p._asked.includes('fr') && p._asked.includes('en'), 'the alert was read again in English: ' + p._asked.join(','));
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== English is chosen while the French read is still on its way');
  { const { p, ctx } = await open({ slowFrench: true });
    await p.waitForTimeout(200);
    await toEnglish(p);
    await p.waitForTimeout(1500);
    const t = await body(p);
    pass(/ACTION EN/.test(t) && !/ACTION FR/.test(t), 'the late French answer does not replace the English one');
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
  process.exit(fails ? 1 : 0);
})();
