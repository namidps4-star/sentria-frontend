// The SentrIA mark: the five public files are the locked logo (lime dome, white bowl, ink tile for icons),
// the sidebar and the sign-in screen draw it, and the page head points at the icons.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { mockSupabase, session, STORAGE_KEY } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const png = buf => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

(async () => {
  const browser = await chromium.launch(LAUNCH);

  console.log('== the public files');
  { const ctx = await browser.newContext(); const get = async path => { const r = await ctx.request.get(APP_URL + path); return { r, b: await r.body() }; };
    for (const [path, size] of [['/logo-mark.png', 1024], ['/apple-icon.png', 180], ['/icon-light-32x32.png', 32], ['/icon-dark-32x32.png', 32]]) {
      const { r, b } = await get(path); const d = png(b);
      pass(r.status() === 200 && /image\/png/.test(r.headers()['content-type']) && d.w === size && d.h === size, `${path} is a ${size} px PNG`); }
    const { r, b } = await get('/icon.svg'); const svg = b.toString();
    pass(r.status() === 200 && /svg/.test(r.headers()['content-type']), '/icon.svg is served as SVG');
    pass(/#141414/i.test(svg) && /#D6FF3F/i.test(svg) && /#FFFFFF/i.test(svg), 'icon.svg is the new mark (ink tile, lime dome, white bowl)');
    pass(!/prefers-color-scheme/.test(svg), 'icon.svg no longer swaps colours with the theme');
    await ctx.close(); }

  console.log('== the mark itself has a lime dome and a white bowl');
  { const ctx = await browser.newContext(); const p = await ctx.newPage(); await p.goto(APP_URL + '/logo-mark.png');
    const s = await p.evaluate(async () => { const img = document.images[0]; await img.decode(); const c = document.createElement('canvas'); c.width = c.height = 256;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, 256, 256); const d = x.getImageData(0, 0, 256, 256).data; let lime = 0, white = 0, op = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; op++; if (d[i] > 190 && d[i + 1] > 240 && d[i + 2] < 130) lime++; else if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) white++; }
      return { lime: lime / op, white: white / op }; });
    pass(s.lime > 0.3 && s.white > 0.25, `lime ${Math.round(s.lime * 100)}% and white ${Math.round(s.white * 100)}% of the mark`);
    await ctx.close(); }

  const open = async ({ theme, vw, signed }) => {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: 'en-US' });
    const p = await ctx.newPage(); p._errs = []; p.on('pageerror', e => p._errs.push(e.message));
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('/alerts') ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', sentria_company_name: 'Acme', sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_language: 'en', sentria_theme: theme });
    if (signed) { const db = { users: { 'ama@acme.test': { uid: 'u-1', password: 'x' } }, accounts: {} };
      await mockSupabase(p, db, { profileFromPage: true, plan: 'pro' });
      await p.addInitScript(({ key, s }) => { localStorage.setItem(key, JSON.stringify(s)); localStorage.setItem('sentria_account_owner', 'u-1'); }, { key: STORAGE_KEY, s: session('u-1', 'ama@acme.test', {}) }); }
    else { await mockSupabase(p, { users: {}, accounts: {} }, {}); }
    await p.goto(APP_URL); await p.waitForTimeout(2200);
    if (signed && vw < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click(); await p.waitForTimeout(500); }
    return { p, ctx }; };

  const drawn = img => img.evaluate(e => e.complete && e.naturalWidth === 1024 && e.getBoundingClientRect().width > 0);
  for (const [theme, vw] of [['light', 1440], ['dark', 1440], ['light', 390]]) {
    console.log(`== signed in: the sidebar draws the mark (${theme}, ${vw}px)`);
    { const { p, ctx } = await open({ theme, vw, signed: true });
      const img = p.locator('aside img[src="/logo-mark.png"]').first();
      pass(await img.count() === 1 && await drawn(img), 'the sidebar image is the 1024 px mark and is drawn');
      const bb = await img.boundingBox(); pass(bb && Math.round(bb.width) === 32 && Math.round(bb.height) === 32, 'at 32 px');
      pass(/SentrIA/.test(await p.locator('aside').first().innerText()), 'the SentrIA name is next to it');
      await p.locator('aside').first().screenshot({ path: `logo-sidebar-${theme}-${vw}.png` });
      pass(p._errs.length === 0, 'no page errors' + (p._errs.length ? ': ' + p._errs[0] : ''));
      await ctx.close(); }
    console.log(`== signed out: the sign-in screen draws the mark (${theme}, ${vw}px)`);
    { const { p, ctx } = await open({ theme, vw, signed: false });
      const img = p.locator('img[src="/logo-mark.png"]').first();
      pass(await img.count() === 1 && await drawn(img), 'the sign-in image is the 1024 px mark and is drawn');
      await p.screenshot({ path: `logo-signin-${theme}-${vw}.png` });
      pass(p._errs.length === 0, 'no page errors' + (p._errs.length ? ': ' + p._errs[0] : ''));
      await ctx.close(); }
  }

  console.log('== the page head points at the icons');
  { const { p, ctx } = await open({ theme: 'light', vw: 1440, signed: false });
    const links = await p.evaluate(() => [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')].map(l => l.getAttribute('href')));
    pass(['/icon-light-32x32.png', '/icon-dark-32x32.png', '/icon.svg', '/apple-icon.png'].every(h => links.some(l => l && l.includes(h.replace('.png', '').replace('.svg', '')))), 'icon links: ' + links.join(', '));
    await ctx.close(); }

  await browser.close(); console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);
})();
