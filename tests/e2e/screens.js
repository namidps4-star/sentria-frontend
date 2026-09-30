// Severity tags (solid red / amber in every theme), onboarding step 1, and the restyled Calendar, Sites, Report, Settings.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright'); const { signedIn } = require('./auth-mock');
let fails = 0; const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const deps = ['pharmacie', 'clinique-hopital', 'laboratoire'];
const data = Array.from({ length: 12 }, (_, k) => ({ id: k, equipment: `Med ${k}`, sector: 'health', business_type: deps[k % 3], severity: k % 3 === 1 ? 'WARNING' : 'CRITICAL', date: new Date(Date.now() - k * 36e5 * 7).toISOString(), alert_key: 'health.stock.low', message: `MSG ${k}` }));
const recs = data.map((a, i) => ({ ...a, recommended_action: ['Order 120 boxes', 'Call the supplier', 'Check the freezer'][i % 3], action_category: 'restock', date: new Date(Date.now() + (i % 5 - 2) * 864e5).toISOString() }));
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Pharmacie A', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_departments: '{"health":["pharmacie","clinique-hopital","laboratoire"]}', sentria_timezone: 'wat', sentria_country: 'BJ' };
const lum = c => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

(async () => { const b = await chromium.launch(LAUNCH);
  const open = async ({ theme = 'light', scheme = 'light', vw = 1440, ls = {}, name = 'Ama Mensah' } = {}) => {
    const ctx = await b.newContext({ viewport: { width: vw, height: vw < 500 ? 844 : 900 }, locale: 'en-US', colorScheme: scheme });
    const p = await ctx.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message)); p._ctx = ctx;
    await p.route(/onrender\.com\//, r => { const u = r.request().url(); r.fulfill({ status: 200, contentType: 'application/json', body: /\/alerts/.test(u) ? JSON.stringify(data) : /\/recommendations/.test(u) ? JSON.stringify({ recommendations: recs }) : '{"recommendations":[],"assignments":[],"contractors":[]}' }); });
    await p.addInitScript(({ ls }) => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); } }, { ls: { ...LS, sentria_theme: theme, ...ls } });
    await signedIn(p, 'u', 'ama@pharma.bj', { plan: 'business', meta: { full_name: name } }); await p.goto(APP_URL); await p.waitForTimeout(1800); return p; };
  const go = async (p, label) => { if ((p.viewportSize() || {}).width < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(300); } await p.locator('aside nav button', { hasText: label }).click(); await p.waitForTimeout(1300); };
  const style = (loc) => loc.evaluate(e => { const s = getComputedStyle(e); return { bg: s.backgroundColor, fg: s.color }; });

  console.log('== severity tags');
  for (const [theme, scheme, label] of [['light', 'light', 'light'], ['dark', 'light', 'dark'], ['system', 'dark', 'system → dark']]) {
    const p = await open({ theme, scheme });
    const crit = p.locator('#alerts-table span.rounded-full', { hasText: /^Critical$/ }).first();
    const warn = p.locator('span.rounded-full', { hasText: /^Warning$/ }).first();
    await p.locator('#alerts-table').scrollIntoViewIfNeeded().catch(() => {});
    const c = await style(crit);
    pass(c.bg === 'rgb(220, 38, 38)' && c.fg === 'rgb(255, 255, 255)', `${label}: Critical is solid red with white text (${c.bg} / ${c.fg})`);
    if (await warn.count()) { const w = await style(warn); pass(w.bg === 'rgb(245, 158, 11)' && contrast(w.bg, w.fg) >= 4.5, `${label}: Warning is solid amber, readable (${w.bg}, ${contrast(w.bg, w.fg).toFixed(1)}:1)`); }
    pass(contrast(c.bg, c.fg) >= 4.5, `${label}: Critical text contrast ${contrast(c.bg, c.fg).toFixed(2)}:1`);
    const tags = await p.$$eval('span.rounded-full.border.font-semibold', els => els.filter(e => e.offsetParent).map(e => { const s = getComputedStyle(e); return { t: e.innerText.trim(), bg: s.backgroundColor, fg: s.color }; }));
    // Solid fills only: the see-through chips on the black banner are not status tags.
    const solid = t => /^rgb\(/.test(t.bg);
    const bad = tags.filter(t => solid(t) && contrast(t.bg, t.fg) < 4.5);
    pass(tags.length > 0 && bad.length === 0, `${label}: all ${tags.length} tags on the dashboard ≥ 4.5:1` + (bad.length ? ' — ' + JSON.stringify(bad.slice(0, 3)) : ''));
    if (theme !== 'light') { const calm = tags.filter(t => solid(t) && !['rgb(220, 38, 38)', 'rgb(245, 158, 11)'].includes(t.bg)); pass(calm.length > 0 && calm.every(t => lum(t.bg) < 0.12), `${label}: calm tags are dark tints, not bright pastels (${calm.map(t => t.t + ' ' + t.bg).slice(0, 4).join(', ')})`); }
    pass(p._errs.length === 0, `${label}: no page errors ` + p._errs.join('|'));
    await p._ctx.close();
  }

  console.log('== onboarding step 1');
  { const p = await open({ ls: { sentria_onboarded: '' } });
    const t = await p.evaluate(() => document.body.innerText);
    pass(/Welcome, Ama/.test(t) && /Hello Ama\. Where do you work\?/.test(t), 'greets by first name, asks as a chat');
    pass(await p.evaluate(() => document.querySelector('[role=dialog] h2').innerText) === 'Your country', 'the heading is the step title');
    await p.getByText('Kenya', { exact: true }).click(); await p.waitForTimeout(200);
    pass(await p.getByRole('button', { name: /Kenya/ }).getAttribute('aria-pressed') === 'true' && await p.locator('select[aria-label="Account currency"]').inputValue() === 'KES', 'Kenya: pressed, currency KES');
    pass(/Your figures in\s*KSh/.test(await p.evaluate(() => document.body.innerText)), 'the black card shows the currency');
    await p._ctx.close(); }

  console.log('== Settings');
  { const p = await open(); await go(p, 'Settings');
    const switches = p.getByRole('switch');
    pass(await switches.count() === 3, '3 switches, each named: ' + (await switches.evaluateAll(els => els.map(e => e.getAttribute('aria-label')))).join(', '));
    let inside = true;
    for (let i = 0; i < 3; i++) { const sw = switches.nth(i); const a = await sw.boundingBox(); const k = await sw.locator('span').boundingBox(); if (k.x < a.x - 0.5 || k.x + k.width > a.x + a.width + 0.5) inside = false; }
    pass(inside, 'every knob sits inside its track (it used to hang outside)');
    await p.getByRole('switch', { name: 'Dark mode' }).click(); await p.waitForTimeout(300);
    pass(await p.evaluate(() => document.documentElement.classList.contains('dark')) && await p.getByRole('switch', { name: 'Dark mode' }).getAttribute('aria-checked') === 'true', 'Dark mode switch turns the dark theme on');
    const k = await p.getByRole('switch', { name: 'Dark mode' }).locator('span').boundingBox(), a = await p.getByRole('switch', { name: 'Dark mode' }).boundingBox();
    pass(k.x + k.width <= a.x + a.width + 0.5 && k.x > a.x + a.width / 2 - 4, 'on: knob moved to the right, still inside');
    await p.fill('input[autocomplete=organization]', 'Changed name'); await p.getByRole('button', { name: 'Cancel' }).click(); await p.waitForTimeout(150);
    pass(await p.inputValue('input[autocomplete=organization]') === 'Pharmacie A', 'Cancel puts the saved name back');
    await p.getByRole('button', { name: 'Français' }).click(); await p.waitForTimeout(400);
    pass(await p.getByRole('button', { name: /Français/ }).getAttribute('aria-pressed') === 'true', 'language pick is pressed');
    pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
    await p._ctx.close(); }

  console.log('== Calendar');
  { const p = await open(); await go(p, 'Calendar');
    let t = await p.evaluate(() => document.querySelector('main').innerText);
    pass(/This week: \d+ deadlines?, \d+ active incidents?/.test(t), 'the week in one sentence');
    const chips = p.locator('#calendar-grid [role=button]');
    pass(await chips.count() > 0, `events on the week grid (${await chips.count()})`);
    const colours = await chips.evaluateAll(els => els.map(e => getComputedStyle(e).backgroundColor));
    pass(colours.includes('rgb(220, 38, 38)'), 'a critical incident is red on the grid, like its tag (was amber)');
    await p.getByRole('button', { name: 'Month', exact: true }).click(); await p.waitForTimeout(600);
    t = await p.evaluate(() => document.querySelector('main').innerText);
    pass(/Upcoming/.test(t) && /This month/.test(t) && !/À venir|Ce mois|Rien\b|événements/.test(t), 'month panel in English (French and English were swapped)');
    pass(!/\d+X\b/.test(t), 'no stray "2X" / "3X" counters');
    pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
    await p._ctx.close(); }
  { const p = await open({ ls: { sentria_language: 'fr' } }); await go(p, 'Calendrier');
    await p.getByRole('button', { name: 'Mois', exact: true }).click(); await p.waitForTimeout(600);
    const t = await p.evaluate(() => document.querySelector('main').innerText);
    pass(/À venir/.test(t) && !/Upcoming|This month/.test(t), 'month panel in French');
    await p._ctx.close(); }

  console.log('== Sites and Report');
  { const p = await open(); await go(p, 'Sites');
    await p.getByRole('button', { name: 'Create my first site' }).click(); await p.waitForTimeout(300);
    await p.getByPlaceholder('e.g. Lyon plant').fill('Usine Lyon'); await p.getByRole('button', { name: 'Create the site' }).click(); await p.waitForTimeout(400);
    pass(/Usine Lyon/.test(await p.evaluate(() => document.querySelector('main').innerText)), 'Create my first site: form, then the new site opens');
    await go(p, 'Report');
    const t = await p.evaluate(() => document.querySelector('main').innerText);
    pass(/Your report/.test(t) && /Alerts in all\s*12/.test(t) && /Critical\s*8/.test(t) && /Warning\s*4/.test(t), 'report: 12 alerts, 8 critical, 4 warning in the black card');
    pass(await p.getByRole('button', { name: /Export as PDF/ }).count() === 1, 'Export as PDF still there');
    pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
    await p._ctx.close(); }

  console.log('== phone, both themes: no sideways scroll');
  for (const theme of ['light', 'dark']) {
    const p = await open({ theme, vw: 390 });
    const wide = [];
    for (const v of ['Calendar', 'Sites', 'Report', 'Settings']) { await go(p, v); if (!(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('main').scrollWidth <= document.querySelector('main').clientWidth + 1))) wide.push(v); await p.screenshot({ path: `screens-${v}-${theme}-390.png` }); }
    pass(wide.length === 0, `${theme}: Calendar, Sites, Report, Settings fit 390 px` + (wide.length ? ' — too wide: ' + wide.join(', ') : ''));
    pass(p._errs.length === 0, `${theme}: no page errors ` + p._errs.join('|'));
    await p._ctx.close();
  }

  await b.close(); console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`); process.exit(fails ? 1 : 0); })();
