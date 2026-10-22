// Slow network: the sign-in page on a throttled 3G-like connection. Something readable must appear in a few seconds, and the page must not go blank after that.
const { LAUNCH, APP_URL } = require('./env');
const { chromium } = require('playwright');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  // Slow 3G, as Lighthouse sets it: 400 kbit/s down, 400 ms round trip.
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 });

  console.log('== sign-in page on slow 3G');
  const started = Date.now();
  let firstContent = null;
  let blankSince = null;
  let longestBlank = 0;
  const watch = setInterval(async () => {
    try {
      const text = await p.evaluate(() => (document.body ? document.body.innerText.trim().length : 0));
      const t = Date.now() - started;
      if (text > 0 && firstContent === null) firstContent = t;
      if (firstContent !== null) {
        if (text === 0) blankSince = blankSince ?? t;
        else if (blankSince !== null) { longestBlank = Math.max(longestBlank, t - blankSince); blankSince = null; }
      }
    } catch { /* the page is navigating */ }
  }, 150);

  await p.goto(APP_URL, { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(2500);
  clearInterval(watch);

  console.log(`   first readable content at ${firstContent === null ? 'never' : (firstContent / 1000).toFixed(1) + ' s'}, longest blank stretch afterwards ${(longestBlank / 1000).toFixed(1)} s`);
  pass(firstContent !== null && firstContent < 8000, 'something readable within 8 s on slow 3G');
  pass(longestBlank < 1500, 'the page never goes blank for more than 1.5 s once it has shown text');
  pass(await p.locator('input[autocomplete="username"], input[autocomplete="current-password"]').first().isVisible(), 'the sign-in form is usable at the end');
  await p.screenshot({ path: 'slownet.png' });

  await b.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
