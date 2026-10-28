// Column matching before the file is sent: the app checks the file first (check_only=true, nothing saved). A file whose
// columns need matching shows "Associez vos colonnes." with the server's suggestions already chosen, and nothing is
// uploaded until the user confirms. A file that passes the check is sent straight away. The answers are the backend's
// shape (pipeline/upload_check.py preflight_body, api/main.py check_only).
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const ONB = { sentria_onboarded: 'true', sentria_company_name: 'Pharmacie A', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' };
const FILE_COLUMNS = ['product', 'quantity', 'sales_last_30_days'];
const NEEDS_MATCHING = {
  success: false, outcome: 'refused', error_code: 'upload_columns_missing',
  message: "This file doesn't match the chosen activity. Missing columns: medicine_name, stock_qty.",
  missing: [['medicine_name'], ['stock_qty']], expected: ['medicine_name', 'stock_qty'], looks_like: [],
  file_columns: FILE_COLUMNS, suggested_mapping: { medicine_name: 'product', stock_qty: 'quantity' },
  confidence: { medicine_name: 'close', stock_qty: 'close' }, rows: 3, expected: ['medicine_name', 'stock_qty'], required: ['medicine_name', 'stock_qty'],
  explain: [
    { column: 'medicine_name', alternatives: ['medicine_name'], more_alternatives: 0, why: "The medicine's name: every alert points to it.", example: 'Paracetamol 500mg' },
    { column: 'stock_qty', alternatives: ['stock_qty'], more_alternatives: 0, why: "The quantity in stock: without it we can't see a stock-out coming.", example: '120' },
  ],
  example: { header: ['medicine_name', 'stock_qty'], row: ['Paracetamol 500mg', '120'] },
};
const ACCEPTED = { success: true, outcome: 'accepted', file_columns: ['medicine_name', 'stock_qty'], suggested_mapping: {} };
const DONE = { rows_processed: 3, alerts_fired: 1, saves_failed: 0 };
const CORS = { 'access-control-allow-origin': '*' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ preflight = NEEDS_MATCHING, lang = 'en', theme = 'light', vw = 1440, vh = 900 } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p._sent = []; p._checks = 0;
    p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => {
      const u = new URL(r.request().url());
      if (u.pathname === '/upload') {
        if (u.searchParams.get('check_only') === 'true') { p._checks += 1; return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(preflight) }); }
        const body = r.request().postData() || '';
        p._sent.push({ mapped: /name="mapping"/.test(body), at: p._checks });
        return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(DONE) });
      }
      r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: u.pathname === '/alerts' ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' });
    });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } }, { ...ONB, sentria_language: lang, sentria_theme: theme });
    await signedIn(p, 'u-1', 'a@b.c', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(1800);
    await p.setInputFiles('input[type=file]', { name: 'stock.csv', mimeType: 'text/csv', buffer: Buffer.from('product,quantity,sales_last_30_days\nParacetamol,24,90\n') });
    await p.waitForTimeout(1500);
    return { p, ctx };
  };
  const dialog = p => p.locator('[role=dialog][aria-label="Data import"]');

  console.log('== a file that needs matching: matched before it is sent');
  { const { p, ctx } = await open();
    pass(await p.getByTestId('upload-match').isVisible(), 'the matching step shows');
    pass(p._checks >= 1 && p._sent.length === 0, 'the file was checked and nothing was sent yet');
    pass(await p.getByTestId('status-medicine_name').innerText() === 'To check', 'a suggestion that is not an exact match says To check');
    pass(/Import 3 rows/.test(await p.getByTestId('upload-match-submit').innerText()), 'the button names the rows in the file');
    pass(await p.getByTestId('match-medicine_name').inputValue() === 'product' && await p.getByTestId('match-stock_qty').inputValue() === 'quantity', 'the suggestions are already chosen');
    pass(await p.getByTestId('upload-match-submit').isEnabled(), 'Import is on, because every field has a column');
    pass(await p.getByTestId('upload-match').count() === 1 && /Match your columns/.test(await p.getByTestId('upload-match').innerText()), 'the headline is shown');
    await p.screenshot({ path: 'uploadpreflight-light.png' });
    await p.getByTestId('upload-match-submit').click(); await p.waitForTimeout(1200);
    pass(p._sent.length === 1 && p._sent[0].mapped, 'after confirming, one upload is sent with the matching');
    pass(/Import complete/.test(await dialog(p).innerText()), 'the import finishes');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== the user changes a suggestion');
  { const { p, ctx } = await open();
    await p.getByTestId('match-stock_qty').selectOption('sales_last_30_days');
    pass(await p.getByTestId('status-stock_qty').innerText() === 'Recognised', 'a column the user picks is recognised');
    await p.getByTestId('upload-match-submit').click(); await p.waitForTimeout(1200);
    pass(p._sent.length === 1, 'the changed matching is sent');
    await ctx.close(); }

  console.log('== a file that passes the check is sent straight away');
  { const { p, ctx } = await open({ preflight: ACCEPTED });
    pass(await p.getByTestId('upload-match').count() === 0, 'no matching step');
    pass(p._sent.length === 1 && !p._sent[0].mapped, 'one plain upload is sent');
    pass(/Import complete/.test(await dialog(p).innerText()), 'Import complete');
    await ctx.close(); }

  console.log('== a short screen: the card scrolls, its bar hidden, and Import stays reachable');
  { const { p, ctx } = await open({ vh: 360 });
    const card = await p.evaluate(() => {
      let node = document.querySelector('[data-testid="upload-match-submit"]');
      while (node && getComputedStyle(node).overflowY !== 'auto') node = node.parentElement;
      if (!node) return null;
      const style = getComputedStyle(node);
      return { overflowY: style.overflowY, scrollbarWidth: style.scrollbarWidth, scrollable: node.scrollHeight > node.clientHeight };
    });
    pass(card && card.overflowY === 'auto' && card.scrollable, 'the card scrolls when it is taller than the screen ' + JSON.stringify(card));
    pass(card && card.scrollbarWidth === 'none', 'its bar is hidden');
    await p.getByTestId('upload-match-submit').scrollIntoViewIfNeeded();
    pass(await p.getByTestId('upload-match-submit').isVisible(), 'the Import button can be reached');
    await p.screenshot({ path: 'uploadpreflight-short.png' });
    await ctx.close(); }

  console.log('== French, dark and phone');
  { const { p, ctx } = await open({ lang: 'fr', theme: 'dark' });
    pass(/Importer 3 lignes/.test(await p.getByTestId('upload-match-submit').innerText()), 'French: the button names the rows');
    pass(/Associez vos colonnes/.test(await p.getByTestId('upload-match').innerText()), 'French headline');
    pass(/SentrIA a reconnu/.test(await p.getByTestId('upload-match').innerText()), 'French subtitle counts the fields');
    await p.screenshot({ path: 'uploadpreflight-dark.png' });
    await ctx.close(); }
  { const { p, ctx } = await open({ vw: 390 });
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll at 390 px');
    await p.screenshot({ path: 'uploadpreflight-390.png' });
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
