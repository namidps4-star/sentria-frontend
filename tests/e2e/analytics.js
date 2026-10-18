// F-ANALYTICS: product analytics that asks first.
//
// This build has no PostHog key (the normal test build): nothing shows and nothing is sent.
// To run the keyed half, build with NEXT_PUBLIC_POSTHOG_KEY=phc_testkey NEXT_PUBLIC_POSTHOG_HOST=https://ph.test,
// start it, and run this with E2E_ANALYTICS_KEY=1 (and E2E_URL pointing at it).
const zlib = require('zlib');
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
const KEYED = process.env.E2E_ANALYTICS_KEY === '1';
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

const decode = req => {
  const buf = req.postDataBuffer(); if (!buf) return '';
  try { return zlib.gunzipSync(buf).toString('utf8'); } catch { return buf.toString('utf8'); }
};

(async () => {
  const b = await chromium.launch(LAUNCH);
  const open = async ({ vw = 1440, theme = 'light', lang = 'en', consent = null } = {}) => {
    // A normal browser's name and no automation flag: PostHog drops everything from a bot.
    const ctx = await b.newContext({ viewport: { width: vw, height: 900 }, locale: lang === 'fr' ? 'fr-FR' : 'en-US', userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' });
    const p = await ctx.newPage(); p._errs = []; p._ph = []; p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/\/alerts(\?|$)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.route(/\/(recommendations|assignments|contractors)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.route(/^https:\/\/ph\.test\//, r => { p._ph.push({ url: r.request().url(), body: decode(r.request()) }); r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }); });
    await p.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_language: lang, sentria_theme: theme, ...(consent ? { sentria_analytics_consent: consent } : {}) });
    await signedIn(p, 'u-1', 'person@example.test', { plan: 'pro' });
    await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
    return { p, ctx };
  };
  const nav = async (p, name) => { if (p.viewportSize().width < 1024) { const m = p.getByRole('button', { name: /menu/i }).first(); if (await m.count()) { await m.click(); await p.waitForTimeout(300); } } await p.getByRole('button', { name }).first().click(); await p.waitForTimeout(900); };

  if (!KEYED) {
    console.log('== no key in this build: nothing shows, nothing is sent');
    const { p, ctx } = await open();
    pass(await p.getByTestId('analytics-consent').count() === 0, 'no consent banner');
    await nav(p, /^Settings$/);
    pass(await p.getByTestId('analytics-toggle').count() === 0, 'no usage-statistics switch in Settings');
    pass(p._ph.length === 0, 'nothing sent');
    pass(p._errs.length === 0, 'no page errors ' + p._errs.join('|'));
    await ctx.close();
  } else {
    console.log('== asks first');
    { const { p, ctx } = await open();
      pass(await p.getByTestId('analytics-consent').count() === 1, 'the banner is there');
      await p.screenshot({ path: 'analytics-banner-light.png' });
      await nav(p, /^Sites$/); await nav(p, /^Tracking$/);
      pass(p._ph.length === 0, 'before an answer, not one request to PostHog (' + p._ph.length + ')');
      await ctx.close(); }

    console.log('== decline');
    { const { p, ctx } = await open();
      await p.getByTestId('analytics-decline').click(); await p.waitForTimeout(500);
      pass(await p.getByTestId('analytics-consent').count() === 0, 'the banner goes');
      pass(await p.evaluate(() => localStorage.getItem('sentria_analytics_consent')) === 'denied', 'the answer is kept');
      await nav(p, /^Sites$/); await nav(p, /^Tracking$/);
      pass(p._ph.length === 0, 'nothing is sent after a no');
      await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
      pass(await p.getByTestId('analytics-consent').count() === 0 && p._ph.length === 0, 'after a reload: no banner, nothing sent');
      await ctx.close(); }

    console.log('== accept');
    { const { p, ctx } = await open();
      await p.getByTestId('analytics-accept').click(); await p.waitForTimeout(1500);
      await nav(p, /^Sites$/); await nav(p, /^Tracking$/); await p.waitForTimeout(3500);
      const all = p._ph.map(x => x.body).join('\n');
      pass(p._ph.length > 0, 'events are sent to PostHog (' + p._ph.length + ' requests)');
      pass(/view_opened/.test(all) && /"view":"sites"/.test(all) && /"view":"tracking"/.test(all), 'screens opened are counted, by name of the screen only');
      pass(!/person@example\.test|Acme|u-1/.test(all), 'no email, company name or user id in anything sent');
      pass(!/\$autocapture|\$identify|\$snapshot/.test(all), 'no autocapture, no identify, no session recording');
      pass(!p._ph.some(x => /\/s\/|\/e\/\?.*recorder/.test(x.url) && /snapshot/.test(x.body)), 'no replay data');
      await ctx.close(); }

    console.log('== take it back in Settings');
    { const { p, ctx } = await open({ consent: 'granted' });
      await nav(p, /^Settings$/);
      const tog = p.getByTestId('analytics-toggle'); await tog.scrollIntoViewIfNeeded();
      pass(await tog.isChecked(), 'the switch shows a yes');
      await p.screenshot({ path: 'analytics-settings-light.png' });
      await tog.uncheck(); await p.waitForTimeout(800);
      const before = p._ph.length;
      await nav(p, /^Sites$/); await nav(p, /^Tracking$/); await p.waitForTimeout(2500);
      pass(p._ph.length === before, 'after withdrawing, nothing more is sent');
      pass(await p.evaluate(() => localStorage.getItem('sentria_analytics_consent')) === 'denied', 'the withdrawal is kept');
      await ctx.close(); }

    console.log('== French, dark, phone');
    { const { p, ctx } = await open({ lang: 'fr', theme: 'dark' });
      pass(/Mesurer l'usage/.test(await p.getByTestId('analytics-consent').innerText()), 'French text');
      await p.screenshot({ path: 'analytics-banner-dark-fr.png' }); await ctx.close(); }
    { const { p, ctx } = await open({ vw: 390 });
      const box = await p.getByTestId('analytics-consent').boundingBox();
      pass(box && box.x >= 0 && box.x + box.width <= 390, 'the banner fits at 390 px');
      pass(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no sideways scroll');
      await p.screenshot({ path: 'analytics-banner-390.png' }); await ctx.close(); }
  }

  await b.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
