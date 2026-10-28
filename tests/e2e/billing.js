// BILL-STRIPE: the Plans page opens Stripe. The boss gets a Choose button on Pro and Business when payment is on,
// yearly only where a yearly price exists, and a Manage button once Stripe knows the company. An employee, or
// payment switched off, keeps "Soon". Only a Stripe page is followed. Back from Stripe the page says what happened.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
const { PLANS_ANSWER } = require('./plans-fixture');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const ON = { enabled: true, can_buy: true, yearly: { pro: true, business: false }, portal: true };
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Atlantis', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' };

(async () => {
  const b = await chromium.launch(LAUNCH);
  const open = async ({ status = ON, role = null, checkout = { url: 'https://checkout.stripe.com/c/pay/cs_test_1' }, checkoutStatus = 200, vw = 1440, vh = 1000, theme = 'light', lang = 'en', path = '', nav = true } = {}) => {
    const ctx = await b.newContext({ viewport: { width: vw, height: vh }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage();
    p._errs = []; p._posts = [];
    p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/stripe\.com\//, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Stripe test page</body></html>' }));
    await p.route(/onrender\.com\//, r => {
      const req = r.request(); const u = new URL(req.url());
      const send = (body, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (u.pathname === '/plans') return send(PLANS_ANSWER);
      if (u.pathname === '/billing/status') return send(status);
      if (u.pathname === '/billing/checkout') { p._posts.push({ path: u.pathname, body: JSON.parse(req.postData() || '{}') }); return send(checkoutStatus === 200 ? checkout : { detail: { error_code: 'billing_unavailable' } }, checkoutStatus); }
      if (u.pathname === '/billing/portal') { p._posts.push({ path: u.pathname }); return send({ url: 'https://billing.stripe.com/p/session/test_1' }); }
      return send({ recommendations: [], assignments: [], contractors: [], alerts: [] });
    });
    await p.addInitScript(v => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(v).forEach(([k, val]) => localStorage.setItem(k, val)); } }, { ...LS, sentria_theme: theme, sentria_language: lang });
    await signedIn(p, 'u', 'a@b.c', { plan: 'decouverte', ...(role ? { role } : {}) });
    await p.goto(APP_URL + path); await p.waitForTimeout(1800);
    if (nav) {
      if (vw < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click().catch(() => {}); await p.waitForTimeout(300); }
      await p.locator('aside nav button').filter({ hasText: /^(Subscription|Abonnement)$/ }).locator('visible=true').first().click(); await p.waitForTimeout(1000);
    }
    return { p, ctx };
  };

  console.log('== the boss, payment on');
  let { p, ctx } = await open();
  pass(await p.getByTestId('buy-pro').count() === 1 && await p.getByTestId('buy-business').count() === 1, 'Choose on Pro and Business');
  pass(await p.getByTestId('buy-entreprise').count() === 0 && await p.getByText('Contact us').count() >= 1, 'Entreprise stays on request');
  pass(await p.getByTestId('buy-decouverte').count() === 0, 'nothing to buy on the free plan');
  pass(await p.getByText('Card payment with Stripe').count() === 1, 'the note says payment goes through Stripe');
  pass(await p.getByTestId('billing-portal').count() === 1, 'Manage my subscription shows once Stripe knows the company');
  await p.screenshot({ path: 'billing-boss-light.png', fullPage: false });
  await p.getByTestId('buy-pro').click(); await p.waitForURL(/checkout\.stripe\.com/, { timeout: 5000 }).catch(() => {});
  pass(p._posts[0]?.path === '/billing/checkout' && p._posts[0].body.plan === 'pro' && p._posts[0].body.interval === 'month', 'Choose asks for Pro, monthly: ' + JSON.stringify(p._posts[0]));
  pass(/checkout\.stripe\.com/.test(p.url()), 'and the browser goes to Stripe Checkout');
  pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
  await ctx.close();

  console.log('== yearly');
  ({ p, ctx } = await open());
  await p.getByRole('button', { name: /^(Yearly|Annual)/ }).first().click().catch(() => {}); await p.waitForTimeout(400);
  pass(await p.getByTestId('buy-pro').count() === 1 && await p.getByTestId('buy-business').count() === 0, 'yearly: Pro has a yearly price, Business does not');
  await p.getByTestId('buy-pro').click(); await p.waitForTimeout(800);
  pass(p._posts[0]?.body.interval === 'year', 'and Pro is asked for yearly');
  await ctx.close();

  console.log('== the portal');
  ({ p, ctx } = await open());
  await p.getByTestId('billing-portal').click(); await p.waitForURL(/billing\.stripe\.com/, { timeout: 5000 }).catch(() => {});
  pass(p._posts[0]?.path === '/billing/portal' && /billing\.stripe\.com/.test(p.url()), 'Manage opens the Stripe portal');
  await ctx.close();

  console.log('== failures');
  ({ p, ctx } = await open({ checkoutStatus: 502 }));
  await p.getByTestId('buy-business').click(); await p.waitForTimeout(800);
  pass(/Stripe is not answering/.test(await p.getByTestId('billing-failure').innerText()) && !/stripe\.com/.test(p.url()), 'Stripe failing: a plain message, the page stays');
  pass(await p.getByTestId('buy-business').isEnabled(), 'and the button works again');
  await ctx.close();
  ({ p, ctx } = await open({ checkout: { url: 'https://evil.test/pay' } }));
  await p.getByTestId('buy-pro').click(); await p.waitForTimeout(800);
  pass(!/evil\.test/.test(p.url()) && /could not open/.test(await p.getByTestId('billing-failure').innerText()), 'a page that is not Stripe is never followed');
  await ctx.close();

  console.log('== an employee, and payment off');
  ({ p, ctx } = await open({ role: 'employee', status: { enabled: true, can_buy: false, yearly: {}, portal: false } }));
  pass(await p.locator('[data-testid^="buy-"]').count() === 0 && await p.getByTestId('billing-portal').count() === 0, 'an employee gets no Choose and no Manage');
  await ctx.close();
  ({ p, ctx } = await open({ status: { enabled: false, can_buy: false, yearly: {}, portal: false } }));
  pass(await p.locator('[data-testid^="buy-"]').count() === 0 && await p.getByText('Soon').count() >= 1 && await p.getByText('coming soon').count() === 1, 'payment off: Soon, and the coming-soon note');
  await ctx.close();

  console.log('== back from Stripe');
  ({ p, ctx } = await open({ path: '/?billing=done', nav: false }));
  pass(/Payment received/.test(await p.getByTestId('billing-returned').innerText().catch(() => '')), 'back from a payment: the Plans page opens and says it was received');
  pass(!/billing=/.test(p.url()), 'and the address is put back');
  await ctx.close();
  ({ p, ctx } = await open({ path: '/?billing=cancelled', nav: false, vw: 390, vh: 844, theme: 'dark', lang: 'fr' }));
  pass(/Paiement annulé/.test(await p.getByTestId('billing-returned').innerText().catch(() => '')), 'back from a cancel, in French: nothing changed');
  pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll at 390 px');
  await p.screenshot({ path: 'billing-390-dark-fr.png' });
  await ctx.close();
  ({ p, ctx } = await open({ theme: 'dark' }));
  await p.screenshot({ path: 'billing-boss-dark.png' });
  await ctx.close();

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
