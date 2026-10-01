// P-BRAND: the views follow the theme tokens, so they look right in light,
// dark AND "system" (OS dark). A `dark:` class only applies when the theme is
// explicitly dark (`@custom-variant dark` is `.dark *`), so under "system" it
// silently doesn't: the pricing page's check marks went dark green on a dark
// card. The views use tokens instead.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

console.log('== no `dark:` classes in the views (source)');
const SRC = path.join(__dirname, '..', '..', 'components', 'sentria');
for (const f of ['sites-view', 'ask-view', 'settings-view', 'pricing-view', 'profile-view', 'report-view', 'sidebar', 'admin-view', 'admin-thresholds']) {
  const code = fs.readFileSync(path.join(SRC, f + '.tsx'), 'utf8');
  const hits = code.match(/\bdark:[a-z[!-][^\s"'`]*/g) || [];
  pass(hits.length === 0, `${f}.tsx: no dark: utility ${hits.slice(0, 3).join(' ')}`);
}
{ const report = fs.readFileSync(path.join(SRC, 'report-view.tsx'), 'utf8');
  pass(!/emerald-600/.test(report), 'report-view.tsx: the "good" text uses the success tag token, not emerald-600'); }

console.log('== pricing colours follow the theme');
const MINT = 'rgb(142, 232, 187)', DEEP = 'rgb(15, 97, 57)', LIGHT_TAG_BG = 'rgb(201, 242, 220)';
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async (theme, scheme) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US', colorScheme: scheme });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('/alerts') ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_language: 'en', sentria_theme: theme });
    await signedIn(p, 'u-1', 'a@b.c', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(2000);
    await p.locator('aside nav button').filter({ hasText: /^Subscription$/ }).locator('visible=true').first().click(); await p.waitForTimeout(900);
    return { p, ctx };
  };
  const colours = p => p.evaluate(() => {
    const check = document.querySelector('svg[class*="tag-success-fg"]');
    const yours = [...document.querySelectorAll('span')].find(s => s.textContent.trim() === 'Your plan');
    return { check: getComputedStyle(check).color, tagBg: getComputedStyle(yours).backgroundColor, tagInBusinessCard: !!yours.closest('.tags-light') };
  });

  for (const [label, theme, scheme, wantCheck] of [
    ['light', 'light', 'light', DEEP],
    ['explicit dark', 'dark', 'dark', MINT],
    ['system, OS dark', 'system', 'dark', MINT],
    ['system, OS light', 'system', 'light', DEEP],
  ]) {
    const { p, ctx } = await open(theme, scheme);
    const c = await colours(p);
    pass(c.check === wantCheck, `${label}: check marks are ${wantCheck} (got ${c.check})`);
    pass(c.tagBg === LIGHT_TAG_BG && c.tagInBusinessCard, `${label}: "Your plan" on the bright card keeps its light tag (got ${c.tagBg})`);
    pass(p._errors.length === 0, `${label}: no page errors ${p._errors.join('|')}`);
    if (theme === 'system' && scheme === 'dark') await p.screenshot({ path: 'brand-pricing-system-dark.png' });
    await ctx.close();
  }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
