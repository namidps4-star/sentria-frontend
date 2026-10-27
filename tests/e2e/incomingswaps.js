// F-SWAPIN: a branch sees the swaps other branches send to it. Mombasa's employee, who sends nothing, gets the Branch swaps
// row and a read-only "Coming into this branch" list. The value shows only on a plan that sees amounts, and nothing to send.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const now = Date.now();
const day = n => new Date(now + n * 864e5).toISOString().slice(0, 10);
const NOW = new Date().toISOString();
const srcs = ['csv', 'api', 'erp', 'iot'].map(type => ({ type, wanted: false, connected: false, synced: false }));
const site = (id, name) => ({ id, name, location: '', sector: 'health', status: 'offline', sources: srcs, created_at: NOW, departments: [], priorities: [], configured: false });
const MOMBASA = site('s2', 'Mombasa');
const incomingSwap = (id, product, qty, days, value) => ({
  id, equipment: `${product} · Nairobi -> Mombasa`, alert_key: 'health.branch.swap', sector: 'health', date: NOW,
  params: [['product', product], ['qty', qty], ['from_site', 'Nairobi'], ['to_site', 'Mombasa'], ['days', days], ['expiry', day(days)], ['value', value], ['currency', 'KES']],
});
const INCOMING = [incomingSwap(1, 'Amoxicillin 250mg', 20, 9, 7600), incomingSwap(2, 'Metformin 500mg', 40, 14, 3200)];
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Atlantis', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_active_site: 's2' };

(async () => {
  const b = await chromium.launch(LAUNCH);
  const open = async ({ plan = 'pro', incoming = INCOMING, vw = 1440, vh = 1000, theme = 'light', lang = 'en' } = {}) => {
    const p = await b.newPage({ viewport: { width: vw, height: vh }, locale: 'en-US' });
    p._errs = []; p._incoming = [];
    p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/onrender\.com\//, r => {
      const req = r.request(); const u = new URL(req.url());
      const send = body => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (u.pathname === '/sites') return send({ sites: [MOMBASA], persisted: true, max_sites: 50 });
      if (u.pathname === '/alerts') return send([]);
      if (u.pathname === '/swaps/incoming') { p._incoming.push(u.search); return send({ alerts: incoming }); }
      if (u.pathname === '/assignments') return send({ assignments: [] });
      if (u.pathname === '/contractors') return send({ contractors: [] });
      return send({ recommendations: [], assignments: [], contractors: [] });
    });
    await p.addInitScript(v => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(v).forEach(([k, val]) => localStorage.setItem(k, val)); } }, { ...LS, sentria_theme: theme, sentria_language: lang });
    await signedIn(p, 'u', 'a@b.c', { plan, role: 'employee' }); await p.goto(APP_URL); await p.waitForTimeout(1800);
    if (vw < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(300); }
    return p;
  };

  console.log('== Mombasa, on a plan that sees amounts');
  let q = await open();
  pass(await q.getByTestId('swaps-open').count() === 1, 'the Branch swaps row shows, though Mombasa sends nothing');
  await q.getByTestId('swaps-open').click(); await q.getByTestId('swaps-sheet').waitFor({ timeout: 4000 }).catch(() => {});
  pass(await q.getByTestId('swaps-sheet').count() === 1, 'the sheet opens');
  pass(await q.getByTestId('incoming-line').count() === 2, 'two swaps are coming in');
  const text = await q.getByTestId('incoming-swaps').innerText();
  pass(/Amoxicillin 250mg/.test(text) && /Metformin 500mg/.test(text) && /from Nairobi/.test(text), 'each line names the product and the branch it comes from');
  pass(/7[.,]6/.test(text), 'the value shows on a plan that sees amounts');
  pass(p_has(q._incoming, 'site_id=s2'), 'the read names Mombasa');
  pass(await q.getByTestId('swaps-sheet').getByRole('button', { name: /^Send|^Envoyer/ }).count() === 0, 'and nothing to send from here');
  await q.getByTestId('swaps-sheet').screenshot({ path: 'incomingswaps-light.png' });
  pass(q._errs.length === 0, 'no page errors ' + q._errs.join('|'));
  await q.close();

  console.log('== Mombasa, on the free plan, dark, French, phone');
  q = await open({ plan: 'decouverte', vw: 390, vh: 844, theme: 'dark', lang: 'fr' });
  await q.getByTestId('swaps-open').click(); await q.waitForTimeout(600);
  const phone = await q.getByTestId('incoming-swaps').innerText();
  pass(!/7[.,]6/.test(phone) && /20 unités/.test(phone), 'the free plan sees the units, not the value');
  pass(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll at 390 px');
  await q.getByTestId('incoming-swaps').screenshot({ path: 'incomingswaps-390-dark-fr.png' });
  pass(q._errs.length === 0, 'no page errors ' + q._errs.join('|'));
  await q.close();

  console.log('== Mombasa with nothing coming in');
  q = await open({ incoming: [] });
  pass(await q.getByTestId('swaps-open').count() === 0, 'no row when no swap is sent or received');
  await q.close();

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();

function p_has(list, text) { return list.some(s => s.includes(text)); }
