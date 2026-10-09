// A pharmacy stock alert says when to order, from the wholesalers the pharmacy listed and the days of
// stock left the API sends (`stock_days_left`). Checks: it shows in the alert detail and in the
// recommendation popup; with no wholesaler it offers to set them up and opens the page; a wholesaler
// that is too slow shows what the gap would be; an alert without the number, and an expiry alert,
// say nothing about delivery; French and a phone.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const TODAY = (new Date().getUTCDay() + 6) % 7; // the account clock is GMT
const dayName = (offset, lang = 'en') => new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + ((TODAY + offset) % 7))));
const ALL = [true, true, true, true, true, true, true];
const W = (id, name, before, after = before, cutoff = null) => ({ id, name, cutoff, before, after, days: ALL });
const now = new Date().toISOString();
const rec = (eq, key) => ({ equipment: eq, sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, message: `MSG ${eq}`, alert_key: key, recommended_action: `ACT ${eq}`, action_category: 'stock', confidence: 0.8 });
const alertOf = (eq, key, params) => ({ id: eq, equipment: eq, sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, alert_key: key, message: `MSG ${eq}`, risk_score: 70, params });

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ key = 'health.stock.critical_low', params = [['stock', 50], ['stock_days_left', 2]], wholesalers = null, lang = 'en', theme = 'light', vw = 1440, popup = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vw < 500 ? 844 : 1000 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US', timezoneId: 'UTC' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([alertOf('Amoxicillin', key, params)]) }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: [rec('Amoxicillin', key)] }) }));
    await p.route(/\/(contractors|assignments)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"contractors":[],"assignments":[]}' }));
    const store = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: lang, sentria_company_name: 'Acme', sentria_theme: theme, sentria_timezone: 'gmt' };
    if (wholesalers) store.sentria_wholesalers = JSON.stringify(wholesalers);
    await p.addInitScript(s => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } }, store);
    await signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    await p.locator('tbody tr').first().click(); await p.waitForTimeout(500);
    if (popup) { await p.getByRole('button', { name: lang === 'fr' ? /Voir la recommandation/ : /See the recommendation/ }).first().click(); await p.waitForTimeout(700); }
    return { p, ctx };
  };
  const msg = async p => (await p.getByTestId('alert-advice-message').first().innerText()).replace(/\s+/g, ' ');
  const fb = async p => (await p.getByTestId('alert-advice-fallback').first().innerText()).replace(/\s+/g, ' ');

  console.log('== with wholesalers: the alert detail');
  { const { p, ctx } = await open({ wholesalers: [W('a', 'Dakar Centre', 0), W('b', 'Thiès', 3)] });
    pass(await p.getByTestId('alert-advice').count() === 1, 'a stock alert with days of stock left shows the advice');
    const rowLine = p.locator('#alerts-table tbody tr').first().getByTestId('alert-advice-line');
    pass(await rowLine.count() === 1 && /Order from Dakar Centre now\. It arrives today\./.test(await rowLine.innerText()), 'and the alerts list says it in the message itself, under the alert');
    const panelLine = p.locator('[data-testid=alert-advice-line]').filter({ hasNot: p.locator('#alerts-table') });
    pass(await p.locator('main').getByTestId('alert-advice-line').count() >= 2, 'and the priority card above the list says it too');
    pass(await msg(p) === 'Order from Dakar Centre now. It arrives today.', `stock lasts 2 days: ${await msg(p)}`);
    pass((await fb(p)).includes(`Thiès arrives ${dayName(3)}. You would run out for 1 day.`), `and what a miss costs: ${await fb(p)}`);
    pass(!/has the product|has it in stock/i.test(await p.getByTestId('alert-advice').innerText()), 'it never says a wholesaler has the product');
    await p.screenshot({ path: 'alertadvice-detail-light.png' });
    await p.locator('main').screenshot({ path: 'alertadvice-list-light.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== too slow');
  { const { p, ctx } = await open({ params: [['stock', 20], ['stock_days_left', 1]], wholesalers: [W('a', 'Dakar Centre', 3), W('b', 'Thiès', 4)] });
    pass((await msg(p)).includes(`No wholesaler arrives in time. Dakar Centre is the fastest: ${dayName(3)}.`), `nobody in time: ${await msg(p)}`);
    pass((await fb(p)).includes('run out for 2 days'), `and the gap: ${await fb(p)}`);
    pass(await p.getByTestId('alert-advice').getAttribute('data-late') !== null, 'the card is marked late');
    await ctx.close(); }
  { const { p, ctx } = await open({ params: [['stock', 20], ['stock_days_left', 5]], wholesalers: [W('a', 'Dakar Centre', 6), W('b', 'Thiès', 2)] });
    pass((await msg(p)).startsWith('Order from Thiès now. It arrives ' + dayName(2)), `the first wholesaler too slow, the second in time: ${await msg(p)}`);
    await ctx.close(); }

  console.log('== the popup');
  { const { p, ctx } = await open({ popup: true, wholesalers: [W('a', 'Dakar Centre', 0), W('b', 'Thiès', 3)] });
    const dialog = p.locator('[aria-labelledby=recommendation-dialog-title]');
    pass(await dialog.getByTestId('alert-advice').count() === 1, 'the recommendation popup shows it too');
    pass(/Order from Dakar Centre now\. It arrives today\./.test(await dialog.getByTestId('alert-advice-message').innerText()), 'with the same sentence');
    await p.screenshot({ path: 'alertadvice-popup-light.png' });
    await ctx.close(); }

  console.log('== no wholesaler yet');
  { const { p, ctx } = await open({});
    pass(await p.getByTestId('alert-advice').count() === 0 && await p.getByTestId('alert-advice-setup').count() === 1, 'it offers to add wholesalers, and gives no delivery advice');
    pass(await p.getByTestId('alert-advice-line').count() === 0, 'and the list rows stay quiet: no prompt on every row');
    pass(/Add your wholesalers to know when to order/.test(await p.getByTestId('alert-advice-setup').innerText()), 'in plain words');
    await p.getByRole('button', { name: 'Add my wholesalers' }).click(); await p.waitForTimeout(1000);
    pass(await p.getByTestId('wholesalers-card').count() === 1, 'the button opens the Wholesalers page');
    await ctx.close(); }
  { const { p, ctx } = await open({ popup: true });
    await p.locator('[aria-labelledby=recommendation-dialog-title]').getByRole('button', { name: 'Add my wholesalers' }).click(); await p.waitForTimeout(1000);
    pass(await p.getByTestId('wholesalers-card').count() === 1 && await p.locator('[aria-labelledby=recommendation-dialog-title]').count() === 0, 'from the popup too: it closes and opens the page');
    await ctx.close(); }

  console.log('== nothing is claimed without the figure');
  { const { p, ctx } = await open({ params: [['stock', 50]], wholesalers: [W('a', 'Dakar Centre', 0)] });
    pass(await p.getByTestId('alert-advice').count() === 0 && await p.getByTestId('alert-advice-setup').count() === 0, 'an alert without stock_days_left says nothing about delivery');
    await ctx.close(); }
  { const { p, ctx } = await open({ key: 'health.expiry.soon', params: [['days_left', 3]], wholesalers: [W('a', 'Dakar Centre', 0)] });
    pass(await p.getByTestId('alert-advice').count() === 0, 'an expiry alert (days_left is days to expiry) says nothing about delivery');
    pass(await p.getByTestId('alert-advice-line').count() === 0, 'not in the list either');
    await ctx.close(); }
  { const { p, ctx } = await open({ params: [['stock_days_left', 'soon']], wholesalers: [W('a', 'Dakar Centre', 0)] });
    pass(await p.getByTestId('alert-advice').count() === 0, 'a figure that is not a number is ignored');
    await ctx.close(); }
  { const { p, ctx } = await open({ params: { stock_days_left: 0 }, wholesalers: [W('a', 'Dakar Centre', 0)] });
    pass((await msg(p)).includes('It arrives today'), `a plain object of params works, and 0 days left is still advice: ${await msg(p)}`);
    await ctx.close(); }

  console.log('== French, dark, phone');
  { const { p, ctx } = await open({ lang: 'fr', theme: 'dark', wholesalers: [W('a', 'Dakar Centre', 0), W('b', 'Thiès', 3)] });
    pass(await msg(p) === 'Commandez chez Dakar Centre maintenant. Livraison aujourd\'hui.', `in French: ${await msg(p)}`);
    pass((await fb(p)).includes(`Thiès livre ${dayName(3, 'fr')}`), 'and the line under it');
    await p.screenshot({ path: 'alertadvice-detail-dark.png' });
    await ctx.close(); }
  { const { p, ctx } = await open({ vw: 390, popup: true, wholesalers: [W('a', 'Dakar Centre', 0), W('b', 'Thiès', 3)] });
    const over = await p.evaluate(() => { const d = document.querySelector('[aria-labelledby=recommendation-dialog-title]'); const a = d.querySelector('[data-testid=alert-advice]'); return d.scrollWidth > d.clientWidth + 1 || a.getBoundingClientRect().right > d.getBoundingClientRect().right; });
    pass(!over && await p.locator('[aria-labelledby=recommendation-dialog-title]').getByTestId('alert-advice').count() === 1, 'a phone: the advice is there and fits inside the popup');
    await p.screenshot({ path: 'alertadvice-popup-390.png' });
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
