// F-TEACH: a refused import says, per missing column, why it's needed and an example, and offers a template.
// The 422 bodies below are the backend's real output (Sentria pipeline/upload_check.py) for a pharmacy
// file with "product,quantity,sales_last_30_days": medicine_name and stock_qty missing.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const BODY = { en: {"error_code": "upload_columns_missing", "message": "This file doesn't match the chosen activity. Missing columns: medicine_name, stock_qty. Expected columns: medicine_name, stock_qty, min_stock, sales_last_30_days, unit_cost, expiry_date.", "missing": [["medicine_name"], ["stock_qty"]], "expected": ["medicine_name", "stock_qty", "min_stock", "sales_last_30_days", "unit_cost", "expiry_date"], "looks_like": [], "explain": [{"column": "medicine_name", "alternatives": ["medicine_name"], "more_alternatives": 0, "why": "The medicine's name: every alert points to it.", "example": "Paracetamol 500mg"}, {"column": "stock_qty", "alternatives": ["stock_qty"], "more_alternatives": 0, "why": "The quantity in stock: without it we can't see a stock-out coming.", "example": "120"}], "example": {"header": ["medicine_name", "stock_qty", "min_stock", "sales_last_30_days", "unit_cost", "expiry_date"], "row": ["Paracetamol 500mg", "120", "30", "90", "2500", "2026-12-31"]}}, fr: {"error_code": "upload_columns_missing", "message": "Ce fichier ne correspond pas à l'activité choisie. Colonnes manquantes : medicine_name, stock_qty. Colonnes attendues : medicine_name, stock_qty, min_stock, sales_last_30_days, unit_cost, expiry_date.", "missing": [["medicine_name"], ["stock_qty"]], "expected": ["medicine_name", "stock_qty", "min_stock", "sales_last_30_days", "unit_cost", "expiry_date"], "looks_like": [], "explain": [{"column": "medicine_name", "alternatives": ["medicine_name"], "more_alternatives": 0, "why": "Le nom du médicament : c'est lui que chaque alerte désigne.", "example": "Paracetamol 500mg"}, {"column": "stock_qty", "alternatives": ["stock_qty"], "more_alternatives": 0, "why": "La quantité en stock : sans elle, impossible de voir une rupture venir.", "example": "120"}], "example": {"header": ["medicine_name", "stock_qty", "min_stock", "sales_last_30_days", "unit_cost", "expiry_date"], "row": ["Paracetamol 500mg", "120", "30", "90", "2500", "2026-12-31"]}} };
const ONB = { sentria_onboarded: 'true', sentria_company_name: 'Pharmacie A', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async (lang, body, vw = 1440) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: 'en-US', acceptDownloads: true });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => { const u = new URL(r.request().url());
      if (u.pathname === '/upload') return r.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify(body) });
      r.fulfill({ status: 200, contentType: 'application/json', body: u.pathname === '/alerts' ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' }); });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } }, { ...ONB, sentria_language: lang });
    await signedIn(p, 'u-1', 'a@b.c', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(1800);
    await p.setInputFiles('input[type=file]', { name: 'wrong.csv', mimeType: 'text/csv', buffer: Buffer.from('product,quantity,sales_last_30_days\nx,1,2\n') });
    await p.waitForTimeout(1500);
    return { p, ctx };
  };

  console.log('== English');
  { const { p, ctx } = await open('en', BODY.en);
    const box = p.getByTestId('upload-teach').first();
    pass(await box.isVisible(), 'the refusal shows "How to fix the file"');
    const items = box.locator('li');
    pass(await items.count() === 2, 'both missing columns listed');
    const t0 = await items.nth(0).innerText(), t1 = await items.nth(1).innerText();
    pass(/medicine_name/.test(t0) && /every alert points to it/.test(t0) && /e\.g\.\s*Paracetamol 500mg/.test(t0), 'medicine_name: why + example');
    pass(/stock_qty/.test(t1) && /stock-out coming/.test(t1) && /e\.g\.\s*120/.test(t1), 'stock_qty: why + example');
    const pre = await box.locator('pre').innerText();
    pass(pre.split('\n')[0] === 'medicine_name,stock_qty,min_stock,sales_last_30_days,unit_cost,expiry_date' && pre.split('\n')[1].startsWith('Paracetamol 500mg,120,'), 'an example line under the suggested header');
    const [dl] = await Promise.all([p.waitForEvent('download'), box.getByRole('button', { name: 'Download the CSV template' }).click()]);
    const file = require('fs').readFileSync(await dl.path(), 'utf8');
    pass(dl.suggestedFilename() === 'sentria-template.csv' && file === pre.trim() + '\n', 'the template downloads, same two lines: ' + dl.suggestedFilename());
    pass(/File refused, nothing was saved/.test(await p.locator('[role=dialog][aria-label="Data import"]').innerText()), 'still says nothing was saved');
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await p.screenshot({ path: 'teach-en.png' });
    await ctx.close(); }

  console.log('== French');
  { const { p, ctx } = await open('fr', BODY.fr);
    const box = p.getByTestId('upload-teach').first();
    const t = await box.innerText();
    pass(/Comment corriger le fichier/.test(t) && /rupture venir/.test(t) && /ex\.\s*120/.test(t) && /Télécharger le modèle CSV/.test(t), 'in French: title, why, example, button');
    await ctx.close(); }

  console.log('== older API without explanations');
  { const legacy = { error_code: 'upload_columns_missing', message: 'This file is missing: medicine_name.' };
    const { p, ctx } = await open('en', legacy);
    pass(await p.getByTestId('upload-teach').count() === 0 && /missing: medicine_name/.test(await p.locator('[role=dialog][aria-label="Data import"]').innerText()), 'no explain in the body: the plain message, no empty box');
    await ctx.close(); }

  console.log('== phone');
  { const { p, ctx } = await open('en', BODY.en, 390);
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll (the example line scrolls inside its box)');
    await p.screenshot({ path: 'teach-390.png', fullPage: false });
    await ctx.close(); }

  await browser.close();
  console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`); process.exit(fails ? 1 : 0);
})();
