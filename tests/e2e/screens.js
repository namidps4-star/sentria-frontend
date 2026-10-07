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
    const dark = theme !== 'light';
    const want = dark ? { crit: 'rgb(79, 53, 54)', critFg: 'rgb(255, 184, 191)', warn: 'rgb(75, 66, 42)' } : { crit: 'rgb(255, 214, 218)', critFg: 'rgb(179, 32, 46)', warn: 'rgb(255, 230, 168)' };
    pass(c.bg === want.crit && c.fg === want.critFg, `${label}: Critical is a pastel pink with deep/bright text (${c.bg} / ${c.fg})`);
    if (await warn.count()) { const w = await style(warn); pass(w.bg === want.warn && contrast(w.bg, w.fg) >= 4.5, `${label}: Warning is butter pastel, readable (${w.bg}, ${contrast(w.bg, w.fg).toFixed(1)}:1)`); }
    pass(contrast(c.bg, c.fg) >= 4.5, `${label}: Critical text contrast ${contrast(c.bg, c.fg).toFixed(2)}:1`);
    const tags = await p.$$eval('span.rounded-full.border.font-semibold', els => els.filter(e => e.offsetParent).map(e => { const s = getComputedStyle(e); return { t: e.innerText.trim(), bg: s.backgroundColor, fg: s.color, bright: !!e.closest('.tags-light') }; }));
    // Solid fills only: the see-through chips on the black banner are not status tags.
    const solid = t => /^rgb\(/.test(t.bg);
    const bad = tags.filter(t => solid(t) && contrast(t.bg, t.fg) < 4.5);
    pass(tags.length > 0 && bad.length === 0, `${label}: all ${tags.length} tags on the dashboard ≥ 4.5:1` + (bad.length ? ' — ' + JSON.stringify(bad.slice(0, 3)) : ''));
    // A surface that stays bright in dark (the lime and white KPI tiles) takes .tags-light, so its tags are light on purpose.
    if (theme !== 'light') { const all = tags.filter(solid).filter(t => !t.bright); pass(all.length > 0 && all.every(t => lum(t.bg) < 0.12 && lum(t.fg) > 0.4), `${label}: every tag is a deep tint with bright pastel text, no glare (${all.map(t => t.t).slice(0, 5).join(', ')})`); }
    else { const all = tags.filter(solid); pass(all.length > 0 && all.every(t => lum(t.bg) > 0.6), `${label}: every tag is a light pastel fill`); }
    pass(p._errs.length === 0, `${label}: no page errors ` + p._errs.join('|'));
    await p._ctx.close();
  }

  console.log('== onboarding step 1');
  { const p = await open({ ls: { sentria_onboarded: '' } });
    const t = await p.evaluate(() => document.body.innerText);
    pass(/Welcome, Ama/.test(t) && /Hello Ama\. Where do you work\?/.test(t), 'greets by first name, asks as a chat');
    pass(await p.evaluate(() => document.querySelector('[role=dialog] h2').innerText) === 'Your country', 'the heading is the step title');
    await p.getByText('Senegal', { exact: true }).click(); await p.waitForTimeout(200);
    pass(await p.getByRole('button', { name: /Senegal/ }).getAttribute('aria-pressed') === 'true' && await p.locator('select[aria-label="Account currency"]').inputValue() === 'XOF', 'Senegal: pressed, currency XOF');
    pass(/Your figures in\s*F CFA/.test(await p.evaluate(() => document.body.innerText)), 'the black card shows the currency');
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
    pass(colours.includes('rgb(255, 214, 218)'), 'a critical incident is pastel pink on the grid, like its tag (was amber)');
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

  console.log('== login: floating glossy cards, pill fields');
  { const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const { mockSupabase } = require('./auth-mock'); await mockSupabase(p, { users: {}, accounts: {} });
    await p.addInitScript(() => localStorage.setItem('sentria_language', 'en'));
    await p.goto(APP_URL); await p.waitForTimeout(1200);
    const main = await p.locator('main').evaluate(e => getComputedStyle(e).borderTopWidth);
    pass(main === '0px', 'no black outline around the page (was a 2px frame)');
    const f = await p.locator('#auth-email').evaluate(e => { const s = getComputedStyle(e); return { r: parseFloat(s.borderTopLeftRadius), under: s.borderBottomWidth, bg: s.backgroundColor }; });
    pass(f.r >= 12 && f.bg !== 'rgba(0, 0, 0, 0)', `fields are filled pills, not underlines (radius ${f.r}px)`);
    pass(await p.locator('.gloss').count() >= 4, 'glossy cards: ' + await p.locator('.gloss').count());
    pass(/Hello\. Sign in with your email or your @username\./.test(await p.evaluate(() => document.body.innerText)), 'the form opens with a chat line');
    const sc = await p.locator('section[aria-roledescription=carousel]').boundingBox(), panel = await p.locator('#showcase-panel').boundingBox();
    pass(panel.y + panel.height > sc.y + sc.height * 0.6, 'the example alert sits low in its card, no empty bottom');
    pass(errs.length === 0, 'no page errors ' + errs.join('|'));
    await ctx.close(); }

  console.log('== Tracking, Field team, Profile: the Calendar layout');
  { const p = await open();
    await go(p, 'Tracking'); let t = await p.evaluate(() => document.querySelector('main').innerText);
    pass(/What matters now/.test(t) && /The board/.test(t) && /\d+ priorit(y|ies), \d+ critical/.test(t), 'Tracking: grey panel with the summary line, black "The board" card');
    pass(await p.locator('main').getByRole('progressbar').count() >= 1, 'Tracking: lime card progress bar');
    await go(p, 'Field team'); t = await p.evaluate(() => document.querySelector('main').innerText);
    pass(/Contractors/.test(t) && /The team/.test(t) && /Nobody is on file yet/.test(t), 'Field team: same layout, says nobody is on file');
    await p.getByRole('button', { name: 'Add a contractor' }).first().click(); await p.waitForTimeout(300);
    t = await p.evaluate(() => document.querySelector('main').innerText);
    pass(/Only your company's accounts can see these contact details/.test(t) && !/no authentication/.test(t), 'Field team: the old "API has no authentication" warning is gone');
    await go(p, 'Profile'); t = await p.evaluate(() => document.querySelector('main').innerText);
    pass(/Recent signals/.test(t) && /Your activity/.test(t) && /My workspace/.test(t) && /Username/.test(t), 'Profile: same layout, username card kept');
    pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
    await p._ctx.close(); }
  { // No alerts yet: the note used to be French-only.
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' }); const p = await ctx.newPage();
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: /\/alerts/.test(r.request().url()) ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); } }, LS);
    await signedIn(p, 'u', 'a@b.c', { plan: 'business' }); await p.goto(APP_URL); await p.waitForTimeout(1500);
    p._ctx = ctx; await go(p, 'Profile');
    const t = await p.evaluate(() => document.querySelector('main').innerText);
    pass(/These counters are at zero because no signal has been imported yet/.test(t) && !/Ces compteurs/.test(t), 'Profile, no data: the note is in English (was French only)');
    await ctx.close(); }

  console.log('== import panel: departments as a clear step, not hidden tabs');
  { const p = await open();
    await p.click('button[aria-controls=import-panel]'); await p.waitForTimeout(250);
    const panel = p.locator('#import-panel'); const t = await panel.innerText();
    pass(/1 · SECTOR/i.test(t) && /2 · WHICH DEPARTMENT IS THIS FILE FOR\?/i.test(t) && /3 · THE FILE/i.test(t), 'three numbered steps: sector, department, file');
    const choices = panel.getByRole('group', { name: /Which department/ }).getByRole('button');
    pass(await choices.count() === 3, 'one choice per department (3)');
    const boxes = await choices.evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { h: r.height, fs: parseFloat(getComputedStyle(e.querySelector('span span')).fontSize) }; }));
    pass(boxes.every(b => b.h >= 44 && b.fs >= 14), 'big enough to read and tap: ' + JSON.stringify(boxes));
    const dep = await choices.first().boundingBox(), file = await panel.locator('label:has(input[type=file])').boundingBox();
    pass(dep.y < file.y, 'the department is chosen before the file');
    await choices.filter({ hasText: 'Laboratory' }).click(); await p.waitForTimeout(150);
    pass(await choices.filter({ hasText: 'Laboratory' }).getAttribute('aria-pressed') === 'true' && /Health · Laboratory/.test(await panel.locator('label:has(input[type=file])').innerText()), 'picking Laboratory: pressed, and the import button says where it goes');
    pass(/other than the configured one/.test(await panel.innerText()), 'importing another department is flagged');
    await p._ctx.close(); }

  console.log('== login: example alert under the pitch');
  { const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' }); const p = await ctx.newPage();
    const { mockSupabase } = require('./auth-mock'); await mockSupabase(p, { users: {}, accounts: {} });
    await p.addInitScript(() => localStorage.setItem('sentria_language', 'en'));
    await p.goto(APP_URL); await p.waitForTimeout(1200);
    const lime = await p.locator('main > div > section').first().boundingBox(), sc = await p.locator('section[aria-roledescription=carousel]').boundingBox(), form = await p.locator('main > section').boundingBox();
    pass(Math.abs(sc.x - lime.x) < 2 && sc.y > lime.y + lime.height, 'the example alert sits right under the lime card, same column');
    pass(form.x > lime.x + lime.width && Math.abs(form.y + form.height - (sc.y + sc.height)) < 3, 'the form fills the other column, bottoms aligned');
    await p.getByRole('button', { name: 'Create one' }).click(); await p.waitForTimeout(300);
    const t = await p.evaluate(() => document.body.innerText);
    pass(/You'll sign in with this @name or your email/.test(t) && /Email \(to sign in and reset your password\)/.test(t), 'sign-up says both @username and email sign you in');
    await ctx.close(); }

  console.log('== Profile: what matters for the mission');
  { const p = await open(); await go(p, 'Profile');
    const fresh = p.getByTestId('profile-freshness'), next = p.getByTestId('profile-next');
    pass(/Data freshness/i.test(await fresh.innerText()) && /ago/.test(await fresh.innerText()), 'data freshness: ' + (await fresh.innerText()).replace(/\n/g, ' | '));
    pass(/Critical waiting longest/i.test(await next.innerText()) && /Med 9/.test(await next.innerText()), 'the critical alert waiting longest (Med 9, the oldest open one)');
    pass(/Business/.test(await p.getByTestId('profile-plan').innerText()), 'the plan is shown');
    pass(/ama@pharma\.bj/.test(await p.getByTestId('profile-signin').innerText()), 'how you sign in: the email');
    pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
    await p._ctx.close(); }

  console.log('== Field team: a clear message when its tables are missing');
  { const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' }); const p = await ctx.newPage(); p._ctx = ctx; p._errs = [];
    await p.route(/onrender\.com\//, r => { const u = r.request().url();
      if (/\/contractors/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contractors: [], error_code: 'crm_setup_missing', error_detail: 'The Field team tables are not set up in the database yet. Run migrations/008_crm_repair.sql in the Supabase SQL editor, then reload.' }) });
      if (/\/assignments/.test(u)) return r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ detail: { error_code: 'account_missing', message: 'No account for this user yet. Reload the app.' } }) });
      r.fulfill({ status: 200, contentType: 'application/json', body: /\/alerts/.test(u) ? JSON.stringify(data) : JSON.stringify({ recommendations: recs }) }); });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); } }, LS);
    await signedIn(p, 'u', 'a@b.c', { plan: 'business' }); await p.goto(APP_URL); await p.waitForTimeout(1500);
    await go(p, 'Field team');
    pass(/Run migrations\/008_crm_repair\.sql/.test(await p.evaluate(() => document.querySelector('main').innerText)), 'says which migration to run');
    await go(p, 'Tracking');
    const tt = await p.evaluate(() => document.querySelector('main').innerText);
    pass(/The API answered 403\. No account for this user yet\. Reload the app\./.test(tt), 'an HTTP refusal shows the API reason, not just the status');
    await ctx.close(); }

  console.log('== phone, both themes: no sideways scroll');
  for (const theme of ['light', 'dark']) {
    const p = await open({ theme, vw: 390 });
    const wide = [];
    for (const v of ['Calendar', 'Sites', 'Report', 'Settings', 'Tracking', 'Field team', 'Profile']) { await go(p, v); if (!(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('main').scrollWidth <= document.querySelector('main').clientWidth + 1))) wide.push(v); await p.screenshot({ path: `screens-${v}-${theme}-390.png` }); }
    pass(wide.length === 0, `${theme}: Calendar, Sites, Report, Settings, Tracking, Field team, Profile fit 390 px` + (wide.length ? ' — too wide: ' + wide.join(', ') : ''));
    pass(p._errs.length === 0, `${theme}: no page errors ` + p._errs.join('|'));
    await p._ctx.close();
  }

  await b.close(); console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`); process.exit(fails ? 1 : 0); })();
