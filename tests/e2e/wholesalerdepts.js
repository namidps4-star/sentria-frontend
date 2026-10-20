// Each health department keeps its own wholesaler list. Checks: a pharmacy and a vet outlet on one
// account get two tabs and two lists; an old single list belongs to the pharmacy and moves under it on
// the next save, nothing lost; adding on one tab leaves the other alone and survives a reload; a
// one-department account names its department and shows no tabs; a stock alert reads the list of its
// own department; light, dark (French) and 390 px with screenshots.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const ALL = [true, true, true, true, true, true, true];
const W = (id, name) => ({ id, name, cutoff: null, before: 0, after: 0, days: ALL });
const now = new Date().toISOString();
const BOTH = { sentria_onboarded: 'true', sentria_company_name: 'Clinique A', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_departments: '{"health":["veterinaire","pharmacie"]}', sentria_timezone: 'gmt' };
const alertOf = (eq, dept) => ({ id: eq, equipment: eq, sector: 'health', business_type: dept, severity: 'CRITICAL', date: now, alert_key: 'health.stock.critical_low', message: `MSG ${eq}`, risk_score: 70, params: [['stock', 50], ['stock_days_left', 2]] });

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ lang = 'en', theme = 'light', vw = 1440, ls = {}, wholesalers = null, alerts = [] } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vw < 500 ? 1600 : 1100 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US', timezoneId: 'UTC', colorScheme: theme });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => { const u = r.request().url();
      const body = /\/alerts/.test(u) ? alerts : /\/recommendations/.test(u) ? { recommendations: [] } : { contractors: [], assignments: [] };
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }); });
    const store = { ...BOTH, ...ls, sentria_language: lang, sentria_theme: theme };
    if (wholesalers) store.sentria_wholesalers = JSON.stringify(wholesalers);
    await p.addInitScript(v => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, val] of Object.entries(v)) localStorage.setItem(k, val); } }, store);
    await signedIn(p, 'u-1', 'boss@clinic.test', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(2500);
    return { p, ctx };
  };
  const goPage = async (p, label = 'Wholesalers') => {
    if (p.viewportSize().width < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(500); }
    await p.locator('aside nav button', { hasText: new RegExp(`^${label}$`) }).click(); await p.waitForTimeout(1200);
  };
  const names = p => p.getByTestId('wholesaler-name').evaluateAll(els => els.map(e => e.value));
  const tabs = p => p.getByTestId('wholesaler-department');
  const store = p => p.evaluate(() => JSON.parse(localStorage.getItem('sentria_wholesalers') || 'null'));

  console.log('== two departments, an old single list');
  { const { p, ctx } = await open({ wholesalers: [W('a', 'Pharma Nord')] });
    await goPage(p);
    pass(await tabs(p).count() === 2, 'a pharmacy and a vet outlet: two tabs');
    pass((await tabs(p).allInnerTexts()).join('|') === 'Pharmacy|Veterinary', 'pharmacy first: ' + (await tabs(p).allInnerTexts()).join('|'));
    pass(await tabs(p).first().getAttribute('aria-selected') === 'true', 'it opens on the pharmacy');
    pass((await names(p)).join() === 'Pharma Nord', 'the old list shows under the pharmacy');
    await tabs(p).nth(1).click(); await p.waitForTimeout(300);
    pass(await tabs(p).nth(1).getAttribute('aria-selected') === 'true' && (await names(p)).length === 0, 'the vet tab has its own list, empty');
    pass(await p.getByTestId('wholesalers-empty').count() === 1, 'with the empty card');
    await p.getByTestId('wholesaler-add').click(); await p.waitForTimeout(200);
    await p.getByTestId('wholesaler-name').first().fill('Vet Supply Sud'); await p.getByTestId('wholesaler-name').first().blur(); await p.waitForTimeout(400);
    const s = await store(p);
    pass(s && !Array.isArray(s) && s.veterinaire?.[0]?.name === 'Vet Supply Sud', 'the vet wholesaler is saved under the vet department');
    pass(s?.pharmacie?.length === 1 && s.pharmacie[0].name === 'Pharma Nord', 'the old list moved under the pharmacy, nothing lost');
    await tabs(p).first().click(); await p.waitForTimeout(300);
    pass((await names(p)).join() === 'Pharma Nord', 'back on the pharmacy: its list, without the vet one');
    await p.reload(); await p.waitForTimeout(2500); await goPage(p);
    await tabs(p).nth(1).click(); await p.waitForTimeout(300);
    pass((await names(p)).join() === 'Vet Supply Sud', 'after a reload the vet list is still there');
    await p.getByTestId('wholesalers-card').scrollIntoViewIfNeeded(); await p.screenshot({ path: 'wholesalerdepts-light.png' });
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await ctx.close(); }

  console.log('== one department');
  { const { p, ctx } = await open({ ls: { sentria_departments: '{"health":["pharmacie"]}' } });
    await goPage(p);
    pass(await tabs(p).count() === 0, 'no tabs');
    pass(/List for: Pharmacy/.test(await p.getByTestId('wholesaler-departments').innerText()), 'it names the department the list is for');
    await ctx.close(); }

  console.log('== a stock alert reads its own department\'s list');
  { const { p, ctx } = await open({ wholesalers: { pharmacie: [W('a', 'Pharma Nord')], veterinaire: [W('b', 'Vet Supply Sud')] }, alerts: [alertOf('Ivermectin', 'veterinaire')], ls: { sentria_business_type: 'veterinaire', sentria_active_department: 'veterinaire' } });
    await p.locator('#alerts-table tbody tr').first().click(); await p.waitForTimeout(600);
    const previews = await p.getByTestId('alert-advice-preview').allInnerTexts();
    pass(previews.length > 0 && previews.every(t => /Vet Supply Sud/.test(t) && !/Pharma Nord/.test(t)), 'a vet alert names the vet wholesaler: ' + previews.join(' | '));
    await ctx.close(); }
  { const { p, ctx } = await open({ wholesalers: { pharmacie: [W('a', 'Pharma Nord')], veterinaire: [W('b', 'Vet Supply Sud')] }, alerts: [alertOf('Amoxicillin', 'pharmacie')] });
    await p.locator('#alerts-table tbody tr').first().click(); await p.waitForTimeout(600);
    const previews = await p.getByTestId('alert-advice-preview').allInnerTexts();
    pass(previews.length > 0 && previews.every(t => /Pharma Nord/.test(t)), 'a pharmacy alert names the pharmacy wholesaler: ' + previews.join(' | '));
    await ctx.close(); }

  console.log('== French on dark, and a phone');
  { const { p, ctx } = await open({ lang: 'fr', theme: 'dark', wholesalers: { pharmacie: [W('a', 'Pharma Nord')] } });
    await goPage(p, 'Grossistes');
    pass((await tabs(p).allInnerTexts()).join('|') === 'Pharmacie|Vétérinaire', 'French tab names: ' + (await tabs(p).allInnerTexts()).join('|'));
    pass(/Chaque département a sa propre liste/.test(await p.getByTestId('wholesaler-departments').innerText()), 'French note');
    await p.getByTestId('wholesalers-card').scrollIntoViewIfNeeded(); await p.screenshot({ path: 'wholesalerdepts-dark.png' });
    await ctx.close(); }
  { const { p, ctx } = await open({ vw: 390, wholesalers: { pharmacie: [W('a', 'Pharma Nord')] } });
    await goPage(p);
    const box = await p.getByTestId('wholesaler-departments').boundingBox();
    pass(box && box.x >= 0 && box.x + box.width <= 390, 'the tabs fit a 390 px screen');
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll');
    await p.getByTestId('wholesalers-card').scrollIntoViewIfNeeded(); await p.screenshot({ path: 'wholesalerdepts-phone.png' });
    await ctx.close(); }

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
