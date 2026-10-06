// F-VIZPREMIUM, what was still missing: (1) placeholders instead of a false
// "0" while the alerts load, in the three dashboard layouts and in the chart
// and breakdown cards; (2) the bell rings once when a critical alert nobody
// has seen shows up, never on first load and never on a refetch that finds
// nothing new, and an upload tells it at once. Motion stays inside the card's
// 250 ms budget and stops under "reduce motion".
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const al = (id, sector, bt, equipment, key, severity, hoursAgo = 1) => ({ id, equipment, sector, business_type: bt, severity, date: new Date(Date.now() - hoursAgo * 36e5).toISOString(), alert_key: key, message: `${equipment} message`, risk_score: 70 });
const HEALTH = [al(1, 'health', 'pharmacie', 'Amoxicillin', 'health.stock.critical_low', 'CRITICAL'), al(2, 'health', 'pharmacie', 'Ibuprofen', 'health.stock.critical_low', 'CRITICAL', 30), al(3, 'health', 'pharmacie', 'Insulin', 'health.stock.low', 'WARNING')];
const INDUSTRY = [al(1, 'industry', 'usine-production', 'Presse P1', 'industry.generic', 'CRITICAL'), al(2, 'industry', 'usine-production', 'Moteur M2', 'industry.generic', 'WARNING')];
const LOGI = [al(1, 'logistics', 'port-conteneurs', 'GRUE-02', 'logistics.cycles.critical', 'CRITICAL', 2), al(2, 'logistics', 'port-conteneurs', 'QUAI-3', 'logistics.wait.critical', 'CRITICAL', 1)];

const LAYOUTS = {
  generic: { ls: { sentria_sector: 'health', sentria_sectors: '["industry","health","energy"]', sentria_business_type: 'pharmacie', sentria_company_name: 'Acme' }, alerts: HEALTH, pill: 'Health', label: 'Cold chain alerts', tight: false },
  industry: { ls: { sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_business_type: 'usine-production', sentria_departments: '{"industry":["usine-production"]}', sentria_equipment: '["machines","motors","production","maintenance-production-link"]', sentria_company_name: 'Usine Nord' }, alerts: INDUSTRY, pill: /^Industry/, tight: true },
  logistics: { ls: { sentria_sector: 'logistics', sentria_sectors: '["logistics"]', sentria_business_type: 'port-conteneurs', sentria_ops_types: '["port"]', sentria_ops_type: 'port', sentria_departments: '{"logistics":["port-conteneurs"]}', sentria_equipment: '["blockages","wait","cost","anticipate","recommend"]', sentria_company_name: 'Port Autonome' }, alerts: LOGI, pill: /^Logistics/, tight: true },
};

// gate: while `hold` is a promise the /alerts answer waits on it
async function open(browser, layout, { theme = 'light', width = 1440, hold = null, status = 200, scheme = 'light', reduce = false, alertsRef = null } = {}) {
  const L = LAYOUTS[layout];
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 1000 }, locale: 'en-US', colorScheme: scheme, reducedMotion: reduce ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
  const live = alertsRef || { rows: L.alerts };
  await p.route(/onrender\.com\//, async r => {
    const u = new URL(r.request().url()); const json = (b, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.pathname === '/alerts') { if (hold) await hold; return status === 200 ? json(live.rows) : json({ detail: 'nope' }, status); }
    return json({ recommendations: [], assignments: [], contractors: [] });
  });
  await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
    { sentria_language: 'en', sentria_onboarded: 'true', sentria_theme: theme, ...L.ls });
  await signedIn(p, 'u', 'a@b.c', { plan: 'entreprise' });
  await p.goto(APP_URL);
  return { ctx, p, live };
}
async function settle(p, layout) {
  const L = LAYOUTS[layout];
  const btn = typeof L.pill === 'string' ? new RegExp('^' + L.pill + '\\s*\\d*$') : L.pill;
  const b = p.getByRole('button', { name: btn }).first();
  if (layout === 'generic' && await b.count()) { await b.click().catch(() => {}); await p.waitForTimeout(500); }
  else if (layout !== 'generic' && await p.getByTestId('priority-bento').count() === 0 && await b.count()) { await b.click().catch(() => {}); await p.waitForTimeout(600); }
}
const skels = p => p.locator('[data-kpi-skeleton]');

