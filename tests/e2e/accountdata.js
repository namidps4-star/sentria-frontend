// Privacy rights in Settings: export downloads a JSON file; delete needs the word DELETE, offers the export
// first, sends the confirm word, clears local data and signs out; a failed call keeps the user in with a message.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

(async () => {
  const b = await chromium.launch(LAUNCH);
  const open = async ({ vw = 1440, theme = 'light', lang = 'en', failDelete = false } = {}) => {
    const ctx = await b.newContext({ viewport: { width: vw, height: 900 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US', acceptDownloads: true });
    const p = await ctx.newPage(); p._errs = []; p._calls = []; p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/\/account(\/export)?$/, r => {
      const req = r.request(); p._calls.push({ m: req.method(), u: new URL(req.url()).pathname, body: req.postData(), auth: req.headers()['authorization'] });
      if (req.method() === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-disposition': 'attachment; filename="sentria-data.json"' }, body: '{"account":null,"tables":{"alerts":[]}}' });
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      return failDelete ? r.fulfill({ status: 500, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: '{"detail":{}}' }) : r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: '{"success":true,"company_data_deleted":true}' });
    });
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.route(/\/(recommendations|assignments|contractors)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_language: lang, sentria_theme: theme });
    await signedIn(p, 'u-1', 'a@b.c', { plan: 'pro' });
    await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    if (vw < 1024) { const m = p.getByRole('button', { name: /menu/i }).first(); if (await m.count()) { await m.click(); await p.waitForTimeout(400); } }
    await p.getByRole('button', { name: lang === 'fr' ? /^Paramètres$/ : /^Settings$/ }).first().click(); await p.waitForTimeout(700);
    return { p, ctx };
  };

  console.log('== export');
  { const { p, ctx } = await open();
    await p.getByTestId('account-data').scrollIntoViewIfNeeded();
    await p.screenshot({ path: 'accountdata-light.png' });
    const [dl] = await Promise.all([p.waitForEvent('download'), p.getByTestId('account-export').click()]);
    pass(dl.suggestedFilename() === 'sentria-data.json', 'a file named sentria-data.json is downloaded');
    pass(p._calls.some(c => c.m === 'GET' && c.u === '/account/export' && /^Bearer /.test(c.auth || '')), 'the call is signed in');
    await p.waitForTimeout(300);
    pass(/downloaded/i.test(await p.getByTestId('account-note').innerText()), 'a note says the file was downloaded');
    await ctx.close(); }

  console.log('== delete');
  { const { p, ctx } = await open();
    await p.getByTestId('account-delete').click(); await p.waitForTimeout(500);
    const confirm = p.getByTestId('account-delete-confirm');
    pass(await confirm.isDisabled(), 'the delete button is off until the word is typed');
    await p.getByTestId('account-delete-word').fill('delete');
    pass(await confirm.isDisabled(), 'a lower-case word does not unlock it');
    await p.screenshot({ path: 'accountdata-dialog-light.png' });
    const [dl] = await Promise.all([p.waitForEvent('download'), p.getByTestId('account-delete-export').click()]);
    pass(!!dl, 'the dialog offers the export first');
    pass(p._calls.every(c => c.m !== 'DELETE'), 'exporting from the dialog deletes nothing');
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    pass(await p.getByTestId('account-delete-dialog').count() === 0, 'Escape closes it and nothing is deleted');
    await p.getByTestId('account-delete').click(); await p.waitForTimeout(400);
    await p.getByTestId('account-delete-word').fill('DELETE');
    pass(!(await confirm.isDisabled()), 'DELETE unlocks it');
    await Promise.all([p.waitForNavigation({ timeout: 8000 }).catch(() => {}), confirm.click()]);
    await p.waitForTimeout(1500);
    const del = p._calls.find(c => c.m === 'DELETE');
    pass(del && del.u === '/account' && JSON.parse(del.body).confirm === 'DELETE', 'it sends DELETE /account with the word');
    pass(await p.evaluate(() => localStorage.getItem('sentria_company_name')) === null, 'local data is cleared');
    pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
    await ctx.close(); }

  console.log('== a failed deletion');
  { const { p, ctx } = await open({ failDelete: true });
    await p.getByTestId('account-delete').click(); await p.waitForTimeout(400);
    await p.getByTestId('account-delete-word').fill('DELETE');
    await p.getByTestId('account-delete-confirm').click(); await p.waitForTimeout(1200);
    pass(/failed/i.test(await p.getByTestId('account-delete-error').innerText()), 'a message says it failed');
    pass(await p.evaluate(() => localStorage.getItem('sentria_company_name')) === 'Acme', 'local data is kept');
    pass(!(await p.getByTestId('account-delete-confirm').isDisabled()), 'it can be tried again');
    await ctx.close(); }

  console.log('== dark, French, phone');
  { const { p, ctx } = await open({ theme: 'dark', lang: 'fr' });
    await p.getByTestId('account-data').scrollIntoViewIfNeeded();
    pass(/Exporter mes données/.test(await p.getByTestId('account-export').innerText()) && /Supprimer mon compte/.test(await p.getByTestId('account-delete').innerText()), 'French labels');
    await p.screenshot({ path: 'accountdata-dark-fr.png' });
    await p.getByTestId('account-delete').click(); await p.waitForTimeout(500);
    await p.screenshot({ path: 'accountdata-dialog-dark-fr.png' }); await ctx.close(); }
  { const { p, ctx } = await open({ vw: 390 });
    await p.getByTestId('account-data').scrollIntoViewIfNeeded();
    pass(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no sideways scroll at 390 px');
    await p.screenshot({ path: 'accountdata-390.png' });
    await p.getByTestId('account-delete').click(); await p.waitForTimeout(500);
    const box = await p.getByTestId('account-delete-dialog').boundingBox();
    pass(box && box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 900, 'the dialog fits at 390 px');
    await p.screenshot({ path: 'accountdata-dialog-390.png' }); await ctx.close(); }

  await b.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
