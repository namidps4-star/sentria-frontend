// F-SITEGATE: "Add a site" is capped by plan (lib/plans.ts maxSitesFor):
// Découverte 1, Pro 1, Business 3, Entreprise unlimited. At the cap the add
// form is replaced by an upgrade prompt.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async (plan, { theme = 'light', vw = 1440 } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => json(r, { recommendations: [], assignments: [], contractors: [] }));
    await p.route(/\/alerts(\?|$)/, r => json(r, []));
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_language: 'en', sentria_theme: theme });
    await signedIn(p, 'u-1', 'a@b.c', { plan });
    await p.goto(APP_URL); await p.waitForTimeout(2000);
    // On a phone the sidebar is behind the menu button.
    if (vw < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click(); await p.waitForTimeout(400); }
    await p.getByRole('button', { name: /^Sites$/ }).first().click(); await p.waitForTimeout(600);
    return { p, ctx };
  };
  const addBtn = p => p.getByRole('button', { name: 'Add a site' }).locator('visible=true').first();
  const addSite = async (p, name) => {
    await addBtn(p).click(); await p.waitForTimeout(250);
    if (await p.getByPlaceholder('e.g. Lyon plant').count() === 0) return false;
    await p.getByPlaceholder('e.g. Lyon plant').fill(name);
    await p.getByRole('button', { name: 'Create the site' }).click(); await p.waitForTimeout(300);
    // Creating a site opens its detail page: back to the list.
    const back = p.getByRole('button', { name: 'All sites' });
    if (await back.count()) { await back.click(); await p.waitForTimeout(300); }
    return true;
  };
  const upgrade = p => p.getByRole('dialog', { name: 'Site limit reached' });

  for (const [plan, cap, label] of [['decouverte', 1, 'Découverte'], ['pro', 1, 'Pro'], ['business', 3, 'Business']]) {
    console.log(`== ${label}: ${cap} site${cap > 1 ? 's' : ''}`);
    const { p, ctx } = await open(plan);
    let added = 0;
    for (let i = 1; i <= cap; i++) { if (await addSite(p, `Site ${i}`)) added++; }
    pass(added === cap, `can add ${cap} (added ${added})`);
    await addBtn(p).click(); await p.waitForTimeout(300);
    pass(await upgrade(p).count() === 1, 'the next "Add a site" opens the upgrade prompt');
    pass(await p.getByPlaceholder('e.g. Lyon plant').count() === 0, 'and not the add form');
    const text = await upgrade(p).innerText();
    pass(new RegExp(`${cap} site`).test(text) && (plan === 'business' ? /Entreprise plan for unlimited sites/ : /Business includes 3 sites/).test(text), 'it says what the plan includes and what upgrading gives: ' + text.replace(/\s+/g, ' ').slice(0, 120));
    if (plan === 'decouverte') await p.screenshot({ path: 'sitegate-light.png' });
    await upgrade(p).getByRole('button', { name: 'See the plans' }).click(); await p.waitForTimeout(700);
    pass(/plan|Plan|pricing|Pricing/i.test(await p.evaluate(() => document.body.innerText)) && await upgrade(p).count() === 0, 'See the plans leaves the dialog and opens the plans page');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close();
  }

  console.log('== Entreprise: no cap');
  { const { p, ctx } = await open('entreprise');
    let added = 0; for (let i = 1; i <= 5; i++) { if (await addSite(p, `Site ${i}`)) added++; }
    pass(added === 5, 'five sites added, never stopped (added ' + added + ')');
    pass(await upgrade(p).count() === 0, 'no upgrade prompt'); await ctx.close(); }

  console.log('== dark and phone');
  { const { p, ctx } = await open('decouverte', { theme: 'dark' });
    await addSite(p, 'Site 1'); await addBtn(p).click(); await p.waitForTimeout(300);
    pass(await upgrade(p).count() === 1, 'dark: prompt shown'); await p.screenshot({ path: 'sitegate-dark.png' }); await ctx.close(); }
  { const { p, ctx } = await open('decouverte', { vw: 390 });
    await addSite(p, 'Site 1'); await addBtn(p).click(); await p.waitForTimeout(300);
    pass(await upgrade(p).count() === 1, '390 px: prompt shown');
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways page scroll');
    await p.screenshot({ path: 'sitegate-390.png' }); await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
