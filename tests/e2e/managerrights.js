// Manager rights (F-MANAGERRIGHTS): only the boss adds, edits or removes a branch manager or contractor, files one under a branch,
// and opens a branch's dashboard from Field team. An employee reads the same board and list, with none of those controls.
// The API refuses the writes too (owner_only); this suite checks the page offers none of them and sends no write.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const NOW = new Date().toISOString();
const srcs = ['csv', 'api', 'erp', 'iot'].map(type => ({ type, wanted: false, connected: false, synced: false }));
const site = (id, name) => ({ id, name, location: '', sector: 'health', status: 'offline', sources: srcs, created_at: NOW, departments: [], priorities: [], configured: false });
const person = (id, name, site_id, availability, open) => ({ id, name, role: 'Branch manager', phone: '+254700000' + id.slice(1).padStart(3, '1'), email: null, availability, note: null, active: true, open_assignments: open, site_id, sms_ready: true });
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Atlantis', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' };
const SITES = [site('s1', 'Nairobi'), site('s2', 'Mombasa'), site('s3', 'Kisumu')];
const PEOPLE = [
  person('c1', 'Mary Atieno', 's1', 'available', 1),
  person('c2', 'Joe Otieno', 's2', 'busy', 0),
  person('c3', 'Ruth Wanjiru', null, 'available', 0),
];

(async () => {
  const b = await chromium.launch(LAUNCH);
  const open = async ({ role = null, sites = SITES, people = PEOPLE, vw = 1440, vh = 1000, theme = 'light', lang = 'en' } = {}) => {
    const p = await b.newPage({ viewport: { width: vw, height: vh }, locale: 'en-US' });
    p._errs = []; p._writes = [];
    p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/onrender\.com\//, r => {
      const req = r.request(); const u = new URL(req.url());
      const send = body => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (req.method() !== 'GET' && u.pathname.startsWith('/contractors')) p._writes.push(`${req.method()} ${u.pathname}`);
      if (u.pathname === '/sites') return send({ sites, persisted: true, max_sites: 50 });
      if (u.pathname === '/branches') return send({ branches: SITES.map(x => ({ id: x.id, name: x.name })) });
      if (u.pathname === '/alerts') return send([]);
      if (u.pathname === '/contractors' && req.method() === 'GET') return send({ contractors: people });
      if (u.pathname === '/assignments') return send({ assignments: [] });
      return send({ recommendations: [], assignments: [], contractors: [] });
    });
    await p.addInitScript(v => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(v).forEach(([k, val]) => localStorage.setItem(k, val)); } }, { ...LS, sentria_theme: theme, sentria_language: lang });
    await signedIn(p, 'u', 'a@b.c', { plan: 'entreprise', ...(role ? { role } : {}) });
    await p.goto(APP_URL); await p.waitForTimeout(1800);
    if (vw < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(300); }
    await p.locator('aside nav [data-nav="contractors"]').click(); await p.waitForTimeout(2200);
    return p;
  };

  console.log('== the boss: the board is his to change');
  let q = await open();
  pass(await q.getByTestId('add-manager').count() === 1, 'the boss adds a branch manager');
  pass(await q.getByTestId('open-branch').count() === 2, 'the boss opens a branch dashboard from each manager');
  pass(await q.getByTestId('file-under-branch').count() === 1, 'the boss files an unfiled person under a branch');
  pass(await q.getByTestId('manager-card').first().getByRole('button', { name: /^Options for/ }).count() === 1, 'the boss gets the options menu on a manager');
  await q.getByRole('button', { name: /^Options for Mary/ }).click(); await q.waitForTimeout(200);
  pass(await q.getByTestId('manager-menu').count() === 1 && await q.getByRole('button', { name: /^Remove Mary/ }).count() === 1, 'the boss can remove a manager from the menu');
  await q.getByTestId('branch-board').scrollIntoViewIfNeeded(); await q.screenshot({ path: 'managerrights-boss-light.png' });
  pass(q._errs.length === 0, 'no page errors ' + q._errs.join('|'));
  await q.close();

  console.log('== the employee: sees the board, changes nothing');
  q = await open({ role: 'employee', sites: SITES, people: PEOPLE });
  pass(await q.getByTestId('branch-board').count() === 1, 'the employee still reads the branch board');
  pass(await q.getByTestId('manager-card').count() === 3, 'and sees every manager, the unfiled one included');
  pass(await q.getByTestId('add-manager').count() === 0, 'no add button in the banner');
  pass(await q.getByTestId('add-managers').count() === 0 && await q.getByTestId('missing-strip').count() === 1, 'the band for an uncovered branch has no add button');
  pass(/The account owner adds the managers\./.test(await q.getByTestId('missing-strip').innerText()), 'and says who adds them');
  pass(await q.getByTestId('open-branch').count() === 0, 'no switch to a branch dashboard');
  pass(await q.getByTestId('file-under-branch').count() === 0, 'no file-under select');
  pass(await q.getByRole('button', { name: /^Options for/ }).count() === 0, 'no options menu, so no availability change and no removal');
  pass(await q.getByTestId('manager-sheet').count() === 0, 'no add form opens');
  await q.getByTestId('branch-board').scrollIntoViewIfNeeded(); await q.screenshot({ path: 'managerrights-employee-light.png' });
  pass(q._writes.length === 0, 'and sends no write to the contractors ' + q._writes.join('|'));
  pass(q._errs.length === 0, 'no page errors ' + q._errs.join('|'));
  await q.close();

  console.log('== the employee in dark and on a phone');
  q = await open({ role: 'employee', sites: SITES, people: PEOPLE, vw: 390, vh: 844, theme: 'dark', lang: 'fr' });
  pass(await q.getByTestId('add-manager').count() === 0 && await q.getByTestId('open-branch').count() === 0, 'French, dark, 390 px: the same controls are absent');
  pass(await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll at 390 px');
  await q.getByTestId('branch-board').scrollIntoViewIfNeeded(); await q.screenshot({ path: 'managerrights-employee-390-dark-fr.png' });
  await q.close();

  console.log('== the employee of one branch: the same board as the boss');
  q = await open({ role: 'employee', sites: [SITES[0]], people: PEOPLE });
  pass(await q.getByTestId('branch-board').count() === 1, 'one branch of the account: still the board, every branch');
  pass(await q.getByTestId('manager-card').count() === 3 && await q.getByTestId('banner-covered').innerText().then(t => /2 \/ 3/.test(t)), 'the same numbers as the boss: 2 of 3 covered');
  pass(await q.getByText('Swaps not loaded').count() >= 1 && (await q.getByTestId('banner-swaps').innerText()).startsWith('–'), 'swaps are not loaded for an employee: a dash, never a zero');
  pass(await q.getByTestId('add-manager').count() === 0 && await q.getByTestId('open-branch').count() === 0, 'and no controls');
  await q.screenshot({ path: 'managerrights-employee-one-branch-light.png' });
  pass(q._writes.length === 0, 'no write sent');
  pass(q._errs.length === 0, 'no page errors ' + q._errs.join('|'));
  await q.close();

  console.log('== the boss, one branch: the same list stays editable');
  q = await open({ sites: [SITES[0]], people: [PEOPLE[0]] });
  pass(await q.getByRole('button', { name: /Add a contractor/ }).count() >= 1, 'the boss adds a contractor');
  pass(await q.getByRole('button', { name: /^Remove Mary/ }).count() === 1, 'the boss can remove a person');
  await q.close();

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})();
