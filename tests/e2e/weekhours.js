// The Calendar's week view as an hour grid (F-CALWEEK). Timed events (incidents
// and thresholds) sit in their hour, deadlines and resolved items (dates with no
// time) sit in the all-day row, a line marks now, and a click opens the detail
// card. On a phone the grid gives way to a day picker and that day's list. The
// data is faked here; screens.js covers the rest of the Calendar.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

// The week that the Calendar shows: Monday to Sunday, in this browser's time zone.
const now = new Date();
const todayIdx = (now.getDay() + 6) % 7;
const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - todayIdx);
const at = (off, h, m = 0) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + off, h, m).toISOString();
const ymd = off => { const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + off); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const rec = (id, equipment, action, severity, off, h, m) => ({ id, task_key: `${equipment}-${id}`, alert_key: id, equipment, sector: 'health', business_type: 'pharmacie', severity, date: at(off, h, m), message: action, recommended_action: action, risk_score: 72, confidence: 80 });
const RECS = [
  rec('r-cold', 'Frigo 3', 'Température frigo 3', 'CRITICAL', todayIdx, 6, 50),
  rec('r-queue', 'Quai 1', 'Quai 1 : file en attente', 'WARNING', 1, 9, 40),
  rec('r-late', 'Amox', 'Stock amoxicilline bas', 'WARNING', 3, 21, 30),
  rec('r-audit', 'Audit', 'Audit fournisseur', 'WARNING', 3, 8, 0),
];
const ASSIGN = [{ task_key: 'Audit-r-audit', status: 'todo', priority: 'medium', deadline: ymd(3), contractor_ids: [] }];
if (todayIdx >= 1) {
  RECS.push(rec('r-late-check', 'Lots', 'Contrôle des lots', 'WARNING', todayIdx - 1, 8, 0));
  ASSIGN.push({ task_key: 'Lots-r-late-check', status: 'todo', priority: 'high', deadline: ymd(todayIdx - 1), contractor_ids: [] });
}
const json = body => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function open(browser, { theme = 'light', lang = 'en', width = 1440 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 960 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/onrender\.com\//, r => {
    const u = r.request().url();
    if (/\/recommendations/.test(u)) return r.fulfill(json({ recommendations: RECS }));
    if (/\/assignments/.test(u)) return r.fulfill(json({ assignments: ASSIGN }));
    if (/\/alerts/.test(u)) return r.fulfill(json([]));
    if (/\/freshness/.test(u)) return r.fulfill(json({ freshness: [], persisted: false, stale_after_days: 7 }));
    return r.fulfill(json({ recommendations: [], assignments: [], contractors: [] }));
  });
  await p.addInitScript(th => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(th).forEach(([k, v]) => localStorage.setItem(k, v)); } },
    { sentria_language: lang, sentria_onboarded: 'true', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_company_name: 'Pharmacie A', sentria_business_type: 'pharmacie', sentria_departments: '{"health":["pharmacie"]}', sentria_theme: theme, sentria_country: 'BJ' });
  await signedIn(p, 'u', 'ama@pharma.bj', { plan: 'business', meta: { full_name: 'Ama Mensah' } });
  await p.goto(APP_URL); await p.waitForTimeout(1600);
  if (width < 1024) { await p.getByRole('button', { name: /menu/i }).first().click().catch(() => {}); await p.waitForTimeout(300); }
  await p.locator('aside nav button', { hasText: lang === 'fr' ? 'Calendrier' : 'Calendar' }).click(); await p.waitForTimeout(1000);
  return { ctx, p, errs };
}
const cell = (p, day, hour) => p.locator(`#calendar-grid [data-day="${day}"][data-hour="${hour}"]`);
const allDay = (p, day) => p.locator(`#calendar-grid [data-allday="${day}"]`);

