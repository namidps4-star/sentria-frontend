// The Report opens with the week told as a story: a headline, what needs the boss, what keeps coming back, a plan.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const now = Date.now();
const mk = (i, equipment, sev, key, message, hoursAgo, risk) => ({ id: i, equipment, sector: 'logistics', business_type: 'port-conteneurs', severity: sev, date: new Date(now - hoursAgo * 36e5).toISOString(), alert_key: key, risk_score: risk, message });
const ALERTS = [
  mk(1, 'CRANE-02', 'CRITICAL', 'logistics.cycles.critical', 'Crane at 96% of its cycle limit : plan service', 3, 90),
  mk(2, 'CRANE-02', 'CRITICAL', 'logistics.cycles.critical', 'Crane at 98% of its cycle limit : plan service', 1, 95),
  mk(3, 'REEFER-7', 'CRITICAL', 'logistics.temp.high', 'Reefer at 9 C : check the unit', 5, 80),
  mk(4, 'QUAI-1', 'WARNING', 'logistics.wait.long', 'Berth wait of 6 h : call the line', 30, 40),
  mk(5, 'QUAI-3', 'WARNING', 'logistics.wait.long', 'Berth wait of 5 h : call the line', 20, 35),
];
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Port A', sentria_sector: 'logistics', sentria_sectors: '["logistics"]', sentria_business_type: 'port-conteneurs', sentria_ops_types: '["port"]', sentria_ops_type: 'port' };

(async () => {
  const b = await chromium.launch(LAUNCH);
  const open = async ({ alerts = ALERTS, vw = 1440, theme = 'light', lang = 'en' } = {}) => {
    const p = await b.newPage({ viewport: { width: vw, height: 900 }, locale: 'en-US' }); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/onrender\.com\//, r => { const u = new URL(r.request().url());
      r.fulfill({ status: 200, contentType: 'application/json', body: u.pathname === '/alerts' ? JSON.stringify(alerts) : u.pathname === '/reports/weekly' ? '{"alerts":5,"critical":3,"warning":2,"previous_alerts":1,"delta":4,"trend":"up","resolved":0,"top_offender":null}' : '{"recommendations":[],"assignments":[],"contractors":[]}' }); });
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); } }, { ...LS, sentria_theme: theme, sentria_language: lang });
    await signedIn(p, 'u', 'a@b.c', { plan: 'business' }); await p.goto(APP_URL); await p.waitForTimeout(1800);
    if (vw < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(300); }
    await p.locator('aside nav button', { hasText: lang === 'fr' ? 'Rapport' : 'Report' }).click(); await p.waitForTimeout(1500);
    return p; };

  console.log('== the story, in English');
  let p = await open();
  const card = p.getByTestId('briefing');
  const t = (await card.innerText()).replace(/\s+/g, ' ');
  pass(/2 critical things need you, starting with CRANE-02/.test(t), 'headline names the worst asset: ' + t.slice(0, 90));
  pass(/5 alerts in the period: 3 critical, 2 to watch/.test(t), 'the lead counts the period');
  pass(/What needs you now/.test(t) && /CRANE-02/.test(t) && /REEFER-7/.test(t), 'what needs you now lists the critical assets');
  pass(await card.locator('ul li', { hasText: 'CRANE-02' }).count() === 1 && /2 times/.test(t), 'a repeat is one story with a count, not two');
  pass(/Crane at 98% of its cycle limit/.test(t) && !/96%/.test(t), 'the newest reading of a repeat is the one shown');
  pass(/What keeps coming back/.test(t) && /CRANE-02 \(2 alerts\)/.test(t), 'what keeps coming back names the repeat asset');
  pass(/The plan/i.test(t) && /Today: deal with CRANE-02/.test(t) && /Today: deal with REEFER-7/.test(t) && /This week: find out why CRANE-02/.test(t), 'a short plan: today for critical, this week for the repeat');
  pass(!/€|\$/.test(t), 'no money figure invented');
  pass(await p.getByText('Key figures', { exact: true }).count() === 1 && await p.getByText('The figures behind the story').count() === 1, 'the old figures stay below the story');
  pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
  await p.screenshot({ path: 'briefing-light.png' });
  await p.close();

  console.log('== only warnings');
  p = await open({ alerts: ALERTS.slice(3) });
  pass(/Nothing critical\. 2 things to watch\./.test(await p.getByTestId('briefing').innerText()), 'no critical alert: it says so and does not raise a false alarm');
  await p.close();

  console.log('== French, dark, and 390 px');
  p = await open({ lang: 'fr', theme: 'dark' });
  const fr = (await p.getByTestId('briefing').innerText()).replace(/\s+/g, ' ');
  pass(/Votre semaine/i.test(fr) && /Ce qui vous attend/.test(fr) && /Ce qui revient/.test(fr) && /Le plan/i.test(fr), 'every heading is French');
  pass(!/needs you|What needs/.test(fr), 'no English left in French');
  await p.screenshot({ path: 'briefing-dark-fr.png' });
  await p.close();

  p = await open({ vw: 390 });
  pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll at 390 px');
  await p.screenshot({ path: 'briefing-390.png', fullPage: false });
  await p.close();

  await b.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
