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

  console.log('== click the bubble: Robo explains');
  x = await open({ state: 'fresh' });
  await x.bubble.click(); await x.p.waitForTimeout(500);
  let pop = x.p.getByTestId('robo-popover');
  t = (await pop.innerText()).replace(/\s+/g, ' ');
  pass(await pop.count() === 1 && await pop.getAttribute('data-mood') === 'fresh', 'a click opens Robo\'s pop-out (fresh)');
  pass(/robo/i.test(t) && /All good, your data is fresh/.test(t) && /Your newest file came in 3 h ago/.test(t) && /more than 7 days/.test(t), 'he says the data is fresh and when the file came in: ' + t.slice(0, 120));
  pass(/Health · Pharmacy/.test(t) && /Rows read\s*10/.test(t) && /Alerts raised\s*1/.test(t), 'with real facts from the stamps');
  pass(!/Upload a file/.test(t) && /Got it/.test(t), 'fresh: only Got it');
  await x.p.screenshot({ path: 'sentriastatus-pop-fresh.png' });
  await x.p.keyboard.press('Escape'); await x.p.waitForTimeout(400);
  pass(await x.p.getByTestId('robo-popover').count() === 0, 'Escape closes it');
  await x.bubble.click(); await x.p.waitForTimeout(400);
  await x.p.mouse.click(900, 300); await x.p.waitForTimeout(400);
  pass(await x.p.getByTestId('robo-popover').count() === 0, 'a click elsewhere closes it');
  await x.ctx.close();

  x = await open({ state: 'stale' });
  await x.bubble.click(); await x.p.waitForTimeout(500);
  pop = x.p.getByTestId('robo-popover');
  t = (await pop.innerText()).replace(/\s+/g, ' ');
  pass(await pop.getAttribute('data-mood') === 'stale' && /Hmm, it has gone quiet/.test(t) && /no new file for 12 days/.test(t) && /a zero is not a measurement/.test(t), 'stale: he says it went quiet, how long, and that a zero is not a measurement');
  pass(/Limit before a warning\s*7 days/.test(t) && /Upload a file/.test(t) && /Not now/.test(t), 'with the limit, Upload a file and Not now');
  await x.p.screenshot({ path: 'sentriastatus-pop-stale.png' });
  await x.p.getByRole('button', { name: 'Not now' }).click(); await x.p.waitForTimeout(400);
  pass(await x.p.getByTestId('robo-popover').count() === 0, 'Not now closes it');
  await x.ctx.close();

  x = await open({ state: 'unknown' });
  await x.bubble.click(); await x.p.waitForTimeout(500);
  t = (await x.p.getByTestId('robo-popover').innerText()).replace(/\s+/g, ' ');
  pass(/I cannot tell yet/.test(t) && /I will not guess/.test(t) && await x.p.getByTestId('robo-facts').count() === 0, 'unknown: he will not guess, and shows no facts');
  await x.p.screenshot({ path: 'sentriastatus-pop-unknown.png' });
  await x.ctx.close();

  console.log('== Upload a file opens the import panel, from another page');
  x = await open({ state: 'stale' });
  await x.p.locator('aside nav button').filter({ hasText: /^Tracking$/ }).first().click(); await x.p.waitForTimeout(1200);
  await x.bubble.click(); await x.p.waitForTimeout(400);
  await x.p.getByTestId('robo-upload').click(); await x.p.waitForTimeout(1500);
  pass(await x.p.locator('#import-panel').isVisible(), 'Upload a file goes to the dashboard and opens the import panel');
  pass(await x.p.getByTestId('robo-popover').count() === 0, 'and the pop-out is closed');
  await x.ctx.close();
  x = await open({ state: 'stale' });
  await x.bubble.click(); await x.p.waitForTimeout(400);
  await x.p.getByTestId('robo-upload').click(); await x.p.waitForTimeout(800);
  pass(await x.p.locator('#import-panel').isVisible(), 'and on the dashboard itself it opens at once');
  pass(x.p._errors.length === 0, 'no page errors ' + x.p._errors.join('|'));
  await x.ctx.close();

  console.log('== French, phone');
  x = await open({ state: 'stale', lang: 'fr' });
  await x.bubble.click(); await x.p.waitForTimeout(500);
  t = (await x.p.getByTestId('robo-popover').innerText()).replace(/\s+/g, ' ');
  pass(/Hmm, c'est devenu silencieux/.test(t) && /Importer un fichier/.test(t) && /Pas maintenant/.test(t), 'in French: ' + t.slice(0, 90));
  await x.ctx.close();
  x = await open({ state: 'stale', vw: 390, vh: 844 });
  await x.bubble.click(); await x.p.waitForTimeout(500);
  const pb = await x.p.getByTestId('robo-popover').boundingBox();
  pass(pb.x >= 0 && pb.x + pb.width <= 390 && pb.y >= 0 && pb.y + pb.height <= 844, 'on a phone the pop-out fits the screen');
  await x.p.screenshot({ path: 'sentriastatus-pop-phone.png' });
  await x.ctx.close();

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
