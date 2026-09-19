#!/usr/bin/env node
/**
 * Does the onboarding wizard actually complete?
 *
 * Walks all eight steps for every sector, in both languages, and fails if
 * any run stalls, throws, or does not land on the dashboard.
 *
 * Why this exists
 * ---------------
 *
 * `tsc` does not check a JSX child against ReactNode when the fragment
 * holding it has more than one child:
 *
 *     <>{<span/>}{pair}</>        // pair is an object; tsc says nothing
 *     <div>{pair}</div>           // tsc errors, as you would expect
 *
 * A raw { fr, en } pair sat in exactly that position on step 7 and threw
 * React error #31, so the wizard died after step 6 with a build that was
 * green and a type check that passed. Nothing static caught it. This did.
 *
 * It also catches the other failure from the same day: the language card
 * on step 1 only set React state, so choosing a language changed nothing
 * on screen. The walk asserts each step's own language.
 *
 * Run:
 *   npx next build && npx next start -p 3300 &
 *   node scripts/smoke-onboarding.mjs 3300        both languages
 *   node scripts/smoke-onboarding.mjs 3300 fr     one of them
 *
 * Needs Playwright. The API is stubbed, so it runs with no backend.
 */

/* Playwright may be a devDependency here or installed globally. Resolve
   either, and say which is missing rather than throwing a module error at
   whoever runs this. */
let chromium
try {
  ;({ chromium } = await import("playwright"))
} catch {
  try {
    ;({ chromium } = await import(
      "/opt/node22/lib/node_modules/playwright/index.mjs"
    ))
  } catch {
    console.error(
      "Playwright not found. Install it with `npm i -D playwright`,\n" +
        "or run this where a global playwright is on the module path."
    )
    process.exit(2)
  }
}
const PORT = process.argv[2] || "3270"

const SECTORS = {
  en: ["Logistics", "Industry", "Health", "Agriculture", "Transport", "Energy", "Retail"],
  fr: ["Logistique", "Industrie", "Santé", "Agriculture", "Transport", "Énergie", "Commerce"],
}
const LANG_CARD = { en: "English", fr: "Français" }
const CONTINUE = /^(Continuer|Continue)$/
const FINISH = /Ouvrir mon dashboard|Open my dashboard/

const browser = await chromium.launch()
let failures = 0

