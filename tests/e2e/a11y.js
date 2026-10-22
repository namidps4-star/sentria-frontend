// Accessibility: axe on the main screens. Fails on a critical finding and lists the rest, so the report shows what to fix next.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const now = Date.now();
const alerts = [0, 1, 2].map(i => ({ id: i, equipment: i < 2 ? 'CRANE-02' : 'QUAI-1', sector: 'logistics', business_type: 'port-conteneurs', severity: i === 0 ? 'CRITICAL' : 'WARNING', date: new Date(now - i * 36e5).toISOString(), alert_key: 'logistics.cycles.critical', risk_score: 80, message: 'Crane at 96% : plan service' }));
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Port A', sentria_sector: 'logistics', sentria_sectors: '["logistics"]', sentria_business_type: 'port-conteneurs', sentria_ops_types: '["port"]', sentria_ops_type: 'port' };

(async () => {
  const b = await chromium.launch(LAUNCH);
  const open = async (signed) => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
    const p = await ctx.newPage();
    await p.route(/onrender\.com\//, r => { const u = new URL(r.request().url()); r.fulfill({ status: 200, contentType: 'application/json', body: u.pathname === '/alerts' ? JSON.stringify(alerts) : '{"recommendations":[],"assignments":[],"contractors":[]}' }); });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); } }, LS);
    if (signed) await signedIn(p, 'u', 'a@b.c', { plan: 'business' });
    return p;
  };
  const scan = async (p, label) => {
    const result = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const by = impact => result.violations.filter(v => v.impact === impact);
    const critical = by('critical'), serious = by('serious');
    console.log(`   ${label}: ${critical.length} critical, ${serious.length} serious, ${by('moderate').length + by('minor').length} minor`);
    for (const v of [...critical, ...serious]) console.log(`      ${v.impact}: ${v.id} (${v.nodes.length}) ${v.help}`);
    pass(critical.length === 0, `${label}: no critical finding`);
  };

  console.log('== signed out');
  let p = await open(false);
  await p.goto(APP_URL); await p.waitForTimeout(1500);
  await scan(p, 'sign-in');
  await p.goto(APP_URL + '/no-such-page'); await p.waitForTimeout(800);
  await scan(p, '404');
  await p.close();

  console.log('== signed in');
  p = await open(true);
  await p.goto(APP_URL); await p.waitForTimeout(2000);
  for (const view of ['Dashboard', 'Tracking', 'Calendar', 'Sites', 'Report', 'Settings']) {
    await p.locator('aside nav button', { hasText: view }).first().click(); await p.waitForTimeout(1500);
    await scan(p, view);
  }
  await p.close();

  await b.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
