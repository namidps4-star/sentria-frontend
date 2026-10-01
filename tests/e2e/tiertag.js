// F-TIERTAG: the sidebar's signed-in block shows the plan in force as a small
// tag next to the name. It follows the account (trial, admin) and updates live,
// here (PLAN_UPDATED_EVENT) and from another tab (storage), with no reload.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const tag = p => p.locator('[data-testid="plan-tag"]').locator('visible=true');
const tagText = async p => (await tag(p).count()) ? (await tag(p).first().innerText()).trim() : null;

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ plan = 'decouverte', trialEndsAt, isAdmin = false, name = '', theme = 'light', vw = 1440, ctx } = {}) => {
    ctx = ctx || await browser.newContext({ viewport: { width: vw, height: 900 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('/alerts') ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_language: 'en', sentria_theme: theme });
    await signedIn(p, 'u-1', 'ama@acme.test', { plan, trialEndsAt, isAdmin, meta: name ? { full_name: name } : {} });
    await p.goto(APP_URL); await p.waitForTimeout(2200);
    if (vw < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click(); await p.waitForTimeout(400); }
    return { p, ctx };
  };

  console.log('== each plan shows its own name');
  for (const [plan, label] of [['decouverte', 'Découverte'], ['pro', 'Pro'], ['business', 'Business'], ['entreprise', 'Entreprise']]) {
    const { p, ctx } = await open({ plan, name: 'Ama Koffi' });
    pass(await tagText(p) === label, `${plan}: tag reads "${label}" (got ${JSON.stringify(await tagText(p))})`);
    if (plan === 'decouverte') {
      const inBlock = await p.locator('[data-testid="signed-in-user"] [data-testid="plan-tag"]').count();
      pass(inBlock === 1, 'the tag sits inside the signed-in block');
      pass(/Ama Koffi/.test(await p.locator('[data-testid="signed-in-user"]').innerText()), 'the name is still shown');
      await p.screenshot({ path: 'tiertag-light.png' });
    }
    pass(p._errors.length === 0, `${plan}: no page errors ${p._errors.join('|')}`);
    await ctx.close();
  }

  console.log('== the plan in force, not the stored one');
  { const soon = new Date(Date.now() + 5 * 86400000).toISOString();
    const { p, ctx } = await open({ plan: 'decouverte', trialEndsAt: soon });
    pass(await tagText(p) === 'Business', `a running trial counts as Business (got ${JSON.stringify(await tagText(p))})`); await ctx.close(); }
  { const past = new Date(Date.now() - 86400000).toISOString();
    const { p, ctx } = await open({ plan: 'decouverte', trialEndsAt: past });
    pass(await tagText(p) === 'Découverte', 'an ended trial is back to Découverte'); await ctx.close(); }
  { const { p, ctx } = await open({ plan: 'decouverte', isAdmin: true });
    pass(await tagText(p) === 'Entreprise', 'staff (admin) see Entreprise'); await ctx.close(); }

  console.log('== it updates live, no reload');
  { const { p, ctx } = await open({ plan: 'decouverte', name: 'Ama Koffi' });
    pass(await tagText(p) === 'Découverte', 'starts on Découverte');
    await p.evaluate(() => { localStorage.setItem('sentria_plan', 'pro'); window.dispatchEvent(new Event('sentria_plan_updated')); });
    await p.waitForTimeout(300);
    pass(await tagText(p) === 'Pro', 'this tab: plan changed -> tag reads Pro (event)');

    // Another tab of the same browser changes the plan: only "storage" tells this one.
    const p2 = await ctx.newPage();
    await p2.goto(APP_URL); await p2.waitForTimeout(500);
    await p2.evaluate(() => localStorage.setItem('sentria_plan', 'business'));
    await p.waitForTimeout(500);
    pass(await tagText(p) === 'Business', `another tab: plan changed -> tag reads Business (got ${JSON.stringify(await tagText(p))})`);
    pass(p._errors.length === 0, 'no page errors'); await ctx.close(); }

  console.log('== a long name does not push the tag out');
  { const { p, ctx } = await open({ plan: 'entreprise', name: 'Maximilienne Anne-Sophie de la Rochefoucauld-Montmorency' });
    const r = await p.evaluate(() => {
      const aside = document.querySelector('aside').getBoundingClientRect();
      const t = document.querySelector('[data-testid="plan-tag"]').getBoundingClientRect();
      return { inside: t.left >= aside.left && t.right <= aside.right - 8, w: t.width };
    });
    pass(r.inside, 'the tag stays inside the sidebar, the name is cut instead');
    pass(await tagText(p) === 'Entreprise', 'and it is not cut');
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways page scroll');
    await ctx.close(); }

  console.log('== collapsed: the block is hidden, as before');
  { const { p, ctx } = await open({ plan: 'pro' });
    await p.getByRole('button', { name: /Collapse/ }).click(); await p.waitForTimeout(500);
    pass(await tag(p).count() === 0, 'no tag in the collapsed sidebar');
    pass(p._errors.length === 0, 'no page errors'); await ctx.close(); }

  console.log('== dark and phone');
  { const { p, ctx } = await open({ plan: 'business', name: 'Ama Koffi', theme: 'dark' });
    pass(await tagText(p) === 'Business', 'dark: tag shown'); await p.screenshot({ path: 'tiertag-dark.png' }); await ctx.close(); }
  { const { p, ctx } = await open({ plan: 'business', name: 'Ama Koffi', vw: 390 });
    pass(await tagText(p) === 'Business', '390 px: tag shown');
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways page scroll');
    await p.screenshot({ path: 'tiertag-390.png' }); await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
