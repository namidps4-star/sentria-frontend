// A page in English never asks the API in French, and a French answer that lands late never replaces an
// English one. The first render of a view used to read the language one tick late, so every view asked
// for /alerts and /recommendations in French first, then again in English, and the French answer could
// arrive last. Checks: no French request on any view for an English account; and, on the dashboard, the
// report and the profile, a slow French answer after a switch to English is dropped; French stays French.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const now = new Date().toISOString();
const wait = ms => new Promise(r => setTimeout(r, ms));

const alertOf = lang => ({ id: 'a1', equipment: 'Doliprane', sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, alert_key: 'health.stock.critical_low', message: `MSG-${lang}`, risk_score: 70, params: [['stock', 5]] });
const recOf = lang => ({ equipment: 'Doliprane', sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, message: `MSG-${lang}`, alert_key: 'health.stock.critical_low', recommended_action: `ACT-${lang}`, action_category: 'stock', confidence: 0.8 });
const PROFILE = { sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  // `slow`: {lang: ms} delays the answers asked in that language. Every request is recorded.
  const open = async ({ lang = 'en', slow = {} } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    p._asked = [];
    await p.route(/onrender\.com\//, async r => {
      const u = new URL(r.request().url()); const asked = u.searchParams.get('lang') || 'fr'; const path = u.pathname;
      if (path === '/alerts' || path === '/recommendations') { p._asked.push(`${path}?lang=${asked}`); if (slow[asked]) await wait(slow[asked]); }
      if (path === '/alerts') return json(r, [alertOf(asked)]);
      if (path === '/recommendations') return json(r, { recommendations: [recOf(asked)] });
      return json(r, { recommendations: [], assignments: [], contractors: [], disposals: [] });
    });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } }, { ...PROFILE, sentria_language: lang });
    await signedIn(p, 'u-me', 'boss@sentria.app', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(2500);
    return { p, ctx };
  };
  const go = async (p, label) => { await p.locator('aside nav button', { hasText: new RegExp(`^${label}$`) }).first().click(); await p.waitForTimeout(1500); };
  const toEnglish = p => p.evaluate(() => { localStorage.setItem('sentria_language', 'en'); window.dispatchEvent(new Event('sentria_locale_updated')); });
  const text = p => p.locator('body').innerText();

  console.log('== an English account never asks in French');
  { const { p, ctx } = await open({ lang: 'en' });
    for (const view of ['Tracking', 'Calendar', 'Report', 'Profile', 'Ask SentrIA']) await go(p, view);
    const french = p._asked.filter(a => /lang=fr/.test(a));
    pass(p._asked.length > 0, `it did ask: ${p._asked.length} requests`);
    pass(french.length === 0, `no request in French on the dashboard, tracking, calendar, report, profile or ask (${french.join(', ') || 'none'})`);
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== a French account still asks in French');
  { const { p, ctx } = await open({ lang: 'fr' });
    pass(p._asked.length > 0 && p._asked.every(a => /lang=fr/.test(a)), 'every request is in French: ' + [...new Set(p._asked)].join(', '));
    await ctx.close(); }

  console.log('== a slow French answer after a switch to English is dropped');
  { const { p, ctx } = await open({ lang: 'fr', slow: { fr: 2500 } });
    await p.reload(); await p.waitForTimeout(700);
    await toEnglish(p); await p.waitForTimeout(3800);
    const t = await text(p);
    pass(/ACT-en/.test(t) && !/ACT-fr/.test(t), 'dashboard: the recommendation is English once the late French answer has landed');
    await ctx.close(); }
  { const { p, ctx } = await open({ lang: 'fr', slow: { fr: 2500 } });
    await go(p, 'Rapport'); await p.waitForTimeout(300);
    await toEnglish(p); await p.waitForTimeout(3800);
    const t = await text(p);
    pass(!/MSG-fr/.test(t), 'report: no French message after the late French answer');
    await ctx.close(); }
  { const { p, ctx } = await open({ lang: 'fr', slow: { fr: 2500 } });
    await go(p, 'Profil'); await p.waitForTimeout(300);
    await toEnglish(p); await p.waitForTimeout(3800);
    const t = await text(p);
    pass(!/MSG-fr/.test(t), 'profile: no French message after the late French answer');
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
  process.exit(fails ? 1 : 0);
})();
