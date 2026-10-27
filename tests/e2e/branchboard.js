// F-BRANCHBOARD: the Field team page of a pharmacy company with several branches: a banner with the numbers, one card per person in
// their branch's colour, a tear-off stub with the swaps the branch sends and receives, and a lime band for the branches nobody runs.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const now = Date.now();
const day = n => new Date(now + n * 864e5).toISOString().slice(0, 10);
const NOW = new Date().toISOString();
const srcs = ['csv', 'api', 'erp', 'iot'].map(type => ({ type, wanted: false, connected: false, synced: false }));
const site = (id, name) => ({ id, name, location: '', sector: 'health', status: 'offline', sources: srcs, created_at: NOW, departments: [], priorities: [], configured: false });
const swap = (id, from, to, product, qty, days, value) => ({
  id, equipment: `${product} · ${from} -> ${to}`, sector: 'health', business_type: 'pharmacie', severity: 'WARNING', date: new Date(now - 3600e3).toISOString(), alert_key: 'health.branch.swap', risk_score: null,
  message: `${product}: ${qty} units`, site_id: from === 'Nairobi' ? 's1' : 's2',
  params: [['product', product], ['qty', qty], ['from_site', from], ['to_site', to], ['days', days], ['expiry', day(days)], ['value', value], ['currency', 'KES']],
});
const person = (id, name, site_id, availability, open) => ({ id, name, role: 'Branch manager', phone: '+254700000' + id.slice(1).padStart(3, '1'), email: null, availability, note: null, active: true, open_assignments: open, site_id, sms_ready: true });
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Atlantis', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' };

