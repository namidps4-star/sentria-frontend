// The status bubble at the foot of the sidebar: it says how fresh the data is, warns when a sector went
// quiet, and claims nothing when the stamps cannot tell. It is on screen at every window height.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const stamp = h => ({ freshness: [{ sector: 'health', scope: 'pharmacie', last_upload_at: new Date(Date.now() - h * 3600e3).toISOString(), age_days: Math.floor(h / 24), stale: h / 24 > 7, rows_processed: 10, alerts_fired: 1 }], persisted: true, stale_after_days: 7 });

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async ({ state = 'fresh', vw = 1440, vh = 900, lang = 'en', theme = 'light' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
    const p = await ctx.newPage(); p._errors = []; p.on('pageerror', e => p._errors.push(e.message));
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.route(/\/recommendations/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"recommendations":[]}' }));
    await p.route(/\/(contractors|assignments)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"contractors":[],"assignments":[]}' }));
    await p.route(/\/freshness/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state === 'fresh' ? stamp(3) : state === 'stale' ? stamp(12 * 24) : { freshness: [], persisted: false, stale_after_days: 7 }) }));
    await p.addInitScript(([l, t]) => { const s = { sentria_onboarded: '1', sentria_sector: 'health', sentria_sectors: '["health"]', sentria_business_type: 'pharmacie', sentria_language: l, sentria_company_name: 'Acme', sentria_theme: t }; for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, [lang, theme]);
    await signedIn(p, 'u', 'a@b.c', { plan: 'entreprise' }); await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    if (vw < 1024) { await p.getByRole('button', { name: /menu/i }).first().click(); await p.waitForTimeout(500); }
    return { p, ctx, bubble: p.getByTestId('sentria-status').locator('visible=true').first() };
  };
  const inView = (p, loc) => loc.evaluate(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight; });

  console.log('== fresh data');
  let x = await open();
  let t = (await x.bubble.innerText()).replace(/\s+/g, ' ');
  pass(/SentrIA is watching/.test(t) && /Data updated 3 h ago/.test(t), 'fresh: "' + t + '"');
  pass(await x.bubble.getAttribute('data-look') === 'fresh', 'look = fresh');
  pass(!/Intelligence online/.test(await x.p.locator('aside').innerText()), 'the old "Intelligence online" claim is gone');
  await x.p.screenshot({ path: 'sentriastatus-light.png' });
  pass(x.p._errors.length === 0, 'no page errors ' + x.p._errors.join('|'));
  await x.ctx.close();

  console.log('== old data, and data we cannot date');
  x = await open({ state: 'stale' });
  t = (await x.bubble.innerText()).replace(/\s+/g, ' ');
  pass(/Data is 12 days old/.test(t) && /Upload a new file/.test(t) && await x.bubble.getAttribute('data-look') === 'stale', 'stale: "' + t + '"');
  await x.p.screenshot({ path: 'sentriastatus-stale.png' });
  await x.ctx.close();
  x = await open({ state: 'unknown' });
  t = (await x.bubble.innerText()).replace(/\s+/g, ' ');
  pass(/Data age unknown/.test(t) && !/watching|updated|online/i.test(t) && await x.bubble.getAttribute('data-look') === 'unknown', 'unknown: claims nothing: "' + t + '"');
  await x.ctx.close();

  console.log('== on screen at every height');
  for (const vh of [640, 700, 760, 900, 1080]) {
    x = await open({ vh });
    pass(await inView(x.p, x.bubble), `${vh} px tall: the bubble is on screen`);
    pass(await inView(x.p, x.p.getByRole('button', { name: /sign out/i }).first()), `${vh} px tall: Sign out still fits`);
    await x.ctx.close();
  }

  console.log('== French, dark, phone');
  x = await open({ lang: 'fr' });
  t = (await x.bubble.innerText()).replace(/\s+/g, ' ');
  pass(/SentrIA surveille/.test(t) && /Données mises à jour il y a 3 h/.test(t), 'in French: ' + t);
  await x.ctx.close();
  x = await open({ theme: 'dark' });
  await x.p.screenshot({ path: 'sentriastatus-dark.png' });
  await x.ctx.close();
  x = await open({ vw: 390, vh: 844 });
  pass(await inView(x.p, x.bubble), 'on a phone the drawer shows the bubble');
  await x.p.screenshot({ path: 'sentriastatus-phone.png' });
  await x.ctx.close();

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
