// Branch swaps: a product leaving Nairobi is never suggested to someone of Nairobi. Mary (Nairobi) is
// not offered, Joe (Mombasa) is the default. Where nobody else is free, the card says so, and sends nothing.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const now = Date.now();
const day = n => new Date(now + n * 864e5).toISOString().slice(0, 10);
const AMOX = { id: 1, equipment: 'Amoxicillin 250mg · Nairobi -> Mombasa', sector: 'health', business_type: 'pharmacie', severity: 'WARNING', date: new Date(now - 3600e3).toISOString(), alert_key: 'health.branch.swap', risk_score: null,
  message: 'Amoxicillin 250mg: 20 units expire in 20 days at Nairobi and will not sell there. Mombasa sells this product: send them before ' + day(20),
  params: [['product', 'Amoxicillin 250mg'], ['qty', 20], ['from_site', 'Nairobi'], ['to_site', 'Mombasa'], ['days', 20], ['expiry', day(20)], ['value', 7600], ['currency', 'KES']] };
const SITES = [
  { id: 's1', name: 'Nairobi', location: '', sector: 'health', status: 'online', departments: ['pharmacie'], priorities: [], configured: true, sources: [] },
  { id: 's2', name: 'Mombasa', location: '', sector: 'health', status: 'online', departments: ['pharmacie'], priorities: [], configured: true, sources: [] },
];
const person = (id, name, site_id) => ({ id, name, role: 'Branch manager', phone: null, email: null, availability: 'available', note: null, active: true, open_assignments: 0, site_id });
const MARY = person('c1', 'Mary Atieno', 's1');
const JOE = person('c2', 'Joe Otieno', 's2');
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Atlantis', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' };

(async () => {
  const b = await chromium.launch(LAUNCH);
  const open = async ({ contractors, vw = 1440, vh = 900, theme = 'light' } = {}) => {
    const p = await b.newPage({ viewport: { width: vw, height: vh }, locale: 'en-US' });
    p._errs = []; p._calls = []; p._sent = [];
    p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/onrender\.com\//, r => {
      const req = r.request(); const u = new URL(req.url()); p._calls.push(`${req.method()} ${u.pathname}`);
      const send = body => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (u.pathname === '/alerts') return send([AMOX]);
      if (u.pathname === '/sites') return send({ persisted: true, sites: SITES });
      if (u.pathname === '/reports/weekly') return send({ alerts: 1, critical: 0, warning: 1, previous_alerts: 0, delta: 1, trend: 'up', resolved: 0, top_offender: null });
      if (u.pathname === '/contractors') return send({ contractors });
      if (u.pathname === '/assignments' && req.method() === 'GET') return send({ assignments: [] });
      if (u.pathname === '/assignments' && req.method() === 'PUT') { p._sent.push(JSON.parse(req.postData())); return send({ assignment: JSON.parse(req.postData()) }); }
      return send({ recommendations: [], assignments: [], contractors: [] });
    });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); } }, { ...LS, sentria_theme: theme });
    await signedIn(p, 'u', 'a@b.c', { plan: 'business' }); await p.goto(APP_URL); await p.waitForTimeout(1800);
    if (vw < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(300); }
    await p.locator('aside nav button', { hasText: 'Dashboard' }).click(); await p.waitForTimeout(1500);
    if (vw < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(400); }
    if (await p.getByTestId('swaps-open').count()) { await p.getByTestId('swaps-open').click(); await p.waitForTimeout(700); }
    return p;
  };

  console.log('== Mary (Nairobi) is not offered her own branch\'s product');
  let p = await open({ contractors: [MARY, JOE] });
  const row = p.getByTestId('swap-row').first();
  const picker = row.getByTestId('swap-person');
  pass(await picker.count() === 1, 'a manager can be picked');
  const options = await picker.locator('option').allInnerTexts();
  pass(options.length === 1 && /Joe Otieno/.test(options[0]), 'only Joe is offered: ' + options.join(' | '));
  pass(!options.some(o => /Mary/.test(o)), 'Mary is not suggested for a swap out of Nairobi');
  pass(await picker.inputValue() === 'c2', 'the default is Joe, not the first person in the list');
  await p.screenshot({ path: 'swapsuggest-light.png' });
  await row.getByTestId('swap-send').click().catch(() => {}); await p.waitForTimeout(900);
  pass(p._sent.length === 1 && JSON.stringify(p._sent[0].contractor_ids) === '["c2"]', 'sending goes to Joe: ' + JSON.stringify(p._sent.map(x => x.contractor_ids)));
  pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
  await p.close();

  console.log('== only the sending branch\'s people exist');
  p = await open({ contractors: [MARY] });
  const text = (await p.getByTestId('swap-row').first().innerText()).replace(/\s+/g, ' ');
  pass(await p.getByTestId('swap-row').first().getByTestId('swap-person').count() === 0, 'no suggestion when only Mary exists');
  pass(/No other manager outside this branch/.test(text), 'the card says there is no other manager, and does not offer Mary');
  pass(await p.getByTestId('swap-row').first().getByTestId('swap-send').count() === 0, 'and no send button');
  await p.close();

  console.log('== a phone, dark');
  p = await open({ contractors: [MARY, JOE], vw: 390, vh: 844, theme: 'dark' });
  const phoneRow = p.getByTestId('swap-row').first();
  pass(await phoneRow.getByTestId('swap-person').count() === 1 && await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '390 px: the picker is there, no sideways scroll');
  await p.screenshot({ path: 'swapsuggest-390-dark.png' });
  await p.close();

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL OK'); process.exit(fails ? 1 : 0);
})();