(async () => {
  const b = await chromium.launch(LAUNCH);
  const open = async ({ sites = [site('s1', 'Nairobi'), site('s2', 'Mombasa'), site('s3', 'Kisumu')], people = [person('c1', 'Mary Atieno', 's1', 'available', 1), person('c2', 'Joe Otieno', 's2', 'busy', 0)], alerts = [swap(1, 'Nairobi', 'Mombasa', 'Amoxicillin 250mg', 20, 20, 7600)], vw = 1440, vh = 1000, theme = 'light', lang = 'en', plan = 'entreprise', ls = {}, failAlertsFor = null } = {}) => {
    const p = await b.newPage({ viewport: { width: vw, height: vh }, locale: 'en-US' });
    p._errs = []; p._calls = []; p._people = people.map(x => ({ ...x }));
    p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/onrender\.com\//, r => {
      const req = r.request(); const u = new URL(req.url()); p._calls.push(`${req.method()} ${u.pathname}${u.search}`);
      const send = body => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (u.pathname === '/sites') return send({ sites, persisted: true, max_sites: 50 });
      if (u.pathname === '/alerts') { const sid = u.searchParams.get('site_id'); if (failAlertsFor && sid === failAlertsFor) return send({ error_code: 'boom', message: 'x' }); return send(alerts.filter(a => !sid || a.site_id === sid)); }
      if (u.pathname === '/contractors' && req.method() === 'GET') return send({ contractors: p._people });
      if (u.pathname === '/contractors' && req.method() === 'POST') { const body = JSON.parse(req.postData()); const c = person('c' + (p._people.length + 1), body.name, body.site_id || null, 'available', 0); c.role = body.role || null; p._people.push(c); p._posted = body; return send({ contractor: c }); }
      if (/^\/contractors\/[^/]+$/.test(u.pathname) && req.method() === 'PATCH') { const id = u.pathname.split('/').pop(); const body = JSON.parse(req.postData()); p._patches = (p._patches || []).concat([{ id, body }]); const c = p._people.find(x => x.id === id); Object.assign(c, body); return send({ contractor: c }); }
      if (u.pathname === '/assignments') return send({ assignments: [] });
      return send({ recommendations: [], assignments: [], contractors: [] });
    });
    await p.addInitScript(v => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(v).forEach(([k, val]) => localStorage.setItem(k, val)); } }, { ...LS, ...ls, sentria_theme: theme, sentria_language: lang });
    await signedIn(p, 'u', 'a@b.c', { plan }); await p.goto(APP_URL); await p.waitForTimeout(1800);
    if (vw < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(300); }
    await p.locator('aside nav [data-nav="contractors"]').click(); await p.waitForTimeout(2200);
    return p;
  };

  console.log('== the banner, the cards and the stub');
  let q = await open();
  pass(await q.getByTestId('branch-board').count() === 1, 'a pharmacy company with 3 branches gets the branch board');
  pass((await q.getByTestId('banner-covered').innerText()).replace(/\s+/g, ' ').startsWith('2 / 3'), 'the banner says 2 of 3 branches are covered');
  pass((await q.getByTestId('banner-missing').innerText()).startsWith('1'), 'one branch has no manager');
  pass((await q.getByTestId('banner-swaps').innerText()).startsWith('1'), 'one swap is waiting');
  pass(await q.getByTestId('manager-card').count() === 2, 'one card per manager, none for a branch with nobody');
  const mary = q.getByTestId('manager-card').filter({ hasText: 'Mary Atieno' });
  const joe = q.getByTestId('manager-card').filter({ hasText: 'Joe Otieno' });
  pass(await mary.getAttribute('data-branch') === 'Nairobi' && /Nairobi/.test(await mary.innerText()), "Mary's card names her branch");
  pass(/Available/.test(await mary.innerText()) && /Busy/.test(await joe.innerText()), 'status tags say Available and Busy');
  pass(/1\s*send/.test((await mary.getByTestId('swap-stub').innerText()).replace(/\s+/g, ' ')) && /0\s*receive/.test((await mary.getByTestId('swap-stub').innerText()).replace(/\s+/g, ' ')), 'Nairobi sends 1 swap and receives none');
  pass(/0\s*send/.test((await joe.getByTestId('swap-stub').innerText()).replace(/\s+/g, ' ')) && /1\s*receive/.test((await joe.getByTestId('swap-stub').innerText()).replace(/\s+/g, ' ')), 'Mombasa receives the swap Nairobi sends');
  pass(/7\.6k/.test(await mary.getByTestId('swap-stub').innerText()), 'the stub shows the money at stake, 7.6k');
  const colours = await q.getByTestId('manager-card').evaluateAll(els => els.map(e => getComputedStyle(e).backgroundColor));
  pass(colours[0] !== colours[1], 'two branches have two colours');
  pass(await q.getByTestId('missing-strip').isVisible() && /Kisumu/.test(await q.getByTestId('missing-strip').innerText()), 'the lime band names Kisumu');
  pass(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll');
  pass(await q.getByTestId('manager-card').evaluateAll(els => els.every(e => e.scrollHeight <= e.clientHeight + 1)), 'no card has a scrollbar of its own');
  await q.screenshot({ path: 'branchboard-light.png', fullPage: true });
  pass(q._errs.length === 0, 'no page errors ' + q._errs.join('|'));

  console.log('== filters');
  await q.getByRole('button', { name: 'Busy' }).click(); await q.waitForTimeout(300);
  pass(await q.getByTestId('manager-card').count() === 1 && /Joe/.test(await q.getByTestId('manager-card').innerText()), 'Busy shows only Joe');
  await q.getByTestId('filter-nomanager').click(); await q.waitForTimeout(300);
  pass(await q.getByTestId('manager-card').count() === 0 && await q.getByTestId('missing-strip').isVisible(), '"need a manager" shows only the band');
  await q.getByRole('button', { name: /^All/ }).click(); await q.waitForTimeout(300);
  pass(await q.getByTestId('manager-card').count() === 2, 'All brings both back');

  console.log('== adding a manager to the branch with none');
  await q.getByTestId('add-managers').click(); await q.waitForTimeout(500);
  pass(await q.locator('[data-testid=branch-option][data-site=s3]').getAttribute('aria-checked') === 'true', 'the band opens the form with Kisumu chosen');
  pass(await q.getByRole('textbox', { name: /Role/i }).count() === 0, 'there is no free role field: the role is Branch manager');
  await q.getByTestId('manager-name').fill('Grace Wanjiru');
  await q.getByTestId('manager-save').click(); await q.waitForTimeout(1200);
  pass(q._posted && q._posted.role === 'Branch manager', 'the new person is saved as a Branch manager');
  pass((q._patches || []).some(x => x.body.site_id === 's3'), 'and filed under Kisumu');
  pass(await q.getByTestId('manager-card').count() === 3 && (await q.getByTestId('banner-covered').innerText()).startsWith('3 / 3'), 'the board shows 3 managers and 3 of 3 covered');
  pass(await q.getByTestId('missing-strip').count() === 0, 'the lime band is gone when every branch has a manager');
  await q.close();

  console.log('== the form needs a branch');
  q = await open();
  await q.getByTestId('add-manager').click(); await q.waitForTimeout(400);
  await q.getByTestId('manager-name').fill('Peter Kamau');
  pass(await q.getByTestId('manager-save').isDisabled(), 'Save waits for a branch');
  await q.locator('[data-testid=branch-option][data-site=s2]').click();
  pass(await q.getByTestId('manager-save').isEnabled(), 'and wakes up once a branch is picked');
  await q.close();

  console.log('== the banner is pinned and the form hangs below it, never over it');
  q = await open({ vh: 760 });
  const box = async t => q.getByTestId(t).boundingBox();
  await q.getByTestId('add-manager').click(); await q.waitForTimeout(600);
  let bn = await box('branch-banner'); let sh = await box('manager-sheet');
  pass(sh.y >= bn.y + bn.height - 1, 'the form starts below the banner, not over it');
  pass(await q.evaluate(() => { const b = document.querySelector('[data-testid=branch-banner]').getBoundingClientRect(); const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return !!el && !!el.closest('[data-testid=branch-banner]'); }), 'nothing sits over the banner while the form is open');
  pass(await q.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-testid') === 'manager-name'), 'the name field has the focus');
  await q.evaluate(() => document.querySelector('main').scrollTo(0, 600)); await q.waitForTimeout(400);
  const mainTop = await q.evaluate(() => document.querySelector('main').getBoundingClientRect().top);
  let bn2 = await box('branch-banner'); let sh2 = await box('manager-sheet');
  pass(await q.evaluate(() => document.querySelector('main').scrollTop) > 0 && Math.abs(bn2.y - bn.y) <= 2 && bn2.y <= mainTop + 40, 'the banner stays pinned at the top while the page scrolls');
  pass(Math.abs(bn2.y - bn.y) <= 40 && sh2.y >= bn2.y + bn2.height - 1, 'and the form moves with it, still below');
  await q.screenshot({ path: 'branchform-light.png' });
  await q.getByTestId('manager-name').fill('Zed');
  await q.mouse.click(700, 740); await q.waitForTimeout(400);
  pass(await q.getByTestId('manager-sheet').count() === 1, 'a click outside does not throw away typed text');
  await q.getByTestId('manager-name').fill('');
  await q.mouse.click(700, 740); await q.waitForTimeout(400);
  pass(await q.getByTestId('manager-sheet').count() === 0, 'a click outside closes an empty form');
  await q.getByTestId('add-manager').click(); await q.waitForTimeout(500);
  await q.keyboard.press('Escape'); await q.waitForTimeout(400);
  pass(await q.getByTestId('manager-sheet').count() === 0, 'Escape closes the form');
  await q.getByTestId('add-manager').click(); await q.waitForTimeout(500);
  await q.getByTestId('manager-cancel').click(); await q.waitForTimeout(400);
  pass(await q.getByTestId('manager-sheet').count() === 0, 'Cancel closes the form');
  pass(q._errs.length === 0, 'no page errors ' + q._errs.join('|'));
  await q.close();
  q = await open({ theme: 'dark', vh: 760 });
  await q.getByTestId('add-manager').click(); await q.waitForTimeout(600);
  await q.screenshot({ path: 'branchform-dark.png' });
  await q.close();
  q = await open({ vw: 390, vh: 844 });
  await q.getByTestId('add-manager').click(); await q.waitForTimeout(600);
  bn = await box('branch-banner'); sh = await box('manager-sheet');
  pass(sh.y >= bn.y + bn.height - 1 && sh.x >= 0 && sh.x + sh.width <= 391 && sh.y + sh.height <= 844, 'at 390 px the form is below the banner and inside the screen');
  pass(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll with the form open at 390 px');
  await q.screenshot({ path: 'branchform-390.png' });
  await q.close();

  console.log('== the card menu and opening a branch');
  q = await open();
  await q.getByTestId('manager-card').filter({ hasText: 'Mary Atieno' }).getByRole('button', { name: /Options for Mary/ }).click(); await q.waitForTimeout(300);
  await q.getByTestId('manager-menu').getByRole('button', { name: 'Busy' }).click(); await q.waitForTimeout(800);
  pass((q._patches || []).some(x => x.id === 'c1' && x.body.availability === 'busy'), 'the menu sets availability');
  await q.getByTestId('manager-card').filter({ hasText: 'Joe Otieno' }).getByTestId('open-branch').click(); await q.waitForTimeout(1200);
  pass(await q.evaluate(() => localStorage.getItem('sentria_active_site')) === 's2', 'the arrow on a card shows that branch');
  await q.close();

  console.log('== a branch that will not answer leaves the numbers out');
  q = await open({ failAlertsFor: 's2' });
  pass((await q.getByTestId('banner-swaps').innerText()).startsWith('–') && /not loaded/i.test(await q.getByTestId('swap-stub').first().innerText()), 'the swap figures say so, no zero is made up');
  await q.close();

  console.log('== who gets it');
  q = await open({ sites: [site('s1', 'Nairobi')], people: [person('c1', 'Mary Atieno', 's1', 'available', 1)] });
  pass(await q.getByTestId('branch-board').count() === 0, 'one branch keeps the usual Field team page');
  await q.close();
  q = await open({ ls: { sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_business_type: '' } });
  pass(await q.getByTestId('branch-board').count() === 0, 'a company that is not a pharmacy keeps the usual page');
  await q.close();

  console.log('== 15 branches, dark, and a phone');
  const names = ['Nairobi CBD', 'Westlands', 'Karen', 'Mombasa', 'Nyali', 'Malindi', 'Diani', 'Kisumu', 'Kakamega', 'Bungoma', 'Nakuru', 'Eldoret', 'Naivasha', 'Nyeri', 'Thika'];
  const many = names.map((n, i) => site('s' + (i + 1), n));
  const staff = names.filter((_, i) => ![6, 9, 12].includes(i)).map((n, i) => person('c' + (i + 1), ['Mary Atieno', 'Peter Kamau', 'Grace Wanjiru', 'Joe Otieno', 'Ali Hassan', 'Fatma Said', 'Brian Odhiambo', 'Lucy Wafula', 'David Kiprop', 'Esther Chebet', 'James Mwangi', 'Rose Njeri'][i], 's' + (names.indexOf(n) + 1), ['available', 'busy', 'off'][i % 3], i % 5));
  q = await open({ sites: many, people: staff, alerts: [swap(1, 'Nairobi', 'Mombasa', 'Amoxicillin 250mg', 20, 20, 7600)], theme: 'dark', vh: 1100 });
  pass(await q.getByTestId('manager-card').count() === 12 && /3/.test(await q.getByTestId('banner-missing').innerText()), '12 managers and 3 branches without one');
  pass(/Diani/.test(await q.getByTestId('missing-strip').innerText()) && /Bungoma/.test(await q.getByTestId('missing-strip').innerText()), 'the band names the 3 branches');
  await q.screenshot({ path: 'branchboard-15-dark.png', fullPage: true });
  await q.close();
  q = await open({ sites: many, people: staff, vw: 390, vh: 900 });
  pass(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll at 390 px');
  await q.screenshot({ path: 'branchboard-390.png', fullPage: true });
  await q.close();

  console.log('== French');
  q = await open({ lang: 'fr' });
  pass(/Qui dirige chaque agence/.test(await q.getByTestId('branch-banner').innerText()), 'the banner speaks French');
  await q.close();

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})();
