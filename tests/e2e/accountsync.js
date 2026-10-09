// An account value a view writes (the wholesalers list) reaches the account at once, and a reload a
// moment after an edit does not bring the old values back. When nothing is waiting to be sent, the saved
// account still wins, so a change made on another device shows up.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { mockSupabase, session, STORAGE_KEY } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const UID = 'u-sync', EMAIL = 'a@b.c';
const PROFILE = { sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_language: 'en' };
const OTHER = [{ id: 'z', name: 'From another device', cutoff: null, before: 1, after: 1, days: [true, true, true, true, true, true, true] }];

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    const db = { users: { [EMAIL]: { uid: UID, password: 'x' } }, accounts: { [UID]: { profile: { ...PROFILE }, plan: 'business' } } };
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await mockSupabase(p, db, { plan: 'business' });
    await p.addInitScript(({ key, s }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s)); }, { key: STORAGE_KEY, s: session(UID, EMAIL, {}) });
    await p.goto(APP_URL); await p.waitForTimeout(3500);
    return { p, ctx, db };
  };
  const goPage = async p => { await p.locator('aside nav button', { hasText: /^Wholesalers$/ }).click(); await p.waitForTimeout(800); };
  const server = db => JSON.parse(db.accounts[UID].profile.sentria_wholesalers || '[]');

  console.log('== saved at once');
  { const { p, ctx, db } = await open();
    await goPage(p);
    await p.getByTestId('wholesaler-add').click(); await p.keyboard.type('Dakar'); await p.waitForTimeout(500);
    pass(server(db).length === 1 && server(db)[0].name === 'Dakar', 'half a second after typing, the account holds the wholesaler');
    pass(await p.evaluate(() => localStorage.getItem('sentria_account_dirty')) === null, 'and nothing is left waiting to be sent');
    await ctx.close(); }

  console.log('== a reload right after an edit');
  { const { p, ctx, db } = await open();
    await goPage(p);
    await p.getByTestId('wholesaler-add').click(); await p.keyboard.type('Dakar');
    await p.reload(); await p.waitForTimeout(3500); await goPage(p);
    pass(await p.getByTestId('wholesaler-row').count() === 1, 'the wholesaler is still there');
    pass(server(db).length === 1, 'and the account has it');
    await ctx.close(); }
  { // The save has not reached the server (the page was closed first): the values wait, and win at the next load
    const { p, ctx, db } = await open();
    await goPage(p);
    await p.route(/\/rest\/v1\/accounts/, r => r.request().method() === 'PATCH' ? r.abort() : r.fallback());
    await p.getByTestId('wholesaler-add').click(); await p.keyboard.type('Dakar'); await p.waitForTimeout(400);
    pass(server(db).length === 0, 'with the save failing, the account does not have it yet');
    await p.reload(); await p.waitForTimeout(3500); await goPage(p);
    pass(await p.getByTestId('wholesaler-row').count() === 1, 'after a reload the unsent wholesaler is kept, not wiped');
    await p.unroute(/\/rest\/v1\/accounts/);
    // A failed save waits 30 seconds before it tries again; the next edit tries at once.
    await p.evaluate(() => window.dispatchEvent(new Event('sentria-account-changed'))); await p.waitForTimeout(800);
    pass(server(db).length === 1, 'and it is sent once the network works');
    await ctx.close(); }

  console.log('== another device wins when nothing is waiting');
  { const { p, ctx, db } = await open();
    await goPage(p);
    await p.getByTestId('wholesaler-add').click(); await p.keyboard.type('Dakar'); await p.waitForTimeout(800);
    db.accounts[UID].profile.sentria_wholesalers = JSON.stringify(OTHER);
    await p.reload(); await p.waitForTimeout(3500); await goPage(p);
    const names = await p.getByTestId('wholesaler-name').evaluateAll(e => e.map(x => x.value));
    pass(names.join('|') === 'From another device', `the saved account wins on a new load (${names.join('|')})`);
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
