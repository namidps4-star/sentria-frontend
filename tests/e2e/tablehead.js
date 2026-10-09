// Data-table headers: soft lime with a lime line in light, the full lime bar
// in dark, text from the theme tokens. Dashboard alert table is checked in the
// browser; the other tables are checked to carry the same class.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const now = Date.now();
const A = (eq, sev, msg, h) => ({ id: eq, equipment: eq, sector: 'logistics', business_type: '', severity: sev, date: new Date(now - h * 3600e3).toISOString(), alert_key: 'x.' + eq, message: msg, risk_score: 70 });
const ALERTS = [A('Cold room 2', 'CRITICAL', 'Temperature above 8 C', 0.2), A('Crane 4', 'WARNING', 'Vibration rising', 2), A('Dock door 3', 'INFO', 'Opened 14 times', 5)];

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async (theme, width) => {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ALERTS) }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"recommendations":[]}' }));
    await p.route(/\/(contractors|assignments|cost)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"contractors":[],"assignments":[]}' }));
    await p.addInitScript(t => { const s = { sentria_onboarded: '1', sentria_sector: 'logistics', sentria_sectors: '["logistics"]', sentria_language: 'en', sentria_company_name: 'Acme', sentria_theme: t }; for (const k in s) localStorage.setItem(k, s[k]); }, theme);
    await signedIn(p, 'u-test', 'test@sentria.app', { plan: 'business' });
    await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    return { p, ctx };
  };
  // colours as the browser resolves them, so the test compares like with like
  const probe = (p) => p.evaluate(() => {
    const css = v => { const d = document.createElement('div'); d.style.background = v; document.body.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; };
    const th = document.querySelector('thead th'); const cs = getComputedStyle(th);
    const col = v => { const d = document.createElement('div'); d.style.color = v; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
    return { bg: cs.backgroundColor, fg: cs.color, line: cs.borderBottomColor, lineW: cs.borderBottomWidth, card: css('var(--card)'), brand: css('var(--brand)'), brandFg: col('var(--brand-foreground)'), fgTok: col('var(--foreground)'), muted: col('var(--muted-foreground)') };
  });

  console.log('== light');
  { const { p, ctx } = await open('light', 1440);
    const c = await probe(p);
    pass(c.bg !== c.card && c.bg !== 'rgba(0, 0, 0, 0)', 'the header is tinted, not the plain card colour');
    pass(c.bg !== c.brand, 'in light it is the soft lime, not the full lime bar');
    pass(c.line === c.brand && c.lineW === '2px', 'a 2px lime line sits under the header');
    pass(c.fg === c.fgTok && c.fg !== c.muted, 'header text uses the foreground token');
    pass(await p.locator('thead th').count() === 5, 'five columns: asset, message, sector, severity, date');
    await p.locator('table').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    await p.screenshot({ path: 'tablehead-light.png' });
    pass(p._errors.length === 0, 'no page errors'); await ctx.close(); }

  console.log('== dark');
  { const { p, ctx } = await open('dark', 1440);
    const c = await probe(p);
    pass(c.bg === c.brand, 'in dark the header is the full lime bar');
    pass(c.fg === c.brandFg, 'its text is the brand foreground (dark on lime)');
    await p.locator('table').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    await p.screenshot({ path: 'tablehead-dark.png' });
    pass(p._errors.length === 0, 'no page errors'); await ctx.close(); }

  console.log('== phone 390');
  { const { p, ctx } = await open('light', 390);
    const c = await probe(p);
    pass(c.bg !== c.card, 'the tint holds at phone width');
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'the page does not scroll sideways');
    await p.locator('table').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    await p.screenshot({ path: 'tablehead-phone.png' }); await ctx.close(); }

  console.log('== every data table carries the class');
  const root = path.join(__dirname, '..', '..', 'components', 'sentria');
  for (const f of ['dashboard-view', 'report-view', 'logistics-cost-view', 'admin-view']) {
    const src = fs.readFileSync(path.join(root, f + '.tsx'), 'utf8');
    pass(/<thead className="table-head/.test(src), `${f} header uses table-head`);
  }

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nAll passed');
  process.exit(fails ? 1 : 0);
})();
