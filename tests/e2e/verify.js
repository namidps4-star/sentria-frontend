const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const now = new Date().toISOString();
const A = (id, eq, sector, bt, key, sev = 'CRITICAL', msg) => ({ id, equipment: eq, sector, business_type: bt, severity: sev, date: now, alert_key: key, message: msg || `MSG ${eq}`, risk_score: 70 });
const pass = (ok, l) => console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`);
let browser;
async function open(ls, alerts, extra) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
  let current = alerts;
  p._setAlerts = a => { current = a; };
  await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(current) }));
  await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: current.map(a => ({ ...a, recommended_action: `ACT ${a.equipment}`, action_category: 'stock', confidence: 0.8 })) }) }));
  await p.route(/\/(assignments|contractors)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"assignments":[],"contractors":[]}' }));
  await p.route(/\/upload/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"message":"Processed 1 rows, 1 alert(s) fired."}' }));
  await p.addInitScript(ls => { localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); }, { sentria_onboarded: '1', sentria_language: 'en', ...ls });
  await require('./auth-mock').signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  return p;
}
const text = p => p.evaluate(() => document.body.innerText);
(async () => {
  browser = await chromium.launch(LAUNCH);

  console.log('== B-01 industry agro, no data');
  { const p = await open({ sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_business_type: 'usine-agroalimentaire', sentria_equipment: '["machines","hygiene-lead-time"]' }, []);
    const t = await text(p);
    pass(/No industry data|No data for/i.test(t), 'empty state shown');
    pass(!/Failures imminent|about to fail/i.test(t), 'no "failures imminent" KPI cards');
    await p.close(); }

  console.log('== B-02 non-logistics account');
  { const p = await open({ sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_equipment: '["stocks","expiry"]' },
      [A(1, 'Doliprane', 'health', 'pharmacie', 'health.stock.low'), A(2, 'GRUE-02', 'logistics', null, 'logistics.wait.critical')]);
    let t = await text(p);
    const logi = /Avoid blockages|Blockages|Port & containers|Logistics/;
    pass(!logi.test(t), 'dashboard: no logistics priority or sector');
    await p.getByRole('button', { name: /^Tracking$/ }).first().click(); await p.waitForTimeout(900);
    t = await text(p); pass(!/GRUE-02|Logistics/.test(t), 'tracking: no logistics');
    console.log('== B-04 health priority visible');
    await p.getByRole('button', { name: /^Dashboard$/ }).first().click(); await p.waitForTimeout(900);
    t = await text(p);
    pass(/Your priorities/i.test(t), '"Your priorities" row shown');
    pass(/Stock/i.test(t) && /Expir/i.test(t), 'picked priorities (stocks, expiry) listed');
    await p.close(); }

  console.log('== B-06 laboratory, only pharmacy data');
  { const p = await open({ sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'laboratoire' },
      [A(1, 'Doliprane', 'health', 'pharmacie', 'health.stock.low')]);
    const t = await text(p);
    pass(!/Doliprane/.test(t), 'recorded pharmacy alert hidden');
    pass(/No data for|Nothing has been imported/i.test(t), 'empty state');
    await p.close(); }
  { const p = await open({ sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'laboratoire' },
      [A(1, 'Doliprane', 'health', null, 'health.stock.low')]);
    const t = await text(p);
    pass(!/Doliprane/.test(t), 'legacy pharmacy alert (no business_type) hidden');
    await p.close(); }

  console.log('== B-07 / B-08 two departments in one sector');
  { const p = await open({ sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' },
      [A(1, 'Doliprane', 'health', 'pharmacie', 'health.stock.low'), A(2, 'Gants', 'health', 'clinique-hopital', 'hospital.stock.low'), A(3, 'Réactif A', 'health', 'laboratoire', 'lab.tests_remaining.critical')]);
    const t = await text(p);
    pass(/Doliprane/.test(t) && !/Gants|Réactif A/.test(t), 'table + panel: pharmacy only');
    pass(!/ACT Gants|ACT Réactif/.test(t), 'recommendations: pharmacy only');
    await p.close(); }

  console.log('== B-13 import button stays in place across 5 uploads');
  { const base = [A(1, 'Doliprane', 'health', 'pharmacie', 'health.stock.low')];
    const p = await open({ sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie' }, base);
    await p.evaluate(() => document.getElementById('alerts-table')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
    const tops = [];
    await p.click('button[aria-controls=import-panel]'); await p.waitForTimeout(150); 
    for (let i = 0; i < 5; i++) {
      const before = await p.evaluate(() => document.getElementById('alerts-table').getBoundingClientRect().top);
      p._setAlerts([...base, ...Array.from({ length: i * 3 + 1 }, (_, k) => A(100 + i * 10 + k, `Med ${i}-${k}`, 'health', 'pharmacie', 'health.stock.low', k % 2 ? 'WARNING' : 'CRITICAL'))]);
      await p.setInputFiles('input[type=file]', { name: 'x.csv', mimeType: 'text/csv', buffer: Buffer.from('medicine_name,stock_qty\nA,1\n') });
      await p.waitForTimeout(2600);
      const after = await p.evaluate(() => document.getElementById('alerts-table').getBoundingClientRect().top);
      tops.push(Math.round(after - before));
    }
    pass(tops.every(d => Math.abs(d) <= 2), `alerts table (what you're looking at) moved by ${tops.join(', ')} px`);
    await p.close(); }

  console.log('== B-23 FCFA account never sees € or $');
  { const p = await open({ sentria_country: 'BJ', sentria_sector: 'industry', sentria_sectors: '["industry","logistics"]', sentria_business_type: 'usine-production', sentria_ops_types: '["port"]', sentria_ops_type: 'port', sentria_equipment: '["machines","production"]' },
      [A(1, 'Presse P1', 'industry', 'usine-production', 'industry.failure.imminent', 'CRITICAL', ' Imminent failure risk : stop the machine'), A(2, 'Ligne L1', 'industry', 'usine-production', 'industry.production.critical', 'CRITICAL', ' Output at 60% of target : check the line'), A(3, 'GQ-1', 'logistics', null, 'logistics.wait.critical', 'CRITICAL', ' Containers stuck for 10h : move resources')]);
    const seen = [];
    const scan = async (where) => { const t = await text(p); if (/€|\$\s?\d|\d\s?\$|USD|EUR\b/.test(t)) seen.push(where); };
    await scan('dashboard');
    for (const label of ['Production machines', 'Production', 'Tracking', 'Calendar', 'Report', 'Profile']) {
      const el = p.getByText(label, { exact: true }).first();
      if (await el.count()) { await el.click().catch(() => {}); await p.waitForTimeout(800); await scan(label); }
    }
    pass(seen.length === 0, 'no € / $ on: dashboard, industry priorities, tracking, calendar, report, profile' + (seen.length ? ' — seen on ' + seen.join(', ') : ''));
    pass(p._errors.length === 0, 'no page errors ' + p._errors.join('|'));
    await p.close(); }

  await browser.close();
})();
