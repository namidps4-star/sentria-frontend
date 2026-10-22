// Crash reports: nothing is loaded or sent without a DSN and a yes; with both, a crash arrives with no personal data.
// The keyed half needs its own build:
//   NEXT_PUBLIC_SENTRY_DSN=https://testkey@o1.ingest.sentry.io/1 npx next build, then E2E_SENTRY_KEY=1 node errortracking.js
// In the normal build this checks the inert half.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const KEYED = process.env.E2E_SENTRY_KEY === '1';
const LS = { sentria_language: 'en', sentria_onboarded: 'true', sentria_company_name: 'Port A', sentria_sector: 'logistics', sentria_sectors: '["logistics"]', sentria_business_type: 'port-conteneurs', sentria_ops_types: '["port"]', sentria_ops_type: 'port' };

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const open = async (consent) => {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    p._sent = [];
    await p.route(/ingest\.sentry\.io/, r => { p._sent.push(r.request().postData() || ''); r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); });
    await p.route(/onrender\.com\//, r => r.fulfill({ status: 200, contentType: 'application/json', body: new URL(r.request().url()).pathname === '/alerts' ? '[]' : '{"recommendations":[],"assignments":[],"contractors":[]}' }));
    await p.addInitScript(({ ls, consent }) => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v)); if (consent) localStorage.setItem('sentria_analytics_consent', consent); } }, { ls: LS, consent });
    await signedIn(p, 'u', 'a@b.c', { plan: 'business' });
    await p.goto(APP_URL); await p.waitForTimeout(2000);
    return p;
  };
  const crash = p => p.evaluate(() => { setTimeout(() => { throw new Error('boom for ama@port-a.test or +229 01 97 12 34 56'); }, 0); });

  if (!KEYED) {
    console.log('== inert: no DSN in this build');
    const p = await open('granted');
    await crash(p); await p.waitForTimeout(1500);
    pass(p._sent.length === 0, 'a crash sends nothing: there is no DSN');
    pass(await p.getByTestId('analytics-consent').count() === 0, 'and no banner is shown for a feature that is off');
    await p.close();
  } else {
    console.log('== keyed build');
    let p = await open('denied');
    await crash(p); await p.waitForTimeout(1500);
    pass(p._sent.length === 0, 'a "no" to the banner: a crash sends nothing');
    await p.close();

    p = await open(null);
    pass(await p.getByTestId('analytics-consent').isVisible(), 'no answer yet: the banner asks first');
    await crash(p); await p.waitForTimeout(1500);
    pass(p._sent.length === 0, 'and until it is answered nothing is sent');
    await p.getByTestId('analytics-consent').getByRole('button', { name: /accept|yes|agree|oui/i }).first().click().catch(() => {});
    await p.close();

    p = await open('granted');
    await crash(p); await p.waitForTimeout(2500);
    const body = p._sent.join('\n');
    pass(p._sent.length > 0 && /boom/.test(body), 'a "yes": the crash arrives, with its message');
    pass(!/ama@|port-a\.test|2290197|01 97 12/.test(body), 'the email and the phone number in the message are hidden');
    pass(!/Port A|a@b\.c|authorization|cookie/i.test(body), 'no company name, login, header or cookie is in it');
    pass(!/breadcrumbs/.test(body) || /"breadcrumbs":\[\]/.test(body), 'no breadcrumbs');
    await p.close();
  }

  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
