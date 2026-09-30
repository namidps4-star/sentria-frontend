// Ask SentrIA: signed calls, answers, conversations, errors, per-user memory.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright'); const { signedIn } = require('./auth-mock');
let fails = 0; const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const now = new Date().toISOString();
const ALERTS = [
  { id: 1, equipment: 'Doliprane', sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, alert_key: 'health.stock.low', message: 'low' },
  { id: 2, equipment: 'Doliprane', sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, alert_key: 'health.stock.low', message: 'low again' },
  { id: 3, equipment: 'Amoxicilline', sector: 'health', business_type: 'pharmacie', severity: 'CRITICAL', date: now, alert_key: 'health.expiry.soon', message: 'exp' },
  { id: 4, equipment: 'Gants', sector: 'health', business_type: 'clinique-hopital', severity: 'WARNING', date: now, alert_key: 'hospital.stock.low', message: 'x' },
];
(async () => { const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  const open = async (uid = 'u-ama', failAsk = false, vw) => {
    const p = await ctx.newPage(); if (vw) await p.setViewportSize({ width: vw, height: 844 });
    p._errs = []; p.on('pageerror', e => p._errs.push(e.message)); p._asks = [];
    await p.route(/onrender\.com\//, async r => { const u = r.request().url();
      if (u.includes('/ask')) { p._asks.push({ body: JSON.parse(r.request().postData()), auth: r.request().headers()['authorization'] || '' });
        await new Promise(x => setTimeout(x, 700));
        return failAsk ? r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: { message: 'The AI is busy, try again.' } }) })
          : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer: '**Doliprane** first.\n\n- Order 120 boxes\n- Call the supplier' }) }); }
      if (u.includes('/alerts')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ALERTS) });
      if (u.includes('/assignments')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assignments: [{ task_key: 'Amoxicilline-health.expiry.soon', status: 'done', priority: 'medium', deadline: null, contractor_ids: [] }] }) });
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"recommendations":[],"contractors":[]}' }); });
    await p.addInitScript(() => { if (!sessionStorage.x) { sessionStorage.x = 1; Object.entries({ sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Pharmacie A', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_departments: '{"health":["pharmacie","clinique-hopital"]}', sentria_timezone: 'wat' }).forEach(([k, v]) => localStorage.setItem(k, v)); } });
    await signedIn(p, uid, 'ama@pharma.bj', { plan: 'business', meta: { full_name: 'Ama Mensah' } });
    await p.goto(APP_URL); await p.waitForTimeout(1500);
    if (vw && vw < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(300); }
    await p.locator('aside nav button', { hasText: 'Ask SentrIA' }).click(); await p.waitForTimeout(1200); return p; };
  const main = p => p.evaluate(() => document.querySelector('main').innerText);
  let p = await open();
  let t = await main(p);
  pass(/Hello Ama\./.test(t) && /Assistant online · Pharmacie A/.test(t), 'greets by first name; company in the header');
  pass(/What SentrIA reads/.test(t) && /Pharmacy, Clinic \/ Hospital/.test(t), 'right card: sector and departments');
  const crit = await p.locator('text=Critical handled').locator('..').innerText();
  pass(/1 \/ 2/.test(crit), 'critical handled 1 / 2 (repeats counted once, done task counted) ' + crit.replace(/\n/g, ' '));
  pass(/Why is Doliprane critical/.test(t), 'first quick question built from the open critical alert');
  await p.screenshot({ path: 'A-empty.png' });
  await p.fill('#ask-input', 'What needs my attention today?'); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  pass(await p.getByRole('status', { name: 'SentrIA is writing…' }).count() === 1, 'typing indicator while waiting');
  await p.waitForTimeout(1000);
  const a = p._asks[0] || {};
  pass(/^Bearer /.test(a.auth || ''), 'call is signed (Bearer token) — it failed before: no token');
  pass(a.body && a.body.lang === 'en' && a.body.text === 'What needs my attention today?' && a.body.session_id && /Lagos|Cotonou|Africa\//.test(a.body.timezone + a.body.timezone_label), 'sends text, language, conversation id and time zone ' + JSON.stringify(a.body));
  t = await main(p);
  pass(/Order 120 boxes/.test(t) && await p.locator('[role=log] strong', { hasText: 'Doliprane' }).count() === 1, 'answer shown, markdown rendered');
  pass(/Last reply\s*1 s/.test(t), 'last reply speed shown');
  pass(await p.locator('[aria-label="Your conversations"] button', { hasText: 'What needs my attention today?' }).count() === 1, 'conversation titled by its first question');
  await p.screenshot({ path: 'A-chat.png' });
  await p.getByRole('button', { name: 'New conversation' }).first().click(); await p.waitForTimeout(200);
  pass(await p.locator('[aria-label="Your conversations"] li').count() === 2 && !/Order 120 boxes/.test(await main(p)), 'new conversation: empty, listed');
  await p.locator('[aria-label="Your conversations"] button', { hasText: 'What needs my attention' }).click(); await p.waitForTimeout(200);
  pass(/Order 120 boxes/.test(await main(p)), 'switching back restores the conversation');
  const sid = a.body.session_id;
  await p.fill('#ask-input', 'And tomorrow?'); await p.keyboard.press('Enter'); await p.waitForTimeout(1200);
  pass(p._asks[1] && p._asks[1].body.session_id === sid, 'follow-up keeps the same conversation id');
  pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
  await p.locator('aside nav button', { hasText: 'Dashboard' }).click(); await p.waitForTimeout(600);
  await p.locator('aside nav button', { hasText: 'Ask SentrIA' }).click(); await p.waitForTimeout(600);
  pass(await p.locator('[aria-label="Your conversations"] button', { hasText: 'What needs my attention' }).count() === 1, 'left Ask and came back: conversation still there');
  await p.reload(); await p.waitForTimeout(1500); await p.locator('aside nav button', { hasText: 'Ask SentrIA' }).click(); await p.waitForTimeout(800);
  pass(await p.locator('[aria-label="Your conversations"] button', { hasText: 'What needs my attention' }).count() === 1, 'page reload in the same tab: still there');
  await p.close();
  p = await open('u-other');
  pass(await p.locator('[aria-label="Your conversations"] button', { hasText: 'What needs my attention' }).count() === 0, 'another account in the same browser does not see them');
  await p.close();
  p = await open('u-err', true);
  await p.getByRole('button', { name: /^Why is Doliprane critical/ }).first().click(); await p.waitForTimeout(1300);
  t = await main(p);
  pass(/No answer/.test(t) && /The AI is busy, try again\./.test(t), 'API error: "No answer" tag and the server\'s reason');
  await p.close();
  p = await open('u-ph', false, 390);
  pass(await p.locator('#ask-input').isVisible() && await p.evaluate(() => document.querySelector('main').scrollWidth <= document.querySelector('main').clientWidth + 1), 'phone: chat usable, no sideways scroll');
  await p.screenshot({ path: 'A-phone.png' }); await p.close();
  await b.close(); console.log(`\n${fails ? fails + ' failure(s)' : 'ALL OK'}`); process.exit(fails ? 1 : 0); })();
