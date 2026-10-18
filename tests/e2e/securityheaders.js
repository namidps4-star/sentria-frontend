// S-7: every page carries the security headers, and the app still loads with them.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const res = await p.goto(APP_URL, { waitUntil: 'networkidle' });
  const h = res.headers();
  pass(h['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff');
  pass(h['x-frame-options'] === 'DENY', 'X-Frame-Options: DENY (the app cannot be framed)');
  pass(h['referrer-policy'] === 'strict-origin-when-cross-origin', 'Referrer-Policy is set');
  pass(/camera=\(\)/.test(h['permissions-policy'] || '') && /microphone=\(\)/.test(h['permissions-policy'] || ''), 'Permissions-Policy turns off camera and microphone');
  const asset = await p.evaluate(() => performance.getEntriesByType('resource').find(r => /_next\/static/.test(r.name))?.name);
  if (asset) { const r = await p.request.get(asset); pass(r.headers()['x-content-type-options'] === 'nosniff', 'static files carry it too'); }
  pass(await p.locator('body').innerText().then(t => t.length > 50), 'the page still renders');
  pass(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
