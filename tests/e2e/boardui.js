// The Tracking board: each card carries a big light priority number with a lime line, the severity
// tag without a risk number, a relative time and the same controls as before. The To do / In progress /
// Resolved tags stay as they were.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const now = new Date().toISOString(), old = new Date(Date.now() - 86400000).toISOString();
const R = (eq, sector, bt, key, date = now) => ({ equipment: eq, sector, business_type: bt, severity: 'CRITICAL', date, message: `MSG ${eq}`, alert_key: key, recommended_action: `ACT ${eq}`, action_category: 'stock', confidence: 0.8, risk_score: null });
const recs0 = [
  R('Doliprane', 'health', 'pharmacie', 'health.stock.low'),
  R('Doliprane', 'health', 'pharmacie', 'health.stock.low', old),     // repeat: same task
  R('Gants', 'health', 'clinique-hopital', 'hospital.stock.low'),     // other activity
  R('Riz', 'retail', 'supermarche-hypermarche', 'retail.stock.low'),
  R('GRUE-02', 'logistics', null, 'logistics.cycles.warning'),        // sector not selected
];

const mk=(eq,sev,msg,act,key,h)=>({equipment:eq,sector:'health',business_type:'pharmacie',severity:sev,date:new Date(Date.now()-h*3600e3).toISOString(),message:msg,alert_key:key,recommended_action:act,action_category:'stock',risk_score:70});
const recs=[mk('Fridge-3','CRITICAL','Fridge above range for 40 minutes','Move the vaccines to the backup fridge','health.cold.high',0.3),mk('Paracetamol 500 mg','CRITICAL','Out of stock in 3 days','Order 120 boxes','health.stock.low',2),mk('Artemether 80 mg','WARNING','Temperature drifting up','Check the shelf thermometer','health.temp.up',26),mk('Vaccine fridge 2','CRITICAL','Door open for 12 minutes','Close the door and check the log','health.cold.door',5),mk('Amoxicillin','WARNING','Low stock','Reorder at next round','health.stock.low2',50)];
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await b.newPage({ viewport: { width: 1440, height: 1400 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const saved = [];
  await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: recs }) }));
  await p.route(/\/contractors/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contractors: [{ id: 'c1', name: 'Awa Diop', availability: 'available', open_assignments: 0, active: true, role: null, phone: null, note: null }] }) }));
  await p.route(/\/assignments/, r => { if (r.request().method() === 'PUT') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"assignment":{}}' }); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignments: [{ task_key: 'Vaccine fridge 2-health.cold.door', status: 'in_progress', priority: 'high', deadline: null, contractor_ids: ['c1'] }, { task_key: 'Amoxicillin-health.stock.low2', status: 'done', priority: 'low', deadline: null, contractor_ids: [] }] }) }); });
  await p.addInitScript(() => { const s = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health","commerce"]', sentria_business_type: 'pharmacie', sentria_language: 'en', sentria_company_name: 'Acme' }; for (const k in s) localStorage.setItem(k, s[k]); });
  const _extra = 0;
  await require('./auth-mock').signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /^Tracking$/ }).first().click(); await p.waitForTimeout(1500);
  const secs = p.locator('section').filter({ has: p.locator('article') });
  const heads = await secs.evaluateAll(els => els.map(e => e.querySelector('h4')?.innerText.trim()));
  pass(heads.join('|') === 'To do|In progress|Resolved', 'the three status tags are intact: ' + heads.join(' | '));
  const nums = await secs.evaluateAll(els => els.map(e => [...e.querySelectorAll('[data-board-number]')].map(n => n.textContent.trim())));
  pass(JSON.stringify(nums) === JSON.stringify([['01', '02', '03'], ['01'], ['01']]), 'each column numbers its cards 01, 02, 03: ' + JSON.stringify(nums));
  const line = await p.locator('[data-board-number] > span').first().evaluate(el => { const c = getComputedStyle(el); const r = el.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), bg: c.backgroundColor }; });
  pass(line.h >= 3 && line.w >= 20 && line.bg !== 'rgba(0, 0, 0, 0)', 'every number has a lime line under it: ' + JSON.stringify(line));
  pass(await p.locator('[data-board-number] > span').count() === 5, 'one line per card (5)');
  const tagTexts = await p.locator('article').evaluateAll(els => els.map(e => e.innerText));
  pass(tagTexts.every(t => !/(Critical|Warning)\s*·\s*\d+/.test(t)), 'the severity tag carries no risk number');
  const times = await p.locator('article [data-alert-time]').allInnerTexts();
  pass(times.length === 5 && times.includes('Yesterday') && times.some(t => /min ago$/.test(t)), 'each card shows how long ago: ' + times.join(' | '));
  const warnTag = p.locator('article span', { hasText: /^Warning$/ }).first();
  const warnCol = await warnTag.evaluate(el => { const t = el.closest('span.rounded-full') || el; const cv = document.createElement('canvas'); cv.width = cv.height = 1; const c = cv.getContext('2d', { willReadFrequently: true }); const get = v => { c.fillStyle = '#000'; c.fillStyle = v; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3); }; const s = getComputedStyle(t); return { bg: get(s.backgroundColor), fg: get(s.color) }; });
  pass(warnCol.bg[0] > 220 && warnCol.bg[1] > 120 && warnCol.bg[1] < 170 && warnCol.bg[2] < 80 && warnCol.fg[0] < 70, 'the Warning tag is solid orange with dark text: bg rgb(' + warnCol.bg.join(',') + ') text rgb(' + warnCol.fg.join(',') + ')');
  const first = p.locator('article').first();
  pass(await first.getByRole('button', { name: /Move to the next column/ }).count() === 1 && await first.getByRole('button', { name: /Priority detail/ }).count() === 1, 'the move arrows and the detail button are still there');
  pass(await first.locator('input[type=date]').count() === 1, 'the due date is still there');
  await first.getByRole('button', { name: /Move to the next column/ }).click({ force: true }); await p.waitForTimeout(500);
  const heads2 = await secs.evaluateAll(els => els.map(e => e.querySelectorAll('article').length));
  pass(heads2.join() === '2,2,1', 'moving a card still works: ' + heads2.join());
  await p.screenshot({ path: 'boardui-light.png', fullPage: true });
  await p.setViewportSize({ width: 390, height: 1800 }); await p.waitForTimeout(500);
  pass(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'no sideways scroll on a phone');
  await p.screenshot({ path: 'boardui-phone.png', fullPage: true });
  await p.setViewportSize({ width: 1440, height: 1400 });
  await p.evaluate(() => localStorage.setItem('sentria_theme', 'dark')); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  await p.getByRole('button', { name: /^Tracking$/ }).first().click(); await p.waitForTimeout(1200);
  await p.screenshot({ path: 'boardui-dark.png', fullPage: true });
  pass(errors.length === 0, 'no page errors ' + errors.join('|'));
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
