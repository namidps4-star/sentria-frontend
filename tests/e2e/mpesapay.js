// BILL-MPESA: a company in Kenyan shillings pays a month of a plan with M-PESA. Choose opens the payment form on
// M-PESA: a phone number, no card fields. Pay sends the prompt through the API (plan and phone only, never an amount),
// then the form waits and asks the API until Safaricom has answered: paid shows the end date, a cancel or a timeout
// says why and lets the person try again. Yearly is card only. The API is faked; Safaricom is never called.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
const { PLANS_ANSWER } = require('./plans-fixture');
const fs = require('fs');
const path = require('path');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const ON = { enabled: true, can_buy: true, yearly: { pro: true, business: false }, portal: false, card_key: '', mpesa: true, mpesa_until: null };
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Duka', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_country: 'KE', sentria_currency: 'KES' };
const SHOTS = path.join(__dirname, 'screenshots');
const UNTIL = '2026-11-28T10:00:00+00:00';

(async () => {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch(LAUNCH);
  const open = async ({ status = ON, pay = { checkout_id: 'ws_CO_1', amount: 2500, currency: 'KES' }, payStatus = 200, states = [], vw = 1440, vh = 1000, theme = 'light', lang = 'en' } = {}) => {
    const ctx = await b.newContext({ viewport: { width: vw, height: vh }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage();
    p._errs = []; p._posts = []; p._polls = []; p._states = [...states];
    p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/js\.stripe\.com\/v3/, r => r.abort());
    await p.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await p.route(/onrender\.com\//, r => {
      const req = r.request(); const u = new URL(req.url());
      const send = (body, code = 200) => r.fulfill({ status: code, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (u.pathname === '/plans') return send(PLANS_ANSWER);
      if (u.pathname === '/billing/status') return send(status);
      if (u.pathname === '/billing/mpesa/pay') { p._posts.push(JSON.parse(req.postData() || '{}')); return send(pay, payStatus); }
      if (u.pathname.startsWith('/billing/mpesa/')) { p._polls.push(u.pathname); return send(p._states.shift() || { status: 'pending' }); }
      return send({ recommendations: [], assignments: [], contractors: [], alerts: [] });
    });
    await p.addInitScript(v => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(v).forEach(([k, val]) => localStorage.setItem(k, val)); } }, { ...LS, sentria_theme: theme, sentria_language: lang });
    await signedIn(p, 'u', 'boss@duka.ke', { plan: 'decouverte' });
    await p.goto(APP_URL); await p.waitForTimeout(1800);
    if (vw < 768) { await p.getByRole('button', { name: /(open|ouvrir).*(menu|navigation)/i }).first().click().catch(() => {}); await p.waitForTimeout(300); }
    await p.locator('aside nav button').filter({ hasText: /^(Subscription|Abonnement)$/ }).locator('visible=true').first().click(); await p.waitForTimeout(1000);
    return { p, ctx };
  };
  const dialog = p => p.getByTestId('pay-dialog');

  console.log('== Choose opens the form on M-PESA');
  let { p, ctx } = await open({ states: [{ status: 'pending' }, { status: 'paid', plan: 'pro', paid_until: UNTIL }] });
  pass(/M-PESA/.test(await p.locator('main').innerText()), 'the Plans page says M-PESA is accepted');
  await p.getByTestId('buy-pro').click(); await p.waitForTimeout(800);
  pass(await dialog(p).count() === 1, 'Choose opens the payment form, though there is no card key');
  pass(await p.getByTestId('pay-mm-mpesa').getAttribute('aria-checked') === 'true' && await p.getByTestId('pay-mm-mpesa').locator('img').getAttribute('alt') === 'M-Pesa', 'M-PESA is picked, with its logo');
  pass(await p.getByTestId('pay-mm-momo').isDisabled() && await p.getByTestId('pay-mm-orange').isDisabled() && /Soon/.test(await p.getByTestId('pay-mm-momo').textContent()), 'MTN MoMo and Orange Money stay Soon');
  pass(await p.getByTestId('mpesa-phone').isVisible() && !(await p.getByTestId('pay-email').isVisible()) && !(await p.getByTestId('pay-name').isVisible()), 'a phone number, no email, no card fields');
  pass(/2[,\s  ]?500/.test(await p.getByTestId('mpesa-submit').textContent()) && /with M-PESA/.test(await p.getByTestId('mpesa-submit').textContent()), 'the button says the shilling amount: ' + (await p.getByTestId('mpesa-submit').textContent()).trim());
  pass(/covers 30 days/.test(await dialog(p).innerText()) && /does not renew by itself/.test(await dialog(p).innerText()), 'it says one payment covers 30 days and does not renew');
  await p.screenshot({ path: path.join(SHOTS, 'mpesapay-light.png') });

  console.log('== a bad number never reaches the API');
  await p.getByTestId('mpesa-phone').fill('12345');
  await p.getByTestId('mpesa-submit').click(); await p.waitForTimeout(300);
  pass(/not a Kenyan M-PESA number/.test(await p.getByTestId('pay-problem').textContent()) && p._posts.length === 0, 'a bad number: said, nothing sent');

  console.log('== pay, wait, paid');
  await p.getByTestId('mpesa-phone').fill('0712 345 678');
  await p.getByTestId('mpesa-submit').click(); await p.waitForTimeout(600);
  pass(p._posts.length === 1 && p._posts[0].plan === 'pro' && p._posts[0].phone === '254712345678', 'the API gets the plan and the normalised number');
  pass(!('amount' in p._posts[0]) && !('currency' in p._posts[0]), 'the browser names no amount and no currency');
  pass(await p.getByTestId('mpesa-waiting').isVisible() && /Check your phone/.test(await p.getByTestId('mpesa-waiting').textContent()), 'the form says to check the phone');
  pass(await p.getByTestId('pay-method-card').isDisabled(), 'the method cannot change while it waits');
  await p.screenshot({ path: path.join(SHOTS, 'mpesapay-waiting.png') });
  await p.waitForTimeout(7000);
  pass(p._polls.length >= 2 && p._polls.every(x => x === '/billing/mpesa/ws_CO_1'), 'it asks the API about this payment until it is answered (' + p._polls.length + ' times)');
  const done = p.getByTestId('pay-done');
  pass(await done.count() === 1 && /Safaricom confirmed it/.test(await done.textContent()) && /Pro until 28 November 2026/.test(await done.textContent()), 'paid: the plan and its end date');
  pass(await p.getByTestId('mpesa-see-plan').isVisible(), 'and a button to see the plan');
  pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
  await ctx.close();

  console.log('== cancelled on the phone, then tried again');
  ({ p, ctx } = await open({ states: [{ status: 'failed', reason: 'cancelled' }] }));
  await p.getByTestId('buy-business').click(); await p.waitForTimeout(800);
  await p.getByTestId('mpesa-phone').fill('0112345678');
  await p.getByTestId('mpesa-submit').click(); await p.waitForTimeout(4200);
  pass(p._posts[0].plan === 'business' && p._posts[0].phone === '254112345678', 'Business, from a 01… number');
  pass(/cancelled on the phone/.test(await p.getByTestId('pay-problem').textContent()) && await p.getByTestId('pay-done').count() === 0, 'cancelled: said, nothing marked paid');
  pass(await p.getByTestId('mpesa-submit').isVisible() && await p.getByTestId('mpesa-submit').isEnabled(), 'the button is back, to try again');
  await ctx.close();

  console.log('== a payment already waiting');
  ({ p, ctx } = await open({ pay: { detail: { error_code: 'mpesa_pending' } }, payStatus: 409 }));
  await p.getByTestId('buy-pro').click(); await p.waitForTimeout(800);
  await p.getByTestId('mpesa-phone').fill('0712345678');
  await p.getByTestId('mpesa-submit').click(); await p.waitForTimeout(600);
  pass(/already waiting for your PIN/.test(await p.getByTestId('pay-problem').textContent()), 'the API says one is pending: the form says to answer it');
  await ctx.close();

  console.log('== card and yearly');
  ({ p, ctx } = await open());
  await p.getByTestId('buy-pro').click(); await p.waitForTimeout(800);
  await p.getByTestId('pay-method-card').click(); await p.waitForTimeout(300);
  pass(await p.getByTestId('pay-email').isVisible() && !(await p.getByTestId('mpesa-phone').count()), 'Card shows the card form');
  await p.getByTestId('pay-mm-mpesa').click(); await p.waitForTimeout(300);
  pass(await p.getByTestId('mpesa-phone').isVisible(), 'and back to M-PESA');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.getByRole('button', { name: /^Annual$/ }).click(); await p.waitForTimeout(400);
  if (await p.getByTestId('buy-pro').count()) {
    await p.getByTestId('buy-pro').click(); await p.waitForTimeout(800);
    pass(await p.getByTestId('pay-mm-mpesa').isDisabled() && /Monthly/.test(await p.getByTestId('pay-mm-mpesa').textContent()), 'yearly: M-PESA is monthly only, the card is used');
  } else {
    pass(false, 'the yearly toggle was not found');
  }
  await ctx.close();

  console.log('== paid time on the Plans page, dark, French, 390 px');
  ({ p, ctx } = await open({ status: { ...ON, mpesa_until: UNTIL }, theme: 'dark' }));
  pass(/Paid by M-PESA until 28 November 2026/.test(await p.getByTestId('mpesa-until').textContent()), 'the page says until when M-PESA paid');
  await p.getByTestId('buy-pro').click(); await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(SHOTS, 'mpesapay-dark.png') });
  await ctx.close();
  ({ p, ctx } = await open({ lang: 'fr', vw: 390, vh: 844 }));
  await p.getByTestId('buy-pro').click(); await p.waitForTimeout(800);
  pass(/avec M-PESA/.test(await p.getByTestId('mpesa-submit').textContent()) && /couvre 30 jours/.test(await dialog(p).innerText()), 'French: button and the 30-day note');
  pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '390 px: no sideways scroll');
  const phone = await p.getByTestId('mpesa-phone').boundingBox();
  pass(phone && phone.x >= 0 && phone.x + phone.width <= 390, '390 px: the phone field fits');
  await p.screenshot({ path: path.join(SHOTS, 'mpesapay-390-fr.png') });
  await ctx.close();

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
