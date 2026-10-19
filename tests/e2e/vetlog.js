// H-VET step 2: the disposal log on the Vet dashboard. One line per disposal, what the log adds up to and the share
// thrown in pits; adding and removing go to the API signed in; a log the API cannot hold says so; French, dark, phone.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const day = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const ROWS = () => [
  { id: 'd1', product: 'Rabies vaccine', batch: 'B7', qty: 20, value: 100, currency: 'EUR', method: 'pit', disposed_on: day(2), note: '' },
  { id: 'd2', product: 'Dewormer', batch: '', qty: 5, value: 50, currency: 'EUR', method: 'burn', disposed_on: day(5), note: '' },
];
const summarize = rows => {
  const total = rows.reduce((a, r) => a + r.value, 0), pit = rows.filter(r => r.method === 'pit').reduce((a, r) => a + r.value, 0);
  return { count: rows.length, total_value: total, last_30_days_value: total, pit_share: total ? Math.round(pit / total * 1000) / 10 : 0, by_method: {} };
};

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ lang = 'en', theme = 'light', vw = 1440, persisted = true, business = 'veterinaire' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 1000 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p._calls = []; p.on('pageerror', e => p._errors.push(e.message));
    let rows = ROWS();
    await p.route(/onrender\.com\//, r => {
      const req = r.request(), u = new URL(req.url()), m = req.method();
      if (u.pathname === '/disposals' && m === 'GET') return json(r, persisted ? { disposals: rows, summary: summarize(rows), methods: ['pit', 'burn', 'return', 'donation', 'other'], persisted: true } : { disposals: [], summary: summarize([]), methods: [], persisted: false });
      if (u.pathname === '/disposals' && m === 'POST') { const b = JSON.parse(req.postData()); p._calls.push({ m, b, auth: req.headers()['authorization'] }); rows = [{ id: 'n' + rows.length, note: '', ...b }, ...rows]; return json(r, { disposal: rows[0] }, 201); }
      const one = u.pathname.match(/^\/disposals\/(.+)$/);
      if (one && m === 'DELETE') { p._calls.push({ m, id: one[1] }); rows = rows.filter(x => x.id !== one[1]); return json(r, { success: true }); }
      return json(r, u.pathname === '/alerts' ? [] : { recommendations: [], assignments: [], contractors: [] });
    });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: business, sentria_language: lang, sentria_theme: theme });
    await signedIn(p, 'u-1', 'a@b.c', { plan: 'pro' });
    await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(2000);
    return { p, ctx };
  };
  const log = p => p.getByTestId('disposal-log');

  console.log('== the log');
  { const { p, ctx } = await open();
    await log(p).scrollIntoViewIfNeeded();
    pass(await log(p).count() === 1, 'a Vet account has the Disposal log on its dashboard');
    pass(await p.getByTestId('disposal-row').count() === 2 && /Rabies vaccine · batch B7/.test(await p.getByTestId('disposal-row').first().innerText()), 'it lists the entries with their batch');
    const t = await p.getByTestId('disposal-summary').innerText();
    pass(/150/.test(t) && /66\.7 %/.test(t), 'it adds up: 150 lost, 66.7 % in pits: ' + t.replace(/\s+/g, ' '));
    pass(await p.getByTestId('disposal-advice').count() === 1 && /66\.7 % of losses end in a pit/.test(await p.getByTestId('disposal-advice').innerText()), 'advice line shows when pits are half or more');
    await p.getByTestId('disposal-filter-burn').click(); await p.waitForTimeout(150);
    pass(await p.getByTestId('disposal-row').count() === 1 && /Dewormer/.test(await p.getByTestId('disposal-row').first().innerText()), 'filter Burned shows only the burned entry');
    await p.getByTestId('disposal-filter-all').click(); await p.waitForTimeout(150);
    pass(await p.getByTestId('disposal-row').count() === 2, 'filter All shows both again');
    await p.getByTestId('disposal-product').fill('Antibiotic'); await p.getByTestId('disposal-value').fill('80');
    await p.getByTestId('disposal-method').selectOption('return'); await p.getByTestId('disposal-add').click(); await p.waitForTimeout(700);
    const sent = p._calls.find(c => c.m === 'POST');
    pass(sent && sent.b.product === 'Antibiotic' && sent.b.value === 80 && sent.b.method === 'return' && /^Bearer /.test(sent.auth || ''), 'adding sends the entry, signed in: ' + JSON.stringify(sent && sent.b));
    pass(/Saved/.test(await p.getByTestId('disposal-note').innerText()) && await p.getByTestId('disposal-row').count() === 3, 'a note says saved and the list grows');
    await p.getByTestId('disposal-remove').first().click(); await p.waitForTimeout(600);
    pass(p._calls.some(c => c.m === 'DELETE') && await p.getByTestId('disposal-row').count() === 2, 'removing sends a DELETE and the list shrinks');
    await log(p).scrollIntoViewIfNeeded(); await p.screenshot({ path: 'vetlog-light.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== another department');
  { const { p, ctx } = await open({ business: 'pharmacie' });
    pass(await log(p).count() === 0, 'a pharmacy has no disposal log');
    await ctx.close(); }

  console.log('== before the migration');
  { const { p, ctx } = await open({ persisted: false });
    await log(p).scrollIntoViewIfNeeded();
    pass(/not available yet/.test(await p.getByTestId('disposal-unavailable').innerText()) && await p.getByTestId('disposal-add').count() === 0, 'the log says it is not available and offers no form');
    await ctx.close(); }

  console.log('== French, dark, phone');
  { const { p, ctx } = await open({ lang: 'fr', theme: 'dark', vw: 390 });
    await log(p).scrollIntoViewIfNeeded();
    const t = await log(p).innerText();
    pass(/journal des pertes/i.test(t) && /Jeté en fosse|fosse/i.test(t) && /Ajouter/.test(t), 'French labels');
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll at 390 px');
    await p.screenshot({ path: 'vetlog-390-dark-fr.png' });
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