(async () => {
  const b = await chromium.launch(LAUNCH);

  console.log('== the hour grid, on a laptop');
  {
    const { ctx, p, errs } = await open(b);
    pass(await p.locator('#calendar-grid [data-hour]').count() > 0, 'the week is drawn as an hour grid');
    const txt = await p.locator('#calendar-grid').innerText();
    pass(/06:00/.test(txt) && /18:00/.test(txt) && /21:00/.test(txt), 'the hours run from 06:00 to 21:00 (wider than 07 to 18 because an event falls at 21:30)');
    pass(await cell(p, todayIdx, 6).getByText('Température frigo 3').count() === 1, 'a 06:50 incident today sits in the 06:00 row of today');
    pass(await cell(p, 1, 9).getByText('Quai 1 : file en attente').count() === 1, 'a 09:40 threshold on Tuesday sits in the 09:00 row of Tuesday');
    pass(await cell(p, 3, 21).getByText('Stock amoxicilline bas').count() === 1, 'a 21:30 threshold on Thursday sits in the 21:00 row');
    pass(await allDay(p, 3).getByText('Audit fournisseur').count() === 1, 'a deadline (a date with no time) sits in the all-day row, not an hour row');
    pass(await allDay(p, 3).getByText('Stock amoxicilline bas').count() === 0 && await cell(p, 3, 8).getByText('Audit fournisseur').count() === 0, 'and never in an hour row');
    if (todayIdx >= 1) {
      const late = allDay(p, todayIdx - 1);
      pass(await late.getByText('Contrôle des lots').count() === 1 && /Overdue|En retard/.test(await late.innerText()), 'a deadline already past says so');
    }
    pass(await p.locator('#calendar-grid [data-day="5"] [role=button]').count() === 0 && await p.locator('#calendar-grid [data-day="6"] [role=button]').count() === 0, 'Saturday and Sunday are empty');
    const nowHour = now.getHours();
    const line = await p.locator('#calendar-grid span.h-0\\.5').count();
    pass(nowHour < 6 || nowHour > 21 ? line === 0 : line === 1, `the now line is drawn once, in the current hour (${line} now, hour ${nowHour})`);
    const colW = await p.locator('#calendar-grid [data-day="0"][data-hour="6"]').evaluate(e => e.getBoundingClientRect().width);
    pass(colW > 90, `the day columns are wide enough to read (${Math.round(colW)} px)`);
    await p.locator('#calendar-grid [data-day="' + todayIdx + '"][data-hour="6"] [role=button]').first().click(); await p.waitForTimeout(250);
    // The phone list holds a hidden copy of the same card: look only at what is on screen.
    const shown = p.getByText('Recommendation', { exact: true }).locator('visible=true');
    pass(await shown.count() === 1, 'a click opens the detail card');
    await p.getByRole('button', { name: 'Close', exact: true }).locator('visible=true').first().click(); await p.waitForTimeout(250);
    pass(await p.getByText('Recommendation', { exact: true }).locator('visible=true').count() === 0, 'Close shuts it');
    await p.screenshot({ path: 'weekhours-light.png' });
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll at 1440');
    pass(errs.length === 0, `no page errors ${errs.join('|')}`);
    await ctx.close();
  }

  console.log('== dark');
  {
    const { ctx, p, errs } = await open(b, { theme: 'dark' });
    await p.screenshot({ path: 'weekhours-dark.png' });
    pass(await cell(p, todayIdx, 6).getByText('Température frigo 3').isVisible(), 'the grid is drawn in dark too');
    pass(errs.length === 0, `dark: no page errors ${errs.join('|')}`);
    await ctx.close();
  }

  console.log('== French');
  {
    const { ctx, p, errs } = await open(b, { lang: 'fr' });
    const txt = await p.locator('#calendar-grid').innerText();
    pass(/Journée/.test(txt) && /06:00/.test(txt), 'the all-day row and the hours in French');
    pass(errs.length === 0, `French: no page errors ${errs.join('|')}`);
    await ctx.close();
  }

  console.log('== a phone: a day picker and that day\'s list');
  {
    const { ctx, p, errs } = await open(b, { width: 390 });
    const picker = p.locator('#calendar-grid button[aria-pressed]');
    pass(await picker.count() === 7, 'seven days to pick from');
    pass(await picker.nth(todayIdx).getAttribute('aria-pressed') === 'true', 'today is picked first');
    pass(await p.locator('#calendar-grid [data-hour]').first().isVisible() === false, 'the hour grid is hidden on a phone');
    pass(/Température frigo 3/.test(await p.locator('#calendar-grid').innerText()), 'today\'s list shows its events');
    await picker.nth(5).click(); await p.waitForTimeout(200);
    pass(/Nothing|Rien/.test(await p.locator('#calendar-grid').innerText()), 'Saturday says it has nothing');
    await picker.nth(1).click(); await p.waitForTimeout(200);
    pass(/Quai 1 : file en attente/.test(await p.locator('#calendar-grid').innerText()), 'Tuesday lists its event');
    await p.locator('#calendar-grid [role=button]', { hasText: 'Quai 1 : file en attente' }).locator('visible=true').first().click(); await p.waitForTimeout(250);
    pass(await p.getByText('Recommendation', { exact: true }).locator('visible=true').count() === 1, 'a tap opens the same detail card');
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll at 390 px');
    await p.screenshot({ path: 'weekhours-390.png' });
    pass(errs.length === 0, `390: no page errors ${errs.join('|')}`);
    await ctx.close();
  }

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})();
