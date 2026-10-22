// The Top 5 card on the dashboard: a black lead card (big light 01 with the lime line, severity tag, the action
// in a lime tile, risk and confidence as light numbers) beside four grey rows (02 to 05). Light, dark, 390 px.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const NAMES = ['Fridge-3', 'Paracetamol 500 mg', 'Artemether 80 mg', 'Freezer-1', 'Insulin pens'];
const SEV = ['CRITICAL', 'CRITICAL', 'WARNING', 'WARNING', 'CRITICAL'];
const dates = NAMES.map((_, i) => new Date(Date.now() - (i + 1) * 3600e3).toISOString());
const alerts = NAMES.map((n, i) => ({ id: i + 1, equipment: n, sector: 'health', business_type: 'pharmacie', severity: SEV[i], date: dates[i], alert_key: 'health.cold.high' + i, message: 'MSG ' + n, risk_score: 81 - i, params: [['value', 1240], ['currency', '€']] }));
const recs = NAMES.map((n, i) => ({ equipment: n, sector: 'health', business_type: 'pharmacie', severity: SEV[i], date: dates[i], message: 'MSG ' + n, alert_key: 'health.cold.high' + i, recommended_action: 'ACT ' + n, action_category: 'cold_chain', risk_score: 81 - i, confidence: 84 }));

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ theme = 'light', width = 1440, lang = 'en' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 1500 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(alerts) }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendations: recs }) }));
    await p.route(/\/(contractors|assignments)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"contractors":[],"assignments":[]}' }));
    await p.addInitScript(([l, t]) => { const s = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: l, sentria_company_name: 'Acme', sentria_theme: t }; for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, [lang, theme]);
    await signedIn(p); await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1800);
    return { p, ctx, card: p.locator('[data-testid=top5]') };
  };
  const rgb = (loc, prop) => loc.evaluate((el, prop) => { const cv = document.createElement('canvas'); cv.width = cv.height = 1; const c = cv.getContext('2d', { willReadFrequently: true }); c.fillStyle = '#000'; c.fillStyle = getComputedStyle(el)[prop]; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3); }, prop);

  console.log('== desktop, light');
  let x = await open();
  let t = await x.card.innerText({timeout:3000}).catch(async()=>{await x.p.screenshot({path:'top5dbg.png'});console.log((await x.p.locator('body').innerText()).slice(0,600));process.exit(1)});
  pass(await x.card.count() === 1 && /Top 5 priorities/.test(t), 'the card is titled Top 5 priorities');
  pass(/ranked by urgency, each with its action/.test(t), 'subtitle');
  pass(await x.card.locator('[data-testid=top5-lead]').count() === 1 && await x.card.locator('[data-testid=top5-row]').count() === 4, 'one lead card and four rows');
  const lead = x.card.locator('[data-testid=top5-lead]');
  const lt = (await lead.innerText()).replace(/\s+/g, ' ');
  pass(/01/.test(lt) && /Fridge-3/.test(lt) && /Critical/.test(lt), 'lead: 01, equipment, severity: ' + lt.slice(0, 60));
  pass(/Do this now/i.test(lt) && /ACT Fridge-3/.test(lt), 'lead: the action sits under Do this now');
  pass(/81\s*\/100/.test(lt) && /84\s*%/.test(lt), 'lead: risk 81/100 and confidence 84%');
  pass(await lead.locator('span.bg-accent').count() >= 3, 'lime lines under 01, risk and confidence');
  const leadBg = await rgb(lead, 'backgroundColor');
  pass(leadBg.every(v => v < 60), 'the lead card is black: rgb(' + leadBg.join(',') + ')');
  const rows = x.card.locator('[data-testid=top5-row]');
  const nums = []; for (let i = 0; i < 4; i++) nums.push(((await rows.nth(i).innerText()).match(/0\d/) || [''])[0]);
  pass(nums.join(',') === '02,03,04,05', 'rows are numbered 02 to 05: ' + nums.join(','));
  pass(/ACT Paracetamol 500 mg/.test(await rows.nth(0).innerText()), 'a row shows its action line');
  pass(await x.card.getByRole('button', { name: 'Handled', exact: true }).count() === 4 && await x.card.getByRole('button', { name: 'Mark handled', exact: true }).count() === 1, 'Mark handled on the lead, Handled on each row');
  pass(await x.card.getByRole('button', { name: 'Dismiss', exact: true }).count() === 5, 'a dismiss X on all five');
  pass(await x.card.evaluate(el => [...el.querySelectorAll('*')].every(n => { const o = getComputedStyle(n).overflowY; return !(o === 'auto' || o === 'scroll') || n.scrollHeight <= n.clientHeight + 1; })), 'no inner scroll bar');
  await x.card.screenshot({ path: 'top5ui-light.png' });

  console.log('== acting on a priority');
  await x.card.getByRole('button', { name: 'Handled', exact: true }).first().click(); await x.p.waitForTimeout(300);
  pass(/Handled at \d/.test(await rows.nth(0).innerText()), 'a row shows Handled at <time> once acted on');
  await x.card.getByRole('button', { name: 'Mark handled', exact: true }).click(); await x.p.waitForTimeout(300);
  pass(/Outcome/i.test(await lead.innerText()) && /Handled at \d/.test(await lead.innerText()), 'the lead card shows the outcome');
  pass(x.p._errors.length === 0, 'no page errors ' + x.p._errors.join('|'));
  await x.ctx.close();

  console.log('== See all in Tracking');
  x = await open();
  await x.card.getByRole('button', { name: /See all in Tracking/ }).click(); await x.p.waitForTimeout(900);
  pass(await x.p.locator('[data-testid=top5]').count() === 0, 'it leaves the dashboard for Tracking');
  await x.ctx.close();

  console.log('== French, dark, phone');
  x = await open({ lang: 'fr' });
  t = await x.card.innerText({timeout:3000}).catch(async()=>{await x.p.screenshot({path:'top5dbg.png'});console.log((await x.p.locator('body').innerText()).slice(0,600));process.exit(1)});
  pass(/Top 5 priorités/.test(t) && /Tout voir dans le suivi/.test(t) && /À faire maintenant/i.test(t), 'in French');
  await x.ctx.close();
  x = await open({ theme: 'dark' });
  await x.card.screenshot({ path: 'top5ui-dark.png' });
  await x.ctx.close();
  x = await open({ width: 390 });
  const box = await x.card.boundingBox();
  pass(box.x >= 0 && box.x + box.width <= 390, 'fits the phone');
  pass(await x.p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth) <= 0, 'no sideways scroll');
  await x.card.scrollIntoViewIfNeeded(); await x.p.waitForTimeout(600); await x.card.screenshot({ path: 'top5ui-phone.png' });
  await x.ctx.close();

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
