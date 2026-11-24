// The Upload card's "Optional" box (F-JIT): the columns that let a stock alert say how much to
// order, listed only for the departments that have a reorder alert. English and French, light,
// dark, 390 px, a short screen. The card keeps to the screen and scrolls inside when it is taller.
process.env.TZ = 'Europe/Paris';
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const ACCOUNTS = {
  pharmacy: { sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_departments: '{"health":["pharmacie"]}' },
  hospital: { sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'clinique-hopital', sentria_departments: '{"health":["clinique-hopital"]}' },
  shop: { sentria_sector: 'commerce', sentria_sectors: '["commerce"]', sentria_business_type: 'supermarche-hypermarche', sentria_departments: '{"commerce":["supermarche-hypermarche"]}' },
  factory: { sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_business_type: 'usine-production', sentria_departments: '{"industry":["usine-production"]}' },
};
const REORDER = ['supplier_lead_days', 'qty_on_order', 'criticality'];

(async () => {
  const browser = await chromium.launch(LAUNCH);
  async function open({ account = 'pharmacy', theme = 'light', width = 1440, height, lang = 'en' } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height: height || (width < 500 ? 844 : 900) }, timezoneId: 'Europe/Paris', locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = [];
    p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/onrender\.com\//, r => {
      const path = new URL(r.request().url()).pathname;
      const json = b => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
      if (path === '/alerts') return json([]);
      if (path === '/freshness') return json({ freshness: [], persisted: false, stale_after_days: 7 });
      return json({ recommendations: [], assignments: [], contractors: [] });
    });
    await p.addInitScript(l => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(l)) localStorage.setItem(k, v); } },
      { sentria_language: lang, sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_theme: theme, ...ACCOUNTS[account] });
    await signedIn(p, 'u', 'ama@acme.test', { plan: 'entreprise', isAdmin: true });
    await p.goto(APP_URL); await p.waitForTimeout(2200);
    await p.click('button[aria-controls=import-panel]'); await p.waitForTimeout(600);
    const panel = p.locator('#import-panel');
    const box = panel.locator('[data-supplier-columns]');
    const text = async () => (await box.innerText()).replace(/\s+/g, ' ');
    const pick = async (label) => { await panel.getByRole('button', { name: label }).first().click(); await p.waitForTimeout(250); };
    return { ctx, p, panel, box, text, pick };
  }
  const names = async (x) => x.box.locator('code').allInnerTexts();

  console.log('== pharmacy, desktop, light');
  let x = await open();
  let t = await x.text();
  pass(await x.panel.locator('[data-reorder-columns]').count() === 1 && await x.panel.locator('[data-supplier-columns]').count() === 1, 'one box, marked as carrying the reorder columns');
  pass(/Optional · who to order from, and how much/i.test(t), 'heading: ' + t.slice(0, 48));
  const codes = await names(x);
  pass(['supplier', 'supplier_phone', 'supplier_email', ...REORDER].every(c => codes.includes(c)), 'lists the supplier columns and the three reorder columns: ' + codes.join(' '));
  pass(!codes.includes('usage_last_30_days'), 'no usage column for a pharmacy');
  pass(/critical, high, normal or low/.test(t) && /days the supplier takes to deliver/.test(t) && /units already ordered/.test(t), 'each column says what it is');
  pass(/Without these columns SentrIA assumes 7 days to deliver\./.test(t), 'says what is assumed without them');
  pass(!/nothing changes/.test(t), 'the old "nothing changes" is gone for a department that has the alert');
  pass(!/\u2014/.test(t), 'no em dash');
  const geo = await x.panel.evaluate(el => ({ bottom: el.getBoundingClientRect().bottom, scroll: el.scrollHeight - el.clientHeight, vh: innerHeight }));
  pass(geo.scroll <= 1 && geo.bottom <= geo.vh, `fits a 900 px screen with no scrolling inside (bottom ${Math.round(geo.bottom)}, scroll ${geo.scroll})`);
  await x.p.screenshot({ path: 'importcolumns-pharmacy-light.png' });

  console.log('== the other health departments, from the same card');
  await x.pick('Clinic / Hospital');
  let c2 = await names(x);
  pass(c2.includes('usage_last_30_days') && c2.indexOf('usage_last_30_days') < c2.indexOf('supplier_lead_days') && !c2.includes('criticality'), 'hospital: usage first, no criticality: ' + c2.join(' '));
  pass(/With usage in the file, critical supplies \(oxygen, blood…\) also get an order quantity\./.test(await x.text()), 'hospital sentence');
  await x.pick('Laboratory');
  t = await x.text();
  pass(await x.panel.locator('[data-reorder-columns]').count() === 0 && /Optional · to know who to order from/i.test(t) && /Without these columns nothing changes\./.test(t), 'laboratory: the supplier box as it was, no reorder columns');
  await x.pick('Pharmaceutical wholesaler');
  pass(await x.panel.locator('[data-reorder-columns]').count() === 0 && !(await names(x)).includes('supplier_lead_days'), 'pharmaceutical wholesaler: none');
  await x.pick('Veterinary');
  const vet = await names(x);
  pass(REORDER.every(c => vet.includes(c)), 'veterinary: the stock columns');
  pass(x.p._errors.length === 0, 'no page errors ' + x.p._errors.join('|'));
  await x.ctx.close();

  console.log('== hospital account');
  x = await open({ account: 'hospital' });
  c2 = await names(x);
  pass((await x.panel.locator('h3').innerText()).includes('Clinic / Hospital') && c2.includes('usage_last_30_days'), 'opens on the hospital with the usage column: ' + c2.join(' '));
  await x.p.screenshot({ path: 'importcolumns-hospital-light.png' });
  await x.ctx.close();

  console.log('== retail account');
  x = await open({ account: 'shop' });
  const depts = await x.panel.getByRole('group').first().getByRole('button').allInnerTexts();
  pass((await names(x)).includes('supplier_lead_days') && await x.panel.locator('[data-reorder-columns]').count() === 1, 'a supermarket gets the stock columns (departments: ' + depts.map(d => d.trim()).join(' | ') + ')');
  const distributor = depts.map(d => d.trim()).find(d => /wholesal|distribut/i.test(d));
  if (distributor) {
    await x.pick(distributor);
    pass(await x.panel.locator('[data-reorder-columns]').count() === 0, `${distributor}: no reorder columns (it holds no stock of its own)`);
  } else pass(false, 'found the distributor department');
  await x.ctx.close();

  console.log('== industry is untouched');
  x = await open({ account: 'factory' });
  pass(await x.panel.locator('[data-cost-columns]').count() === 1 && await x.panel.locator('[data-supplier-columns]').count() === 0, 'its own cost box, and no supplier box');
  await x.ctx.close();

  console.log('== French');
  x = await open({ lang: 'fr' });
  t = await x.text();
  pass(/Facultatif · chez qui commander, et combien/i.test(t), 'heading in French');
  pass(/jours de livraison du fournisseur/.test(t) && /unités déjà commandées/.test(t) && /critique, haute, normale ou faible/.test(t), 'columns in French');
  pass(/SentrIA suppose 7 jours de livraison/.test(t), 'sentence in French');
  pass(!/Optional|units already|days the supplier|assumes|critical, high/i.test(t), 'no English left in the box');
  await x.pick('Clinique / Hôpital');
  pass(/consommation dans le fichier/.test(await x.text()) && /unités utilisées sur 30 jours/.test(await x.text()), 'hospital in French');
  await x.ctx.close();

  console.log('== dark');
  x = await open({ theme: 'dark' });
  const grounds = await x.panel.evaluate(el => ({ box: getComputedStyle(el.querySelector('[data-supplier-columns]')).backgroundColor, card: getComputedStyle(el).backgroundColor }));
  pass(grounds.box !== 'rgba(0, 0, 0, 0)' && grounds.box !== grounds.card, `the box has its own muted ground in dark (${grounds.box} on ${grounds.card})`);
  await x.p.screenshot({ path: 'importcolumns-pharmacy-dark.png' });
  await x.ctx.close();

  console.log('== 390 px: the card keeps to the screen and scrolls inside');
  x = await open({ width: 390 });
  let b = await x.panel.boundingBox();
  pass(b.x >= 0 && b.x + b.width <= 390, `fits the phone width (${Math.round(b.x)}..${Math.round(b.x + b.width)})`);
  pass(b.y + b.height <= 844, `ends on the screen (bottom ${Math.round(b.y + b.height)} of 844)`);
  const inner = await x.panel.evaluate(el => ({ over: el.scrollHeight - el.clientHeight, chooser: el.querySelector('label').getBoundingClientRect().bottom - el.getBoundingClientRect().top, h: el.clientHeight }));
  pass(inner.over > 0, `it scrolls inside, there is more below (${inner.over} px)`);
  pass(inner.chooser <= inner.h, 'the file row is visible without scrolling');
  await x.p.screenshot({ path: 'importcolumns-phone-top.png' });
  await x.panel.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await x.p.waitForTimeout(200);
  const reach = await x.panel.evaluate(el => { const bb = el.querySelector('[data-supplier-columns]').getBoundingClientRect(), pb = el.getBoundingClientRect(); return { boxBottom: bb.bottom, panelBottom: pb.bottom, boxTop: bb.top, panelTop: pb.top }; });
  pass(reach.boxBottom <= reach.panelBottom + 1 && reach.boxTop >= reach.panelTop, 'scrolled down, the whole box is on screen');
  pass(await x.p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth) <= 0, 'no sideways scroll');
  await x.p.screenshot({ path: 'importcolumns-phone.png' });
  pass(x.p._errors.length === 0, 'no page errors ' + x.p._errors.join('|'));
  await x.ctx.close();

  console.log('== a short laptop screen (1280 x 700)');
  x = await open({ width: 1280, height: 700 });
  b = await x.panel.boundingBox();
  pass(b.y + b.height <= 700, `ends on the screen (bottom ${Math.round(b.y + b.height)} of 700)`);
  const lap = await x.panel.evaluate(el => ({ over: el.scrollHeight - el.clientHeight, chooser: el.querySelector('label').getBoundingClientRect().bottom, bottom: el.getBoundingClientRect().bottom }));
  pass(lap.over > 0 && lap.chooser <= lap.bottom, `scrolls inside and the file row stays in view (${lap.over} px more)`);
  await x.ctx.close();

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
