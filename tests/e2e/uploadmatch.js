// Column matching after a refusal: the refused import shows "Associez vos colonnes." with one dropdown per missing
// field, taken from the file's own columns. Import stays off until every field has a column. The retry sends the
// matching as `mapping` and the import finishes. A matching the API refuses stays on screen with the reason.
// The 422 and 200 bodies are the backend's shape (pipeline/upload_check.py, api/main.py).
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const ONB = { sentria_onboarded: 'true', sentria_company_name: 'Pharmacie A', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' };
const REFUSED = {
  success: false, error_code: 'upload_columns_missing', message: "This file doesn't match the chosen activity.",
  missing: [['medicine_name'], ['stock_qty']], expected: ['medicine_name', 'stock_qty'], looks_like: [],
  file_columns: ['product', 'quantity', 'sales_last_30_days'],
  explain: [
    { column: 'medicine_name', alternatives: ['medicine_name'], more_alternatives: 0, why: "The medicine's name: every alert points to it.", example: 'Paracetamol 500mg' },
    { column: 'stock_qty', alternatives: ['stock_qty'], more_alternatives: 0, why: "The quantity in stock: without it we can't see a stock-out coming.", example: '120' },
  ],
  example: { header: ['medicine_name', 'stock_qty'], row: ['Paracetamol 500mg', '120'] },
};
const DONE = { rows_processed: 3, alerts_fired: 1, saves_failed: 0 };
// The check-only answer (api/main.py with check_only=true, pipeline/upload_check.py preflight_body).
const PREFLIGHT = { ...REFUSED, success: false, outcome: 'refused', suggested_mapping: {} };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ lang = 'en', theme = 'light', vw = 1440, mappedStatus = 200, mappedBody = DONE } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p._posts = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => {
      const u = new URL(r.request().url());
      if (u.pathname === '/upload') {
        const body = r.request().postData() || '';
        if (u.searchParams.get('check_only') === 'true') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(PREFLIGHT) });
        p._posts.push(body);
        const mapped = /name="mapping"/.test(body);
        if (!mapped) return r.fulfill({ status: 422, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(REFUSED) });
        return r.fulfill({ status: mappedStatus, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(mappedBody) });
      }
      r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: u.pathname === '/alerts' ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' });
    });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } }, { ...ONB, sentria_language: lang, sentria_theme: theme });
    await signedIn(p, 'u-1', 'a@b.c', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(1800);
    await p.setInputFiles('input[type=file]', { name: 'wrong.csv', mimeType: 'text/csv', buffer: Buffer.from('product,quantity,sales_last_30_days\nParacetamol,24,90\n') });
    await p.waitForTimeout(1500);
    return { p, ctx };
  };
  const dialog = p => p.locator('[role=dialog][aria-label="Data import"]');

  console.log('== the refusal offers matching');
  { const { p, ctx } = await open();
    const match = p.getByTestId('upload-match');
    pass(await match.isVisible(), 'the matching step shows');
    pass(/Match your columns/.test(await match.innerText()), 'with the headline');
    pass(await p.getByTestId('match-medicine_name').isVisible() && await p.getByTestId('match-stock_qty').isVisible(), 'one dropdown per missing field');
    const options = await p.getByTestId('match-medicine_name').locator('option').allInnerTexts();
    pass(options.includes('product') && options.includes('quantity') && options.includes('sales_last_30_days'), "the dropdown lists the file's own columns");
    pass(/every alert points to it/.test(await match.innerText()), 'each field keeps its plain reason');
    const submit = p.getByTestId('upload-match-submit');
    pass(await submit.isDisabled(), 'Import stays off until every field has a column');
    await p.getByTestId('match-medicine_name').selectOption('product');
    pass(await submit.isDisabled(), 'still off with one field chosen');
    pass(await p.getByTestId('match-stock_qty').locator('option[value="product"]').count() === 0, 'a column chosen for one field is not offered for another');
    await p.getByTestId('match-stock_qty').selectOption('quantity');
    pass(await submit.isEnabled(), 'on once every field has a column');
    await p.screenshot({ path: 'uploadmatch-light.png' });
    await submit.click(); await p.waitForTimeout(1200);
    const sent = p._posts[p._posts.length - 1] || '';
    pass(/name="mapping"/.test(sent) && /"medicine_name":"product"/.test(sent) && /"stock_qty":"quantity"/.test(sent), 'the retry sends the matching as mapping');
    pass(await p.getByTestId('upload-match').count() === 0 && /Import complete/.test(await dialog(p).innerText()), 'the import finishes: Import complete');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== a matching the API refuses');
  { const { p, ctx } = await open({ mappedStatus: 400, mappedBody: { success: false, error_code: 'mapping_invalid', message: 'The column matching is not valid.' } });
    await p.getByTestId('match-medicine_name').selectOption('product');
    await p.getByTestId('match-stock_qty').selectOption('quantity');
    await p.getByTestId('upload-match-submit').click(); await p.waitForTimeout(1200);
    pass(/not valid/.test(await dialog(p).innerText()), 'the reason is shown');
    pass(await p.getByTestId('upload-match').count() === 1, 'the matching stays on screen to fix it');
    await ctx.close(); }

  console.log('== French, dark and phone');
  { const { p, ctx } = await open({ lang: 'fr', theme: 'dark' });
    pass(/Associez vos colonnes/.test(await p.getByTestId('upload-match').innerText()), 'French headline');
    pass(/Importer avec ces colonnes/.test(await p.getByTestId('upload-match-submit').innerText()), 'French button');
    await p.screenshot({ path: 'uploadmatch-dark.png' });
    await ctx.close(); }
  { const { p, ctx } = await open({ vw: 390 });
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll at 390 px');
    await p.screenshot({ path: 'uploadmatch-390.png' });
    await ctx.close(); }

  await browser.close();
  console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`); process.exit(fails ? 1 : 0);
})();
