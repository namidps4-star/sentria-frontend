// The Dashboard's Branch swaps card: stock this site should send to another branch, where each swap stands, and the link to the person.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const now = Date.now();
const day = n => new Date(now + n * 864e5).toISOString().slice(0, 10);
const swap = (id, equipment, product, qty, days, value) => ({
  id, equipment, sector: 'health', business_type: 'pharmacie', severity: 'WARNING', date: new Date(now - 3600e3).toISOString(), alert_key: 'health.branch.swap', risk_score: null,
  message: `${product}: ${qty} units expire in ${days} days at Nairobi and will not sell there. Mombasa sells this product: send them before ${day(days)}`,
  params: [['product', product], ['qty', qty], ['from_site', 'Nairobi'], ['to_site', 'Mombasa'], ['days', days], ['expiry', day(days)], ['value', value], ['currency', 'KES']],
});
const AMOX = swap(1, 'Amoxicillin 250mg · Nairobi -> Mombasa', 'Amoxicillin 250mg', 20, 20, 7600);
const ORS = swap(2, 'Oral rehydration salts · Nairobi -> Mombasa', 'Oral rehydration salts', 52, 45, 3120);
const MET = swap(3, 'Metformin 500mg · Nairobi -> Mombasa', 'Metformin 500mg', 35, 31, 3150);
const OTHER = { id: 9, equipment: 'Insulin', sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: new Date(now - 7200e3).toISOString(), alert_key: 'health.stock.critical_low', risk_score: 80, message: 'Stock out soon' };
const key = s => `${s.equipment}-${s.alert_key}`;
const MARY = { id: 'c1', name: 'Mary Atieno', role: 'Branch manager', phone: null, email: null, availability: 'available', note: null, active: true, open_assignments: 0 };
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Atlantis', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' };

