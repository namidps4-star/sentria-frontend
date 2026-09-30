// Department tabs as sheet tabs at the bottom: pinned, counts, overflow arrows, the all-departments menu, keyboard.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright'); const { signedIn } = require('./auth-mock');
let fails = 0; const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const now = new Date().toISOString();
const deps = ['pharmacie', 'clinique-hopital', 'laboratoire'];
// Pharmacy and Laboratory get critical alerts; Clinic only warnings; the wholesaler none.
const data = Array.from({ length: 18 }, (_, k) => ({ id: k, equipment: `Med ${k}`, sector: 'health', business_type: deps[k % 3], severity: k % 3 === 1 ? 'WARNING' : 'CRITICAL', date: now, alert_key: 'health.stock.low', message: `MSG ${k}` }));
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_departments: '{"health":["pharmacie","clinique-hopital","laboratoire","grossiste-pharma"]}' };

(async () => { const b = await chromium.launch(LAUNCH);
  const open = async (vw) => {
    const p = await b.newPage({ viewport: { width: vw, height: vw < 500 ? 844 : 900 }, locale: 'en-US' }); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: /\/alerts/.test(r.request().url()) ? JSON.stringify(data) : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); } }, LS);
    await signedIn(p, 'u', 'a@b.c', { plan: 'entreprise' }); await p.goto(APP_URL); await p.waitForTimeout(2000); return p; };
  const tablist = p => p.getByRole('tablist', { name: 'Your departments' });

  console.log('== desktop');
  let p = await open(1440);
  const tabs = tablist(p);
  pass(await tabs.getByRole('tab').count() === 4, 'one tab per department (4)');
  const box = await tabs.boundingBox(); const mainBox = await p.locator('main').boundingBox();
  pass(box.y + box.height <= mainBox.y + mainBox.height && box.y + box.height >= mainBox.y + mainBox.height - 30, `tabs sit at the bottom of the page (${Math.round(box.y + box.height)} / ${Math.round(mainBox.y + mainBox.height)})`);
  pass(await tabs.getByRole('tab', { name: /Pharmacy/ }).getAttribute('aria-selected') === 'true', 'the configured department is the selected tab');
  const pharmaBadge = tabs.getByRole('tab', { name: /Pharmacy/ }).locator('span[aria-label]');
  pass(await pharmaBadge.innerText() === '6' && /6 alerts, 6 critical/.test(await pharmaBadge.getAttribute('aria-label')), 'Pharmacy badge: 6, read as "6 alerts, 6 critical"');
  pass(await pharmaBadge.evaluate(e => getComputedStyle(e).backgroundColor) === 'rgb(255, 214, 218)', 'a department with critical alerts gets a red badge');
  const clinicBadge = tabs.getByRole('tab', { name: /Clinic/ }).locator('span[aria-label]');
  pass(await clinicBadge.getAttribute('aria-label') === '6 alerts' && await clinicBadge.evaluate(e => getComputedStyle(e).backgroundColor) !== 'rgb(255, 214, 218)', 'warnings only: a grey badge');
  pass(await tabs.getByRole('tab', { name: /wholesaler/ }).locator('span[aria-label]').count() === 0, 'no alerts: no badge');
  pass(await p.getByRole('button', { name: 'Previous tabs' }).isDisabled() && await p.getByRole('button', { name: 'More tabs' }).isDisabled(), 'everything fits: both arrows off');
  await p.evaluate(() => document.querySelector('main').scrollTo(0, 400)); await p.waitForTimeout(150);
  const before = await p.evaluate(() => document.querySelector('main').scrollTop);
  await tabs.getByRole('tab', { name: /Laboratory/ }).click(); await p.waitForTimeout(500);
  pass(await tabs.getByRole('tab', { name: /Laboratory/ }).getAttribute('aria-selected') === 'true' && await p.evaluate(() => localStorage.getItem('sentria_business_type')) === 'laboratoire', 'click: Laboratory selected and applied');
  const after = await p.evaluate(() => document.querySelector('main').scrollTop);
  pass(Math.abs(after - before) < 5, `switching tabs doesn't move the page (${before} → ${after})`);
  await tabs.getByRole('tab', { name: /Laboratory/ }).focus(); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(400);
  pass(await tabs.getByRole('tab', { name: /wholesaler/ }).getAttribute('aria-selected') === 'true' && await p.evaluate(() => document.activeElement.textContent.includes('wholesaler')), 'ArrowRight: next tab selected and focused');
  await p.keyboard.press('Home'); await p.waitForTimeout(400);
  pass(await tabs.getByRole('tab', { name: /Pharmacy/ }).getAttribute('aria-selected') === 'true', 'Home: first tab');
  pass(await tabs.getByRole('tab', { selected: true }).count() === 1 && await tabs.locator('[role=tab][tabindex="0"]').count() === 1, 'one selected tab, one tab stop');
  pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
  await p.screenshot({ path: 'sheet-tabs-1440.png' });
  await p.close();

  console.log('== phone: more tabs than room');
  p = await open(390);
  const strip = tablist(p);
  const prev = p.getByRole('button', { name: 'Previous tabs' }), next = p.getByRole('button', { name: 'More tabs' });
  pass(await prev.isDisabled() && await next.isEnabled(), 'overflow is shown: the "more tabs" arrow is on');
  const scroller = strip.locator('xpath=..');
  pass(await scroller.evaluate(e => (e.style.maskImage || e.style.webkitMaskImage || '').includes('transparent')), 'the hidden edge fades out');
  await next.click(); await p.waitForTimeout(600);
  pass(await scroller.evaluate(e => e.scrollLeft) > 0 && await prev.isEnabled(), 'arrow scrolls the tabs; "previous" turns on');
  const menuBtn = p.getByRole('button', { name: 'All departments (4)' });
  pass(await menuBtn.count() === 1, 'menu button says how many departments there are');
  await menuBtn.click(); await p.waitForTimeout(200);
  const menu = p.getByRole('menu', { name: 'Your departments' });
  pass(await menu.isVisible() && await menu.getByRole('menuitemradio').count() === 4, 'menu lists all 4 departments');
  pass(await menu.getByRole('menuitemradio', { name: /Pharmacy/ }).getAttribute('aria-checked') === 'true', 'menu marks the current one');
  await p.screenshot({ path: 'sheet-tabs-390-menu.png' });
  await menu.getByRole('menuitemradio', { name: /wholesaler/ }).click(); await p.waitForTimeout(500);
  pass(await menu.count() === 0, 'picking closes the menu');
  const tab = strip.getByRole('tab', { name: /wholesaler/ });
  pass(await tab.getAttribute('aria-selected') === 'true', 'picked from the menu: tab selected');
  const sb = await scroller.boundingBox(), tb = await tab.boundingBox();
  pass(tb.x >= sb.x - 1 && tb.x + tb.width <= sb.x + sb.width + 1, 'the picked tab is scrolled into view');
  await menuBtn.click(); await p.waitForTimeout(150); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  pass(await p.getByRole('menu').count() === 0, 'Escape closes the menu');
  pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll on the page');
  pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
  await p.screenshot({ path: 'sheet-tabs-390.png' });

  console.log('== one department: the bar still shows, and offers the linked ones');
  const openOne = async (plan) => {
    const q = await b.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' }); q._errs = []; q.on('pageerror', e => q._errs.push(e.message));
    await q.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: /\/alerts/.test(r.request().url()) ? JSON.stringify(data) : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await q.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); } }, { ...LS, sentria_business_type: 'clinique-hopital', sentria_departments: '{"health":["clinique-hopital"]}' });
    await signedIn(q, 'u', 'a@b.c', { plan }); await q.goto(APP_URL); await q.waitForTimeout(2000); return q; };
  let q = await openOne('business');
  let bar = tablist(q);
  pass(await bar.getByRole('tab').count() === 1 && await bar.getByRole('tab', { name: /Clinic/ }).getAttribute('aria-selected') === 'true', 'a hospital alone: the bar shows its one tab');
  const adds = q.getByRole('group', { name: 'Add a department' }).getByRole('button');
  const addNames = await adds.evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
  pass(addNames.length === 2 && addNames.some(n => /Add Pharmacy/.test(n)) && addNames.some(n => /Add Laboratory/.test(n)) && !addNames.some(n => /wholesal/i.test(n)), 'offers its own pharmacy and lab, not the wholesaler: ' + addNames.join(', '));
  await adds.filter({ hasText: 'Laboratory' }).click(); await q.waitForTimeout(600);
  pass(await bar.getByRole('tab').count() === 2 && await bar.getByRole('tab', { name: /Laboratory/ }).getAttribute('aria-selected') === 'true', 'Business: "+ Laboratory" adds the lab as a tab and switches to it');
  pass(JSON.parse(await q.evaluate(() => localStorage.getItem('sentria_departments'))).health.join(',') === 'clinique-hopital,laboratoire', 'saved with the account\'s departments');
  await bar.getByRole('tab', { name: /Clinic/ }).click(); await q.waitForTimeout(400);
  pass(await q.evaluate(() => localStorage.getItem('sentria_business_type')) === 'clinique-hopital', 'and back to the hospital in one click');
  pass(q._errs.length === 0, 'no page errors ' + q._errs.join('|'));
  await q.screenshot({ path: 'sheet-tabs-add.png' });
  await q.close();

  q = await openOne('decouverte');
  const locked = q.getByRole('group', { name: 'Add a department' }).getByRole('button', { name: /Add Laboratory \(Business plan\)/ });
  pass(await locked.count() === 1, 'Découverte: the lab is offered, marked Business');
  await locked.click(); await q.waitForTimeout(250);
  const dlg = q.getByRole('dialog', { name: 'Add Laboratory' });
  pass(await dlg.isVisible() && /Business plan/.test(await dlg.innerText()) && await tablist(q).getByRole('tab').count() === 1, 'clicking explains the plan and adds nothing');
  await q.screenshot({ path: 'sheet-tabs-locked.png' });
  await dlg.getByRole('button', { name: 'See the plans' }).click(); await q.waitForTimeout(800);
  pass(await q.locator('aside nav [aria-current=page]', { hasText: 'Subscription' }).count() === 1, '"See the plans" opens the Subscription page');
  pass(q._errs.length === 0, 'no page errors ' + q._errs.join('|'));
  await q.close();

  await b.close(); console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`); process.exit(fails ? 1 : 0); })();