(async () => {
  const b = await chromium.launch(LAUNCH);

  console.log('== while the alerts load: placeholders, never a false zero');
  for (const layout of ['generic', 'industry', 'logistics']) {
    let release; const hold = new Promise(res => { release = res; });
    const { ctx, p } = await open(b, layout, { hold });
    await p.waitForTimeout(1800); await settle(p, layout); await p.waitForTimeout(300);
    const n = await skels(p).count();
    pass(n === 4, `${layout}: four KPI placeholders while waiting (${n})`);
    const main = await p.locator('main').innerText();
    pass(await p.locator('[data-kpi-skeleton] [data-skeleton]').first().evaluate(e => getComputedStyle(e).animationName.includes('pulse')), `${layout}: they pulse`);
    if (layout === 'generic') {
      pass(await p.locator('[data-chart-skeleton]').count() === 1, 'generic: the chart card holds a placeholder');
      pass(!/No alerts in this period|Nothing to break down/.test(main), 'generic: no "no alerts" or "nothing to break down" claim while nothing has arrived');
      pass(!(await p.locator('main').evaluate(m => [...m.querySelectorAll('p.font-heading')].some(e => /^\d+$/.test(e.textContent.trim())))), 'generic: no bare number on a KPI tile');
      pass(!(await p.getByRole('button', { name: /^(All|Industry|Health|Energy)\s*\d+$/ }).count()), 'generic: the sector pills carry no count yet (a 0 there is a claim too)');
      await p.screenshot({ path: `vizpolish-skeleton-${layout}-light.png` });
    }
    const before = await skels(p).first().evaluate(e => Math.round(e.getBoundingClientRect().height));
    release(); await p.waitForTimeout(1200);
    pass(await skels(p).count() === 0 && await p.locator('[data-chart-skeleton]').count() === 0, `${layout}: the placeholders are gone once the alerts arrive`);
    const tileH = await p.evaluate(({ tight, label }) => {
        const tiles = [...document.querySelectorAll(tight ? 'main .grid.gap-px > div' : 'main .rounded-3xl.p-5')];
      return tiles.length ? Math.round(tiles[0].getBoundingClientRect().height) : -1;
    }, { tight: LAYOUTS[layout].tight, label: LAYOUTS[layout].label });
    // a tight tile's label takes one line or two, so it cannot match to the pixel
    const slack = LAYOUTS[layout].tight ? 14 : 8;
    pass(tileH > 0 && Math.abs(tileH - before) <= slack, `${layout}: the real tile is about the placeholder's size, so little moves (${before}px then ${tileH}px, within ${slack})`);
    if (layout === 'generic') {
      pass(await p.getByRole('button', { name: /^Health\s*3$/ }).count() === 1, 'generic: the pill counts come back with the alerts (Health 3)');
      pass(await p.locator('main svg[data-sparkline]').count() >= 1 && /Cold chain alerts/.test(await p.locator('main').innerText()), 'generic: the real tiles and their lines are there');
      pass(await p.locator('main svg').count() > 3, 'generic: the chart is drawn');
    }
    pass(p._errs.length === 0, `${layout}: no page errors ${p._errs.join('|')}`);
    await ctx.close();
  }

  console.log('== a failed load is an answer: no placeholder left pulsing');
  for (const layout of ['generic', 'logistics']) {
    const { ctx, p } = await open(b, layout, { status: 500 });
    await p.waitForTimeout(1800); await settle(p, layout); await p.waitForTimeout(400);
    pass(await skels(p).count() === 0 && await p.locator('main .animate-pulse').count() === 0, `${layout}: nothing pulses after a 500`);
    await ctx.close();
  }

  console.log('== reduce motion: the placeholders sit still');
  {
    let release; const hold = new Promise(res => { release = res; });
    const { ctx, p } = await open(b, 'generic', { hold, reduce: true });
    await p.waitForTimeout(1800); await settle(p, 'generic');
    pass(await skels(p).count() === 4 && await p.locator('[data-kpi-skeleton] [data-skeleton]').first().evaluate(e => getComputedStyle(e).animationName === 'none'), 'no animation under prefers-reduced-motion');
    release(); await ctx.close();
  }

  console.log('== looks right while loading: light, dark, 390 px');
  for (const [label, o] of [['dark', { theme: 'dark' }], ['390', { width: 390 }], ['390-dark', { width: 390, theme: 'dark' }]]) {
    let release; const hold = new Promise(res => { release = res; });
    const { ctx, p } = await open(b, 'generic', { hold, ...o });
    await p.waitForTimeout(1800); await settle(p, 'generic'); await p.waitForTimeout(300);
    await p.screenshot({ path: `vizpolish-skeleton-generic-${label}.png` });
    const col = await p.evaluate(() => { const e = document.querySelector('[data-kpi-skeleton] [data-skeleton]'); const c = getComputedStyle(e).backgroundColor; const card = getComputedStyle(e.closest('[data-kpi-skeleton]')).backgroundColor; return { c, card }; });
    pass(col.c !== col.card, `${label}: the placeholder is visible on its card (${col.c} on ${col.card})`);
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${label}: no sideways scroll`);
    release(); await ctx.close();
  }

  console.log('== the bell: rings once for a new critical alert nobody has seen');
  const bellRing = p => p.locator('button[aria-haspopup="dialog"] svg[data-bell-ring]').getAttribute('data-bell-ring');
  const nav = async (p, name) => { await p.locator('aside nav button').filter({ hasText: new RegExp('^' + name + '$') }).locator('visible=true').first().click(); await p.waitForTimeout(900); };
  {
    const live = { rows: [al(1, 'logistics', 'port-conteneurs', 'GRUE-02', 'logistics.cycles.critical', 'CRITICAL', 2)] };
    const { ctx, p } = await open(b, 'logistics', { alertsRef: live });
    await p.waitForTimeout(2200);
    pass(await bellRing(p) === '0', 'first load: it does not ring (the first read is only the baseline)');
    pass(await p.locator('button[aria-haspopup="dialog"] span.bg-accent').count() === 1, '…but the unread dot is there');
    await nav(p, 'Tracking'); await nav(p, 'Dashboard');
    pass(await bellRing(p) === '0', 'a page change that finds nothing new: no ring');
    live.rows = [...live.rows, al(2, 'logistics', 'port-conteneurs', 'QUAI-3', 'logistics.wait.critical', 'CRITICAL', 0.1)];
    await nav(p, 'Tracking');
    pass(await bellRing(p) === '1', 'a new critical alert on the next read: it rings (once)');
    const anim = await p.locator('button[aria-haspopup="dialog"] svg[data-bell-ring]').evaluate(e => { const s = getComputedStyle(e); return { name: s.animationName, dur: s.animationDuration, running: e.getAnimations().length }; });
    pass(anim.name === 't-bell-ring' && parseFloat(anim.dur) * (/ms$/.test(anim.dur) ? 1 : 1000) <= 250, `it is the bell animation, inside the 250 ms budget (${anim.name}, ${anim.dur})`);
    await p.waitForTimeout(500);
    pass(await p.locator('button[aria-haspopup="dialog"] svg[data-bell-ring]').evaluate(e => e.getAnimations().length) === 0, 'and it has stopped (nothing left running)');
    await nav(p, 'Dashboard');
    pass(await bellRing(p) === '1', 'the same alert read again: no second ring');
    await p.locator('header button[aria-haspopup="dialog"]').click(); await p.waitForTimeout(400); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    live.rows = [...live.rows, al(3, 'logistics', 'port-conteneurs', 'OLD-9', 'logistics.pressure.critical', 'CRITICAL', 48)];
    await nav(p, 'Tracking');
    pass(await bellRing(p) === '1', 'a new alert older than what was already seen does not ring');
    live.rows = [...live.rows, al(4, 'logistics', 'port-conteneurs', 'FRESH-4', 'logistics.temperature.critical', 'CRITICAL', 0)];
    await p.evaluate(() => window.dispatchEvent(new Event('sentria_alerts_updated'))); await p.waitForTimeout(900);
    pass(await bellRing(p) === '2', 'an upload tells the bell at once: it rings without a page change');
    pass(p._errs.length === 0, `no page errors ${p._errs.join('|')}`);
    await ctx.close();
  }
  {
    const live = { rows: [al(1, 'logistics', 'port-conteneurs', 'GRUE-02', 'logistics.cycles.critical', 'CRITICAL', 2)] };
    const { ctx, p } = await open(b, 'logistics', { alertsRef: live, reduce: true });
    await p.waitForTimeout(2200);
    live.rows = [...live.rows, al(2, 'logistics', 'port-conteneurs', 'QUAI-3', 'logistics.wait.critical', 'CRITICAL', 0.1)];
    await nav(p, 'Tracking');
    pass(await bellRing(p) === '1' && await p.locator('button[aria-haspopup="dialog"] svg[data-bell-ring]').evaluate(e => getComputedStyle(e).animationName === 'none'), 'under reduce motion the bell is counted but does not move');
    await ctx.close();
  }
  {
    const live = { rows: [] };
    const { ctx, p } = await open(b, 'logistics', { alertsRef: live });
    await p.waitForTimeout(2200);
    live.rows = [al(1, 'logistics', 'port-conteneurs', 'GRUE-02', 'logistics.cycles.critical', 'CRITICAL', 0.1)];
    await nav(p, 'Tracking');
    pass(await bellRing(p) === '1', 'starting from an empty bell, the first alert rings it (the baseline was a real, empty read)');
    await ctx.close();
  }
  {
    // an API that is down on first load gives no baseline, so the first good read does not ring
    const live = { rows: [al(1, 'logistics', 'port-conteneurs', 'GRUE-02', 'logistics.cycles.critical', 'CRITICAL', 2)] };
    const { ctx, p } = await open(b, 'logistics', { alertsRef: live, status: 500 });
    await p.waitForTimeout(2000);
    pass(await bellRing(p) === '0', 'a failed read is silent: no ring, no dot');
    await ctx.close();
  }

  console.log('== source');
  {
    const files = ['components/sentria/skeleton.tsx', 'lib/alerts-event.ts'];
    pass(files.every(f => !/\bdark:/.test(read(f))) && !/—/.test(read('components/sentria/skeleton.tsx')), 'tokens only (no dark:), no em dash');
    const css = read('app/transitions.css');
    const dur = css.match(/--bell-ring-dur:\s*(\d+)ms/);
    pass(dur && +dur[1] <= 250, `the bell ring is ${dur && dur[1]} ms (the card allows 250)`);
    pass(/\.t-bell-ring\s*\{[^}]*\}\s*@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.t-bell-ring\s*\{\s*animation:\s*none/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'and it stops under prefers-reduced-motion');
    pass(/motion-reduce:animate-none/.test(read('components/sentria/skeleton.tsx')), 'the placeholders stop under reduce motion');
    pass(/announceAlertsUpdated\(\)/.test(read('components/sentria/dashboard-view.tsx')) && /ALERTS_UPDATED_EVENT/.test(read('components/sentria/app-shell.tsx')), 'the upload announces new alerts and the shell listens');
  }

  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