(async () => {
  const b = await chromium.launch(LAUNCH);
  const open = async ({ alerts = [AMOX, ORS, MET, OTHER], assignments = [], contractors = [MARY], vw = 1440, theme = 'light', lang = 'en', plan = 'business' } = {}) => {
    const p = await b.newPage({ viewport: { width: vw, height: 900 }, locale: 'en-US' });
    p._errs = []; p._calls = []; p._puts = []; p._rows = assignments.slice();
    p.on('pageerror', e => p._errs.push(e.message));
    await p.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP_URL }).catch(() => {});
    await p.route(/onrender\.com\//, r => {
      const req = r.request(); const u = new URL(req.url()); p._calls.push(`${req.method()} ${u.pathname}`);
      const send = body => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (u.pathname === '/alerts') return send(alerts);
      if (u.pathname === '/reports/weekly') return send({ alerts: 4, critical: 1, warning: 3, previous_alerts: 1, delta: 3, trend: 'up', resolved: 0, top_offender: null });
      if (u.pathname === '/assignments' && req.method() === 'GET') return send({ assignments: p._rows });
      if (u.pathname === '/assignments' && req.method() === 'PUT') { const body = JSON.parse(req.postData()); p._puts.push(body); p._rows = p._rows.filter(x => x.task_key !== body.task_key).concat([body]); return send({ assignment: body }); }
      if (u.pathname === '/contractors') return send({ contractors });
      if (u.pathname === '/assignments/field-link') return send({ token: 'v1.test.token', expires_at: Math.floor(Date.now() / 1000) + 3 * 86400 });
      return send({ recommendations: [], assignments: [], contractors: [] });
    });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); } }, { ...LS, sentria_theme: theme, sentria_language: lang });
    await signedIn(p, 'u', 'a@b.c', { plan }); await p.goto(APP_URL); await p.waitForTimeout(1800);
    if (vw < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(300); }
    await p.locator('aside nav button', { hasText: 'Dashboard' }).click(); await p.waitForTimeout(1800);
    return p;
  };

  console.log('== three swaps, nobody on them yet');
  let p = await open();
  const card = p.getByTestId('branch-swaps');
  const t = (await card.innerText()).replace(/\s+/g, ' ');
  pass(await card.count() === 1, 'the card shows');
  pass(await card.getByTestId('swap-row').count() === 3, 'one row per swap, the other alert is not one');
  pass(/Branch swaps/.test(t) && /At stake · 3 swaps/i.test(t) && /13,870 KES/.test(t), 'the ticket adds the money: ' + t.slice(0, 120));
  const rows = card.getByTestId('swap-row');
  pass(/Amoxicillin 250mg/.test(await rows.nth(0).innerText()) && /Metformin/.test(await rows.nth(1).innerText()) && /Oral rehydration/.test(await rows.nth(2).innerText()), 'the swap that expires first is on top');
  const first = (await rows.nth(0).innerText()).replace(/\s+/g, ' ');
  pass(/Nairobi/.test(first) && /Mombasa/.test(first) && /expires in 20 d/.test(first) && /20 units/.test(first) && /7,600 KES/.test(first), 'a row says what moves where, how many, by when, and the money: ' + first.slice(0, 140));
  pass(await rows.nth(0).getAttribute('data-stage') === 'waiting' && /Waiting/.test(first) && /Nobody yet/.test(first), 'nobody on it: waiting');
  pass(await rows.nth(0).getByTestId('swap-person').count() === 1 && /Mary Atieno/.test(await rows.nth(0).getByTestId('swap-person').innerText()), 'a manager can be picked');
  await card.scrollIntoViewIfNeeded(); await card.screenshot({ path: 'branchswaps-light.png' });
  const lines = card.getByTestId('ticket-line');
  const lt = (await card.getByTestId('swaps-ticket').innerText()).replace(/\s+/g, ' ');
  pass(await lines.count() === 3 && /20 × 380 KES/.test(lt) && /35 × 90 KES/.test(lt) && /52 × 60 KES/.test(lt), 'the ticket lists every swap with units times unit price: ' + lt);
  pass(/Send before 16 Nov/.test(lt), 'the ticket names the soonest day to send by');
  const price = (await card.getByTestId('swap-price').allInnerTexts()).map(x => x.replace(/\s+/g, ' '));
  pass(price.length === 3 && /Unit price 380 KES Units × 20 7,600 KES/.test(price[0]), 'each row works out unit price times units to the line total: ' + price[0]);
  const ticketBox = await card.getByTestId('swaps-ticket').boundingBox();
  await p.evaluate(() => window.scrollBy(0, 0));
  await card.getByTestId('swaps-ticket').scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -140)); await p.waitForTimeout(200);
  await card.getByTestId('swaps-ticket').screenshot({ path: 'branchswaps-ticket-light.png' });
  pass(ticketBox && ticketBox.width > 600, 'the ticket spans the card');

  console.log('== send the link');
  await rows.nth(0).getByTestId('swap-send').click(); await p.waitForTimeout(900);
  pass(p._puts.length === 1 && p._puts[0].task_key === key(AMOX) && JSON.stringify(p._puts[0].contractor_ids) === '["c1"]' && p._puts[0].status === 'todo' && p._puts[0].deadline === day(20), 'the swap is saved as a task on that person, due by its expiry date ' + JSON.stringify(p._puts[0]));
  pass(p._calls.includes('POST /assignments/field-link'), 'a field link is made');
  pass(await rows.nth(0).getByTestId('swap-link-ready').count() === 1, 'the row says the link is ready');
  pass(await rows.nth(0).getAttribute('data-stage') === 'with' && /Mary Atieno/.test(await rows.nth(0).innerText()), 'the row now shows the person, not nobody');
  const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  pass(!clip || /\/t\/v1\.test\.token$/.test(clip), 'the copied address is the field page: ' + clip);
  pass(await rows.nth(0).getByTestId('swap-send').innerText().then(x => /again/.test(x)), 'it offers to copy the link again, not to assign again');
  await card.screenshot({ path: 'branchswaps-assigned.png' });
  pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
  await p.close();

  console.log('== answers from the field page');
  p = await open({ assignments: [
    { task_key: key(AMOX), status: 'in_progress', priority: 'high', deadline: day(20), contractor_ids: ['c1'] },
    { task_key: key(ORS), status: 'done', priority: 'high', deadline: day(45), contractor_ids: ['c1'] },
    { task_key: key(MET), status: 'todo', priority: 'high', deadline: day(31), contractor_ids: [] },
  ] });
  const r2 = p.getByTestId('swap-row');
  pass(await r2.nth(0).getAttribute('data-stage') === 'taken' && /Taken/.test(await r2.nth(0).innerText()) && /I'll take it/.test(await r2.nth(0).innerText()), 'I\'ll take it reads Taken');
  pass(await r2.nth(0).getByTestId('swap-send').count() === 0, 'a taken swap has no send button');
  pass(await r2.nth(2).getAttribute('data-stage') === 'done' && /Done/.test(await r2.nth(2).innerText()), 'a done swap reads Done');
  pass(await r2.nth(1).getAttribute('data-stage') === 'waiting', 'a task with nobody on it (after "I can\'t") reads Waiting again');
  const ticket = (await p.getByTestId('swaps-ticket').innerText()).replace(/\s+/g, ' ');
  pass(/Taken (\d+)%/i.test(ticket) && Number((ticket.match(/Taken (\d+)%/i) || [])[1]) === Math.round((10720 / 13870) * 100), 'the bar is the share of the money already taken or done: ' + ticket);
  await p.close();

  console.log('== a unit price that does not divide evenly');
  p = await open({ alerts: [swap(4, 'Metformin 500mg · Nairobi -> Mombasa', 'Metformin 500mg', 35, 31, 2630)] });
  const odd = (await p.getByTestId('swap-price').innerText()).replace(/\s+/g, ' ');
  pass(/Unit price ≈ 75 KES/.test(odd) && /2,630 KES/.test(odd), 'a rounded unit price carries a ≈: ' + odd);
  await p.close();

  console.log('== nothing to send');
  p = await open({ alerts: [OTHER] });
  pass(await p.getByTestId('branch-swaps').count() === 0, 'no swap alert: no card');
  const quiet = p._calls.filter(c => c === 'GET /assignments' || c === 'GET /contractors').length;
  await p.close();
  const busy = await open();
  const reads = busy._calls.filter(c => c === 'GET /assignments' || c === 'GET /contractors').length;
  pass(reads === quiet + 2, `the card reads the tasks and the people only when there is a swap (${quiet} reads without, ${reads} with)`);
  await busy.close();

  console.log('== no manager yet');
  p = await open({ contractors: [] });
  pass(/Add a manager in Contractors first/.test(await p.getByTestId('branch-swaps').innerText()), 'with nobody to pick it says so, no broken button');
  await p.close();

  console.log('== a plan without amounts');
  p = await open({ plan: 'decouverte' });
  const lite = (await p.getByTestId('branch-swaps').innerText()).replace(/\s+/g, ' ');
  pass(!/KES/.test(lite) && /To send/i.test(lite), 'no money on the card, the ticket counts swaps: ' + lite.slice(0, 80));
  pass(await p.getByTestId('swap-price').count() === 0, 'no price block without amounts');
  await p.close();

  console.log('== French, dark, and 390 px');
  p = await open({ lang: 'fr', theme: 'dark' });
  const fr = (await p.getByTestId('branch-swaps').innerText()).replace(/\s+/g, ' ');
  pass(/Échanges entre pharmacies/.test(fr) && /Repéré/.test(fr) && /Confié/.test(fr) && /Réponse/.test(fr) && /En attente/.test(fr), 'every heading is French');
  pass(!/Branch swaps|Waiting for|Nobody yet/.test(fr), 'no English left in French');
  await p.getByTestId('branch-swaps').scrollIntoViewIfNeeded(); await p.getByTestId('branch-swaps').screenshot({ path: 'branchswaps-dark-fr.png' });
  await p.getByTestId('swaps-ticket').scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -140)); await p.waitForTimeout(200);
  await p.getByTestId('swaps-ticket').screenshot({ path: 'branchswaps-ticket-dark-fr.png' });
  pass(/Prix unitaire/.test(await p.getByTestId('branch-swaps').innerText()) && /À envoyer avant le/.test(fr), 'unit price and send-before are French');
  await p.close();

  p = await open({ vw: 390 });
  pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll at 390 px');
  pass(await p.getByTestId('branch-swaps').evaluate(el => el.querySelectorAll('*').length > 0 && ![...el.querySelectorAll('*')].some(n => n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflowX !== 'visible')), 'nothing inside the card scrolls or is cut');
  await p.getByTestId('swaps-ticket').scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -140)); await p.waitForTimeout(200);
  await p.getByTestId('swaps-ticket').screenshot({ path: 'branchswaps-ticket-390.png' });
  const ys = await p.getByTestId('swap-row').first().locator('ol > li').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
  pass(ys.length === 3 && ys[0] < ys[1] && ys[1] < ys[2], 'at 390 px the steps stack down a rail: ' + ys);
  await p.getByTestId('branch-swaps').scrollIntoViewIfNeeded();
  await p.screenshot({ path: 'branchswaps-390.png', fullPage: false });
  await p.close();

  await b.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
