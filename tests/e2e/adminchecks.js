// Admin > Checks: the ring and the list, "not connected" when the API has no GitHub token, and a calm message
// when GitHub does not answer. English, French and 390 px.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const ok = (name, seconds) => ({ name, state: 'passed', seconds, url: `https://github.com/x/y/actions/runs/${name}` });
const DATA = {
  configured: true, total: 8, passed: 7, failed: 1, running: 0,
  repos: [
    { repo: 'namidps4-star/sentria-frontend', sha: '5645064', branch: 'new_feat', at: '2026-10-22T07:00:00Z', checks: [ok('ci', 192), ok('e2e', 640), ok('secret-scan', 6), ok('security', 41)] },
    { repo: 'namidps4-star/sentria', sha: 'af55f41', branch: 'retail_tst', at: '2026-10-22T07:00:00Z', checks: [ok('ci', 91), ok('secret-scan', 6), { name: 'security', state: 'failed', seconds: 12, url: null }, ok('smoke', 5)] },
  ],
};

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ checks, lang = 'en', theme = 'light', vw = 1440 } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 1100 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => { const u = new URL(r.request().url());
      if (u.pathname === '/admin/checks') return checks === 'down' ? json(r, { configured: true, error: 'github_unreachable' }) : checks === 'fail' ? json(r, { detail: { message: 'nope' } }, 500) : json(r, checks);
      if (u.pathname === '/admin/accounts') return json(r, { accounts: [] });
      if (u.pathname === '/admin/guard') return json(r, { enabled: true, forced_off: false, persisted: true, log: [] });
      return json(r, u.pathname === '/alerts' ? [] : { recommendations: [], assignments: [], contractors: [] }); });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: lang, sentria_theme: theme });
    await signedIn(p, 'u-me', 'boss@sentria.app', { plan: 'decouverte', isAdmin: true });
    await p.goto(APP_URL); await p.waitForTimeout(1800);
    if (vw < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click(); await p.waitForTimeout(400); }
    await p.locator('aside nav button', { hasText: /^Admin$/ }).locator('visible=true').first().click(); await p.waitForTimeout(1500);
    return { p, ctx };
  };

  console.log('== the ring and the list');
  { const { p, ctx } = await open({ checks: DATA });
    const card = p.getByTestId('admin-checks');
    const t = (await card.innerText()).replace(/\s+/g, ' ');
    pass(await card.getByRole('img', { name: '7 / 8' }).count() === 1, 'the ring reads 7 / 8');
    pass(/checks green/i.test(t) && /1 need you before the next merge/.test(t), 'it says 1 needs you before the next merge');
    pass(/sentria-frontend · new_feat · 5645064/.test(t) && /sentria · retail_tst · af55f41/.test(t), 'each repo shows its branch and commit');
    pass(await card.locator('li').count() === 8, 'all 8 checks are listed, none hidden behind a scroll');
    pass(/ci\s*passed\s*3 min 12 s/.test(t.replace(/(ci) (passed) (3 min 12 s)/, '$1$2$3').replace(/ /g, ' ')) || /3 min 12 s/.test(t), 'a time is shown: 3 min 12 s');
    pass(await card.locator('li', { hasText: 'security' }).filter({ hasText: 'failed' }).count() === 1, 'the failed check says failed for a screen reader');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await card.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    await card.screenshot({ path: 'adminchecks-light.png' });
    await ctx.close(); }

  console.log('== not connected, and GitHub down');
  { const { p, ctx } = await open({ checks: { configured: false } });
    const t = await p.getByTestId('checks-not-connected').innerText();
    pass(/Not connected/.test(t) && /GITHUB_CHECKS_TOKEN/.test(t), 'no token: it says so and names the setting');
    await ctx.close(); }
  { const { p, ctx } = await open({ checks: 'down' });
    pass(/Not measured/.test(await p.getByTestId('admin-checks').innerText()), 'GitHub down: "Not measured", not an empty screen');
    await ctx.close(); }
  { const { p, ctx } = await open({ checks: 'fail' });
    pass(await p.getByTestId('admin-checks').getByRole('alert').count() === 1, 'an API error shows an alert');
    await ctx.close(); }

  console.log('== French, dark and 390 px');
  { const { p, ctx } = await open({ checks: DATA, lang: 'fr', theme: 'dark' });
    const t = await p.getByTestId('admin-checks').innerText();
    pass(/Vérifications/.test(t) && /vérifications réussies/.test(t) && /à regarder avant la prochaine fusion/.test(t), 'French wording');
    await p.getByTestId('admin-checks').screenshot({ path: 'adminchecks-dark-fr.png' });
    await ctx.close(); }
  { const { p, ctx } = await open({ checks: DATA, vw: 390 });
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll at 390 px');
    await p.getByTestId('admin-checks').screenshot({ path: 'adminchecks-390.png' });
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
