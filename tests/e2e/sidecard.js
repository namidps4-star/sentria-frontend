// The Alert detail card beside the alerts table: the title, three big light numbers (risk, confidence,
// category) with the lime line, three steps (what happened, why, do this now), the buttons. The Critical
// tag is solid red with white text. Light, dark, 390 px.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const dates = [0.3, 2, 5].map(h => new Date(Date.now() - h * 3600e3).toISOString());
const NAMES = ['Fridge-3', 'Paracetamol 500 mg', 'Artemether 80 mg'];
const SEV = ['CRITICAL', 'CRITICAL', 'WARNING'];
const alerts = NAMES.map((n, i) => ({ id: i + 1, equipment: n, sector: 'health', business_type: 'pharmacie', severity: SEV[i], date: dates[i], alert_key: 'health.cold.high' + i, message: 'MSG ' + n, risk_score: 81, params: [['value', 1240], ['currency', '€']] }));
const recs = NAMES.map((n, i) => ({ equipment: n, sector: 'health', business_type: 'pharmacie', severity: SEV[i], date: dates[i], message: 'MSG ' + n, alert_key: 'health.cold.high' + i, recommended_action: 'ACT ' + n, action_category: 'cold_chain', risk_score: 81 }));

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
    await p.locator('tbody tr').first().click(); await p.waitForTimeout(900);
    return { p, ctx, card: p.locator('[data-alert-detail]') };
  };
  const rgb = (loc, prop) => loc.evaluate((el, prop) => { const cv = document.createElement('canvas'); cv.width = cv.height = 1; const c = cv.getContext('2d', { willReadFrequently: true }); c.fillStyle = '#000'; c.fillStyle = getComputedStyle(el)[prop]; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3); }, prop);

  console.log('== desktop, light');
  let x = await open();
  let t = await x.card.innerText();
  pass(await x.card.count() === 1 && /Alert detail/i.test(t), 'the card opens and keeps its Alert detail title');
  const eb = await rgb(x.card.getByText(/^Alert detail$/i).first(), 'color');
  pass(!(eb[1] > 180 && eb[0] < 230 && eb[2] < 120), 'the title is not lime-green: rgb(' + eb.join(',') + ')');
  pass(await x.card.locator('[data-alert-steps] > li').count() === 3, 'three steps');
  pass(/What happened/i.test(t) && /Why/i.test(t) && /Do this now/i.test(t), 'labelled What happened, Why, Do this now');
  pass(/MSG Fridge-3/.test(await x.card.locator('[data-alert-steps] > li').nth(0).innerText()), 'step 1 is the alert message');
  pass(/ACT Fridge-3/.test(await x.card.locator('[data-alert-action]').innerText()), 'step 3 is the recommended action, in the lime tile');
  const nums = (await x.card.locator('[data-alert-numbers]').innerText()).replace(/\s+/g, ' ');
  pass(/81\s*\/100/.test(nums) && /\d+\s*%/.test(nums) && /cold chain/i.test(nums), 'risk, confidence and category: ' + nums.slice(0, 80));
  pass(await x.card.locator('[data-alert-numbers] span.bg-accent').count() === 2, 'a lime line under risk and confidence');
  pass(await x.card.getByRole('button', { name: 'Mark handled' }).count() === 1 && await x.card.getByRole('button', { name: /See the recommendation/ }).count() === 1, 'Mark handled and See the recommendation are in the card');
  pass(!/Status\b/.test(t) && (t.match(/Critical/g) || []).length === 1, 'severity shows once, no duplicate Status box');
  const tagBg = await rgb(x.card.getByText('Critical', { exact: true }).first().locator('xpath=ancestor::span[1]'), 'backgroundColor');
  const tagFg = await rgb(x.card.getByText('Critical', { exact: true }).first(), 'color');
  pass(tagBg[0] > 190 && tagBg[1] < 90 && tagBg[2] < 100 && tagFg.every(v => v > 240), 'the Critical tag is solid red with white text: bg rgb(' + tagBg.join(',') + ') text rgb(' + tagFg.join(',') + ')');
  await x.p.waitForTimeout(1800); await x.card.screenshot({ path: 'sidecard-light.png' });
  await x.card.getByRole('button', { name: /See the recommendation/ }).click(); await x.p.waitForTimeout(500);
  pass(await x.p.locator('[aria-labelledby=recommendation-dialog-title]').count() === 1, 'See the recommendation opens the popup');
  pass(x.p._errors.length === 0, 'no page errors ' + x.p._errors.join('|'));
  await x.ctx.close();

  console.log('== French, dark, phone');
  x = await open({ lang: 'fr' });
  pass(/Détails de l'alerte/i.test(await x.card.innerText()) && /À faire maintenant/i.test(await x.card.innerText()), 'in French');
  await x.ctx.close();
  x = await open({ theme: 'dark' });
  const dBg = await rgb(x.card.getByText('Critical', { exact: true }).first().locator('xpath=ancestor::span[1]'), 'backgroundColor');
  pass(dBg[0] > 200 && dBg[1] < 120, 'dark: the Critical tag is still clearly red: rgb(' + dBg.join(',') + ')');
  await x.p.waitForTimeout(1800); await x.card.screenshot({ path: 'sidecard-dark.png' });
  await x.ctx.close();
  x = await open({ width: 390 });
  const box = await x.card.boundingBox();
  pass(box.x >= 0 && box.x + box.width <= 390, 'fits the phone');
  pass(await x.p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth) <= 0, 'no sideways scroll');
  await x.card.scrollIntoViewIfNeeded(); await x.p.waitForTimeout(1800); await x.card.screenshot({ path: 'sidecard-phone.png' });
  await x.ctx.close();

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
