// The site page wears the app's UI: black squircle banner, lime / white / black tiles, squircle cards,
// and the same gradient glyph tiles as the site menu for the sectors and the data sources.
// Light, dark and 390 px. Screenshots go to E2E_SHOTS (default: the working directory).
const { chromium } = require('playwright');
const { LAUNCH, APP_URL } = require('./env');
const { signedIn } = require('./auth-mock');
const path = require('path');
const SHOTS = process.env.E2E_SHOTS || '.';
let fails = 0;
const pass = (ok, l) => { fails += !ok; console.log(`   ${ok ? 'PASS' : 'FAIL'} ${l}`); };
const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

(async () => {
  const browser = await chromium.launch(LAUNCH);
  for (const [name, theme, vw] of [['light', 'light', 1440], ['dark', 'dark', 1440], ['phone', 'light', 390]]) {
    console.log(`== ${name}`);
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, locale: 'en-US' });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route(/onrender\.com\//, r => json(r, { recommendations: [], assignments: [], contractors: [] }));
    await p.route(/\/alerts(\?|$)/, r => json(r, []));
    await p.addInitScript(ls => { if (!sessionStorage.x) { sessionStorage.x = 1; localStorage.clear(); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } },
      { sentria_onboarded: 'true', sentria_company_name: 'Atlantis', sentria_sector: 'industry', sentria_sectors: '["industry"]', sentria_language: 'en', sentria_theme: theme });
    await signedIn(p, 'u-test', 'jean@sentria.app', { plan: 'business', username: 'jean', meta: { full_name: 'Jean Kokou', name: 'Jean Kokou' } });
    await p.goto(APP_URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(3000);
    if (vw < 768) { await p.getByRole('button', { name: /open.*(menu|navigation)/i }).first().click(); await p.waitForTimeout(400); }
    await p.getByRole('button', { name: /^Sites$/ }).first().click(); await p.waitForTimeout(600);
    await p.getByRole('button', { name: 'Add a site' }).locator('visible=true').first().click(); await p.waitForTimeout(300);
    await p.getByPlaceholder('e.g. Lyon plant').fill('Atlantis Central Pharmacy');
    await p.getByRole('button', { name: 'Create the site' }).click(); await p.waitForTimeout(1500);

    const info = await p.evaluate(() => {
      const h = [...document.querySelectorAll('h2')].find(e => e.textContent.includes('Atlantis Central Pharmacy'));
      const banner = h && h.closest('.squircle');
      const cs = el => el && getComputedStyle(el);
      // computed colours can come back as lab(): paint one pixel to get plain rgb
      const cv = document.createElement('canvas'); cv.width = cv.height = 1;
      const c2 = cv.getContext('2d', { willReadFrequently: true });
      const toRgb = col => { c2.clearRect(0, 0, 1, 1); c2.fillStyle = '#000'; c2.fillStyle = col; c2.fillRect(0, 0, 1, 1); const d = c2.getImageData(0, 0, 1, 1).data; return `rgb(${d[0]}, ${d[1]}, ${d[2]})`; };
      const tiles = [...document.querySelectorAll('[class*="grid-cols-[1.15fr_1fr_1fr]"] > .squircle')];
      const configure = document.querySelector('[data-testid="site-open-dashboard"]');
      return {
        banner: !!banner, bannerBg: banner && toRgb(cs(banner).backgroundColor), bannerRadius: banner && parseFloat(cs(banner).borderTopLeftRadius),
        tiles: tiles.length, tileBgs: tiles.map(t => toRgb(cs(t).backgroundColor)),
        configureBg: configure && toRgb(cs(configure).backgroundColor),
        healthSpan: !!tiles[0] && tiles[0].classList.contains('lg:row-span-2'),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    pass(info.banner, 'the site banner is a squircle surface');
    pass(info.banner && rgb(info.bannerBg).every(v => v < 60), 'the banner is black: ' + info.bannerBg);
    pass(info.bannerRadius >= 34, 'with a big corner: ' + info.bannerRadius + 'px');
    pass(info.tiles === 4, `four squircle tiles in the bento (${info.tiles})`);
    pass(info.healthSpan && info.tileBgs[0] && (() => { const [r, g, b] = rgb(info.tileBgs[0]); return g > 200 && b < 110; })(), 'the tall health tile is lime');
    pass(info.tileBgs.some(c => { const [r, g, b] = rgb(c); return g > 200 && r > 150 && b < 110; }), 'one tile is lime: ' + info.tileBgs.join(' '));
    pass(info.tileBgs.some(c => rgb(c).every(v => v < 60)), 'one tile is black');
    pass(info.configureBg && (() => { const [r, g, b] = rgb(info.configureBg); return g > 200 && b < 110; })(), 'the main button (Go to dashboard) is lime: ' + info.configureBg);
    pass(!info.overflow, 'nothing scrolls sideways');
    pass(errs.length === 0, 'no page errors ' + errs.join('|'));
    await p.screenshot({ path: path.join(SHOTS, `sitesui-${name}.png`), fullPage: vw < 768 });

    // The list of sites: three cards, each in the app's UI (lime for the active one, then white and black).
    for (const extra of ['Atlantis North', 'Atlantis South']) {
      await p.getByRole('button', { name: 'All sites' }).click(); await p.waitForTimeout(400);
      await p.getByRole('button', { name: 'Add a site' }).locator('visible=true').first().click(); await p.waitForTimeout(300);
      await p.getByPlaceholder('e.g. Lyon plant').fill(extra);
      await p.getByRole('button', { name: 'Create the site' }).click(); await p.waitForTimeout(800);
    }
    await p.getByRole('button', { name: 'All sites' }).click(); await p.waitForTimeout(800);
    const list = await p.evaluate(() => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 1;
      const c2 = cv.getContext('2d', { willReadFrequently: true });
      const toRgb = col => { c2.clearRect(0, 0, 1, 1); c2.fillStyle = '#000'; c2.fillStyle = col; c2.fillRect(0, 0, 1, 1); const d = c2.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
      const cards = [...document.querySelectorAll('main button.group')];
      return { n: cards.length, bgs: cards.map(c => toRgb(getComputedStyle(c).backgroundColor)), radii: cards.map(c => parseFloat(getComputedStyle(c).borderTopLeftRadius)), squircle: cards.every(c => c.classList.contains('squircle')) };
    });
    pass(list.n === 3, `three site cards (${list.n})`);
    pass(list.squircle && list.radii.every(r => r >= 30), 'all squircle with a big corner: ' + list.radii.join(', '));
    pass(list.bgs.some(([r, g, b]) => g > 200 && b < 110), 'the active card is lime');
    pass(list.bgs.some(c => c.every(v => v < 60)), 'one card is black');
    pass(list.bgs.some(c => c.every(v => v > 230)), 'one card is white');
    const stats = await p.evaluate(() => {
      const cards = [...document.querySelectorAll('main button.group')];
      return cards.map(c => {
        const cells = [...c.querySelectorAll('[data-site-stat]')];
        return { n: cells.length, keys: cells.map(x => x.dataset.siteStat).join(','), squircle: cells.every(x => x.classList.contains('squircle')), radius: cells.map(x => parseFloat(getComputedStyle(x).borderTopLeftRadius)), bars: cells.every(x => x.querySelector('[aria-hidden="true"] > div')), tags: cells.every(x => x.querySelector('span')) };
      });
    });
    pass(stats.every(c => c.n === 3 && c.keys === 'assets,warnings,critical'), 'each card has the Assets, Warnings and Critical cells');
    pass(stats.every(c => c.squircle && c.radius.every(r => r >= 24)), 'the cells are squircles with a big corner');
    pass(stats.every(c => c.bars && c.tags), 'each cell has its tag and its bar');
    const tiles = await p.evaluate(() => ({
      sector: [...document.querySelectorAll('main [data-sector-icon]')].map(e => ({ drawn: !!e.querySelector('svg path'), tile: /linear-gradient/.test(getComputedStyle(e).backgroundImage), w: Math.round(e.getBoundingClientRect().width) })),
    }));
    pass(tiles.sector.length >= 4 && tiles.sector.every(t => t.drawn && t.tile), `every sector icon is a drawn glyph on a gradient squircle (${tiles.sector.length}: the active tile, its chip and the cards)`);
    pass(tiles.sector.filter(t => t.w === 46).length === 3, 'the three site cards carry a 46 px tile');
        pass(!(await p.locator('main').evaluate(el => /[\u{1F300}-\u{1FAFF}]/u.test(el.innerText))), 'and no emoji');
    await p.screenshot({ path: path.join(SHOTS, `sitesui-list-${name}.png`), fullPage: vw < 768 });
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nAll passed');
  process.exit(fails ? 1 : 0);
})();
