// The Wholesalers page: a pharmacy lists who delivers to it, in order of preference, with a cutoff
// time and delivery days for each, and a panel shows who would arrive in time.
// Checks: the sidebar item (health accounts only), add, edit, remove, reorder (keys and drag),
// it persists and follows the account, the arithmetic of the test panel on a fixed Friday, the
// "late" and "never delivers" cases, French, dark and a phone.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

// The account clock is GMT, so "today" is today in UTC. Every delivery day is on in these checks, so the
// weekday does not change the answer; the one check that turns a day off counts from today.
const TODAY = (new Date().getUTCDay() + 6) % 7;
const dayName = (offset, lang = 'en') => new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + ((TODAY + offset) % 7))));
const ALL = [true, true, true, true, true, true, true];
const BASE = { sentria_onboarded: 'true', sentria_company_name: 'Pharmacie A', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_timezone: 'gmt' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ lang = 'en', theme = 'light', vw = 1440, ls = {}, wholesalers = null } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vw < 500 ? 2600 : 1500 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US', timezoneId: 'UTC' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: /\/recommendations/.test(r.request().url()) ? '{"recommendations":[]}' : /\/alerts/.test(r.request().url()) ? '[]' : '{"assignments":[],"contractors":[]}' }));
    const store = { ...BASE, ...ls, sentria_language: lang, sentria_theme: theme };
    if (wholesalers) store.sentria_wholesalers = JSON.stringify(wholesalers);
    await p.addInitScript(v => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, val] of Object.entries(v)) localStorage.setItem(k, val); } }, store);
    await signedIn(p, 'u-1', 'ama@pharma.test', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(2500);
    return { p, ctx };
  };
  const goPage = async (p, label = 'Wholesalers') => {
    if (p.viewportSize().width < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(500); }
    await p.locator('aside nav button', { hasText: new RegExp(`^${label}$`) }).click(); await p.waitForTimeout(1200);
  };
  const rows = p => p.getByTestId('wholesaler-row');
  const names = p => p.getByTestId('wholesaler-name').evaluateAll(els => els.map(e => e.value));
  const saved = p => p.evaluate(() => JSON.parse(localStorage.getItem('sentria_wholesalers') || '[]'));
  const set = (p, i, id, value) => rows(p).nth(i).getByTestId(id).selectOption(String(value));
  const days = async (p, i, on) => { // on: array of 7 booleans
    for (let d = 0; d < 7; d++) { const b = rows(p).nth(i).getByTestId(`wholesaler-day-${d}`); const cur = (await b.getAttribute('aria-pressed')) === 'true'; if (cur !== on[d]) await b.click(); }
  };

  console.log('== the sidebar item shows for a health account only');
  { const { p, ctx } = await open();
    pass(await p.locator('aside nav button', { hasText: /^Wholesalers$/ }).count() === 1, 'a pharmacy sees Wholesalers in the sidebar, under Operations');
    await ctx.close(); }
  { const { p, ctx } = await open({ ls: { sentria_sector: 'industry', sentria_sectors: '["industry"]' } });
    pass(await p.locator('aside nav button', { hasText: /^Wholesalers$/ }).count() === 0, 'an industry account does not');
    await ctx.close(); }

  console.log('== empty, then add three');
  { const { p, ctx } = await open();
    await goPage(p);
    pass(/Wholesalers/.test(await p.locator('header').first().innerText()), 'the page title is Wholesalers');
    pass(await p.getByTestId('wholesalers-empty').count() === 1, 'no wholesaler yet: the empty card shows');
    pass(/Add a wholesaler to see who arrives in time/.test(await p.getByTestId('wholesaler-test').innerText()), 'the test panel asks for a first wholesaler');
    await p.getByTestId('wholesaler-add').click(); await p.waitForTimeout(300);
    pass(await rows(p).count() === 1, 'Add creates one row');
    pass(await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-testid')) === 'wholesaler-name', 'and puts the cursor in its name');
    await p.keyboard.type('Grossiste Dakar Centre');
    let w = (await saved(p))[0];
    pass(w.name === 'Grossiste Dakar Centre' && w.cutoff === 960 && w.before === 0 && w.after === 1 && w.days.join() === 'true,true,true,true,true,true,false', `defaults: 4:00 pm, same day, next day, Monday to Saturday (${JSON.stringify(w)})`);
    await days(p, 0, ALL);
    await p.getByTestId('wholesaler-add').click(); await p.waitForTimeout(200); await p.keyboard.type('Pharma Distribution Thiès');
    await set(p, 1, 'wholesaler-cutoff', 840); await set(p, 1, 'wholesaler-before', 2); await set(p, 1, 'wholesaler-after', 3);
    await days(p, 1, ALL);
    await p.getByTestId('wholesaler-add').click(); await p.waitForTimeout(200); await p.keyboard.type('Comptoir Médical Sud');
    await set(p, 2, 'wholesaler-cutoff', -1);
    pass(await rows(p).nth(2).getByTestId('wholesaler-after').count() === 0, 'with no cutoff the "after" field goes away');
    await set(p, 2, 'wholesaler-before', 4);
    await days(p, 2, ALL);
    const all = await saved(p);
    pass(all.length === 3 && all[1].cutoff === 840 && all[1].before === 2 && all[1].after === 3 && all[2].cutoff === null && all[2].before === 4 && all[2].after === 4, `three wholesalers saved (${all.map(x => x.name).join(' | ')})`);
    const tags = (await rows(p).evaluateAll(r => r.map(x => x.innerText))).map(t => /Nearby|Farthest|Farther/.exec(t)?.[0]);
    pass(tags.join() === 'Nearby,Farther,Farthest', `tags by rank: ${tags.join(', ')}`);
    pass(await p.getByTestId('wholesalers-empty').count() === 0, 'the empty card is gone');

    console.log('== it persists');
    await p.reload(); await p.waitForTimeout(2500); await goPage(p);
    pass((await names(p)).join('|') === 'Grossiste Dakar Centre|Pharma Distribution Thiès|Comptoir Médical Sud', 'after a reload the list is the same');
    pass(/sentria_wholesalers/.test(fs.readFileSync(path.join(__dirname, '../../lib/account.ts'), 'utf8')), 'the key is in ACCOUNT_KEYS, so it follows the account');

    console.log('== the test panel');
    // The page opens at the real "now" on the account clock.
    const nowUtc = new Date(); const shown = await p.getByTestId('test-order-at').inputValue(); const [hh, mm] = shown.split(':').map(Number);
    pass(/^\d\d:\d\d$/.test(shown) && Math.abs((hh * 60 + mm) - (nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes())) <= 3, `it starts at the time now on the account clock (${shown})`);
    await p.getByTestId('test-order-at').fill('14:30'); await p.waitForTimeout(200);
    const adv = async () => ({ advice: (await p.getByTestId('test-advice').innerText()).replace(/\s+/g, ' '), fb: (await p.getByTestId('test-fallback').count()) ? (await p.getByTestId('test-fallback').innerText()).replace(/\s+/g, ' ') : '', arr: await p.getByTestId('test-arrival').allInnerTexts() });
    let a = await adv();
    pass(/Order from Grossiste Dakar Centre before 4:00 pm\. It arrives today\./.test(a.advice), `2:30 pm, stock lasts 2 days: ${a.advice}`);
    pass(a.fb.includes(`Pharma Distribution Thiès arrives ${dayName(3)}. You would run out for 1 day.`), `fallback: ${a.fb}`);
    pass(a.arr.join('|') === `Arrives today|Arrives ${dayName(3)}, too late|Arrives ${dayName(4)}, too late`, `arrivals: ${a.arr.join(' | ')}`);
    pass(await p.getByTestId('test-dot-ok').count() === 1 && await p.getByTestId('test-dot-late').count() === 2, 'one tick and two crosses on the ladder');
    await p.getByTestId('test-order-at').fill('17:00'); await p.waitForTimeout(200);
    a = await adv();
    pass(/Order from Grossiste Dakar Centre now\. It arrives tomorrow\./.test(a.advice), `5:00 pm, after the cutoff: ${a.advice}`);
    await p.getByTestId('test-stock-less').click(); await p.waitForTimeout(150);
    pass(await p.getByTestId('test-stock-days').innerText() === '1 day', 'the stepper goes down to 1 day');
    pass(await p.getByTestId('test-stock-less').isDisabled(), 'and stops there');
    a = await adv();
    pass(/arrives tomorrow/.test(a.advice), `stock lasts 1 day, tomorrow is still in time: ${a.advice}`);
    // A delivery day that is off moves the arrival to the next one that is on
    await p.getByTestId('test-order-at').fill('17:00'); await p.getByTestId('test-stock-more').click(); await p.waitForTimeout(150);
    await rows(p).nth(0).getByTestId(`wholesaler-day-${(TODAY + 1) % 7}`).click(); await p.waitForTimeout(150);
    a = await adv();
    pass(a.arr[0] === `Arrives ${dayName(2)}`, `with tomorrow switched off, an order after the cutoff arrives ${dayName(2)} (${a.arr[0]})`);
    await rows(p).nth(0).getByTestId(`wholesaler-day-${(TODAY + 1) % 7}`).click();
    await p.getByTestId('test-stock-less').click(); await p.waitForTimeout(150);
    // No delivery day at all for the first wholesaler
    await days(p, 0, [false, false, false, false, false, false, false]); await p.waitForTimeout(150);
    a = await adv();
    pass(a.arr[0] === 'Never delivers', `a wholesaler with no delivery day says so (${a.arr[0]})`);
    pass(a.advice.includes(`No wholesaler arrives in time. Pharma Distribution Thiès is the fastest: ${dayName(3)}.`) && /run out for 2 days/.test(a.fb), `nobody in time: ${a.advice} / ${a.fb}`);
    await days(p, 0, ALL);

    console.log('== order of preference');
    await p.getByTestId('test-stock-more').click(); await p.getByTestId('test-order-at').fill('14:30'); await p.waitForTimeout(150);
    await rows(p).nth(2).getByTestId('wholesaler-handle').focus();
    await p.keyboard.press('ArrowUp'); await p.waitForTimeout(250);
    pass((await names(p)).join('|') === 'Grossiste Dakar Centre|Comptoir Médical Sud|Pharma Distribution Thiès', 'ArrowUp on a handle moves the row up');
    pass(await p.evaluate(() => document.activeElement.getAttribute('data-testid')) === 'wholesaler-handle', 'and the focus stays on its handle');
    await p.keyboard.press('ArrowDown'); await p.waitForTimeout(250);
    pass((await names(p)).join('|') === 'Grossiste Dakar Centre|Pharma Distribution Thiès|Comptoir Médical Sud', 'ArrowDown puts it back');
    await rows(p).nth(0).getByTestId('wholesaler-handle').focus(); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(200);
    pass((await names(p))[0] === 'Grossiste Dakar Centre', 'the first row cannot go further up');
    // by dragging
    await rows(p).nth(0).getByTestId('wholesaler-handle').dragTo(rows(p).nth(2)); await p.waitForTimeout(400);
    pass((await names(p)).join('|') === 'Pharma Distribution Thiès|Comptoir Médical Sud|Grossiste Dakar Centre', `dragging the first handle onto the last row moves it there (${(await names(p)).join(' | ')})`);
    pass((await saved(p)).map(x => x.name).join('|') === (await names(p)).join('|'), 'and the new order is saved');
    pass(/Nearby/.test(await rows(p).nth(0).innerText()), 'the tags follow the new order');
    await rows(p).nth(2).getByTestId('wholesaler-handle').focus(); await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); await p.waitForTimeout(300);

    console.log('== remove');
    await rows(p).nth(1).getByTestId('wholesaler-remove').click(); await p.waitForTimeout(150);
    pass(await rows(p).count() === 3 && await p.getByTestId('wholesaler-remove-yes').count() === 1, 'the trash button asks first');
    await p.getByRole('button', { name: /^No$/ }).click(); await p.waitForTimeout(150);
    pass(await rows(p).count() === 3, 'No keeps the row');
    await rows(p).nth(1).getByTestId('wholesaler-remove').click(); await p.getByTestId('wholesaler-remove-yes').click(); await p.waitForTimeout(250);
    pass(await rows(p).count() === 2 && (await saved(p)).length === 2, 'Yes removes it, and the saved list too');

    console.log('== at most 10');
    for (let k = 0; k < 8; k++) await p.getByTestId('wholesaler-add').click();
    await p.waitForTimeout(300);
    pass(await rows(p).count() === 10 && await p.getByTestId('wholesaler-add').isDisabled() && await p.getByTestId('wholesaler-max').count() === 1, 'ten rows, then Add is off and says why');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== a stored list is read as it is, and bad data is ignored');
  { const { p, ctx } = await open({ wholesalers: [{ id: 'a', name: 'Alpha', cutoff: 720, before: 0, after: 2, days: ALL }, { id: 'b', name: 'Beta', cutoff: 'x', before: 99, after: -3, days: [true] }, 'junk', null] });
    await goPage(p);
    pass((await names(p)).join('|') === 'Alpha|Beta', 'two usable rows out of four');
    const s = (await rows(p).nth(1).innerText());
    pass(await rows(p).nth(1).getByTestId('wholesaler-cutoff').inputValue() === '-1' && await rows(p).nth(1).getByTestId('wholesaler-before').inputValue() === '7', 'a broken row falls back: no cutoff, days kept within 0 to 7');
    pass(await rows(p).nth(0).getByTestId('wholesaler-cutoff').inputValue() === '720', 'a good row is kept (12:00 pm)');
    await ctx.close(); }
  { const { p, ctx } = await open({ wholesalers: 'not an array' });
    await goPage(p);
    pass(await p.getByTestId('wholesalers-empty').count() === 1, 'stored text that is not a list shows the empty card');
    await ctx.close(); }

  console.log('== French');
  { const { p, ctx } = await open({ lang: 'fr', wholesalers: [{ id: 'a', name: 'Dakar', cutoff: 960, before: 0, after: 1, days: ALL }, { id: 'b', name: 'Thiès', cutoff: 840, before: 2, after: 3, days: ALL }] });
    await goPage(p, 'Grossistes');
    const text = await p.getByTestId('wholesalers-card').innerText();
    pass(/Grossistes/i.test(text) && /Ajouter un grossiste/i.test(text) && /Commander avant/i.test(text) && /Le jour même/i.test(text) && /Le plus proche/i.test(text), 'the page is in French');
    await p.getByTestId('test-order-at').fill('14:30'); await p.waitForTimeout(200);
    const adv = (await p.getByTestId('test-advice').innerText()).replace(/\s+/g, ' ');
    pass(/Commandez chez Dakar avant 16:00\. Livraison aujourd'hui\./.test(adv), `advice in French: ${adv}`);
    pass((await p.getByTestId('test-fallback').innerText()).includes(`Thiès livre ${dayName(3, 'fr')}`), 'and the fallback line');
    await ctx.close(); }

  console.log('== dark and a phone');
  { const { p, ctx } = await open({ theme: 'dark', wholesalers: [{ id: 'a', name: 'Dakar', cutoff: 960, before: 0, after: 1, days: ALL }] });
    await goPage(p); await p.waitForTimeout(600);
    await p.screenshot({ path: 'wholesalers-dark.png' });
    const bg = await p.getByTestId('wholesaler-test').evaluate(e => getComputedStyle(e).backgroundColor);
    const lightness = /^lab\(([\d.]+)/.exec(bg) ? Number(/^lab\(([\d.]+)/.exec(bg)[1]) : Math.max(...(bg.match(/\d+/g) || [255]).slice(0, 3).map(Number)) / 2.55;
    pass(lightness < 20, `the test panel stays dark in dark mode (${bg})`);
    await ctx.close(); }
  { const { p, ctx } = await open({ vw: 390, wholesalers: [{ id: 'a', name: 'Dakar Centre', cutoff: 960, before: 0, after: 1, days: ALL }, { id: 'b', name: 'Pharma Distribution Thiès', cutoff: 840, before: 2, after: 3, days: ALL }] });
    await goPage(p); await p.waitForTimeout(600);
    const over = await p.evaluate(() => { const m = document.querySelector('main'); return m.scrollWidth > m.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1; });
    pass(!over, 'no sideways scroll on a phone');
    const small = await p.evaluate(() => [...document.querySelectorAll('[data-testid=wholesaler-row] button')].filter(b => b.getBoundingClientRect().width < 28 || b.getBoundingClientRect().height < 28).length);
    pass(small === 0, 'every button in a row is at least 28 px');
    await p.screenshot({ path: 'wholesalers-390.png', fullPage: false });
    await p.getByTestId('wholesalers-card').screenshot({ path: 'wholesalers-390-card.png' });
    const clipped = await p.evaluate(() => [...document.querySelectorAll('[data-testid=wholesaler-row] select')].map(s => s.closest('label').querySelector('span.truncate')).filter(e => e && e.scrollWidth > e.clientWidth + 1).length);
    pass(clipped === 0, `no pill clips its text on a phone (${clipped} clipped)`);
    await ctx.close(); }
  { const { p, ctx } = await open({ wholesalers: [{ id: 'a', name: 'Dakar Centre', cutoff: 960, before: 0, after: 1, days: ALL }] });
    await goPage(p); await p.waitForTimeout(600);
    await p.screenshot({ path: 'wholesalers-light.png' });
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
