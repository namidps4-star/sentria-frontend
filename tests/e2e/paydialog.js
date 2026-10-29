// BILL-STRIPE: the in-app card form. With Stripe's publishable key from /billing/status, Choose opens the form
// (mockup A) instead of Stripe Checkout: the plan on a dark panel with its perks and the total, then email, the card /
// mobile money slider (mobile money disabled, "Soon"), Stripe's card fields, name and country. Pay starts the
// subscription on the API, confirms the card with Stripe.js, and only says the payment was received: the plan is
// never set here. A declined card retries on the same subscription. Without the key, or if Stripe.js cannot load,
// Stripe's own page is used. Stripe.js is faked here; the real one is never loaded.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
const { PLANS_ANSWER } = require('./plans-fixture');
const fs = require('fs');
const path = require('path');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const KEY = 'pk_test_fake123';
const ON = { enabled: true, can_buy: true, yearly: { pro: true, business: false }, portal: false, card_key: KEY };
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Atlantis', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_country: 'BJ', sentria_currency: 'EUR' };
const SHOTS = path.join(__dirname, 'screenshots');

// A stand-in for Stripe.js v3: three plain inputs in place of Stripe's iframes, and a confirm that answers what the
// test asks for and records what it was given.
const FAKE_STRIPE = `
window.__stripe = { key: null, options: null, confirms: [], next: [] };
window.Stripe = function (key, options) {
  window.__stripe.key = key; window.__stripe.options = options;
  return {
    elements: function () {
      return {
        create: function (kind) {
          var handlers = []; var input;
          return {
            mount: function (node) {
              input = document.createElement('input');
              input.setAttribute('data-fake', kind);
              input.style.cssText = 'all:unset;width:100%;font-size:15px';
              input.placeholder = kind === 'cardNumber' ? '1234 1234 1234 1234' : kind === 'cardExpiry' ? 'MM / YY' : 'CVC';
              input.addEventListener('input', function () {
                var need = kind === 'cardNumber' ? 16 : kind === 'cardExpiry' ? 4 : 3;
                var digits = input.value.replace(/\\D/g, '').length;
                handlers.forEach(function (h) { h({ complete: digits >= need, empty: digits === 0 }); });
              });
              node.appendChild(input);
            },
            on: function (event, handler) { if (event === 'change') handlers.push(handler); },
            update: function () {},
            destroy: function () { if (input) input.remove(); }
          };
        }
      };
    },
    confirmCardPayment: function (secret, data) {
      var d = data.payment_method.billing_details;
      window.__stripe.confirms.push({ secret: secret, name: d.name, email: d.email, country: d.address.country, card: !!data.payment_method.card });
      var next = window.__stripe.next.shift() || { paymentIntent: { status: 'succeeded' } };
      return new Promise(function (resolve) { setTimeout(function () { resolve(next); }, 150); });
    }
  };
};`;

