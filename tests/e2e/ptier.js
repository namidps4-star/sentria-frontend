// P-TIER: the app follows the plan table the API serves (GET /plans).
// The API is mocked with CHANGED numbers; the pricing page, the Sites cap and
// the onboarding rules must show them, with no frontend change. With no answer
// (API down) the bundled defaults apply.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const text = p => p.evaluate(() => document.body.innerText);

const E = (o) => ({ sectors: 1, departments: 'one', sites: 1, users: 1, ask_per_month: 20, history_days: 30, sms: false, tracking: false, ml: false, ...o });
const TABLE = {
  order: ['decouverte', 'pro', 'business', 'entreprise'],
  entitlements: {
    decouverte: E({ sites: 2, ask_per_month: 7, history_days: 14 }),
    pro: E({ users: 4, ask_per_month: null, history_days: 365, sms: true, tracking: true }),
    business: E({ departments: 'linked', sites: 6, users: 12, ask_per_month: null, history_days: 730, sms: true, tracking: true, ml: true }),
    entreprise: E({ sectors: null, departments: 'any', sites: null, users: null, ask_per_month: null, history_days: null, sms: true, tracking: true, ml: true }),
  },
  department_groups: {},
  your_plan: 'decouverte',
};

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ plans, theme = 'light', vw = 1440, plan = 'decouverte' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    p._asked = 0;
    await p.route(/onrender\.com\//, r => {
      const u = r.request().url();
      if (/\/plans(\?|$)/.test(u)) { p._asked++; return plans ? json(r, plans) : json(r, { detail: 'down' }, 503); }
      if (/\/alerts(\?|$)/.test(u)) return json(r, []);
      return json(r, { recommendations: [], assignments: [], contractors: [] });
    });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_language: 'en', sentria_theme: theme });
    await signedIn(p, 'u-1', 'a@b.c', { plan });
    await p.goto(APP_URL); await p.waitForTimeout(2200);
    if (vw < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click(); await p.waitForTimeout(400); }
    return { p, ctx };
  };
  const go = async (p, re) => { await p.locator('aside nav button, nav button').filter({ hasText: re }).locator('visible=true').first().click(); await p.waitForTimeout(800); };

  console.log('== the API answers with changed numbers');
  { const { p, ctx } = await open({ plans: TABLE });
    pass(p._asked >= 1, 'the app asked GET /plans after sign-in');
    await go(p, /Pricing|Plans|Subscription/); const t = await text(p);
    pass(/7 questions\/month/.test(t), 'pricing: Découverte shows 7 questions/month (was 20)');
    pass(/14-day history/.test(t), 'pricing: 14-day history (was 30)');
    pass(/6 sites · 12 users/.test(t), 'pricing: Business shows 6 sites · 12 users (was 3 · 10)');
    pass(/2 sites · 1 user/.test(t), 'pricing: Découverte shows 2 sites');
    pass(!/20 questions\/month/.test(t), 'the old 20 is gone');
    await p.screenshot({ path: 'ptier-light.png' });
    await go(p, /^Sites$/);
    const addBtn = p.getByRole('button', { name: 'Add a site' }).locator('visible=true').first();
    let added = 0;
    for (let i = 1; i <= 2; i++) {
      await addBtn.click(); await p.waitForTimeout(250);
      if (await p.getByPlaceholder('e.g. Lyon plant').count() === 0) break;
      await p.getByPlaceholder('e.g. Lyon plant').fill(`S${i}`); await p.getByRole('button', { name: 'Create the site' }).click(); await p.waitForTimeout(300);
      const back = p.getByRole('button', { name: 'All sites' }); if (await back.count()) { await back.click(); await p.waitForTimeout(300); }
      added++;
    }
    await addBtn.click(); await p.waitForTimeout(300);
    pass(added === 2, 'Sites: two can be added now (the API says 2), added ' + added);
    pass(await p.getByRole('dialog', { name: 'Site limit reached' }).count() === 1, 'and the third opens the upgrade prompt');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== API unreachable: the defaults');
  { const { p, ctx } = await open({ plans: null });
    await go(p, /Pricing|Plans|Subscription/); const t = await text(p);
    pass(/20 questions\/month/.test(t) && /3 sites · 10 users/.test(t), 'pricing shows the bundled numbers (20 questions, 3 sites · 10 users)');
    pass(p._errors.length === 0, 'no page errors');
    await ctx.close(); }

  console.log('== a malformed answer is ignored');
  { const bad = { ...TABLE, entitlements: { ...TABLE.entitlements, pro: { sectors: 'many' } } };
    const { p, ctx } = await open({ plans: bad });
    await go(p, /Pricing|Plans|Subscription/); const t = await text(p);
    pass(/20 questions\/month/.test(t) && !/7 questions\/month/.test(t), 'nothing applied; the defaults stay');
    await ctx.close(); }

  console.log('== dark and phone');
  { const { p, ctx } = await open({ plans: TABLE, theme: 'dark' });
    await go(p, /Pricing|Plans|Subscription/);
    pass(/7 questions\/month/.test(await text(p)), 'dark: changed numbers shown'); await p.screenshot({ path: 'ptier-dark.png' }); await ctx.close(); }
  { const { p, ctx } = await open({ plans: TABLE, vw: 390 });
    await go(p, /Pricing|Plans|Subscription/);
    pass(/7 questions\/month/.test(await text(p)), '390 px: changed numbers shown');
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways page scroll');
    await p.screenshot({ path: 'ptier-390.png' }); await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