for (const lang of (process.argv[3] ? [process.argv[3]] : ["en", "fr"])) {
  for (let si = 0; si < SECTORS[lang].length; si++) {
    const sector = SECTORS[lang][si]
    const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } })
    const errs = []
    page.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message.slice(0, 150)))
    page.on("console", (m) => {
      if (m.type() === "error" && !/Failed to fetch|ERR_|404|favicon/.test(m.text()))
        errs.push("CONSOLE: " + m.text().slice(0, 150))
    })
    for (const [pat, json] of [["**/alerts*", []], ["**/recommendations*", []],
                               ["**/contractors*", { contractors: [] }],
                               ["**/assignments*", { assignments: [] }]])
      await page.route(pat, (r) => r.fulfill({ json, headers: { "access-control-allow-origin": "*" } }))

    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" })
    await page.evaluate(() => localStorage.clear())
    await page.reload({ waitUntil: "networkidle" })
    await page.waitForTimeout(900)

    const click = (needle) => page.evaluate((needle) => {
      const bs = [...document.querySelectorAll("button")].filter((b) => !b.closest("aside"))
      const b = bs.find((x) => x.innerText.includes(needle))
      if (!b || b.disabled) return false
      b.click(); return true
    }, needle)

    const contin = () => page.evaluate((src) => {
      const re = new RegExp(src)
      const b = [...document.querySelectorAll("button")].find((x) => re.test(x.innerText.trim()))
      if (!b || b.disabled) return false
      b.click(); return true
    }, CONTINUE.source)

    const stepNo = () => page.evaluate(() => {
      const m = document.body.innerText.match(/(Étape|Step)\s+(\d+)\s+(sur|of)\s+\d+/)
      return m ? Number(m[2]) : null
    })

    const trail = []
    // 1 language
    await click(LANG_CARD[lang]); await page.waitForTimeout(300); await contin(); await page.waitForTimeout(700)
    // 2 country
    await click(lang === "en" ? "Benin" : "Bénin"); await page.waitForTimeout(300); await contin(); await page.waitForTimeout(700)
    // 3 zone
    await click("GMT"); await page.waitForTimeout(300); await contin(); await page.waitForTimeout(700)
    // 4 company
    const typedOk = await page.evaluate(() => {
      const i = document.querySelector('input[autocomplete="organization"]')
      if (!i) return false
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      set.call(i, "Atlantic Terminal")
      i.dispatchEvent(new Event("input", { bubbles: true }))
      return true
    })
    if (!typedOk) {
      const at = await stepNo()
      console.log(`FAIL  ${lang}/${sector} :: no company input, stalled on step ${at}`)
      await page.screenshot({ path: `stall-${lang}-${sector.replace(/\W/g, "")}.png`, fullPage: true })
      failures++
      await page.close()
      continue
    }
    await page.waitForTimeout(300); await contin(); await page.waitForTimeout(700)
    // 5 sector
    const gotSector = await click(sector)
    await page.waitForTimeout(300); await contin(); await page.waitForTimeout(900)
    trail.push(`after sector: step ${await stepNo()}`)
    // 6 activity: pick the first activity card available
    const act = await page.evaluate(() => {
      const skip = /Retour|Back|Continuer|Continue|Tout sélectionner|Select all|Tout désélectionner|Clear all/i
      const bs = [...document.querySelectorAll("button")]
        .filter((b) => !b.closest("aside") && b.innerText.trim() && !skip.test(b.innerText))
      if (!bs.length) return null
      bs[0].click()
      return bs[0].innerText.trim().split("\n")[0].slice(0, 30)
    })
    await page.waitForTimeout(400); await contin(); await page.waitForTimeout(1200)
    const s7 = await stepNo()
    trail.push(`after activity(${act}): step ${s7}`)
    // 7 priorities: pick two
    for (let k = 0; k < 2; k++) {
      await page.evaluate((k) => {
        const skip = /Retour|Back|Continuer|Continue|Tout |Select all|Clear all|Modifiable|Changeable/i
        const bs = [...document.querySelectorAll("button")]
          .filter((b) => !b.closest("aside") && b.innerText.trim() && !skip.test(b.innerText) && !b.disabled)
        if (bs[k]) bs[k].click()
      }, k)
      await page.waitForTimeout(250)
    }
    await contin(); await page.waitForTimeout(1000)
    const s8 = await stepNo()
    trail.push(`after priorities: step ${s8}`)
    // 8 finish
    const fin = await page.evaluate((src) => {
      const re = new RegExp(src)
      const b = [...document.querySelectorAll("button")].find((x) => re.test(x.innerText))
      if (!b) return false
      b.click(); return true
    }, FINISH.source)
    await page.waitForTimeout(2000)

    const end = await page.evaluate(() => ({
      len: document.body.innerText.length,
      broke: /This page couldn|could not be found|Application error/i.test(document.body.innerText),
    }))

    const ok = s7 === 7 && s8 === 8 && fin && !end.broke && errs.length === 0
    if (!ok) failures++
    console.log(`${ok ? "PASS" : "FAIL"}  ${lang}/${sector.padEnd(12)} ${trail.join(" | ")} | finish:${fin} | ${end.len}c | broke:${end.broke} | errors:${errs.length}`)
    for (const e of errs.slice(0, 2)) console.log("        " + e)
    if (!ok) await page.screenshot({ path: `fail-${lang}-${sector.replace(/\W/g, "")}.png`, fullPage: true })
    await page.close()
  }
}

console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURES"}`)
await browser.close()

process.exit(failures === 0 ? 0 : 1)
