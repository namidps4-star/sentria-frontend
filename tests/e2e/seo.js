// Search indexing: this is the signed-in app, so it says noindex. The server HTML of "/" still carries the pitch (h1, both languages, sectors), the
// metadata (canonical, social card, JSON-LD) and robots.txt / sitemap.xml are served. The text for
// crawlers leaves the page once it runs in a browser: the sign-in screen looks the same, in light, dark and 390 px.
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };

(async () => {
  const html = await (await fetch(APP_URL + '/')).text();
  console.log('== the server HTML');
  pass(/<h1[^>]*>Voyez les problèmes avant qu(?:'|&#x27;)ils ne coûtent\.<\/h1>/.test(html), 'French h1 is in the server HTML');
  pass(/<h1[^>]*>See problems before they cost you\.<\/h1>/.test(html), 'English h1 is in the server HTML');
  pass(/lang="en"/.test(html) && /Real-time alerts/.test(html), 'the English block is marked lang="en"');
  pass(['Logistique', 'Santé', 'Énergie', 'Commerce'].every(s => html.includes(s)), 'the sectors are listed');
  pass(/<link rel="canonical" href="https?:\/\/[^"]+"/.test(html), 'canonical link');
  pass(/property="og:title"/.test(html) && /property="og:image"/.test(html), 'Open Graph title and image');
  pass(/name="twitter:card" content="summary_large_image"/.test(html), 'Twitter card');
  pass(/name="robots" content="noindex, nofollow"/.test(html), 'robots meta says noindex: the app is not for search, the landing is');
  const ld = (html.match(/<script type="application\/ld\+json">(.*?)<\/script>/) || [])[1];
  let graph = []; try { graph = JSON.parse(ld)['@graph']; } catch {}
  pass(graph.some(n => n['@type'] === 'Organization') && graph.some(n => n['@type'] === 'SoftwareApplication'), 'JSON-LD names the organization and the application');

  console.log('== robots, sitemap, share card');
  const robots = await (await fetch(APP_URL + '/robots.txt')).text();
  pass(/Allow: \//.test(robots) && /Disallow: \/t\//.test(robots) && !/Sitemap:/i.test(robots), 'robots.txt lets Google read the noindex, blocks /t/, names no sitemap');
  pass((await fetch(APP_URL + '/sitemap.xml')).status === 404, 'the app has no sitemap (the landing owns it)');
  const og = await fetch(APP_URL + '/opengraph-image');
  pass(og.status === 200 && /image\/png/.test(og.headers.get('content-type') || ''), 'the share card is a PNG');

  console.log('== nothing changes for people');
  const b = await chromium.launch(LAUNCH);
  for (const [name, scheme, vw] of [['light', 'light', 1440], ['dark', 'dark', 1440], ['phone', 'light', 390]]) {
    const ctx = await b.newContext({ viewport: { width: vw, height: 844 }, colorScheme: scheme });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(APP_URL, { waitUntil: 'networkidle' });
    pass(await p.locator('h1', { hasText: 'See problems before they cost you.' }).count() <= 1, `${name}: once loaded, the crawler text is gone (a screen reader does not hear it twice)`);
    pass(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${name}: no sideways scroll`);
    pass(errs.length === 0, `${name}: no page errors ` + errs.join('|'));
    await p.screenshot({ path: `seo-${name}.png` });
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
