// The 404 page, the empty board, and the cache header on pictures.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

(async () => {
  const b = await chromium.launch(LAUNCH);
  console.log('== 404');
  for (const [lang, h1, back] of [['en', 'This page is not here.', 'Back to the dashboard'], ['fr', "Cette page n'existe pas.", 'Retour au tableau de bord']]) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await p.addInitScript(l => localStorage.setItem('sentria_language', l), lang);
    const res = await p.goto(APP_URL + '/no-such-page');
    await p.waitForTimeout(800);
    pass(res.status() === 404, `${lang}: the status is 404`);
    pass(await p.getByRole('heading', { name: h1 }).isVisible(), `${lang}: the heading is in ${lang}`);
    const link = p.getByRole('link', { name: back });
    pass(await link.isVisible() && await link.getAttribute('href') === '/', `${lang}: a way back to the dashboard`);
    pass(await p.locator('meta[name=robots]').first().getAttribute('content').then(c => /noindex/.test(c || '')).catch(() => false), `${lang}: not indexed`);
    if (lang === 'en') await p.screenshot({ path: 'status-404.png' });
    await p.close();
  }
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  await p.goto(APP_URL + '/no-such-page'); await p.waitForTimeout(800);
  pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '390 px: no sideways scroll');
  await p.screenshot({ path: 'status-404-390.png' });
  await p.close();

  console.log('== headers');
  const r = await fetch(APP_URL + '/logo-mark.png');
  pass(/max-age=86400/.test(r.headers.get('cache-control') || ''), 'pictures in public/ carry a cache header: ' + r.headers.get('cache-control'));
  pass(r.headers.get('x-content-type-options') === 'nosniff', 'the security headers are still there');
  const page = await fetch(APP_URL + '/');
  pass(!/max-age=86400/.test(page.headers.get('cache-control') || ''), 'the app page itself is not cached for a day');

  await b.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