(async () => {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch(LAUNCH);
  const open = async ({ status = ON, subscribe = { client_secret: 'pi_3Test_secret_Abc' }, subscribeStatus = 200, stripeJs = 'fake', vw = 1440, vh = 1000, theme = 'light', lang = 'en' } = {}) => {
    const ctx = await b.newContext({ viewport: { width: vw, height: vh }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage();
    p._errs = []; p._posts = [];
    p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/stripe\.com\//, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Stripe test page</body></html>' }));
    await p.route(/js\.stripe\.com\/v3/, r => stripeJs === 'fake' ? r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_STRIPE }) : r.abort());
    await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await p.route(/onrender\.com\//, r => {
      const req = r.request(); const u = new URL(req.url());
      const send = (body, code = 200) => r.fulfill({ status: code, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (u.pathname === '/plans') return send(PLANS_ANSWER);
      if (u.pathname === '/billing/status') return send(status);
      if (u.pathname === '/billing/subscribe') { p._posts.push({ path: u.pathname, body: JSON.parse(req.postData() || '{}') }); return send(subscribe, subscribeStatus); }
      if (u.pathname === '/billing/checkout') { p._posts.push({ path: u.pathname, body: JSON.parse(req.postData() || '{}') }); return send({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' }); }
      return send({ recommendations: [], assignments: [], contractors: [], alerts: [] });
    });
    await p.addInitScript(v => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(v).forEach(([k, val]) => localStorage.setItem(k, val)); } }, { ...LS, sentria_theme: theme, sentria_language: lang });
    await signedIn(p, 'u', 'boss@atlantis.bj', { plan: 'decouverte' });
    await p.goto(APP_URL); await p.waitForTimeout(1800);
    if (vw < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click().catch(() => {}); await p.waitForTimeout(300); }
    await p.locator('aside nav button').filter({ hasText: /^(Subscription|Abonnement)$/ }).locator('visible=true').first().click(); await p.waitForTimeout(1000);
    return { p, ctx };
  };
  const fillCard = async (p, number = '4242424242424242') => {
    await p.locator('[data-fake="cardNumber"]').fill(number);
    await p.locator('[data-fake="cardExpiry"]').fill('1230');
    await p.locator('[data-fake="cardCvc"]').fill('123');
  };
  const dialog = p => p.getByTestId('pay-dialog');

  console.log('== Choose opens the card form, not Stripe Checkout');
  let { p, ctx } = await open();
  await p.getByTestId('buy-pro').click(); await p.waitForTimeout(900);
  pass(await dialog(p).count() === 1 && !/stripe\.com/.test(p.url()), 'the form opens in the app');
  pass(await p.evaluate(() => window.__stripe && window.__stripe.key) === KEY, 'Stripe.js loads with the publishable key from the API');
  pass((await p.locator('#pay-plan').textContent()).trim() === 'Pro', 'the plan name is the big title');
  const perks = await p.getByTestId('pay-perks').locator('li').allTextContents();
  pass(perks.length === 4 && /1 site/.test(perks[0]) && /SMS/.test(perks[1]) && /Ask SentrIA/.test(perks[2]) && /12-month/.test(perks[3]), 'four perks, from the plan table: ' + perks.join(' | '));
  pass(/Total, every month/.test(await p.getByTestId('pay-total').textContent()) && /29\s*€/.test(await p.getByTestId('pay-total').textContent()), 'the total sits at the bottom of the panel');
  pass(await p.locator('[data-testid="pay-total"] b').evaluate(e => getComputedStyle(e).color) !== await p.locator('#pay-plan').evaluate(e => getComputedStyle(e).color), 'the total is lime, not white');
  pass(await p.getByTestId('pay-email').inputValue() === 'boss@atlantis.bj', 'the email starts as the signed-in address');
  const mms = ['pay-mm-mpesa', 'pay-mm-momo', 'pay-mm-orange'];
  pass(await Promise.all(mms.map(id => p.getByTestId(id).isDisabled())).then(a => a.every(Boolean)) && /Soon/.test(await p.getByTestId('pay-mm-mpesa').textContent()), 'M-Pesa, MTN MoMo and Orange Money are on the slider, disabled, Soon');
  pass(await Promise.all(['pay-mm-mpesa', 'pay-mm-momo', 'pay-mm-orange'].map(id => p.getByTestId(id).locator('img').evaluate(i => i.complete && i.naturalWidth > 0))).then(a => a.every(Boolean)), 'each option shows its official logo');
  pass(await p.getByTestId('pay-country').inputValue() === 'BJ', 'the billing country starts as the account country');
  pass(/Pay 29\s*€ per month/.test(await p.getByTestId('pay-submit').textContent()), 'the button says the amount and period');
  pass(await p.locator('[data-fake="cardNumber"]').count() === 1 && await p.locator('[data-fake="cardExpiry"]').count() === 1 && await p.locator('[data-fake="cardCvc"]').count() === 1, "Stripe's three card fields are mounted");
  const box = await dialog(p).boundingBox();
  pass(box.y >= 0 && box.y + box.height <= 1000 && box.x >= 0 && box.x + box.width <= 1440, 'the dialog fits the screen');
  await p.screenshot({ path: path.join(SHOTS, 'paydialog-light.png') });

  console.log('== checks before Stripe');
  await p.getByTestId('pay-submit').click(); await p.waitForTimeout(300);
  pass(/name on the card/i.test(await p.getByTestId('pay-problem').textContent()), 'no name: said, nothing sent');
  await p.getByTestId('pay-name').fill('Ama Mensah');
  await p.getByTestId('pay-submit').click(); await p.waitForTimeout(300);
  pass(/card number, date and code/i.test(await p.getByTestId('pay-problem').textContent()), 'an incomplete card: said, nothing sent');
  await p.getByTestId('pay-email').fill('not-an-email');
  await p.getByTestId('pay-submit').click(); await p.waitForTimeout(300);
  pass(/not valid/i.test(await p.getByTestId('pay-problem').textContent()), 'a bad email: said, nothing sent');
  pass(p._posts.length === 0 && (await p.evaluate(() => window.__stripe.confirms.length)) === 0, 'no subscription and no charge so far');

  console.log('== a declined card, then a good one on the same subscription');
  await p.getByTestId('pay-email').fill('ama@atlantis.bj');
  await fillCard(p, '4000000000000002');
  await p.evaluate(() => window.__stripe.next.push({ error: { type: 'card_error', message: 'Your card was declined.' } }));
  await p.getByTestId('pay-submit').click(); await p.waitForTimeout(900);
  pass(p._posts.length === 1 && p._posts[0].body.plan === 'pro' && p._posts[0].body.interval === 'month' && p._posts[0].body.email === 'ama@atlantis.bj', 'Pay starts the subscription with plan, period and email');
  pass(!('amount' in p._posts[0].body) && !('currency' in p._posts[0].body) && !('price' in p._posts[0].body), 'the browser names no amount, price or currency');
  const first = await p.evaluate(() => window.__stripe.confirms[0]);
  pass(first && first.secret === 'pi_3Test_secret_Abc' && first.card && first.name === 'Ama Mensah' && first.email === 'ama@atlantis.bj' && first.country === 'BJ', 'the card is confirmed with the client secret, name, email and country');
  pass(/declined/.test(await p.getByTestId('pay-problem').textContent()) && await p.getByTestId('pay-done').count() === 0, "Stripe's decline is shown, nothing is marked paid");
  await fillCard(p);
  await p.getByTestId('pay-submit').click(); await p.waitForTimeout(900);
  pass(p._posts.length === 1 && (await p.evaluate(() => window.__stripe.confirms.length)) === 2, 'the retry reuses the same subscription, no second one');
  pass(await p.getByTestId('pay-done').count() === 1 && /Payment received/.test(await p.getByTestId('pay-done').textContent()), 'paid: the form says the payment was received');
  pass(/once Stripe confirms/.test(await p.getByTestId('pay-done').textContent()), 'and that the plan changes when Stripe confirms, not now');
  const stored = await p.evaluate(() => JSON.stringify(localStorage));
  pass(!/"plan"\s*:\s*"pro"/.test(stored), 'the browser did not set the plan');
  await p.getByTestId('pay-done').getByRole('button', { name: 'Close' }).click(); await p.waitForTimeout(700);
  pass(await dialog(p).count() === 0 && await p.getByTestId('billing-returned').count() === 1, 'closed: the page says the payment was received');
  pass(p._errs.length === 0, 'no page errors: ' + p._errs.join(' | '));
  await ctx.close();

  console.log('== the API refuses');
  ({ p, ctx } = await open({ subscribe: { detail: { error_code: 'billing_already_subscribed' } }, subscribeStatus: 409 }));
  await p.getByTestId('buy-business').click(); await p.waitForTimeout(900);
  await p.getByTestId('pay-name').fill('Ama Mensah'); await fillCard(p);
  await p.getByTestId('pay-submit').click(); await p.waitForTimeout(900);
  pass(/Manage my subscription/.test(await p.getByTestId('pay-problem').textContent()) && (await p.evaluate(() => window.__stripe.confirms.length)) === 0, 'already subscribed: sent to Manage my subscription, the card is not charged');
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  pass(await dialog(p).count() === 0, 'Escape closes the form');
  await ctx.close();

  console.log('== yearly');
  ({ p, ctx } = await open());
  await p.getByRole('button', { name: 'Annual' }).click(); await p.waitForTimeout(300);
  await p.getByTestId('buy-pro').click(); await p.waitForTimeout(900);
  pass(/Total, every year/.test(await p.getByTestId('pay-total').textContent()) && /290\s*€/.test(await p.getByTestId('pay-total').textContent()), 'yearly: the total is the year');
  pass(/per year/.test(await p.getByTestId('pay-submit').textContent()), 'and the button says per year');
  await p.getByTestId('pay-close').click(); await p.waitForTimeout(500);
  pass(await dialog(p).count() === 0, 'the close button closes the form');
  await ctx.close();

  console.log('== without the key, or without Stripe.js');
  ({ p, ctx } = await open({ status: { ...ON, card_key: '' } }));
  await p.getByTestId('buy-pro').click(); await p.waitForURL(/checkout\.stripe\.com/, { timeout: 5000 }).catch(() => {});
  pass(/checkout\.stripe\.com/.test(p.url()) && p._posts[0]?.path === '/billing/checkout', 'no publishable key: Choose opens Stripe Checkout as before');
  await ctx.close();
  ({ p, ctx } = await open({ status: { ...ON, card_key: 'sk_test_oops' } })); // secret-scan: allow
  await p.getByTestId('buy-pro').click(); await p.waitForURL(/checkout\.stripe\.com/, { timeout: 5000 }).catch(() => {});
  pass(/checkout\.stripe\.com/.test(p.url()), 'a key that is not publishable is ignored: Checkout');
  await ctx.close();
  ({ p, ctx } = await open({ stripeJs: 'blocked' }));
  await p.getByTestId('buy-pro').click(); await p.waitForTimeout(1200);
  pass(await p.getByTestId('pay-fallback').count() === 1 && await p.getByTestId('pay-submit').count() === 0, 'Stripe.js blocked: the form says so and offers Stripe\'s page');
  await p.getByTestId('pay-fallback').getByRole('button').click(); await p.waitForURL(/checkout\.stripe\.com/, { timeout: 5000 }).catch(() => {});
  pass(/checkout\.stripe\.com/.test(p.url()), "and Stripe's page opens");
  await ctx.close();

  console.log('== dark, French, phone');
  ({ p, ctx } = await open({ theme: 'dark' }));
  await p.getByTestId('buy-pro').click(); await p.waitForTimeout(900);
  const panel = await p.locator('[data-testid="pay-dialog"] aside').evaluate(e => getComputedStyle(e).backgroundColor);
  pass(panel !== 'rgba(0, 0, 0, 0)', 'dark: the plan panel keeps its deep colour (' + panel + ')');
  await p.screenshot({ path: path.join(SHOTS, 'paydialog-dark.png') });
  await ctx.close();
  ({ p, ctx } = await open({ lang: 'fr' }));
  await p.getByTestId('buy-pro').click(); await p.waitForTimeout(900);
  pass(/Total, chaque mois/.test(await p.getByTestId('pay-total').textContent()) && /Payer 29\s*€ par mois/.test(await p.getByTestId('pay-submit').textContent()) && /Bientôt/.test(await p.getByTestId('pay-mm-mpesa').textContent()), 'French: total, button and Soon are French');
  pass(await p.evaluate(() => window.__stripe.options && window.__stripe.options.locale) === 'fr', "Stripe's fields and errors are in French");
  await ctx.close();
  ({ p, ctx } = await open({ vw: 390, vh: 844 }));
  await p.getByTestId('buy-pro').click(); await p.waitForTimeout(900);
  const pbox = await dialog(p).boundingBox();
  pass(pbox.x >= 0 && pbox.x + pbox.width <= 390, '390 px: the form fits the width');
  pass(await p.evaluate(() => document.documentElement.scrollWidth <= 390), '390 px: no sideways scroll');
  const boxes = await Promise.all(['pay-mm-mpesa', 'pay-mm-momo', 'pay-mm-orange'].map(id => p.getByTestId(id).boundingBox()));
  pass(boxes.every(b => b.x >= 0 && b.x + b.width <= 390), '390 px: every mobile money option fits the width');
  await p.screenshot({ path: path.join(SHOTS, 'paydialog-390.png') });
  await dialog(p).evaluate(e => { e.scrollTop = e.scrollHeight; });
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(SHOTS, 'paydialog-390-bottom.png') });
  await ctx.close();

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})();
