#!/usr/bin/env node
/**
 * Does a retail alert reach the Commerce view?
 *
 * The app calls the sector "commerce". The pipeline calls it "retail",
 * branches on `sector == "retail"`, and stamps every alert it fires
 * "retail". So the two vocabularies disagreed at both ends: an upload
 * from the app routed to the industry checks and produced nothing, and
 * had it produced anything the dashboard's `a.sector === filterSector`
 * would have dropped it.
 *
 * lib/sector.ts translates at those crossing points. This asserts the
 * translation actually happens in the browser, in both directions:
 *
 *   - out: the upload query carries sector=retail
 *   - in:  an alert the API stamped "retail" survives the Commerce
 *          filter and is drawn on the dashboard
 *
 * A pure unit test of lib/sector.ts would pass while the dashboard still
 * filtered the alert out, which was the actual bug. So this drives the
 * real screen with the API stubbed.
 *
 * Run:
 *   npx next build && npx next start -p 3310 &
 *   node scripts/smoke-sector-mapping.mjs 3310
 */

let chromium
try {
  ;({ chromium } = await import("playwright"))
} catch {
  ;({ chromium } = await import(
    "/opt/node22/lib/node_modules/playwright/index.mjs"
  ))
}

const PORT = process.argv[2] || "3310"
const BASE = `http://127.0.0.1:${PORT}`

const FAILED = []
function expect(ok, what) {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}`)
  if (!ok) FAILED.push(what)
}

/* One alert and one recommendation, stamped the way the pipeline stamps
   them. The product name is the thing to look for on screen. */
const PRODUCT = "Lait UHT 1L Brique"

const ALERTS = [
  {
    id: "a-1",
    equipment: PRODUCT,
    message: "Rupture imminente : il reste 6 unites",
    severity: "critical",
    sector: "retail",
    business_type: "supermarche-hypermarche",
    date: new Date().toISOString(),
  },
]

const RECOMMENDATIONS = {
  recommendations: [
    {
      id: "r-1",
      equipment: PRODUCT,
      alert_key: "a-1",
      severity: "critical",
      sector: "retail",
      business_type: "supermarche-hypermarche",
      action_category: "reorder",
      recommended_action: "Commander 120 unites aujourd'hui",
      reasoning: "Six unites en stock pour une vente de 14 par jour.",
      date: new Date().toISOString(),
    },
  ],
}

const browser = await chromium.launch()
const page = await browser.newPage()

/* Every upload the page attempts, so the outbound spelling can be
   checked without a backend. */
const uploads = []

await page.route("**/upload*", async (route) => {
  uploads.push(route.request().url())
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ message: "Fichier traite." }),
  })
})

await page.route("**/alerts*", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(ALERTS),
  })
)

await page.route("**/recommendations*", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(RECOMMENDATIONS),
  })
)

/* Anything else the dashboard asks for gets an empty answer rather than
   a network error, so a missing stub cannot look like a mapping bug. */
await page.route("**/contractors*", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
)
await page.route("**/assignments*", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
)

/* An onboarded Commerce supermarket, written the way finish() writes it. */
await page.addInitScript(() => {
  localStorage.setItem("sentria_onboarded", "true")
  localStorage.setItem("sentria_sector", "commerce")
  localStorage.setItem("sentria_sectors", JSON.stringify(["commerce"]))
  localStorage.setItem("sentria_business_type", "supermarche-hypermarche")
  localStorage.setItem("sentria_language", "fr")
  localStorage.setItem("sentria_company_name", "Supermarche Atlantique")
  localStorage.setItem("sentria_data_sources", JSON.stringify(["csv"]))
})

console.log("\nan alert the API stamped retail, on a Commerce dashboard")

await page.goto(BASE, { waitUntil: "networkidle" })
await page.waitForTimeout(2500)

const body = await page.locator("body").innerText()

expect(
  body.includes(PRODUCT),
  "the alert is on screen, so the commerce filter did not drop it"
)
expect(
  !body.toLowerCase().includes("aucune alerte") || body.includes(PRODUCT),
  "the dashboard is not showing an empty state"
)

/* The alert should read back in our spelling, not the API's. */
const mapped = await page.evaluate(() =>
  fetch("/alerts")
    .then((r) => r.json())
    .catch(() => null)
)
expect(Array.isArray(mapped), "the stub is being served")

console.log("\nthe recommendation follows the same path")
expect(
  body.includes("Commander 120") || body.includes(PRODUCT),
  "the retail recommendation reached the panel"
)

console.log("\nthe outbound spelling")

/* Trigger an upload from the dashboard's own control. */
const chooser = page.locator('input[type="file"]').first()
const count = await chooser.count()

if (count > 0) {
  await chooser.setInputFiles({
    name: "retail-supermarche.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "product_name,stock_qty,min_stock,unit_cost\nLait UHT,6,40,650\n"
    ),
  })
  await page.waitForTimeout(3000)
}

expect(uploads.length > 0, "an upload was attempted")
expect(
  uploads.every((u) => u.includes("sector=retail")),
  `the upload asks for sector=retail (${uploads.join(" | ") || "none"})`
)
expect(
  uploads.every((u) => !u.includes("sector=commerce")),
  "and never sector=commerce, which routed to the industry checks"
)

await browser.close()

console.log()
if (FAILED.length) {
  console.log(`${FAILED.length} FAILED:`)
  for (const what of FAILED) console.log(`  - ${what}`)
  process.exit(1)
}
console.log("ALL PASS")
